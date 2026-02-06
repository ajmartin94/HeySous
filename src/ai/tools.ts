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
  {
    name: "save_knowledge",
    description:
      "Save a new item to the user's knowledge base (recipe, preference, cooking note). " +
      "Use this after the user confirms they want to save. Include a descriptive title, " +
      "a brief summary (1-2 sentences for search results), the full content, and relevant tags. " +
      "For recipes, tags should include: 'recipe', cuisine type (e.g., 'cuisine:italian'), " +
      "meal type (e.g., 'meal:dinner'), protein (e.g., 'protein:chicken'), and difficulty " +
      "(e.g., 'difficulty:easy'). Returns the saved item's ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Descriptive title for the knowledge item",
        },
        summary: {
          type: "string",
          description:
            "Brief 1-2 sentence summary for search result display",
        },
        content: {
          type: "string",
          description: "Full content of the knowledge item",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Relevant tags for categorization and filtering",
        },
      },
      required: ["title", "summary", "content", "tags"],
    },
  },
  {
    name: "update_knowledge",
    description:
      "Update an existing knowledge item. Provide the item ID and only the fields that changed. " +
      "IMPORTANT: the content field replaces the ENTIRE content -- for partial recipe updates, " +
      "first retrieve the current content with get_knowledge_item, modify the specific part, " +
      "then send back the complete updated content. Does NOT require re-confirming the whole " +
      "recipe for minor changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The ID of the knowledge item to update",
        },
        title: {
          type: "string",
          description: "Updated title (omit to keep current)",
        },
        summary: {
          type: "string",
          description: "Updated summary (omit to keep current)",
        },
        content: {
          type: "string",
          description:
            "Updated full content -- replaces entire content (omit to keep current)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Updated tags -- replaces all tags (omit to keep current)",
        },
        change_description: {
          type: "string",
          description:
            "Brief note of what changed for the changelog",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_knowledge",
    description:
      "Delete a knowledge item permanently. Only use after user explicitly confirms deletion. " +
      "Returns success/failure.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "number",
          description: "The ID of the knowledge item to delete",
        },
      },
      required: ["id"],
    },
  },
];
