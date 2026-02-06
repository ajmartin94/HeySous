import type { createRetrievalService } from "../knowledge/retrieval.js";
import type { createKnowledgeRepository } from "../knowledge/repository.js";
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
}) {
  const { retrievalService, knowledgeRepository, db, chatId } = deps;

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

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };
}
