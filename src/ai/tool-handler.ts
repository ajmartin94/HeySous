import type BetterSqlite3 from "better-sqlite3";
import type { createRetrievalService } from "../knowledge/retrieval.js";
import type { createKnowledgeRepository } from "../knowledge/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { PlanEntry, MealType } from "../planning/repository.js";
import { logMeal, getCookingHistory } from "../planning/history.js";
import { getWeekStartDate, DAY_NAMES } from "../planning/date-utils.js";
import type { DrizzleDatabase } from "../db/index.js";
import { knowledgeChangelog } from "../knowledge/schema.js";

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
  chatId: string;
  planRepository?: ReturnType<typeof createPlanRepository>;
  sqlite?: BetterSqlite3.Database;
}) {
  const { retrievalService, knowledgeRepository, db, chatId, planRepository, sqlite } = deps;

  return {
    /**
     * Handle a tool call from Claude's response.
     * Dispatches to the appropriate retrieval service method by tool name.
     *
     * All underlying operations (FTS5 search, SQLite queries) are synchronous
     * via better-sqlite3, so this method is synchronous.
     *
     * @param name - The tool name from Claude's tool_use block
     * @param input - The parsed input object from Claude's tool_use block
     * @returns String result for the tool_result block
     */
    handleToolCall(name: string, input: Record<string, unknown>): string {
      switch (name) {
        case "search_knowledge": {
          const query = input.query as string;
          const limit = input.limit as number | undefined;
          const { results, metrics } = retrievalService.search(
            chatId,
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
          const item = retrievalService.getItem(id, chatId);

          if (!item) {
            return `No item found with ID ${id}`;
          }

          return JSON.stringify({
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content,
            source: item.source,
            tags: item.tags,
          });
        }

        case "save_knowledge": {
          const title = input.title as string;
          const summary = input.summary as string;
          const content = input.content as string;
          const tags = input.tags as string[];

          const item = knowledgeRepository.create(chatId, {
            title,
            summary,
            content,
            tags,
          });

          db.insert(knowledgeChangelog)
            .values({
              knowledgeItemId: item.id,
              chatId,
              action: "create",
              changeDescription: "Created: " + title,
            })
            .run();

          return JSON.stringify({
            message: `Saved "${title}" (ID: ${item.id})`,
            id: item.id,
          });
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

          // Get current item for changelog snapshot
          const previous = knowledgeRepository.getById(id, chatId);
          if (!previous) {
            return JSON.stringify({ error: `No item found with ID ${id}` });
          }

          // Build changes object with only defined fields
          const changes: Record<string, unknown> = {};
          if (title !== undefined) changes.title = title;
          if (summary !== undefined) changes.summary = summary;
          if (content !== undefined) changes.content = content;
          if (tags !== undefined) changes.tags = tags;

          const updated = knowledgeRepository.update(id, chatId, changes);
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
              chatId,
              action: "update",
              changeDescription: description,
              previousContent: previous.content,
            })
            .run();

          return JSON.stringify({
            message: `Updated "${updated.title}" (ID: ${id})`,
            id: updated.id,
          });
        }

        case "delete_knowledge": {
          const id = input.id as number;

          // Get current item for changelog snapshot
          const previous = knowledgeRepository.getById(id, chatId);
          if (!previous) {
            return JSON.stringify({ error: `No item found with ID ${id}` });
          }

          const deleted = knowledgeRepository.delete(id, chatId);
          if (!deleted) {
            return JSON.stringify({ error: `Failed to delete item ${id}` });
          }

          db.insert(knowledgeChangelog)
            .values({
              knowledgeItemId: id,
              chatId,
              action: "delete",
              changeDescription: "Deleted: " + previous.title,
              previousContent: previous.content,
            })
            .run();

          return JSON.stringify({
            message: `Deleted "${previous.title}"`,
            deleted: true,
          });
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

          const plan = planRepository.savePlan(chatId, weekStartDate, entries);

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
            getWeekStartDate();

          const plan = planRepository.getPlan(chatId, weekStartDate);

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
            chatId,
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
            chatId,
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

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };
}
