import type BetterSqlite3 from "better-sqlite3";
import type { createRetrievalService } from "../knowledge/retrieval.js";
import type { createKnowledgeRepository } from "../knowledge/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { PlanEntry, MealType } from "../planning/repository.js";
import type { createGroceryRepository } from "../grocery/repository.js";
import type { createReminderRepository } from "../reminders/repository.js";
import type { createAppFeedbackRepository } from "../app-feedback/repository.js";
import type { Clock } from "../clock.js";
import { formatIsoDate, getTodayInTimezone } from "../clock.js";
import { logMeal, getCookingHistory } from "../planning/history.js";
import { getWeekStartDate, DAY_NAMES } from "../planning/date-utils.js";
import type { DrizzleDatabase } from "../db/index.js";
import { knowledgeChangelog } from "../knowledge/schema.js";
import { searchFts } from "../knowledge/fts.js";
import { fetchAndParseRecipe } from "../knowledge/url-import.js";

/**
 * Create a tool call dispatcher that routes Claude's tool use requests
 * to the knowledge retrieval service and knowledge repository.
 *
 * Tool results are returned as strings (Anthropic API expects string
 * content in tool_result blocks).
 *
 * Factory pattern matches codebase conventions (createDatabase, createClaudeClient).
 */
export function createToolHandler(deps: {
  retrievalService: ReturnType<typeof createRetrievalService>;
  knowledgeRepository: ReturnType<typeof createKnowledgeRepository>;
  db: DrizzleDatabase;
  householdId: string;
  planRepository?: ReturnType<typeof createPlanRepository>;
  sqlite?: BetterSqlite3.Database;
  groceryRepository?: ReturnType<typeof createGroceryRepository>;
  reminderRepository?: ReturnType<typeof createReminderRepository>;
  generateRemindersFn?: (householdId: string) => void;
  appFeedbackRepository?: ReturnType<typeof createAppFeedbackRepository>;
  clock: Clock;
  timezone?: string;
}) {
  const { retrievalService, knowledgeRepository, db, householdId, planRepository, sqlite, groceryRepository, reminderRepository, generateRemindersFn, appFeedbackRepository, clock } = deps;

  return {
    /**
     * Handle a tool call from Claude's response.
     * Dispatches to the appropriate retrieval service method by tool name.
     *
     * Most operations (FTS5 search, SQLite queries) are synchronous via
     * better-sqlite3. The import_from_url case is async (HTTP fetch).
     * The method is async to support both sync and async tool handlers.
     *
     * @param name - The tool name from Claude's tool_use block
     * @param input - The parsed input object from Claude's tool_use block
     * @returns String result for the tool_result block
     */
    async handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
      switch (name) {
        case "search_knowledge": {
          const query = input.query as string;
          const limit = input.limit as number | undefined;
          const { results, metrics } = retrievalService.search(
            householdId,
            query,
            limit,
          );

          const header = `${results.length} results found, ${metrics.tokensUsed} tokens used`;
          const resultData = results.map((r) => ({
            id: r.id,
            title: r.title,
            summary: r.summary,
            relevance: r.relevance,
            tags: r.tags,
          }));

          return JSON.stringify({ message: header, results: resultData });
        }

        case "get_knowledge_item": {
          const id = input.id as number;
          const item = retrievalService.getItem(id, householdId);

          if (!item) {
            return `No item found with ID ${id}`;
          }

          return JSON.stringify({
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content,
            source: item.source,
            sourceUrl: item.sourceUrl,
            tags: item.tags,
          });
        }

        case "save_knowledge": {
          const title = input.title as string;
          const summary = input.summary as string;
          const content = input.content as string;
          const tags = input.tags as string[];
          const skipDedup = input.skip_dedup as boolean | undefined;
          const sourceUrl = input.source_url as string | undefined;

          // Dedup check: search for existing items with similar titles
          if (!skipDedup && sqlite) {
            try {
              const matches = searchFts(sqlite, title, householdId, 3);

              // Check for exact title match (case-insensitive)
              const exactMatch = matches.find(
                (m) => m.title.toLowerCase() === title.toLowerCase()
              );

              if (exactMatch) {
                return JSON.stringify({
                  duplicate_found: true,
                  message: `A knowledge item with a very similar title already exists: "${exactMatch.title}" (ID: ${exactMatch.id}). Ask the user if they want to update the existing item or save as new.`,
                  existing_item: {
                    id: exactMatch.id,
                    title: exactMatch.title,
                    summary: exactMatch.summary,
                  },
                });
              }

              // Check for close FTS match (top result with strong relevance)
              if (matches.length > 0) {
                const topMatch = matches[0];
                // BM25 relevance is returned as positive values (lower = better match).
                // Title-weighted search: a score below 5 suggests strong title overlap.
                if (topMatch.relevance < 5) {
                  return JSON.stringify({
                    duplicate_found: true,
                    message: `Found a similar existing item: "${topMatch.title}" (ID: ${topMatch.id}). Ask the user if they want to update the existing item or save this as a new item.`,
                    existing_item: {
                      id: topMatch.id,
                      title: topMatch.title,
                      summary: topMatch.summary,
                    },
                  });
                }
              }
            } catch {
              // If search fails, proceed with save (dedup is best-effort)
            }
          }

          try {
            const item = knowledgeRepository.create(householdId, {
              title,
              summary,
              content,
              tags,
              sourceUrl,
            });

            db.insert(knowledgeChangelog)
              .values({
                knowledgeItemId: item.id,
                householdId,
                action: "create",
                changeDescription: "Created: " + title,
              })
              .run();

            return JSON.stringify({
              message: `Saved "${title}" (ID: ${item.id})`,
              id: item.id,
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return JSON.stringify({ error: `Failed to save "${title}": ${msg}` });
          }
        }

        case "update_knowledge": {
          const id = input.id as number;
          const title = input.title as string | undefined;
          const summary = input.summary as string | undefined;
          const content = input.content as string | undefined;
          const tags = input.tags as string[] | undefined;
          const changeDescription = input.change_description as
            | string
            | undefined;

          // Validate that at least one substantive field is provided
          if (title === undefined && summary === undefined && content === undefined && tags === undefined) {
            return JSON.stringify({
              error: "No substantive fields provided. Include at least one of: title, summary, content, or tags to update. The change_description field alone is not an update.",
            });
          }

          try {
            // Get current item for changelog snapshot
            const previous = knowledgeRepository.getById(id, householdId);
            if (!previous) {
              return JSON.stringify({ error: `No item found with ID ${id}` });
            }

            // Build changes object with only defined fields
            const changes: Record<string, unknown> = {};
            if (title !== undefined) changes.title = title;
            if (summary !== undefined) changes.summary = summary;
            if (content !== undefined) changes.content = content;
            if (tags !== undefined) changes.tags = tags;

            const updated = knowledgeRepository.update(id, householdId, changes);
            if (!updated) {
              return JSON.stringify({ error: `Failed to update item ${id}` });
            }

            // Build changelog description
            const changedFields = Object.keys(changes);
            const description =
              changeDescription || `Updated fields: ${changedFields.join(", ")}`;

            db.insert(knowledgeChangelog)
              .values({
                knowledgeItemId: id,
                householdId,
                action: "update",
                changeDescription: description,
                previousContent: previous.content,
              })
              .run();

            return JSON.stringify({
              message: `Updated "${updated.title}" (ID: ${id})`,
              id: updated.id,
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return JSON.stringify({ error: `Failed to update item ${id}: ${msg}` });
          }
        }

        case "delete_knowledge": {
          const id = input.id as number;

          try {
            // Get current item for changelog snapshot
            const previous = knowledgeRepository.getById(id, householdId);
            if (!previous) {
              return JSON.stringify({ error: `No item found with ID ${id}` });
            }

            const deleted = knowledgeRepository.delete(id, householdId);
            if (!deleted) {
              return JSON.stringify({ error: `Failed to delete item ${id}` });
            }

            db.insert(knowledgeChangelog)
              .values({
                knowledgeItemId: id,
                householdId,
                action: "delete",
                changeDescription: "Deleted: " + previous.title,
                previousContent: previous.content,
              })
              .run();

            return JSON.stringify({
              message: `Deleted "${previous.title}"`,
              deleted: true,
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return JSON.stringify({ error: `Failed to delete item ${id}: ${msg}` });
          }
        }

        case "save_meal_plan": {
          if (!planRepository) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          const weekStartDate = input.week_start_date as string;
          const rawEntries = input.entries as Array<{
            day: number;
            meal_type?: string;
            recipe_name: string;
            knowledge_item_id?: number;
          }>;

          const entries: PlanEntry[] = rawEntries.map((e) => ({
            day: e.day,
            recipeName: e.recipe_name,
            mealType: (e.meal_type as MealType) ?? "dinner",
            knowledgeItemId: e.knowledge_item_id,
          }));

          const plan = planRepository.savePlan(householdId, weekStartDate, entries);

          return JSON.stringify({
            message: `Saved plan for week of ${weekStartDate}`,
            plan: {
              id: plan.id,
              weekStartDate: plan.weekStartDate,
              entries: plan.entries.map((e) => ({
                day: e.dayOfWeek,
                dayName: DAY_NAMES[e.dayOfWeek] ?? `Day ${e.dayOfWeek}`,
                mealType: e.mealType,
                recipeName: e.recipeName,
                knowledgeItemId: e.knowledgeItemId,
              })),
            },
          });
        }

        case "get_meal_plan": {
          if (!planRepository) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          const weekStartDate =
            (input.week_start_date as string | undefined) ??
            getWeekStartDate(deps.timezone ? getTodayInTimezone(deps.timezone, clock) : undefined);

          const plan = planRepository.getPlan(householdId, weekStartDate);

          if (!plan) {
            return JSON.stringify({
              message: `No plan found for week of ${weekStartDate}`,
            });
          }

          return JSON.stringify({
            plan: {
              id: plan.id,
              weekStartDate: plan.weekStartDate,
              entries: plan.entries.map((e) => ({
                day: e.dayOfWeek,
                dayName: DAY_NAMES[e.dayOfWeek] ?? `Day ${e.dayOfWeek}`,
                mealType: e.mealType,
                recipeName: e.recipeName,
                knowledgeItemId: e.knowledgeItemId,
              })),
            },
          });
        }

        case "log_meal": {
          if (!sqlite) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          const recipeName = input.recipe_name as string;
          const cookedDate = input.cooked_date as string;
          const mealType = input.meal_type as string | undefined;
          const knowledgeItemId = input.knowledge_item_id as
            | number
            | undefined;
          const notes = input.notes as string | undefined;

          logMeal(sqlite, {
            householdId,
            recipeName,
            cookedDate,
            mealType,
            knowledgeItemId,
            notes,
            source: "unplanned",
          });

          return JSON.stringify({
            message: `Logged ${recipeName} for ${cookedDate}`,
          });
        }

        case "get_cooking_history": {
          if (!sqlite) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          const startDate = input.start_date as string | undefined;
          const endDate = input.end_date as string | undefined;

          const history = getCookingHistory(
            sqlite,
            householdId,
            clock,
            startDate,
            endDate,
          );

          return JSON.stringify({
            history: history.map((h) => ({
              recipeName: h.recipeName,
              cookedDate: h.cookedDate,
              mealType: h.mealType,
              source: h.source,
              notes: h.notes,
            })),
          });
        }

        case "save_grocery_list": {
          if (!groceryRepository) {
            return JSON.stringify({ error: "Grocery tools not available" });
          }

          const items = input.items as Array<{
            name: string;
            quantity?: string;
            store: string;
            section: string;
          }>;

          const list = groceryRepository.createList(householdId);
          groceryRepository.addItems(list.id, items);

          return JSON.stringify({
            message: `Grocery list created with ${items.length} items`,
            listId: list.id,
            itemCount: items.length,
          });
        }

        case "update_grocery_list": {
          if (!groceryRepository) {
            return JSON.stringify({ error: "Grocery tools not available" });
          }

          const activeList = groceryRepository.getActiveList(householdId);
          if (!activeList) {
            return JSON.stringify({
              error: "No active grocery list. Use save_grocery_list to create one first.",
            });
          }

          const addItems = input.add_items as
            | Array<{
                name: string;
                quantity?: string;
                store: string;
                section: string;
              }>
            | undefined;
          const removeItemIds = input.remove_item_ids as number[] | undefined;
          const checkItemIds = input.check_item_ids as number[] | undefined;
          const uncheckItemIds = input.uncheck_item_ids as number[] | undefined;

          if (addItems && addItems.length > 0) {
            groceryRepository.addItems(activeList.id, addItems);
          }
          if (removeItemIds && removeItemIds.length > 0) {
            groceryRepository.removeItems(removeItemIds);
          }
          if (checkItemIds && checkItemIds.length > 0) {
            groceryRepository.checkItems(checkItemIds);
          }
          if (uncheckItemIds && uncheckItemIds.length > 0) {
            groceryRepository.uncheckItems(uncheckItemIds);
          }

          const updatedItems = groceryRepository.getListItems(activeList.id);

          return JSON.stringify({
            message: "List updated",
            listId: activeList.id,
            messageId: activeList.messageId,
            items: updatedItems.map((i) => ({
              id: i.id,
              name: i.name,
              quantity: i.quantity,
              store: i.store,
              section: i.section,
              checked: i.checked,
            })),
          });
        }

        case "get_grocery_list": {
          if (!groceryRepository) {
            return JSON.stringify({ error: "Grocery tools not available" });
          }

          const currentList = groceryRepository.getActiveList(householdId);
          if (!currentList) {
            return JSON.stringify({ message: "No active grocery list" });
          }

          const listItems = groceryRepository.getListItems(currentList.id);

          return JSON.stringify({
            listId: currentList.id,
            status: currentList.status,
            items: listItems.map((i) => ({
              id: i.id,
              name: i.name,
              quantity: i.quantity,
              store: i.store,
              section: i.section,
              checked: i.checked,
            })),
          });
        }

        case "get_reminder_settings": {
          if (!reminderRepository) {
            return JSON.stringify({ error: "Reminder tools not available" });
          }

          const settings = reminderRepository.getOrCreateSettings(householdId);

          return JSON.stringify({
            timezone: settings.timezone,
            morningTime: settings.morningTime,
            dinnerTime: settings.dinnerTime,
            morningEnabled: settings.morningEnabled,
            prepAlertsEnabled: settings.prepAlertsEnabled,
            mutedUntil: settings.mutedUntil
              ? settings.mutedUntil.toISOString()
              : null,
          });
        }

        case "update_reminder_settings": {
          if (!reminderRepository) {
            return JSON.stringify({ error: "Reminder tools not available" });
          }

          const updates: Record<string, unknown> = {};

          if (input.timezone !== undefined) {
            updates.timezone = input.timezone as string;
          }
          if (input.morning_time !== undefined) {
            updates.morningTime = input.morning_time as string;
          }
          if (input.dinner_time !== undefined) {
            updates.dinnerTime = input.dinner_time as string;
          }
          if (input.morning_enabled !== undefined) {
            updates.morningEnabled = input.morning_enabled as boolean;
          }
          if (input.prep_alerts_enabled !== undefined) {
            updates.prepAlertsEnabled = input.prep_alerts_enabled as boolean;
          }
          if (input.muted_until !== undefined) {
            const mutedStr = input.muted_until as string;
            if (mutedStr === "") {
              updates.mutedUntil = null;
            } else {
              updates.mutedUntil = new Date(mutedStr + "T23:59:59Z");
            }
          }

          const updated = reminderRepository.upsertSettings(householdId, updates);

          // Regenerate reminders after settings change
          if (generateRemindersFn) {
            generateRemindersFn(householdId);
          }

          return JSON.stringify({
            message: "Settings updated",
            timezone: updated.timezone,
            morningTime: updated.morningTime,
            dinnerTime: updated.dinnerTime,
            morningEnabled: updated.morningEnabled,
            prepAlertsEnabled: updated.prepAlertsEnabled,
            mutedUntil: updated.mutedUntil
              ? updated.mutedUntil.toISOString()
              : null,
          });
        }

        case "regenerate_reminders": {
          if (!reminderRepository || !generateRemindersFn) {
            return JSON.stringify({ error: "Reminder tools not available" });
          }

          generateRemindersFn(householdId);

          return JSON.stringify({
            message: "Reminders regenerated from current meal plans",
          });
        }

        case "record_feedback": {
          const recipeName = input.recipe_name as string;
          const knowledgeItemId = input.knowledge_item_id as number | undefined;
          const sentiment = input.sentiment as string;
          const notes = input.notes as string | undefined;
          const date =
            (input.date as string | undefined) ??
            formatIsoDate(clock.date());

          if (!knowledgeItemId) {
            return JSON.stringify({
              message: `Feedback noted for "${recipeName}" (${sentiment}), but not attached to a stored recipe.`,
            });
          }

          const item = knowledgeRepository.getById(knowledgeItemId, householdId);
          if (!item) {
            return JSON.stringify({
              message: `Feedback noted for "${recipeName}" (${sentiment}), but recipe ID ${knowledgeItemId} not found.`,
            });
          }

          // Append feedback annotation to content
          const annotation = notes
            ? `- ${date} [${sentiment}]: ${notes}`
            : `- ${date} [${sentiment}]`;

          let updatedContent: string;
          const feedbackSectionIndex = item.content.indexOf("\nFeedback:\n");
          if (feedbackSectionIndex !== -1) {
            // Append to existing Feedback section
            updatedContent = item.content + "\n" + annotation;
          } else if (item.content.startsWith("Feedback:\n")) {
            updatedContent = item.content + "\n" + annotation;
          } else {
            // Add new Feedback section
            updatedContent = item.content + "\n\nFeedback:\n" + annotation;
          }

          knowledgeRepository.update(knowledgeItemId, householdId, {
            content: updatedContent,
          });

          db.insert(knowledgeChangelog)
            .values({
              knowledgeItemId,
              householdId,
              action: "update",
              changeDescription: `Feedback annotation added: ${sentiment}`,
              previousContent: item.content,
            })
            .run();

          return JSON.stringify({
            message: `Feedback recorded for "${recipeName}": ${sentiment}${notes ? ` - ${notes}` : ""}`,
            knowledgeItemId,
          });
        }

        case "save_app_feedback": {
          if (!appFeedbackRepository) {
            return JSON.stringify({ error: "App feedback tools not available" });
          }

          const text = input.text as string;
          appFeedbackRepository.saveFeedback({
            householdId,
            userId: householdId,
            text,
            source: "implicit",
          });

          return JSON.stringify({ saved: true });
        }

        case "import_from_url": {
          const url = input.url as string;
          try {
            const result = await fetchAndParseRecipe(url);
            return JSON.stringify(result);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return JSON.stringify({
              success: false,
              error: `Failed to import recipe from URL: ${msg}`,
              suggestion: "Try copy-pasting the recipe text directly instead.",
            });
          }
        }

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };
}
