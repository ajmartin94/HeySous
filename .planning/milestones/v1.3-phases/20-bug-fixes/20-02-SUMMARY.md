---
phase: 20-bug-fixes
plan: 02
subsystem: reminders
tags: [reminders, recipe-time-parsing, start-cooking]

requires:
  - phase: 20-bug-fixes
    provides: "Existing reminder generator, recipe content storage format"
provides:
  - "parseRecipeTotalMinutes() for extracting total prep+cook time from recipe content"
  - "start_cooking reminders adjusted by total recipe time (fires early enough to account for prep)"
affects: [reminders]

tech-stack:
  added: []
  patterns:
    - "Recipe time parsing with multiple format support for robust extraction"

key-files:
  created: []
  modified:
    - src/reminders/generator.ts

key-decisions:
  - "Prefer explicit prep+cook sum over Total Time field when both available"
  - "Fall back to dinner time (current behavior) when recipe content unavailable or unparseable"
  - "Math.max(0, ...) prevents negative time if recipe time exceeds dinner hour offset"

patterns-established:
  - "Recipe time extraction: parseRecipeTotalMinutes handles multiple common formats"

requirements-completed: [FIX-02]

duration: 3min
completed: 2026-02-18
---

# Phase 20-02: Start Cooking Reminder Timing Summary

**Recipe-aware start_cooking reminders that fire early enough to account for prep and cook time**

## Performance

- **Duration:** 3 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- start_cooking reminders now fire at (dinner time - total recipe time) instead of at dinner time
- Robust time parsing handles "30 minutes", "1 hour 30 min", "1:30", "45m", bare numbers
- Graceful fallback: unparseable recipes or missing content preserves current dinner-time behavior
- No regressions: all tests pass, TypeScript compiles cleanly

## Task Commits

1. **Task 1: Parse recipe prep/cook time and adjust start_cooking reminder timing** - `beef9fc` (feat)

## Files Created/Modified
- `src/reminders/generator.ts` - Added parseTimeToMinutes, parseRecipeTotalMinutes helpers; updated start_cooking block to compute adjusted reminder time

## Decisions Made
- Prefer prep+cook sum when both fields present; fall back to Total Time; then individual fields
- Use Math.max(0, ...) to prevent negative time offsets if recipe time exceeds dinner hour
- Query knowledge_items directly in generator since sqlite is already a dependency

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reminder timing fix complete, ready for phase verification

---
*Phase: 20-bug-fixes*
*Completed: 2026-02-18*
