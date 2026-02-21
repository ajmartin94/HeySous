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
      "Automatically checks for similar existing items before saving. If a match is found, " +
      "returns the match info instead of saving -- present the match to the user and ask " +
      "whether to update the existing item or save as new (with skip_dedup: true). " +
      "Use this after the user confirms they want to save. Include a descriptive title, " +
      "a brief summary (1-2 sentences for search results), the full content, and relevant tags. " +
      "For recipes, tags should include: 'recipe', cuisine type (e.g., 'cuisine:italian'), " +
      "meal type (e.g., 'meal:dinner'), protein (e.g., 'protein:chicken'), and difficulty " +
      "(e.g., 'difficulty:easy'). " +
      "For preferences, tags should include: 'preference', plus domain tags " +
      "(e.g., 'pref:dietary', 'pref:schedule', 'pref:cooking'), subject tags " +
      "(e.g., 'subject:self', 'subject:household'), and severity tags for allergies/restrictions " +
      "(e.g., 'severity:allergy', 'severity:restriction'). Returns the saved item's ID.",
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
        skip_dedup: {
          type: "boolean",
          description:
            "Set to true to skip duplicate checking and force save. " +
            "Use when the user explicitly says to save as new after seeing a duplicate match.",
        },
        source_url: {
          type: "string",
          description:
            "Source URL for imported recipes. Include this when saving a recipe that was imported from a URL.",
        },
      },
      required: ["title", "summary", "content", "tags"],
    },
  },
  {
    name: "import_from_url",
    description:
      "Import a recipe from a URL. Fetches the page and extracts recipe data " +
      "(title, ingredients, instructions, times) using structured data (JSON-LD, Microdata) " +
      "or AI extraction as fallback. After extraction, call save_knowledge immediately in the " +
      "same turn with the extracted content -- do not wait for a separate confirmation step.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The recipe URL to import from",
        },
      },
      required: ["url"],
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

/**
 * Anthropic tool definitions for meal planning operations.
 *
 * Four tools for plan CRUD and cooking history:
 * 1. save_meal_plan -- Create/replace a weekly meal plan
 * 2. get_meal_plan -- Retrieve a plan for a specific week
 * 3. log_meal -- Log an unplanned meal to cooking history
 * 4. get_cooking_history -- Query recent cooking history
 */
export const PLAN_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_meal_plan",
    description:
      "Save or update a weekly meal plan. Provide the week start date (Monday) and an array of " +
      "meal entries. Each entry needs a day (0=Mon through 6=Sun), meal type, and recipe name. " +
      "Replaces all entries for that week -- always send the COMPLETE plan, not just changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start_date: {
          type: "string",
          description:
            "Monday of the plan week in ISO format: YYYY-MM-DD",
        },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: {
                type: "number",
                description: "0=Monday through 6=Sunday",
              },
              meal_type: {
                type: "string",
                enum: ["breakfast", "lunch", "dinner"],
                description: "Meal type, default: dinner",
              },
              recipe_name: {
                type: "string",
                description: "Name of the recipe or meal",
              },
              knowledge_item_id: {
                type: "number",
                description:
                  "ID of stored recipe in knowledge base (from search_knowledge results). Include this whenever the recipe exists in the knowledge base to link the plan entry to the recipe card.",
              },
            },
            required: ["day", "recipe_name"],
          },
          description: "Array of meal entries for the week",
        },
      },
      required: ["week_start_date", "entries"],
    },
  },
  {
    name: "get_meal_plan",
    description:
      "Get the meal plan for a specific week. If no week specified, returns the current " +
      "week's plan. Returns all entries for the week.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start_date: {
          type: "string",
          description:
            "Monday of the plan week in ISO format: YYYY-MM-DD. Omit for current week.",
        },
      },
      required: [],
    },
  },
  {
    name: "log_meal",
    description:
      "Log a meal to cooking history. Use for unplanned meals the user mentions " +
      "('we had pizza tonight') or corrections to planned meals. Planned meals are " +
      "auto-logged when the day passes.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipe_name: {
          type: "string",
          description: "Name of the meal/recipe",
        },
        cooked_date: {
          type: "string",
          description:
            "Date the meal was cooked in ISO format: YYYY-MM-DD",
        },
        meal_type: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner"],
          description: "Meal type (default: dinner)",
        },
        knowledge_item_id: {
          type: "number",
          description: "Optional ID of stored recipe",
        },
        notes: {
          type: "string",
          description: "Optional notes about the meal",
        },
      },
      required: ["recipe_name", "cooked_date"],
    },
  },
  {
    name: "get_cooking_history",
    description:
      "Get recent cooking history. Returns what was cooked/planned in the date range. " +
      "Defaults to the last 3 weeks if no range specified.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description:
            "Start of date range in ISO format: YYYY-MM-DD",
        },
        end_date: {
          type: "string",
          description:
            "End of date range in ISO format: YYYY-MM-DD",
        },
      },
      required: [],
    },
  },
];

/**
 * Anthropic tool definitions for grocery list management.
 *
 * Three tools for grocery list CRUD:
 * 1. save_grocery_list -- Create a new grocery list with all items
 * 2. update_grocery_list -- Modify the active list (add, remove, check, uncheck)
 * 3. get_grocery_list -- Retrieve the active list with all items
 */
