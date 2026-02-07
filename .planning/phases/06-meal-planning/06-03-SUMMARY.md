---
phase: 06-meal-planning
plan: 03
subsystem: meal-planning-integration
tags: [integration, wiring, bot-command, pipeline, dependency-injection]
depends_on:
  requires: ["06-01", "06-02"]
  provides: ["end-to-end meal planning via /plan command and Claude tools"]
  affects: ["07-grocery-lists", "08-reminders"]
tech-stack:
  added: []
  patterns: ["middleware registration ordering", "plan context injection into system prompt"]
key-files:
  created:
    - src/bot/handlers/plan.ts
  modified:
    - src/pipeline/processor.ts
    - src/bot/index.ts
    - src/main.ts
decisions:
  - key: "plan-handler-raw-sql"
    value: "Raw SQLite JOIN for /plan display (same pattern as preferences handler)"
  - key: "dinner-only-detection"
    value: "Auto-detect dinner-only plans for simplified display format"
  - key: "auto-mark-before-claude"
    value: "autoMarkCookedMeals runs before Claude call, ensuring history is current"
metrics:
  duration: "2 min"
  completed: "2026-02-07"
---

# Phase 6 Plan 3: Integration Wiring Summary

**End-to-end meal planning: /plan command, pipeline integration with 9 combined tools, auto-mark cooked meals, plan context in system prompt**

## What Was Done

### Task 1: /plan Command Handler
Created `src/bot/handlers/plan.ts` following the exact pattern of the preferences handler:
- Raw SQLite query JOINs meal_plans and meal_plan_entries for current week
- Two display modes: dinner-only (one line per day) and multi-meal (grouped by day with meal type headers)
- Empty state shows helpful prompt: "Just say something like 'plan my dinners for this week'"
- Factory function `createPlanHandler(sqlite)` returns a grammY Composer

### Task 2: Pipeline Processor Integration and Main.ts Wiring
**Processor (`src/pipeline/processor.ts`):**
- Imports PLAN_TOOLS alongside KNOWLEDGE_TOOLS, spreads both into Claude call
- Calls `autoMarkCookedMeals(sqlite, chatId)` before each Claude invocation
- Loads active plans and cooking history, builds plan context via `buildPlanContext()`
- Passes `planContext` as second argument to `buildSystemPrompt(preferences, planContext)`
- Tool handler receives `planRepository` and `sqlite` for plan tool dispatch

**Bot (`src/bot/index.ts`):**
- Added `planHandler` to CreateBotOptions interface
- Registered planHandler between preferencesHandler and messageHandler (catch-all stays last)
- Updated middleware order comment to reflect 10 total middleware layers

**Main (`src/main.ts`):**
- Creates `planRepository` via `createPlanRepository(db)` after knowledgeRepository
- Creates `planHandler` via `createPlanHandler(sqlite)` after preferencesHandler
- Wires planRepository into processor deps and planHandler into bot options

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | /plan command handler | 40d52b0 | src/bot/handlers/plan.ts |
| 2 | Pipeline integration and wiring | 69ef67c | src/pipeline/processor.ts, src/bot/index.ts, src/main.ts |

## Verification Results

1. `npx tsc --noEmit` passes with zero errors
2. /plan command handler exists and is registered in bot middleware
3. Processor passes [...KNOWLEDGE_TOOLS, ...PLAN_TOOLS] to Claude (both attempts)
4. Processor calls autoMarkCookedMeals before each Claude call
5. Processor injects plan context into system prompt via buildPlanContext
6. Tool handler receives planRepository and sqlite for plan tool dispatch
7. main.ts creates planRepository and planHandler, wires both
8. No new dependencies added (all imports from existing project modules)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Raw SQLite for /plan display** - Uses same raw query pattern as preferences handler rather than going through Drizzle, consistent with existing codebase conventions for direct display queries.
2. **Dinner-only detection** - Auto-detects when all entries are dinner type and uses simplified one-line-per-day format vs multi-meal grouped display.
3. **Auto-mark before Claude** - autoMarkCookedMeals runs before the Claude call in the pipeline, ensuring cooking history is always current when Claude reasons about meal plans.

## Phase 6 Completion

This was the final plan (3 of 3) in Phase 6 - Meal Planning. The phase is now complete:
- **06-01**: Schema, repository, history, date utilities (data layer)
- **06-02**: Plan tools, tool handler cases, system prompt, context builder (AI layer)
- **06-03**: /plan command, pipeline integration, main.ts wiring (integration layer)

End-to-end meal planning is now functional: users can ask Claude to plan meals, view plans with /plan, and the system auto-tracks cooking history.

## Self-Check: PASSED
