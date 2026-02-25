---
phase: 33-input-validation-security
plan: 03
subsystem: pipeline
tags: [validation, message-length, security, rate-limiting]

requires:
  - phase: 33-input-validation-security
    provides: "Pipeline processor and message infrastructure"
provides:
  - "Message length validation (4,000 char limit) in pipeline processor"
  - "In-character rejection messages for oversized messages"
affects: [pipeline, bot-messages]

tech-stack:
  added: []
  patterns: ["early-return validation before pipeline processing"]

key-files:
  created:
    - tests/pipeline/processor-length.test.ts
  modified:
    - src/pipeline/processor.ts
    - src/bot/messages.ts

key-decisions:
  - "4,000 character hardcoded limit on combined debounced content (not per-message)"
  - "Rejected messages discarded entirely -- not stored in conversation history"
  - "Length check placed before db.insert to prevent rejected messages from persisting"

patterns-established:
  - "Early validation pattern: check input constraints before any side effects (DB writes, API calls)"

requirements-completed: [SEC-04]

duration: 3min
completed: 2026-02-21
---

# Phase 33 Plan 03: Message Length Validation Summary

**4,000-character message length limit with in-character Sous rejection, enforced before DB persistence and AI pipeline entry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T19:33:10Z
- **Completed:** 2026-02-21T19:36:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added MAX_MESSAGE_LENGTH (4,000) constant and length check in processor before DB insert
- Added getMessageTooLongResponse() with 4 in-character Sous-voice variants
- Created comprehensive test suite covering rejection, boundary, multi-message combining, and pass-through cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rejection message and length check** - `ecfe252` (feat)
2. **Task 2: Add message length rejection tests** - `8fb439f` (test)

## Files Created/Modified
- `src/bot/messages.ts` - Added getMessageTooLongResponse() with 4 Sous-voice variants
- `src/pipeline/processor.ts` - Added MAX_MESSAGE_LENGTH constant and early length check before db.insert
- `tests/pipeline/processor-length.test.ts` - 5 tests covering rejection, boundary, multi-message, pass-through, and logging

## Decisions Made
- Hardcoded 4,000 character limit (not configurable via env var) per locked decision
- Length check placed after userText construction but before db.insert -- rejected messages never enter conversation history
- Photo captions are part of text field in batch messages, so they are naturally included in the character count

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 is the last plan in Phase 33
- Phase 33 complete, ready for transition to next phase

## Self-Check: PASSED

All files verified on disk. All commits verified in git log.

---
*Phase: 33-input-validation-security*
*Completed: 2026-02-21*
