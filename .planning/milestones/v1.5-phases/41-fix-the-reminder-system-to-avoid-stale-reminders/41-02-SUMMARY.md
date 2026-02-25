---
phase: 41-fix-the-reminder-system-to-avoid-stale-reminders
plan: 02
subsystem: reminders
tags: [sqlite, tdd, bug-fix, reminder-regeneration]

# Dependency graph
requires:
  - phase: 41-fix-the-reminder-system-to-avoid-stale-reminders (plan 01)
    provides: "deleteAllPending call on regeneration after plan save"
provides:
  - "Status-agnostic deleteAllForRegeneration method that removes all reminders regardless of status"
  - "Test proving sent reminders are deleted during regeneration"
affects: [reminders, planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-agnostic deletion during full regeneration (delete all, not just pending)"

key-files:
  created: []
  modified:
    - src/reminders/repository.ts
    - src/reminders/generator.ts
    - tests/reminders/generator.test.ts

key-decisions:
  - "Renamed deleteAllPending to deleteAllForRegeneration rather than adding a separate method, since deleteAllPending had no other callers"

patterns-established:
  - "Full regeneration deletes ALL reminder statuses -- regeneration is a complete reset, not a selective cleanup"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 41 Plan 02: Phantom Reminder Fix Summary

**Status-agnostic deleteAllForRegeneration replaces deleteAllPending to prevent phantom alerts from sent reminders surviving plan changes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T03:04:19Z
- **Completed:** 2026-02-25T03:06:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added failing test proving deleteAllPending misses sent reminders during regeneration (RED)
- Replaced deleteAllPending with deleteAllForRegeneration that removes ALL reminders regardless of status (GREEN)
- Full test suite (247 tests) and typecheck pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Add failing test for sent-reminder cleanup** - `b3c51b1` (test)
2. **Task 2: GREEN -- Replace deleteAllPending with deleteAllForRegeneration** - `8571a83` (fix)

_TDD plan: 2 commits (RED + GREEN), no REFACTOR needed_

## Files Created/Modified
- `src/reminders/repository.ts` - Renamed deleteAllPending to deleteAllForRegeneration, removed status='pending' filter
- `src/reminders/generator.ts` - Updated call from deleteAllPending to deleteAllForRegeneration with updated comments
- `tests/reminders/generator.test.ts` - Added "deletes sent reminders during regeneration (no phantom alerts)" test case

## Decisions Made
- Renamed deleteAllPending to deleteAllForRegeneration rather than adding a new method alongside, since codebase grep confirmed deleteAllPending had no other callers

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phantom reminder bug is fully fixed with test coverage
- Both plan 01 (trigger regeneration on save) and plan 02 (status-agnostic deletion) are complete
- Phase 41 is complete -- the reminder system now handles plan changes correctly

## Self-Check: PASSED

All files exist, all commits verified, all content assertions confirmed.

---
*Phase: 41-fix-the-reminder-system-to-avoid-stale-reminders*
*Completed: 2026-02-25*
