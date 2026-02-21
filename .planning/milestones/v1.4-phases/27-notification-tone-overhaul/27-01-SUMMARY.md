---
phase: 27-notification-tone-overhaul
plan: 01
subsystem: bot
tags: [messages, tone, personality, centralized-module]

requires:
  - phase: none
    provides: existing bot handlers with inline string literals
provides:
  - Centralized message module with Sous-personality variants
  - All bot-initiated messages import from single module
  - Random variant selection for natural conversation variation
affects: []

tech-stack:
  added: []
  patterns: [centralized-message-module, pickRandom-variant-selection]

key-files:
  created:
    - src/bot/messages.ts
    - tests/bot/messages.test.ts
  modified:
    - src/pipeline/processor.ts
    - src/bot/middlewares/access-gate.ts
    - src/bot/handlers/start.ts
    - src/bot/handlers/grocery.ts
    - src/bot/handlers/invite.ts
    - src/bot/handlers/app-feedback.ts
    - src/feedback/sender.ts
    - src/reminders/sender.ts

key-decisions:
  - "Centralized module at src/bot/messages.ts -- single source of truth for all bot-initiated messages"
  - "pickRandom utility for simple random variant selection (no history tracking needed)"
  - "Each message function has 3-5 variants minimum for natural variation"
  - "Debug handler messages excluded (dev-only, not user-facing)"

patterns-established:
  - "Centralized message module: all user-facing bot text in one file"
  - "pickRandom variant selection: function returns randomly chosen phrasing"

requirements-completed: [TONE-01, TONE-02, TONE-03]

duration: 3min
completed: 2026-02-20
---

# Phase 27 Plan 01: Notification Tone Overhaul Summary

**Centralized message module with Sous-personality variants for all bot-initiated messages, migrating 8 handler files to import from single source**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- Created src/bot/messages.ts with 20+ message functions, each with 3-5 Sous-personality variants
- pickRandom utility for random variant selection at runtime
- Migrated pipeline processor (error + timeout messages)
- Migrated access gate (unregistered user message)
- Migrated /start handler (welcome back, invalid token, no token, admin notification)
- Migrated /grocery handler (no list message)
- Migrated /invite handler (usage, household not found, invite link)
- Migrated /feedback handler (empty prompt, thanks)
- Migrated feedback sender (check-in messages with recipe interpolation)
- Migrated reminder sender (all fallback message types)
- 25 new tests covering variant selection, interpolation, and smoke tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create centralized message module** - `304bf4d` (feat)
2. **Task 2: Migrate all handlers to centralized module** - `8da6f56` (feat)

## Files Created/Modified
- `src/bot/messages.ts` - 20+ message functions with pickRandom variant selection
- `tests/bot/messages.test.ts` - 25 tests for messages module
- `src/pipeline/processor.ts` - Removed IN_CHARACTER_ERROR, imports getErrorMessage/getTimeoutMessage
- `src/bot/middlewares/access-gate.ts` - Imports getAccessGateMessage
- `src/bot/handlers/start.ts` - Imports 4 message functions
- `src/bot/handlers/grocery.ts` - Imports getNoGroceryListMessage
- `src/bot/handlers/invite.ts` - Imports 3 message functions
- `src/bot/handlers/app-feedback.ts` - Imports 2 message functions
- `src/feedback/sender.ts` - Rewrites buildCheckinMessage to use centralized module
- `src/reminders/sender.ts` - Rewrites getFallbackText to use centralized module

## Decisions Made
- Simple random selection (no usage tracking) -- sufficient for small message set
- Debug handler messages excluded from scope (dev-only, not user-facing)
- Admin-only messages (/costs, /invite usage) kept minimal (1 variant) since not personality-critical

## Deviations from Plan
None -- plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Phase complete, ready for transition
- Message module pattern established for any future bot-initiated messages

---
*Phase: 27-notification-tone-overhaul*
*Completed: 2026-02-20*
