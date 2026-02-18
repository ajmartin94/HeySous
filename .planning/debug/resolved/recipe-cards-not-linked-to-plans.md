---
status: resolved
trigger: "recipe-cards-not-linked-to-plans"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - three reinforcing gaps in the recipe-to-plan linking chain
test: typecheck + test suite
expecting: clean compilation and no test regressions
next_action: archive session

## Symptoms

expected: When Sous creates a meal plan, it should find existing recipe cards in the knowledge base and link them to the plan entries.
actual: Two failure modes: (1) Plans created with no recipe card links at all. (2) Sous says existing recipe cards don't exist, creates new duplicate recipe cards with same/similar names.
errors: No specific error messages available.
reproduction: Users ask Sous to plan meals. Sous either doesn't link existing recipes or creates duplicates.
started: Problem since launch - never worked correctly.

## Eliminated

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: save_meal_plan tool definition in src/ai/tools.ts
  found: Tool accepts knowledge_item_id as optional per entry, but description says "Optional ID of stored recipe in knowledge base" - no instruction to Claude about WHEN or WHY to include it
  implication: Claude has no clear guidance on linking recipes

- timestamp: 2026-02-18T00:01:00Z
  checked: save_meal_plan handler in src/ai/tool-handler.ts (lines 215-250)
  found: The tool_result returned to Claude STRIPS knowledgeItemId - response only includes day, dayName, mealType, recipeName. The knowledgeItemId is saved to DB but NOT returned in the tool result.
  implication: Even if Claude sends knowledgeItemId, it never sees confirmation. More importantly, when it calls get_meal_plan, it DOES get knowledgeItemId back (line 278). But save_meal_plan does not.

- timestamp: 2026-02-18T00:01:00Z
  checked: System prompt MEAL_PLANNING section in src/ai/system-prompt.ts
  found: "search their recipes and cooking history first (via tools)" and "Use their stored recipes when possible" - but NO explicit instruction like "when a recipe exists in the knowledge base, include its knowledge_item_id in the save_meal_plan entries"
  implication: Claude is told to USE stored recipes but not told HOW to link them via the ID field

- timestamp: 2026-02-18T00:01:00Z
  checked: Plan context builder (src/planning/context.ts)
  found: Active plans context shows "- Monday: Recipe Name" but does NOT include knowledgeItemId for any entries
  implication: When Claude sees existing plan context, there are no IDs, reinforcing the pattern of not using them

- timestamp: 2026-02-18T00:01:00Z
  checked: get_meal_plan handler in tool-handler.ts (lines 252-282)
  found: get_meal_plan DOES return knowledgeItemId in entries, so if Claude retrieves a plan it would see IDs. But this is rarely called for planning since plan context is injected in the system prompt.
  implication: The system prompt injection path (most common) loses the ID link

## Resolution

root_cause: Multiple reinforcing gaps prevent recipe-to-plan linking: (1) System prompt tells Claude to "search recipes" and "use stored recipes" but never instructs it to include knowledge_item_id in save_meal_plan entries. (2) save_meal_plan tool result strips knowledgeItemId from the response, so Claude never sees the IDs echoed back even if it provides them. (3) Plan context injected into system prompt only shows recipe names, not their knowledge item IDs, so Claude has no IDs to carry forward when modifying plans. All three gaps compound: Claude has no instruction to link, no positive reinforcement from results, and no IDs in the context it reads.
fix: Three changes applied: (1) Added explicit "LINKING RECIPES TO PLANS" section to system prompt with CRITICAL instructions for Claude to search recipes before saving plans and include knowledge_item_id. (2) Added knowledgeItemId to save_meal_plan tool result entries so Claude gets confirmation of linked IDs. (3) Added [recipe #ID] suffix to plan context entries so Claude sees existing links when modifying plans. Also improved the knowledge_item_id field description in the tool schema.
verification: TypeScript typecheck passes clean. All 57 tests pass (1 pre-existing unrelated failure in gsd-tools.test.cjs which has no test suites).
files_changed:
  - src/ai/system-prompt.ts
  - src/ai/tool-handler.ts
  - src/ai/tools.ts
  - src/planning/context.ts
