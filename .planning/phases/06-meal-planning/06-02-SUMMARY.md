---
phase: 06-meal-planning
plan: "02"
subsystem: ai-tools
tags: [tool-definitions, tool-handler, system-prompt, meal-planning]
depends_on:
  requires: ["06-01"]
  provides: ["PLAN_TOOLS export", "plan tool dispatch in handler", "meal planning system prompt", "plan context injection"]
  affects: ["06-03"]
tech-stack:
  added: []
  patterns: ["optional dependency injection for backward compat", "tool dispatch switch extension"]
key-files:
  created: []
  modified:
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
decisions:
  - id: "06-02-01"
    decision: "PLAN_TOOLS is a separate export from KNOWLEDGE_TOOLS, not merged"
    rationale: "Separation allows selective inclusion of tool sets per conversation context"
  - id: "06-02-02"
    decision: "Plan tool deps (planRepository, sqlite) are optional in createToolHandler"
    rationale: "Backward compatibility -- existing callers without plan deps continue to work"
  - id: "06-02-03"
    decision: "Plan context injected after PREFERENCE_MANAGEMENT_PROMPT, before MEAL_PLANNING_PROMPT"
    rationale: "Context appears immediately before the instructions that reference it"
  - id: "06-02-04"
    decision: "MEAL_PLANNING_PROMPT always included regardless of whether plan context exists"
    rationale: "Matches PREFERENCE_MANAGEMENT_PROMPT pattern -- instructions always present"
metrics:
  duration: "2 min"
  completed: "2026-02-07"
---

# Phase 6 Plan 2: AI Tools and System Prompt Summary

**One-liner:** Four planning tools (save/get plan, log meal, get history) with full tool handler dispatch and conversational planning intelligence in system prompt.

## What Was Done

### Task 1: Plan tool definitions and tool handler dispatch
- Added `PLAN_TOOLS` array to `src/ai/tools.ts` with 4 Anthropic tool definitions:
  - `save_meal_plan`: Week start date + complete entries array (replaces all)
  - `get_meal_plan`: Optional week start date (defaults to current week)
  - `log_meal`: Recipe name + date + optional meal type/notes
  - `get_cooking_history`: Optional date range (defaults to last 3 weeks)
- Extended `createToolHandler` in `src/ai/tool-handler.ts` with 4 new switch cases
- Added optional `planRepository` and `sqlite` dependencies for backward compatibility
- Guard clauses return error JSON if plan dependencies not provided
- **Commit:** `eb2de65`

### Task 2: System prompt planning instructions and context injection
- Added `MEAL_PLANNING_PROMPT` constant covering:
  - Plan creation approach (collaborative, propose-react-iterate)
  - Display format (recipe name only, Monday-Sunday, single message)
  - Adjustment flow (immediate, no confirmation, no finalize step)
  - Tool usage guidance (complete plan on save, context vs tool for reads)
  - Day/date handling (ISO dates in tools, disambiguation rules)
  - Cooking history (log unplanned, no rigid rotation logic)
- Updated `buildSystemPrompt` signature with optional `planContext` parameter
- Added planning tool references to `<tools>` section
- **Commit:** `684d35a`

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Plan tool definitions and tool handler dispatch | `eb2de65` | src/ai/tools.ts, src/ai/tool-handler.ts |
| 2 | System prompt planning instructions and context injection | `684d35a` | src/ai/system-prompt.ts |

## Decisions Made

1. **PLAN_TOOLS separate export** -- Not merged with KNOWLEDGE_TOOLS for selective tool set inclusion.
2. **Optional plan deps** -- planRepository and sqlite are optional in createToolHandler for backward compatibility.
3. **Plan context placement** -- Injected after preference management, before meal planning instructions.
4. **Always-present instructions** -- MEAL_PLANNING_PROMPT included regardless of plan context existence.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. `npx tsc --noEmit` passes with zero errors
2. PLAN_TOOLS exported from tools.ts with 4 tool definitions (save_meal_plan, get_meal_plan, log_meal, get_cooking_history)
3. tool-handler.ts handles all 4 plan tools with guard clauses
4. system-prompt.ts includes MEAL_PLANNING_PROMPT section
5. buildSystemPrompt accepts optional planContext parameter
6. No new dependencies added

## Next Phase Readiness

Plan 06-03 (wiring/integration) can now proceed. It has:
- PLAN_TOOLS to include in Claude tool arrays
- Tool handler dispatch for all plan operations
- System prompt with planContext injection point
- buildPlanContext from 06-01 to generate the context string

## Self-Check: PASSED
