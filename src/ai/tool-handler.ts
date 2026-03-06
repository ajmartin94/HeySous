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
import { searchFts, searchFtsContent, computeIngredientOverlap, computeContentSimilarity } from "../knowledge/fts.js";
import { fetchAndParseRecipe } from "../knowledge/url-import.js";
import { parseRecipeTotalMinutes, parseTimeToMinutes } from "../reminders/generator.js";
import { logger } from "../logger.js";
import { saveMemory, updateMemory, deleteMemory, getMemoryById } from "../memory/repository.js";
import { searchMemoryFts } from "../memory/fts.js";
import type { MemoryCategory } from "../memory/schema.js";

/** Maximum string lengths for tool inputs */
const MAX_LENGTHS = {
  query: 500,           // search_knowledge query
  title: 200,           // knowledge item title
  summary: 500,         // knowledge item summary
  content: 50_000,      // knowledge item content (recipes can be long)
  tag: 100,             // individual tag
  changeDescription: 500, // changelog description
  recipeName: 200,      // meal plan / log_meal recipe name
  notes: 2000,          // feedback / log_meal notes
  text: 5000,           // app feedback text
  url: 2000,            // import URL
  memoryContent: 2000,  // memory atomic fact
  itemName: 200,        // grocery item name
  quantity: 100,        // grocery item quantity
  store: 100,           // store name
  section: 100,         // section name
  timezone: 50,         // IANA timezone
  time: 5,              // HH:MM format
  date: 10,             // YYYY-MM-DD format
} as const;

const MAX_ENTRIES = {
  tags: 30,               // max tags array length
  mealPlanEntries: 21,    // 7 days x 3 meal types
  groceryItems: 200,      // reasonable grocery list cap
  itemIds: 200,           // check/uncheck/remove IDs
  searchLimit: 20,        // search results limit
} as const;

function validateRequired(value: unknown, field: string, expectedType: "string" | "array" | "number"): string | null {
  if (value === undefined || value === null) {
    return `${field} is required`;
  }
  if (expectedType === "string" && typeof value !== "string") {
    return `${field} must be a string, got ${typeof value}`;
  }
  if (expectedType === "number" && typeof value !== "number") {
    return `${field} must be a number, got ${typeof value}`;
  }
  if (expectedType === "array" && !Array.isArray(value)) {
    return `${field} must be an array, got ${typeof value}`;
  }
  return null;
}

function validateString(value: unknown, field: string, maxLength: number): string | null {
  if (typeof value !== "string") return null; // Let existing type casting handle undefined/null
  if (value.length > maxLength) {
    return `${field} must be at most ${maxLength} characters, got ${value.length}`;
  }
  return null; // valid
}

function validatePositiveInt(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return `${field} must be a positive integer, got ${JSON.stringify(value)}`;
  }
  return null;
}

function validateArray(value: unknown, field: string, maxLength: number): string | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxLength) {
    return `${field} must have at most ${maxLength} items, got ${value.length}`;
  }
  return null;
}

function validateDay(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) {
    return `day must be an integer 0-6 (Mon-Sun), got ${JSON.stringify(value)}`;
  }
  return null;
}

function validationError(msg: string): string {
  return JSON.stringify({ error: msg, is_error: true });
}

/**
 * Validate that a recipe has the required fields: title, ingredients, instructions.
 * Only applies to knowledge items tagged with "recipe".
 * Returns a descriptive error message listing missing fields, or null if valid.
 */