export const GROCERY_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_grocery_list",
    description:
      "Creates a new grocery list, replacing any existing active list. Send ALL items " +
      "with store assignment, section, and quantity. Stores are user-defined (not hardcoded). " +
      "Sections are categories like Produce, Dairy, Meat, Pantry, Bakery, Frozen, Beverages.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name" },
              quantity: {
                type: "string",
                description:
                  "Amount needed (e.g., '2 lbs', '3', '1 bunch')",
              },
              store: {
                type: "string",
                description: "Store name (user-defined)",
              },
              section: {
                type: "string",
                description:
                  "Store section (Produce, Dairy, Meat, Pantry, etc.)",
              },
            },
            required: ["name", "store", "section"],
          },
          description: "Array of grocery items",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "update_grocery_list",
    description:
      "Update the active grocery list. Use for the pantry check (removing items user has), " +
      "adding extras (snacks, drinks), or checking off items conversationally. " +
      "Provide at least one action.",
    input_schema: {
      type: "object" as const,
      properties: {
        add_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "string" },
              store: { type: "string" },
              section: { type: "string" },
            },
            required: ["name", "store", "section"],
          },
          description: "Items to add to the list",
        },
        remove_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to remove from the list",
        },
        check_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to mark as checked",
        },
        uncheck_item_ids: {
          type: "array",
          items: { type: "number" },
          description: "Item IDs to mark as unchecked",
        },
      },
      required: [],
    },
  },
  {
    name: "get_grocery_list",
    description:
      "Get the active grocery list with all items, their IDs, stores, sections, " +
      "quantities, and checked status.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Anthropic tool definitions for reminder management.
 *
 * Three tools for reminder settings CRUD:
 * 1. get_reminder_settings -- Read current reminder settings
 * 2. update_reminder_settings -- Modify settings (timezone, times, enable/disable, mute)
 * 3. regenerate_reminders -- Regenerate all pending reminders from meal plans
 */
export const REMINDER_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_reminder_settings",
    description:
      "Get the current reminder settings for this chat. Returns timezone, " +
      "morning summary time, dinner time, enabled states, and mute status.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_reminder_settings",
    description:
      "Update reminder settings. Provide only the fields you want to change. " +
      "Use this when users say things like 'mute reminders until Monday', " +
      "'change my morning time to 7am', 'turn off prep alerts', or " +
      "'set my timezone to Pacific'.",
    input_schema: {
      type: "object" as const,
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone identifier (e.g., 'America/New_York', 'America/Los_Angeles')",
        },
        morning_time: {
          type: "string",
          description: "Morning summary time in HH:MM format (e.g., '07:00')",
        },
        dinner_time: {
          type: "string",
          description:
            "Dinner/cooking reminder time in HH:MM format (e.g., '17:30')",
        },
        morning_enabled: {
          type: "boolean",
          description: "Enable or disable morning summary reminders",
        },
        prep_alerts_enabled: {
          type: "boolean",
          description: "Enable or disable day-before prep alert reminders",
        },
        muted_until: {
          type: "string",
          description:
            "ISO date to mute all reminders until (e.g., '2025-03-10'). " +
            "Set to empty string to unmute.",
        },
      },
      required: [],
    },
  },
  {
    name: "regenerate_reminders",
    description:
      "Regenerate all pending reminders from the current meal plans. " +
      "Use after settings changes or when the user asks to refresh reminders.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Anthropic tool definitions for app-level feedback collection.
 *
 * One tool for silently saving detected app sentiment:
 * 1. save_app_feedback -- Record user opinions about bot features/UX
 */
export const APP_FEEDBACK_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_app_feedback",
    description:
      "Silently save app-related feedback detected in conversation. Use when the user expresses " +
      "opinions about the bot's features, UX, or experience (e.g., 'I wish you could...', " +
      "'the grocery list feature is great', 'it's annoying when...'). Do NOT acknowledge saving " +
      "feedback to the user. Do NOT use for meal/recipe feedback. Do NOT use for general " +
      "frustration unrelated to bot features.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The app feedback text detected in conversation",
        },
      },
      required: ["text"],
    },
  },
];

/**
 * Anthropic tool definitions for feedback recording.
 *
 * One tool for recording meal feedback from conversational context:
 * 1. record_feedback -- Annotate a recipe knowledge item with feedback
 */
export const FEEDBACK_TOOLS: Anthropic.Tool[] = [
  {
    name: "record_feedback",
    description:
      "Record feedback about a recent meal. Use when the user provides free-text feedback " +
      "about a meal (e.g., 'dinner was great', 'the chicken was dry'). Extracts sentiment " +
      "and notes, and appends a feedback annotation to the recipe's knowledge item.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipe_name: {
          type: "string",
          description: "Name of the recipe the feedback is about",
        },
        knowledge_item_id: {
          type: "number",
          description:
            "ID of the recipe's knowledge item (from search or plan context)",
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
          description: "Overall sentiment of the feedback",
        },
        notes: {
          type: "string",
          description:
            "Specific feedback notes (what worked, what to change)",
        },
        date: {
          type: "string",
          description:
            "Date the meal was cooked (ISO format YYYY-MM-DD). Defaults to today.",
        },
      },
      required: ["recipe_name", "sentiment"],
    },
  },
];
