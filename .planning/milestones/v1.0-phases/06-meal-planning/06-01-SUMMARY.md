---
phase: 06-meal-planning
plan: 01
subsystem: database
tags: [drizzle, sqlite, meal-planning, cooking-history, date-utils]

# Dependency graph
requires:
  - phase: 03-knowledge-system
    provides: "Drizzle ORM setup, initializeFts pattern, createDatabase factory"
  - phase: 01-bot-foundation
    provides: "Database factory, schema re-export pattern"
provides:
  - "mealPlans, mealPlanEntries, cookingHistory Drizzle tables"
  - "Plan CRUD repository (savePlan, getPlan, getActivePlans)"
  - "Cooking history tracking (autoMarkCookedMeals, logMeal, getCookingHistory)"
  - "Plan context builder for system prompt injection"
  - "Week calculation and date formatting utilities"
affects: [06-02, 06-03, 07-shopping-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "initializePlanning raw SQL pattern (same as initializeFts)"
    - "Raw SQLite INSERT...SELECT for auto-marking cooked meals"
    - "Plan context XML tags for system prompt injection"

key-files:
  created:
    - src/planning/schema.ts
    - src/planning/repository.ts
    - src/planning/date-utils.ts
    - src/planning/history.ts
    - src/planning/context.ts
  modified:
    - src/db/schema.ts
    - src/db/index.ts

key-decisions:
  - "MealType enum constrained to 'breakfast' | 'lunch' | 'dinner' for type safety"
  - "Auto-mark uses SQLite date() arithmetic for cooked_date computation"
  - "Week start always Monday via ISO week rules"
  - "History defaults to 21-day lookback when no date range specified"

patterns-established:
  - "Planning tables initialized via initializePlanning (raw SQL, same as initializeFts)"
  - "Plan repository factory function (matches createKnowledgeRepository)"
  - "Cooking history uses raw SQLite for complex queries (matches preferences.ts)"
  - "Context builder uses XML tags for system prompt injection (matches preference context)"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 6 Plan 1: Planning Data Layer Summary

**Drizzle schema for meal plans with CRUD repository, cooking history auto-marking via SQLite date arithmetic, and plan context builder for system prompt injection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T03:45:18Z
- **Completed:** 2026-02-07T03:48:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Three meal planning tables (mealPlans, mealPlanEntries, cookingHistory) with Drizzle schema and raw SQL initialization
- Plan repository with save/get/getActivePlans following factory function pattern
- Cooking history with auto-marking of past planned meals, manual logging, and date-range querying
- Plan context builder formatting active plans and history for system prompt injection
- Date utilities for week calculation, range formatting, and day arithmetic

## Task Commits

Each task was committed atomically:

1. **Task 1: Planning schema, date utils, and table initialization** - `8864cff` (feat)
2. **Task 2: Plan repository, cooking history, and context builder** - `4641f49` (feat)

## Files Created/Modified
- `src/planning/schema.ts` - Drizzle table definitions for mealPlans, mealPlanEntries, cookingHistory
- `src/planning/date-utils.ts` - getWeekStartDate, formatDateRange, addDays utilities
- `src/planning/history.ts` - initializePlanning, autoMarkCookedMeals, logMeal, getCookingHistory
- `src/planning/repository.ts` - createPlanRepository factory with savePlan, getPlan, getActivePlans
- `src/planning/context.ts` - buildPlanContext for system prompt injection
- `src/db/schema.ts` - Re-exports mealPlans, mealPlanEntries, cookingHistory
- `src/db/index.ts` - Calls initializePlanning(sqlite) at startup

## Decisions Made
- MealType constrained to union type `"breakfast" | "lunch" | "dinner"` for Drizzle enum compatibility (plan specified string, tsc required narrowing)
- Auto-mark query uses `date(mp.week_start_date, '+' || mpe.day_of_week || ' days')` for SQLite-native date arithmetic
- Week start computed using ISO week rules (Monday = start) via `(jsDay + 6) % 7` adjustment
- History defaults to 21-day lookback window per research recommendation
- initializePlanning placed in history.ts (alongside cooking history functions) rather than separate file -- follows initializeFts being in fts.ts pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MealType enum type mismatch**
- **Found during:** Task 2 (repository implementation)
- **Issue:** Plan specified `mealType?: string` on PlanEntry interface, but Drizzle insert requires the exact enum union type `"breakfast" | "lunch" | "dinner"`
- **Fix:** Added `MealType` type alias and constrained PlanEntry.mealType to `MealType | undefined`
- **Files modified:** src/planning/repository.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 4641f49 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type narrowing required for Drizzle enum compatibility. No scope creep.

## Issues Encountered
None beyond the type fix documented in deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Planning data layer complete and ready for plan 06-02 (plan generation tools) and 06-03 (command wiring)
- All tables created at startup via initializePlanning
- Repository and history functions ready for injection into tool handlers
- Context builder ready for system prompt integration
- No blockers or concerns

## Self-Check: PASSED

---
*Phase: 06-meal-planning*
*Completed: 2026-02-07*