function validateRecipeCompleteness(
  title: string,
  content: string,
  tags: string[],
): string | null {
  // Only validate items tagged as recipes
  if (!tags.some((t) => t.toLowerCase() === "recipe")) return null;

  const missing: string[] = [];

  if (!title || title.trim().length === 0) {
    missing.push("title");
  }

  // Check for ingredients section in content
  // The content format uses "Ingredients:" header followed by list items
  if (!content || !(/ingredients:/i.test(content) && /^- .+/m.test(content.slice(content.search(/ingredients:/i))))) {
    missing.push("ingredients list");
  }

  // Check for instructions/steps section in content
  if (!content || !(/steps:/i.test(content) && /^\d+\.\s+.+/m.test(content.slice(content.search(/steps:/i))))) {
    missing.push("instructions/steps");
  }

  if (missing.length === 0) return null;

  return `Recipe is missing required fields: ${missing.join(", ")}. Please provide the missing information before saving.`;
}

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
          const err = validateRequired(input.query, "query", "string")
            ?? validateString(input.query, "query", MAX_LENGTHS.query)
            ?? (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_ENTRIES.searchLimit)
              ? `limit must be 1-${MAX_ENTRIES.searchLimit}, got ${JSON.stringify(input.limit)}`
              : null);
          if (err) return validationError(err);

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
          const err = validateRequired(input.id, "id", "number")
            ?? validatePositiveInt(input.id, "id");
          if (err) return validationError(err);

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
            version: item.version,
          });
        }

        case "save_knowledge": {
          const err = validateRequired(input.title, "title", "string")
            ?? validateRequired(input.summary, "summary", "string")
            ?? validateRequired(input.content, "content", "string")
            ?? validateRequired(input.tags, "tags", "array")
            ?? validateString(input.title, "title", MAX_LENGTHS.title)
            ?? validateString(input.summary, "summary", MAX_LENGTHS.summary)
            ?? validateString(input.content, "content", MAX_LENGTHS.content)
            ?? validateArray(input.tags, "tags", MAX_ENTRIES.tags)
            ?? (Array.isArray(input.tags)
              ? input.tags.reduce((e: string | null, t: unknown, i: number) => e ?? validateString(t, `tags[${i}]`, MAX_LENGTHS.tag), null as string | null)
              : null)
            ?? validateString(input.source_url, "source_url", MAX_LENGTHS.url)
            ?? validatePositiveInt(input.prep_time, "prep_time")
            ?? validatePositiveInt(input.cook_time, "cook_time")
            ?? validatePositiveInt(input.total_time, "total_time");
          if (err) return validationError(err);

          const title = input.title as string;
          const summary = input.summary as string;
          const content = input.content as string;
          const tags = input.tags as string[];
          const skipDedup = input.skip_dedup as boolean | undefined;
          const sourceUrl = input.source_url as string | undefined;

          // Dedup check: title-based search + content-aware matching
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

              // Content-aware dedup: check ingredient/content overlap
              const isRecipe = tags.some((t) => t.toLowerCase() === "recipe");
              const isPreference = tags.some((t) => t.toLowerCase() === "preference");

              if (isRecipe || isPreference) {
                try {
                  // Build content search query from key terms
                  let contentSearchQuery: string;
                  if (isRecipe) {
                    // Extract 3-5 key ingredient names from content
                    const ingredientLines = content
                      .split("\n")
                      .filter((line) => line.trim().startsWith("- "))
                      .slice(0, 5)
                      .map((line) => line.trim().slice(2).replace(/^[\d\s/.,½¼¾⅓⅔⅛]+\s*(?:cups?|tbsps?|tsps?|tablespoons?|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|ml|cloves?|bunch(?:es)?|packages?|cans?|bags?|heads?|stalks?|pieces?)\s*/i, "").trim());
                    contentSearchQuery = ingredientLines.filter(Boolean).join(" ");
                  } else {
                    // For preferences: use title + first sentence of content
                    const firstSentence = content.split(/[.!?\n]/)[0] ?? "";
                    contentSearchQuery = `${title} ${firstSentence}`.trim();
                  }

                  if (contentSearchQuery) {
                    let contentMatches = searchFtsContent(sqlite, contentSearchQuery, householdId, 5);

                    // Preference tag-based fallback: FTS may miss near-identical preferences
                    // when key tokens differ (e.g. "7:30am" vs "8am"). Search by pref: tag
                    // to find same-category preferences for similarity comparison.
                    if (isPreference && contentMatches.length === 0) {
                      const prefTag = tags.find((t) => t.startsWith("pref:"));
                      if (prefTag) {
                        const tagRows = sqlite
                          .prepare(
                            `SELECT ki.id, ki.title, ki.summary
                             FROM knowledge_items ki
                             JOIN knowledge_tags kt ON ki.id = kt.knowledge_item_id
                             WHERE kt.tag = ? AND ki.household_id = ?
                             LIMIT 10`
                          )
                          .all(prefTag, householdId) as Array<{
                          id: number;
                          title: string;
                          summary: string;
                        }>;
                        contentMatches = tagRows.map((r) => ({
                          ...r,
                          relevance: 0,
                          tags: [],
                          lastAccessedAt: new Date(),
                        }));
                      }
                    }

                    // Check top 3 content matches for overlap
                    for (const match of contentMatches.slice(0, 3)) {
                      const existingItem = retrievalService.getItem(match.id, householdId);
                      if (!existingItem) continue;

                      let overlap: number;
                      if (isRecipe) {
                        overlap = computeIngredientOverlap(content, existingItem.content);
                      } else {
                        overlap = computeContentSimilarity(content, existingItem.content);
                      }

                      const threshold = isPreference ? 0.70 : 0.85;
                      if (overlap > threshold) {
                        return JSON.stringify({
                          duplicate_found: true,
                          message: `Found a similar existing item: "${match.title}" (ID: ${match.id}). Ask the user if they want to update the existing item or save this as a new item.`,
                          existing_item: {
                            id: match.id,
                            title: match.title,
                            summary: match.summary,
                          },
                        });
                      }
                    }
                  }
                } catch {
                  // Content-based dedup is best-effort, fall through to BM25 check
                }
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

          // Recipe completeness validation (DATA-01)
          const recipeError = validateRecipeCompleteness(title, content, tags);
          if (recipeError) {
            return JSON.stringify({
              error: recipeError,
              is_error: true,
              incomplete_recipe: true,
            });
          }

          // Auto-extract time fields for recipes
          let prepTimeMinutes: number | null = (input.prep_time as number | undefined) ?? null;
          let cookTimeMinutes: number | null = (input.cook_time as number | undefined) ?? null;
          let totalTimeMinutes: number | null = (input.total_time as number | undefined) ?? null;

          if (tags.some((t) => t.toLowerCase() === "recipe")) {
            // Parse time from content lines
            const lines = content.split("\n");
            for (const line of lines) {
              const prepMatch = line.match(/^Prep\s*Time:\s*(.+)$/i);
              if (prepMatch && prepTimeMinutes === null) {
                prepTimeMinutes = parseTimeToMinutes(prepMatch[1]);
              }
              const cookMatch = line.match(/^Cook\s*Time:\s*(.+)$/i);
              if (cookMatch && cookTimeMinutes === null) {
                cookTimeMinutes = parseTimeToMinutes(cookMatch[1]);
              }
              const totalMatch = line.match(/^Total\s*Time:\s*(.+)$/i);
              if (totalMatch && totalTimeMinutes === null) {
                totalTimeMinutes = parseTimeToMinutes(totalMatch[1]);
              }
            }

            // Compute total from prep + cook if both known
            if (totalTimeMinutes === null && prepTimeMinutes !== null && cookTimeMinutes !== null) {
              totalTimeMinutes = prepTimeMinutes + cookTimeMinutes;
            }
            // Fall back to parseRecipeTotalMinutes if still null
            if (totalTimeMinutes === null) {
              totalTimeMinutes = parseRecipeTotalMinutes(content);
            }
          }

          try {
            const item = knowledgeRepository.create(householdId, {
              title,
              summary,
              content,
              tags,
              sourceUrl,
              prepTimeMinutes,
              cookTimeMinutes,
              totalTimeMinutes,
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
          const err = validateRequired(input.id, "id", "number")
            ?? validatePositiveInt(input.id, "id")
            ?? validateString(input.title, "title", MAX_LENGTHS.title)
            ?? validateString(input.summary, "summary", MAX_LENGTHS.summary)
            ?? validateString(input.content, "content", MAX_LENGTHS.content)
            ?? validateArray(input.tags, "tags", MAX_ENTRIES.tags)
            ?? (Array.isArray(input.tags)
              ? input.tags.reduce((e: string | null, t: unknown, i: number) => e ?? validateString(t, `tags[${i}]`, MAX_LENGTHS.tag), null as string | null)
              : null)
            ?? validateString(input.change_description, "change_description", MAX_LENGTHS.changeDescription)
            ?? validatePositiveInt(input.prep_time, "prep_time")
            ?? validatePositiveInt(input.cook_time, "cook_time")
            ?? validatePositiveInt(input.total_time, "total_time");
          if (err) return validationError(err);

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
            // Get current item for changelog snapshot (also captures version for locking)
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

            // Auto-extract time fields for recipes when content is being updated
            const effectiveTags = tags ?? previous.tags;
            const effectiveContent = content ?? previous.content;
            if (effectiveTags.some((t) => t.toLowerCase() === "recipe")) {
              let prepTimeMinutes: number | null = (input.prep_time as number | undefined) ?? null;
              let cookTimeMinutes: number | null = (input.cook_time as number | undefined) ?? null;
              let totalTimeMinutes: number | null = (input.total_time as number | undefined) ?? null;

              // Parse time from content lines
              const contentLines = effectiveContent.split("\n");
              for (const line of contentLines) {
                const prepMatch = line.match(/^Prep\s*Time:\s*(.+)$/i);
                if (prepMatch && prepTimeMinutes === null) {
                  prepTimeMinutes = parseTimeToMinutes(prepMatch[1]);
                }
                const cookMatch = line.match(/^Cook\s*Time:\s*(.+)$/i);
                if (cookMatch && cookTimeMinutes === null) {
                  cookTimeMinutes = parseTimeToMinutes(cookMatch[1]);
                }
                const totalMatch = line.match(/^Total\s*Time:\s*(.+)$/i);
                if (totalMatch && totalTimeMinutes === null) {
                  totalTimeMinutes = parseTimeToMinutes(totalMatch[1]);
                }
              }

              // Compute total from prep + cook if both known
              if (totalTimeMinutes === null && prepTimeMinutes !== null && cookTimeMinutes !== null) {
                totalTimeMinutes = prepTimeMinutes + cookTimeMinutes;
              }
              // Fall back to parseRecipeTotalMinutes if still null
              if (totalTimeMinutes === null) {
                totalTimeMinutes = parseRecipeTotalMinutes(effectiveContent);
              }

              if (prepTimeMinutes !== null) changes.prepTimeMinutes = prepTimeMinutes;
              if (cookTimeMinutes !== null) changes.cookTimeMinutes = cookTimeMinutes;
              if (totalTimeMinutes !== null) changes.totalTimeMinutes = totalTimeMinutes;
            }

            const updated = knowledgeRepository.update(id, householdId, changes, {
              expectedVersion: previous.version,
              updatedBy: householdId,
            });
            if (!updated) {
              return JSON.stringify({
                error: "This item was just modified by someone else. Please review the current version (use get_knowledge_item) and try your update again.",
                is_error: true,
                conflict: true,
              });
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
              version: updated.version,
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return JSON.stringify({ error: `Failed to update item ${id}: ${msg}` });
          }
        }

        case "delete_knowledge": {
          const err = validateRequired(input.id, "id", "number")
            ?? validatePositiveInt(input.id, "id");
          if (err) return validationError(err);

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

          {
            const err = validateRequired(input.week_start_date, "week_start_date", "string")
              ?? validateRequired(input.entries, "entries", "array")
              ?? validateString(input.week_start_date, "week_start_date", MAX_LENGTHS.date)
              ?? validateArray(input.entries, "entries", MAX_ENTRIES.mealPlanEntries);
            if (err) return validationError(err);

            // Per-entry validation
            if (Array.isArray(input.entries)) {
              for (let i = 0; i < input.entries.length; i++) {
                const entry = input.entries[i] as Record<string, unknown>;
                const entryErr = validateDay(entry.day)
                  ?? validateString(entry.recipe_name, `entries[${i}].recipe_name`, MAX_LENGTHS.recipeName)
                  ?? validatePositiveInt(entry.knowledge_item_id, `entries[${i}].knowledge_item_id`);
                if (entryErr) return validationError(entryErr);
              }
            }
          }

          const weekStartDate = input.week_start_date as string;
          const rawEntries = input.entries as Array<{
            day: number;
            meal_type?: string;
            recipe_name: string;
            knowledge_item_id?: number;
          }>;

          // Server-side auto-linking: validate provided IDs and auto-link unlinked entries
          const autoLinked: Array<{ recipe_name: string; knowledge_item_id: number; match_title: string }> = [];
          const correctedIds: Array<{ recipe_name: string; provided_id: number; corrected_id: number; match_title: string }> = [];

          const entries: PlanEntry[] = rawEntries.map((e) => {
            let knowledgeItemId = e.knowledge_item_id;

            if (sqlite) {
              // Phase 1: Validate provided knowledge_item_id
              if (knowledgeItemId) {
                try {
                  const exists = sqlite.prepare(
                    "SELECT id FROM knowledge_items WHERE id = ? AND household_id = ?"
                  ).get(knowledgeItemId, householdId) as { id: number } | undefined;
                  if (!exists) {
                    // ID is invalid (wrong household or doesn't exist) -- clear it so auto-link can try
                    const invalidId = knowledgeItemId;
                    knowledgeItemId = undefined;
                    logger.warn({ householdId, recipeName: e.recipe_name, invalidId }, "Invalid knowledge_item_id in save_meal_plan, will attempt auto-link");
                    // We'll track this in correctedIds below if FTS finds a match
                  }
                } catch {
                  // Validation failure is non-blocking
                }
              }

              // Phase 2: Auto-link entries without a (valid) knowledge_item_id
              if (!knowledgeItemId) {
                try {
                  const ftsResults = searchFts(sqlite, e.recipe_name, householdId, 1);
                  if (ftsResults.length > 0) {
                    const topResult = ftsResults[0];
                    // Match if title is an exact case-insensitive match OR relevance score is very strong
                    if (topResult.title.toLowerCase() === e.recipe_name.toLowerCase() || topResult.relevance < 5) {
                      knowledgeItemId = topResult.id;
                      if (e.knowledge_item_id) {
                        correctedIds.push({
                          recipe_name: e.recipe_name,
                          provided_id: e.knowledge_item_id,
                          corrected_id: topResult.id,
                          match_title: topResult.title,
                        });
                      } else {
                        autoLinked.push({
                          recipe_name: e.recipe_name,
                          knowledge_item_id: topResult.id,
                          match_title: topResult.title,
                        });
                      }
                    }
                  }
                } catch {
                  // FTS search failure is non-blocking
                }
              }
            }

            return {
              day: e.day,
              recipeName: e.recipe_name,
              mealType: (e.meal_type as MealType) ?? "dinner",
              knowledgeItemId,
            };
          });

          if (autoLinked.length > 0 || correctedIds.length > 0) {
            logger.info({ householdId, autoLinked, correctedIds }, "Server-side recipe auto-linking applied");
          }

          // Check for existing plan to get version for optimistic locking
          const existingPlan = planRepository.getPlan(householdId, weekStartDate);
          const plan = planRepository.savePlan(householdId, weekStartDate, entries, {
            expectedVersion: existingPlan?.version,
            updatedBy: householdId,
          });

          if (!plan) {
            return JSON.stringify({
              error: "The meal plan for this week was just updated by someone else. Please check the current plan (use get_meal_plan) and try again.",
              is_error: true,
              conflict: true,
            });
          }

          // Regenerate reminders after plan change to avoid stale reminder context
          if (generateRemindersFn) {
            generateRemindersFn(householdId);
          }

          const response: Record<string, unknown> = {
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
              version: plan.version,
            },
          };

          if (autoLinked.length > 0) {
            response.auto_linked = autoLinked;
          }

          return JSON.stringify(response);
        }

        case "get_meal_plan": {
          if (!planRepository) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          {
            const err = validateString(input.week_start_date, "week_start_date", MAX_LENGTHS.date);
            if (err) return validationError(err);
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
              version: plan.version,
            },
          });
        }

        case "log_meal": {
          if (!sqlite) {
            return JSON.stringify({ error: "Plan tools not available" });
          }

          {
            const err = validateRequired(input.recipe_name, "recipe_name", "string")
              ?? validateRequired(input.cooked_date, "cooked_date", "string")
              ?? validateString(input.recipe_name, "recipe_name", MAX_LENGTHS.recipeName)
              ?? validateString(input.cooked_date, "cooked_date", MAX_LENGTHS.date)
              ?? validateString(input.notes, "notes", MAX_LENGTHS.notes)
              ?? validatePositiveInt(input.knowledge_item_id, "knowledge_item_id");
            if (err) return validationError(err);
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

          {
            const err = validateString(input.start_date, "start_date", MAX_LENGTHS.date)
              ?? validateString(input.end_date, "end_date", MAX_LENGTHS.date);
            if (err) return validationError(err);
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

          {
            const err = validateRequired(input.items, "items", "array")
              ?? validateArray(input.items, "items", MAX_ENTRIES.groceryItems);
            if (err) return validationError(err);

            // Per-item validation
            if (Array.isArray(input.items)) {
              for (let i = 0; i < input.items.length; i++) {
                const item = input.items[i] as Record<string, unknown>;
                const itemErr = validateString(item.name, `items[${i}].name`, MAX_LENGTHS.itemName)
                  ?? validateString(item.quantity, `items[${i}].quantity`, MAX_LENGTHS.quantity)
                  ?? validateString(item.store, `items[${i}].store`, MAX_LENGTHS.store)
                  ?? validateString(item.section, `items[${i}].section`, MAX_LENGTHS.section);
                if (itemErr) return validationError(itemErr);
              }
            }
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

          {
            const err = validateArray(input.add_items, "add_items", MAX_ENTRIES.groceryItems)
              ?? validateArray(input.remove_item_ids, "remove_item_ids", MAX_ENTRIES.itemIds)
              ?? validateArray(input.check_item_ids, "check_item_ids", MAX_ENTRIES.itemIds)
              ?? validateArray(input.uncheck_item_ids, "uncheck_item_ids", MAX_ENTRIES.itemIds);
            if (err) return validationError(err);

            // Per-item validation for add_items
            if (Array.isArray(input.add_items)) {
              for (let i = 0; i < input.add_items.length; i++) {
                const item = input.add_items[i] as Record<string, unknown>;
                const itemErr = validateString(item.name, `add_items[${i}].name`, MAX_LENGTHS.itemName)
                  ?? validateString(item.quantity, `add_items[${i}].quantity`, MAX_LENGTHS.quantity)
                  ?? validateString(item.store, `add_items[${i}].store`, MAX_LENGTHS.store)
                  ?? validateString(item.section, `add_items[${i}].section`, MAX_LENGTHS.section);
                if (itemErr) return validationError(itemErr);
              }
            }

            // Per-ID validation for ID arrays
            for (const [arrName, arr] of [
              ["remove_item_ids", input.remove_item_ids],
              ["check_item_ids", input.check_item_ids],
              ["uncheck_item_ids", input.uncheck_item_ids],
            ] as const) {
              if (Array.isArray(arr)) {
                for (let i = 0; i < arr.length; i++) {
                  const idErr = validatePositiveInt(arr[i], `${arrName}[${i}]`);
                  if (idErr) return validationError(idErr);
                }
              }
            }
          }

          // Optimistic locking: check version before writing
          const versionOk = groceryRepository.updateListVersion(activeList.id, activeList.version, householdId);
          if (!versionOk) {
            return JSON.stringify({
              error: "The grocery list was just updated by someone else. Please check the current list (use get_grocery_list) and try again.",
              is_error: true,
              conflict: true,
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

          // Re-read the list to get the new version after our update
          const refreshedList = groceryRepository.getActiveList(householdId);

          return JSON.stringify({
            message: "List updated",
            listId: activeList.id,
            messageId: activeList.messageId,
            version: refreshedList?.version ?? activeList.version + 1,
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
            version: currentList.version,
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

        case "get_settings": {
          if (!reminderRepository) {
            return JSON.stringify({ error: "Reminder tools not available" });
          }

          const settings = reminderRepository.getOrCreateSettings(householdId);

          return JSON.stringify({
            timezone: settings.timezone,
            morningTime: settings.morningTime,
            breakfastTime: settings.breakfastTime,
            lunchTime: settings.lunchTime,
            snackTime: settings.snackTime,
            dinnerTime: settings.dinnerTime,
            dessertTime: settings.dessertTime,
            morningEnabled: settings.morningEnabled,
            prepAlertsEnabled: settings.prepAlertsEnabled,
            mutedUntil: settings.mutedUntil
              ? settings.mutedUntil.toISOString()
              : null,
          });
        }

        case "update_settings": {
          if (!reminderRepository) {
            return JSON.stringify({ error: "Reminder tools not available" });
          }

          {
            const err = validateString(input.timezone, "timezone", MAX_LENGTHS.timezone)
              ?? validateString(input.morning_time, "morning_time", MAX_LENGTHS.time)
              ?? validateString(input.breakfast_time, "breakfast_time", MAX_LENGTHS.time)
              ?? validateString(input.lunch_time, "lunch_time", MAX_LENGTHS.time)
              ?? validateString(input.snack_time, "snack_time", MAX_LENGTHS.time)
              ?? validateString(input.dinner_time, "dinner_time", MAX_LENGTHS.time)
              ?? validateString(input.dessert_time, "dessert_time", MAX_LENGTHS.time)
              ?? validateString(input.muted_until, "muted_until", MAX_LENGTHS.date);
            if (err) return validationError(err);
          }

          const updates: Record<string, unknown> = {};

          if (input.timezone !== undefined) {
            updates.timezone = input.timezone as string;
          }
          if (input.morning_time !== undefined) {
            updates.morningTime = input.morning_time as string;
          }
          if (input.breakfast_time !== undefined) {
            updates.breakfastTime = input.breakfast_time as string;
          }
          if (input.lunch_time !== undefined) {
            updates.lunchTime = input.lunch_time as string;
          }
          if (input.snack_time !== undefined) {
            updates.snackTime = input.snack_time as string;
          }
          if (input.dinner_time !== undefined) {
            updates.dinnerTime = input.dinner_time as string;
          }
          if (input.dessert_time !== undefined) {
            updates.dessertTime = input.dessert_time as string;
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
            breakfastTime: updated.breakfastTime,
            lunchTime: updated.lunchTime,
            snackTime: updated.snackTime,
            dinnerTime: updated.dinnerTime,
            dessertTime: updated.dessertTime,
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
          const err = validateRequired(input.recipe_name, "recipe_name", "string")
            ?? validateRequired(input.sentiment, "sentiment", "string")
            ?? validateString(input.recipe_name, "recipe_name", MAX_LENGTHS.recipeName)
            ?? validatePositiveInt(input.knowledge_item_id, "knowledge_item_id")
            ?? validateString(input.notes, "notes", MAX_LENGTHS.notes)
            ?? validateString(input.date, "date", MAX_LENGTHS.date);
          if (err) return validationError(err);

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

          {
            const err = validateRequired(input.text, "text", "string")
              ?? validateString(input.text, "text", MAX_LENGTHS.text);
            if (err) return validationError(err);
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
          const err = validateRequired(input.url, "url", "string")
            ?? validateString(input.url, "url", MAX_LENGTHS.url);
          if (err) return validationError(err);

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

        case "attach_deep_link": {
          const validTargets = ["recipe", "recipes", "plan", "grocery"];
          const target = input.target as string;

          if (!target || !validTargets.includes(target)) {
            return validationError(`target must be one of: ${validTargets.join(", ")}`);
          }

          if (target === "recipe") {
            const idErr = validateRequired(input.recipe_id, "recipe_id", "number")
              ?? validatePositiveInt(input.recipe_id, "recipe_id");
            if (idErr) return validationError(idErr);
          }

          // Return a marker JSON -- the processor will read this to attach the button
          return JSON.stringify({
            deep_link: true,
            target,
            recipe_id: target === "recipe" ? input.recipe_id : undefined,
          });
        }

        case "save_memory": {
          if (!sqlite) {
            return JSON.stringify({ error: "Memory tools not available" });
          }

          const validCategories = ["dietary", "taste", "cooking_style", "household", "schedule", "logistics", "general"];
          const err = validateRequired(input.content, "content", "string")
            ?? validateRequired(input.category, "category", "string")
            ?? validateString(input.content, "content", MAX_LENGTHS.memoryContent);
          if (err) return validationError(err);

          const content = input.content as string;
          const category = input.category as string;

          if (!validCategories.includes(category)) {
            return validationError(`category must be one of: ${validCategories.join(", ")}`);
          }

          // Update existing memory
          if (input.update_id !== undefined) {
            const idErr = validatePositiveInt(input.update_id, "update_id");
            if (idErr) return validationError(idErr);

            const updateId = input.update_id as number;
            const existing = getMemoryById(sqlite, updateId, householdId);
            if (!existing) {
              return JSON.stringify({ error: `Memory with ID ${updateId} not found` });
            }

            const updated = updateMemory(sqlite, updateId, content);
            return JSON.stringify({
              status: "updated",
              id: updateId,
              content,
              category: existing.category,
              updated,
            });
          }

          // Dedup check
          if (!input.skip_dedup) {
            try {
              const matches = searchMemoryFts(sqlite, householdId, content, 5);
              // FTS5 rank: lower = better match. searchMemoryFts returns Math.abs(rank).
              // Threshold: rank < 5.0 means a strong match (original BM25 was < -5.0, abs makes it < 5.0)
              const strongMatches = matches.filter((m) => m.rank > 0 && m.rank < 5.0);

              if (strongMatches.length > 0) {
                return JSON.stringify({
                  status: "dedup_match",
                  message: "Similar memories found. Decide: ADD as new (call with skip_dedup: true), UPDATE existing (call with update_id), or NOOP.",
                  matches: strongMatches.map((m) => ({
                    id: m.id,
                    content: m.content,
                    category: m.category,
                    rank: m.rank,
                  })),
                });
              }
            } catch (dedupError) {
              // If dedup search fails, proceed with save
              logger.warn(
                { error: dedupError instanceof Error ? dedupError.message : String(dedupError) },
                "Memory dedup search failed, proceeding with save",
              );
            }
          }

          // Save new memory
          const saved = saveMemory(sqlite, householdId, content, category as MemoryCategory);
          return JSON.stringify({
            status: "saved",
            id: saved.id,
            content: saved.content,
            category: saved.category,
          });
        }

        case "delete_memory": {
          if (!sqlite) {
            return JSON.stringify({ error: "Memory tools not available" });
          }

          const err = validateRequired(input.id, "id", "number")
            ?? validatePositiveInt(input.id, "id");
          if (err) return validationError(err);

          const id = input.id as number;
          const deleted = deleteMemory(sqlite, id, householdId);

          if (!deleted) {
            return JSON.stringify({ error: `Memory with ID ${id} not found or does not belong to this household` });
          }

          return JSON.stringify({ status: "deleted", id });
        }

        case "search_memories": {
          if (!sqlite) {
            return JSON.stringify({ error: "Memory tools not available" });
          }

          const err = validateRequired(input.query, "query", "string")
            ?? validateString(input.query, "query", MAX_LENGTHS.query);
          if (err) return validationError(err);

          const query = input.query as string;
          const limit = (typeof input.limit === "number" && Number.isInteger(input.limit) && input.limit > 0)
            ? Math.min(input.limit, 50)
            : 10;

          const results = searchMemoryFts(sqlite, householdId, query, limit);

          return JSON.stringify({
            results: results.map((r) => ({
              id: r.id,
              content: r.content,
              category: r.category,
              rank: r.rank,
            })),
            count: results.length,
          });
        }

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };
}
