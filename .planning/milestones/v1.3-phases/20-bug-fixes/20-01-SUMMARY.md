---
phase: 20-bug-fixes
plan: 01
subsystem: ai, planning
tags: [timezone, system-prompt, date-utils, intl]

requires:
  - phase: 19-user-help
    provides: "Existing system prompt, planning infrastructure, clock abstraction"
provides:
  - "Timezone-aware date context in Claude system prompt"
  - "getWeekStartDate accepts ISO date string for timezone-resolved week boundaries"
  - "getActivePlans, autoMarkCookedMeals, get_meal_plan, /plan command all timezone-aware"
  - "Processor resolves user timezone from reminder settings and threads through pipeline"
affects: [planning, reminders, ai]

tech-stack:
  added: []
  patterns:
    - "Timezone resolution at pipeline entry, threaded through all date consumers"

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts
    - src/planning/date-utils.ts
    - src/planning/repository.ts
    - src/pipeline/processor.ts
    - src/ai/tool-handler.ts
    - src/bot/handlers/plan.ts
    - src/planning/history.ts
    - tests/ai/system-prompt.test.ts

key-decisions:
  - "Resolve timezone once from reminder_settings at pipeline entry, pass as string through all consumers"
  - "getWeekStartDate signature changed from Date? to string? (ISO date) for simpler timezone handling"
  - "/plan handler creates minimal inline clock since it lacks injected Clock dependency"

patterns-established:
  - "Timezone threading: resolve user timezone early, pass todayStr through pipeline"

requirements-completed: [FIX-01]

duration: 4min
completed: 2026-02-18
---

# Phase 20-01: Date/Timezone Fix Summary

**Timezone-aware date context in system prompt plus timezone-threaded week boundaries across planning pipeline**

## Performance

- **Duration:** 4 min
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments
- Claude now knows the current date and day-of-week in the user's timezone via `<current_date>` block in system prompt
- All date boundary calculations (week start, active plans, auto-mark cooked, get_meal_plan tool, /plan command) use timezone-resolved dates
- No regressions: all 66 tests pass, TypeScript compiles cleanly

## Task Commits

1. **Task 1: Add current date context to system prompt and make date utilities timezone-aware** - `aa117ed` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Added dateContext parameter, injected after boundaries block
- `src/planning/date-utils.ts` - getWeekStartDate now accepts optional ISO date string
- `src/planning/repository.ts` - getActivePlans accepts optional todayStr
- `src/pipeline/processor.ts` - Resolves timezone from reminder settings, builds dateContext, threads through pipeline
- `src/ai/tool-handler.ts` - Accepts timezone parameter, uses it in get_meal_plan fallback
- `src/bot/handlers/plan.ts` - Queries reminder_settings for timezone, uses timezone-aware dates
- `src/planning/history.ts` - autoMarkCookedMeals accepts optional timezone
- `tests/ai/system-prompt.test.ts` - Added date context injection tests

## Decisions Made
- Resolved timezone from reminder_settings table since it's the only place user timezone is stored
- Changed getWeekStartDate parameter from `Date?` to `string?` (ISO date) for cleaner timezone handling
- /plan handler creates a minimal inline clock `{ now: () => Date.now(), date: () => new Date() }` since it doesn't have the injected Clock

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Date infrastructure complete, all timezone-dependent code now uses user timezone
- Phase 20-02 (reminder timing) can use the same timezone resolution pattern

---
*Phase: 20-bug-fixes*
*Completed: 2026-02-18*
