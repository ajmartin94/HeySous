/**
 * Tool name to friendly status label mapping for streaming display.
 * Labels match the Sous personality -- warm, conversational, helpful.
 */

const TOOL_STATUS_LABELS: Record<string, string> = {
  // Knowledge tools
  search_knowledge: "Searching recipes...",
  get_knowledge_item: "Reading recipe details...",
  save_knowledge: "Saving to your recipe book...",
  update_knowledge: "Updating your recipe...",
  delete_knowledge: "Removing from your recipe book...",

  // Meal plan tools
  get_meal_plan: "Checking your meal plan...",
  save_meal_plan: "Updating your meal plan...",

  // Grocery tools
  get_grocery_list: "Checking your grocery list...",
  save_grocery_list: "Building your grocery list...",
  update_grocery_list: "Updating your grocery list...",

  // Settings tools
  get_settings: "Checking your settings...",
  update_settings: "Updating your settings...",
  regenerate_reminders: "Refreshing your reminders...",

  // Memory tools
  save_memory: "Remembering that...",
  delete_memory: "Forgetting that...",
  search_memories: "Searching your memories...",

  // Cooking history & feedback
  log_meal: "Logging your meal...",
  get_cooking_history: "Checking your cooking history...",
  record_feedback: "Noting your feedback...",

  // App feedback
  save_app_feedback: "Saving your feedback...",

  // Import
  import_from_url: "Importing recipe from URL...",
};

/** Generic fallback for unknown/new tools. */
const FALLBACK_LABEL = "Working on it...";

/**
 * Get a friendly, Sous-voice status label for a tool invocation.
 * Returns a generic fallback for unrecognized tool names.
 */
export function getToolStatusLabel(toolName: string): string {
  return TOOL_STATUS_LABELS[toolName] ?? FALLBACK_LABEL;
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a rendered status decoration -- `<i>Searching recipes...</i>` -- for
 * any known label, together with the blank line the stream sender puts in
 * front of it. Anchored to the exact label set so genuine italics in recipe
 * cards ("<i>american | dinner | 25 min</i>") are never touched.
 */
const STATUS_LINE_PATTERN = new RegExp(
  `\\n*<i>(?:${[...Object.values(TOOL_STATUS_LABELS), FALLBACK_LABEL]
    .map(escapeRegex)
    .join("|")})<\\/i>`,
  "g",
);

/**
 * Remove tool-status decorations from an assistant message.
 *
 * These are UI chrome: the stream sender renders them live so the user can see
 * work happening. They must NOT be persisted, because stored messages are
 * replayed as conversation history -- and Sous, seeing turn after turn that
 * looked like "<i>Updating your meal plan...</i>" followed by a confirmation,
 * learned to type the decoration instead of calling the tool. Brownies were
 * confirmed to the user and never saved; a photographed recipe likewise.
 *
 * Display keeps the decorations; only what we write to the messages table is
 * stripped, so history teaches prose rather than chrome.
 */
export function stripToolStatusLines(text: string): string {
  if (!text) return "";
  return text
    .replace(STATUS_LINE_PATTERN, "")
    // Collapse the gap left where a status line sat mid-message.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
