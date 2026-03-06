import { InlineKeyboard } from "grammy";
import { config } from "../config.js";

/**
 * Represents a navigation target within the Mini App.
 * Used to construct InlineKeyboard buttons that open specific views.
 */
export type DeepLinkTarget =
  | { type: "recipe"; recipeId: number }
  | { type: "recipes" }
  | { type: "plan" }
  | { type: "grocery" };

/**
 * Build an InlineKeyboard with webApp buttons for the given deep-link targets.
 *
 * Each target becomes a row with a single webApp button that opens the Mini App
 * to the specified view. Returns null if no targets, empty array, or miniAppUrl
 * is not configured.
 */
export function buildDeepLinkKeyboard(
  targets: DeepLinkTarget[],
): InlineKeyboard | null {
  if (!config.miniAppUrl) return null;
  if (!targets || targets.length === 0) return null;

  const keyboard = new InlineKeyboard();

  for (const target of targets) {
    switch (target.type) {
      case "recipe":
        keyboard.webApp(
          "View Recipe",
          config.miniAppUrl + "/recipes?id=" + target.recipeId,
        );
        break;
      case "recipes":
        keyboard.webApp("View Recipes", config.miniAppUrl + "/recipes");
        break;
      case "plan":
        keyboard.webApp("View Plan", config.miniAppUrl + "/plan");
        break;
      case "grocery":
        keyboard.webApp(
          "View Grocery List",
          config.miniAppUrl + "/grocery",
        );
        break;
    }
    keyboard.row();
  }

  return keyboard;
}

/**
 * Tool call record used by the auto-link builder to determine which
 * navigation buttons to attach after a Claude response.
 */
interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  result: string;
}

/** Tools that produce recipe-related navigation targets. */
const RECIPE_TOOLS = new Set([
  "save_knowledge",
  "get_knowledge_item",
  "import_from_url",
]);

/** Tools that produce plan navigation targets. */
const PLAN_TOOLS = new Set(["save_meal_plan", "get_meal_plan"]);

/** Tools that produce grocery navigation targets. */
const GROCERY_TOOLS = new Set([
  "save_grocery_list",
  "update_grocery_list",
  "get_grocery_list",
]);

/**
 * Safely parse a JSON string, returning null on failure.
 */
function safeParseJson(str: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Analyze tool calls from a Claude response and determine which deep-link
 * navigation buttons should be attached.
 *
 * Implements button density rules:
 * - Single recipe tool call -> specific recipe link (if ID extractable)
 * - Multiple recipe tool calls -> generic recipes link
 * - Any plan tool call -> plan link (always one)
 * - Any grocery tool call -> grocery link (always one)
 *
 * Note: attach_deep_link tool calls are NOT handled here -- they have their
 * own handler in tool-handler.ts that returns a marker for the processor.
 */
export function buildDeepLinksFromToolCalls(
  toolCalls: ToolCallRecord[],
): DeepLinkTarget[] {
  const targets: DeepLinkTarget[] = [];

  // Collect recipe IDs from recipe-producing tool calls
  const recipeIds: number[] = [];
  let hasRecipeToolCalls = false;

  for (const call of toolCalls) {
    if (RECIPE_TOOLS.has(call.name)) {
      hasRecipeToolCalls = true;

      if (call.name === "save_knowledge") {
        // Extract ID from save result JSON
        const parsed = safeParseJson(call.result);
        if (parsed && typeof parsed.id === "number") {
          recipeIds.push(parsed.id);
        }
      } else if (call.name === "get_knowledge_item") {
        // Use input ID directly
        const id = call.input.id;
        if (typeof id === "number") {
          recipeIds.push(id);
        }
      }
      // import_from_url: skip -- the subsequent save_knowledge call captures the ID
    }
  }

  // Apply button density rules for recipes
  if (hasRecipeToolCalls) {
    if (recipeIds.length === 1) {
      targets.push({ type: "recipe", recipeId: recipeIds[0] });
    } else {
      // Multiple recipe calls or no extractable ID -> generic recipes link
      targets.push({ type: "recipes" });
    }
  }

  // Plan tools -> single plan button
  const hasPlanCall = toolCalls.some((call) => PLAN_TOOLS.has(call.name));
  if (hasPlanCall) {
    targets.push({ type: "plan" });
  }

  // Grocery tools -> single grocery button
  const hasGroceryCall = toolCalls.some((call) =>
    GROCERY_TOOLS.has(call.name),
  );
  if (hasGroceryCall) {
    targets.push({ type: "grocery" });
  }

  return targets;
}
