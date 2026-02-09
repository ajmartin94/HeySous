---
phase: 07-grocery-lists
plan: 02
subsystem: ai-integration
tags: [anthropic-tools, tool-handler, system-prompt, grocery-lists, context-builder]

# Dependency graph
requires:
  - phase: 07-grocery-lists
    plan: 01
    provides: "Grocery repository with CRUD methods, Drizzle schema, table init"
  - phase: 03-knowledge-system
    provides: "Tool handler pattern, retrieval service, system prompt structure"
  - phase: 06-meal-planning
    provides: "PLAN_TOOLS pattern, planContext injection, MEAL_PLANNING_PROMPT"
provides:
  - "GROCERY_TOOLS array with save_grocery_list, update_grocery_list, get_grocery_list"
  - "Tool handler dispatch for all 3 grocery tools"
  - "GROCERY_LIST_PROMPT system prompt section with full grocery workflow instructions"
  - "buildGroceryContext function for lightweight active list summary"
affects: [07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GROCERY_TOOLS array (same pattern as PLAN_TOOLS, KNOWLEDGE_TOOLS)"
    - "Optional groceryRepository dependency in createToolHandler"
    - "buildGroceryContext raw SQL summary query for system prompt injection"

key-files:
  created:
    - src/grocery/context.ts
  modified:
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts

key-decisions:
  - "update_grocery_list returns messageId in response for post-loop Telegram message editing"
  - "Grocery context is a lightweight summary (item count, store count, checked count) to keep system prompt tokens low"
  - "GROCERY_LIST_PROMPT always included regardless of grocery context existence (same as MEAL_PLANNING_PROMPT)"
  - "groceryContext injected after planContext, GROCERY_LIST_PROMPT after MEAL_PLANNING_PROMPT"
  - "buildSystemPrompt groceryContext parameter is optional for backward compatibility"

patterns-established:
  - "GROCERY_TOOLS follows exact same export pattern as PLAN_TOOLS and KNOWLEDGE_TOOLS"
  - "groceryRepository optional dep in createToolHandler (same as planRepository)"
  - "buildGroceryContext uses raw SQL GROUP query for efficient summary"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 7 Plan 2: Grocery AI Integration Summary

**GROCERY_TOOLS definitions with tool handler dispatch, GROCERY_LIST_PROMPT system prompt instructions, and buildGroceryContext lightweight summary for system prompt injection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T21:52:32Z
- **Completed:** 2026-02-08T21:55:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Three grocery tool definitions (save_grocery_list, update_grocery_list, get_grocery_list) exported as GROCERY_TOOLS array
- Tool handler dispatches all three tools to grocery repository methods
- update_grocery_list returns messageId for post-loop Telegram message editing by processor
- GROCERY_LIST_PROMPT teaches Claude the full grocery workflow: generation from meal plan, ingredient aggregation, store assignment, pantry check, conversational check-off, store preferences
- buildGroceryContext provides lightweight active list summary for system prompt (item/store/checked counts)
- buildSystemPrompt extended with optional groceryContext parameter, fully backward-compatible

## Task Commits

Each task was committed atomically:

1. **Task 1: GROCERY_TOOLS definitions and tool handler dispatch** - `9f30e0e` (feat)
2. **Task 2: Grocery context builder and system prompt instructions** - `6bcbb1e` (feat)

## Files Created/Modified
- `src/grocery/context.ts` - buildGroceryContext function with raw SQL summary query
- `src/ai/tools.ts` - GROCERY_TOOLS array with 3 tool definitions
- `src/ai/tool-handler.ts` - 3 new switch cases for grocery tools, groceryRepository optional dep
- `src/ai/system-prompt.ts` - GROCERY_LIST_PROMPT constant, groceryContext parameter, injection into template

## Decisions Made
- update_grocery_list response includes messageId so the processor can edit the Telegram grocery list message in place after conversational check-off (the tool handler remains synchronous)
- Grocery context is a lightweight summary (not full item list) to keep system prompt tokens low -- Claude calls get_grocery_list when it needs full details
- GROCERY_LIST_PROMPT is always included in system prompt (not conditional on active list), matching MEAL_PLANNING_PROMPT pattern
- groceryContext injected after planContext in prompt template, GROCERY_LIST_PROMPT appended after MEAL_PLANNING_PROMPT
- save_grocery_list tool description explicitly mentions stores are user-defined, not hardcoded

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI integration layer complete and ready for plan 07-03 (inline buttons and callback handlers)
- GROCERY_TOOLS ready to be spread into the tools array passed to Claude
- groceryRepository needs to be wired into createToolHandler in main.ts/processor.ts (plan 07-04)
- buildGroceryContext needs to be called in processor and passed to buildSystemPrompt (plan 07-04)
- No blockers or concerns

## Self-Check: PASSED
