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

  // Reminder tools
  get_reminder_settings: "Checking your reminder settings...",
  update_reminder_settings: "Updating your reminders...",
  regenerate_reminders: "Refreshing your reminders...",

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
