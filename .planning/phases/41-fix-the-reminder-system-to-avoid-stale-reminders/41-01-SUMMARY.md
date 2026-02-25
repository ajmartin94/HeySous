---
phase: 41-fix-the-reminder-system-to-avoid-stale-reminders
plan: 01
subsystem: reminders
tags: [reminders, meal-plan, tool-handler, stale-data]

requires:
  - phase: 40-reminder-resilience-recipe-time-extraction
    provides: generateRemindersFn wiring and structured time metadata
provides:
  - Automatic reminder regeneration after meal plan saves
affects: [reminders, meal-planning, feedback]

tech-stack:
  added: []
  patterns: [post-save regeneration pattern for save_meal_plan]

key-files:
  created: []
  modified: [src/ai/tool-handler.ts, tests/ai/tool-handler.test.ts]

key-decisions:
  - "Reused existing generateRemindersFn guard pattern from update_reminder_settings case -- consistent approach across all reminder-triggering tool handlers"

patterns-established:
  - "Post-save regeneration: any tool handler that modifies meal plan data calls generateRemindersFn to keep reminders in sync"

requirements-completed: []

duration: 2min
completed: 2026-02-24
---

# Phase 41 Plan 01: Add Reminder Regeneration After Plan Save Summary

**Post-save generateRemindersFn call in save_meal_plan prevents stale reminders referencing old meals after plan changes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T02:22:39Z
- **Completed:** 2026-02-25T02:24:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added generateRemindersFn(householdId) call after successful save_meal_plan, ensuring reminders and feedback check-ins rebuild with current meal data
- Confirmed the call is guarded by both the conflict check (no regeneration on null/conflict saves) and the generateRemindersFn availability check
- Added two new tests: positive case (regeneration called on success) and negative case (not called on conflict)
- All 31 tool-handler tests pass, full suite of 246 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add generateRemindersFn call after save_meal_plan success** - `8ebf197` (feat)
2. **Task 2: Add test verifying reminder regeneration on plan save** - `20448d1` (test)

## Files Created/Modified
- `src/ai/tool-handler.ts` - Added generateRemindersFn(householdId) call after successful plan save, between conflict check and response construction
- `tests/ai/tool-handler.test.ts` - Added createMockDepsWithReminders() helper and two tests for reminder regeneration behavior

## Decisions Made
- Reused the existing generateRemindersFn guard pattern from update_reminder_settings (lines 1066-1068) for consistency
- Placed the call after the conflict null-check to ensure only successful saves trigger regeneration
- Created a separate helper function (createMockDepsWithReminders) rather than modifying existing createMockDeps to avoid affecting existing tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reminder regeneration is now triggered on both plan saves and settings changes
- The stale reminder problem is fully addressed: any meal plan modification rebuilds all future reminders from current data
- Both morning_summary, prep_alert, start_cooking, and feedback_checkin reminders benefit since generateRemindersFn in main.ts calls both generateReminders() and generateFeedbackCheckins()

## Self-Check: PASSED

- src/ai/tool-handler.ts: FOUND
- tests/ai/tool-handler.test.ts: FOUND
- Commit 8ebf197 (feat): FOUND
- Commit 20448d1 (test): FOUND

---
*Phase: 41-fix-the-reminder-system-to-avoid-stale-reminders*
*Completed: 2026-02-24*
