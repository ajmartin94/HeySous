import type { createRetrievalService } from "../knowledge/retrieval.js";

/**
 * Create a tool call dispatcher that routes Claude's tool use requests
 * to the knowledge retrieval service.
 *
 * Tool results are returned as strings (Anthropic API expects string
 * content in tool_result blocks).
 *
 * Factory pattern matches codebase conventions (createDatabase, createClaudeClient).
 */
export function createToolHandler(deps: {
  retrievalService: ReturnType<typeof createRetrievalService>;
  chatId: string;
}) {
  const { retrievalService, chatId } = deps;

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

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };
}
