import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic tool definitions for the knowledge retrieval system.
 *
 * Two tools implementing the two-pass retrieval pattern:
 * 1. search_knowledge -- Pass 1: returns brief summaries with IDs
 * 2. get_knowledge_item -- Pass 2: returns full content for a specific item
 *
 * Claude calls search first to find relevant items, then get_knowledge_item
 * to retrieve the full content it needs.
 */
export const KNOWLEDGE_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_knowledge",
    description:
      "Search the user's knowledge base (recipes, preferences, cooking notes, dietary info). " +
      "Returns brief summaries with IDs. Search multiple times with different queries if needed. " +
      "Use specific keywords for best results.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query -- use specific keywords related to the information you need",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of results to return (default 5, max 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_knowledge_item",
    description:
      "Retrieve the full content of a specific knowledge item by its ID. " +
      "Use after search_knowledge to get complete details for an item you need.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The ID of the knowledge item to retrieve",
        },
      },
      required: ["id"],
    },
  },
];
