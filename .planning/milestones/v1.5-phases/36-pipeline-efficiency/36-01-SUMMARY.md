---
phase: 36-pipeline-efficiency
plan: 01
subsystem: pipeline
tags: [token-budget, session-management, rate-limiting, timezone]

requires:
  - phase: 35-resilience
    provides: "Pipeline processor with retry, context trimming, and resilience messaging"
provides:
  - "Per-household daily token budget enforcement via checkDailyTokenBudget"
  - "Midnight-aligned session boundary replacing 4-hour gap in context builder"
  - "DAILY_TOKEN_BUDGET and SESSION_TIMEZONE env var configuration"
  - "Canned rate limit messages via getDailyLimitMessage"
affects: [pipeline, conversation, config]

tech-stack:
  added: []
  patterns: ["Timezone-aware midnight boundary via Intl.DateTimeFormat", "Budget guard as pre-call filter in processor pipeline"]

key-files:
  created:
    - src/pipeline/token-budget-guard.ts
  modified:
    - src/config.ts
    - src/bot/messages.ts
    - src/pipeline/processor.ts
    - src/conversation/context-builder.ts

key-decisions:
  - "Budget check placed before DB save -- exhausted budget means message is not persisted to conversation history"
  - "Midnight boundary uses Intl.DateTimeFormat offset calculation, same approach as clock.ts localTimeToUtc"
  - "Daily limit messages are out-of-character system notices (not Sous persona), per user decision"

patterns-established:
  - "Token budget guard as pre-call filter: check before expensive API call, return early with canned message"
  - "Midnight session boundary: all messages from midnight-in-timezone to now form the current session"

requirements-completed: [SEC-01, CFG-01]

duration: 3min
completed: 2026-02-22
---

# Phase 36 Plan 01: Daily Token Budget and Midnight Session Summary

**Per-household daily token budget guard with midnight-aligned session boundary replacing 4-hour inactivity gap**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T02:32:58Z
- **Completed:** 2026-02-23T02:36:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Per-household daily token budget enforcement (default 500K tokens/day) prevents runaway API costs
- Session boundary now uses midnight in configured timezone instead of arbitrary 4-hour inactivity gap
- Both values configurable via DAILY_TOKEN_BUDGET and SESSION_TIMEZONE env vars without code changes
- Non-AI interactions (commands, Mini App, grocery list) unaffected by budget exhaustion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add config env vars, token budget guard module, and canned message** - `6e85631` (feat)
2. **Task 2: Wire budget check into processor and replace session boundary with midnight reset** - `0d2b1b8` (feat)

## Files Created/Modified
- `src/pipeline/token-budget-guard.ts` - Daily token budget checking per household with timezone-aware midnight boundary
- `src/config.ts` - Added dailyTokenBudget and sessionTimezone config fields
- `src/bot/messages.ts` - Added getDailyLimitMessage with 3 friendly variants
- `src/pipeline/processor.ts` - Wired budget check before Claude API call, passes sessionTimezone to context builder
- `src/conversation/context-builder.ts` - Replaced 4-hour SESSION_GAP_MS with midnight-based session boundary

## Decisions Made
- Budget check placed before DB save: when budget is exhausted, the message is not persisted to conversation history and Claude is not called. This ensures budget enforcement is complete.
- Midnight boundary uses Intl.DateTimeFormat offset calculation (same reliable approach as clock.ts localTimeToUtc) rather than manual UTC offset math.
- Daily limit messages are out-of-character system notices (not Sous persona), per user decision in the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. DAILY_TOKEN_BUDGET defaults to 500,000 and SESSION_TIMEZONE defaults to "America/New_York" if env vars are not set.

## Next Phase Readiness
- Token budget guard and midnight session boundary are ready for use
- Plans 36-02 and 36-03 can build on this foundation for additional pipeline efficiency improvements

## Self-Check: PASSED

All files verified present on disk. All commit hashes verified in git log.

---
*Phase: 36-pipeline-efficiency*
*Completed: 2026-02-22*
