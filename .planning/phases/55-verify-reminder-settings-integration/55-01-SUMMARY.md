---
phase: 55-verify-reminder-settings-integration
plan: 01
subsystem: reminders
tags: [reminders, settings, integration, mini-app]

requires:
  - phase: 49-sous-memory-system
    provides: application_settings table (renamed from reminder_settings)
provides:
  - Settings PUT triggers reminder regeneration on toggle changes
  - start_cooking gated by prepAlertsEnabled
  - getDueReminders excludes muted households via SQL JOIN
affects: [reminders, mini-app, settings]

tech-stack:
  added: []
  patterns: [callback injection for cross-module side effects]

key-files:
  created:
    - tests/reminders/settings-integration.test.ts
  modified:
    - src/mini-app/routes/settings.ts
    - src/mini-app/router.ts
    - src/main.ts
    - src/reminders/generator.ts
    - src/reminders/repository.ts
    - tests/reminders/generator.test.ts

key-decisions:
  - "Option B for muted_until check: LEFT JOIN in getDueReminders SQL rather than per-household check in poller tick loop"
  - "regenerateReminders threaded as optional callback to preserve backward compatibility of createSettingsRoutes"

patterns-established:
  - "Callback injection: cross-cutting side effects (reminder regeneration) passed as optional callbacks through factory chain"

requirements-completed: [REMIND-VERIFY]

duration: 4min
completed: 2026-03-06
---

# Phase 55 Plan 01: Verify Reminder Settings Integration Summary

**Fixed three settings-to-reminder wiring gaps: PUT regeneration callback, prepAlertsEnabled gating on start_cooking, and muted_until exclusion in getDueReminders SQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T14:44:23Z
- **Completed:** 2026-03-06T14:48:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Settings PUT now triggers reminder regeneration when morning_enabled, prep_alerts_enabled, or muted_until changes
- start_cooking reminders are only generated when prepAlertsEnabled is true
- getDueReminders SQL uses LEFT JOIN against application_settings to exclude muted households while preserving households with no settings row
- 5 integration tests covering all three wiring paths

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing integration tests** - `ada09e0` (test)
2. **Task 1 (GREEN): Fix three wiring gaps** - `0631dcf` (feat)
3. **Task 2: Fix existing test fixtures** - `2aaf509` (fix)

## Files Created/Modified

- `tests/reminders/settings-integration.test.ts` - Integration tests for settings-to-reminder pipeline
- `src/mini-app/routes/settings.ts` - Added regenerateReminders callback after PUT updates
- `src/mini-app/router.ts` - Thread regenerateReminders through ApiRouterDeps
- `src/main.ts` - Pass regenerateReminders to createApiRouter
- `src/reminders/generator.ts` - Gate start_cooking block behind settings.prepAlertsEnabled
- `src/reminders/repository.ts` - getDueReminders LEFT JOIN application_settings for muted_until check
- `tests/reminders/generator.test.ts` - Updated fixtures: prepAlertsEnabled=true for start_cooking tests

## Decisions Made

- Used LEFT JOIN (Option B from plan) for muted_until check in getDueReminders SQL rather than per-household lookup in the poller tick loop -- single query is cleaner and more efficient
- Made regenerateReminders an optional callback parameter to preserve backward compatibility of createSettingsRoutes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing generator tests used prepAlertsEnabled=false**
- **Found during:** Task 2 (full suite verification)
- **Issue:** 15 existing tests in generator.test.ts had prepAlertsEnabled=false in their settings fixtures, which now correctly prevents start_cooking generation
- **Fix:** Changed prepAlertsEnabled to true in all test fixtures that test start_cooking behavior
- **Files modified:** tests/reminders/generator.test.ts
- **Verification:** Full test suite passes (340/340)
- **Committed in:** 2aaf509

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Expected consequence of the prepAlertsEnabled gating fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three settings-to-reminder wiring gaps are closed
- Full test suite passes (340 tests) with typecheck clean
- No blockers for subsequent phases

---
*Phase: 55-verify-reminder-settings-integration*
*Completed: 2026-03-06*
