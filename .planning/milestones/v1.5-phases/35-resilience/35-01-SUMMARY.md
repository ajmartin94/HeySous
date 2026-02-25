---
phase: 35-resilience
plan: 01
subsystem: api
tags: [retry, backoff, rate-limit, 429, resilience, anthropic-sdk]

# Dependency graph
requires:
  - phase: 34-observability
    provides: structured logging patterns and tool instrumentation
provides:
  - retryWithBackoff utility for 429 rate-limit errors with exponential backoff and jitter
  - getThinkingLongerMessage and getResilienceFailureMessage in-character user messages
  - onRetry callback pattern for processor-level user notification during retries
affects: [35-resilience, pipeline, ai-client]

# Tech tracking
tech-stack:
  added: []
  patterns: [retryWithBackoff exponential backoff with jitter, onRetry callback for user notification]

key-files:
  created: []
  modified:
    - src/ai/claude-client.ts
    - src/bot/messages.ts
    - src/pipeline/processor.ts
    - src/main.ts
    - tests/bot/messages.test.ts

key-decisions:
  - "retryWithBackoff is internal to claude-client module (not exported) -- processors interact via onRetry callback"
  - "Only 429 errors are retried; all other API errors pass through immediately"
  - "Thinking-longer message sent once per request (first retry only), not on every retry"
  - "Resilience failure message is distinct from generic getErrorMessage for 429-specific vs general errors"

patterns-established:
  - "onRetry callback pattern: claude-client accepts callback, processor provides user-notification logic"
  - "Retry-After header respected via max(retryAfterMs, computedDelay)"

requirements-completed: [RES-01]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 35 Plan 01: 429 Retry with Backoff Summary

**Exponential backoff retry wrapper for Anthropic API 429 errors with jitter, Retry-After header support, and in-character user notifications**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T22:07:44Z
- **Completed:** 2026-02-22T22:14:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- retryWithBackoff utility with exponential backoff (1s, 2s, 4s base), random 0-50% jitter, and Retry-After header support
- All client.messages.create() calls in claude-client wrapped with retry logic (max 3 retries, 429 only)
- Pipeline processor sends natural "thinking longer" message on first retry, in-character failure message when exhausted
- Structured retry/failure logging with householdId, failureType, retryCount, timestamps

## Task Commits

Each task was committed atomically:

1. **Task 1: Add retry-with-backoff wrapper and messages** - `3d9879a` (feat)
2. **Task 2: Wire retry notifications into processor** - `0c51041` (feat, shared with parallel 35-02 agent)

## Files Created/Modified
- `src/ai/claude-client.ts` - retryWithBackoff utility, updated sendMessage/sendMessageWithTools with onRetry callback
- `src/bot/messages.ts` - getThinkingLongerMessage (5 variants), getResilienceFailureMessage (5 variants)
- `src/pipeline/processor.ts` - Replaced manual two-try block with onRetry callback, resilience failure handling
- `src/main.ts` - Pass logger to createClaudeClient for structured retry logging
- `tests/bot/messages.test.ts` - Added tests for new message functions

## Decisions Made
- retryWithBackoff kept internal (not exported) -- processors interact through the onRetry callback parameter
- Only 429 errors trigger retry; non-429 errors pass through immediately (no blanket retry)
- "Thinking longer" message sent once per request on first retry only -- avoids spamming user
- getResilienceFailureMessage is separate from getErrorMessage -- distinct messaging for rate-limit exhaustion vs general errors
- Retry-After header respected via max(retryAfterMs, computedDelay) so we never wait less than the server requests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 2 commit was captured by a parallel 35-02 agent that committed processor.ts and main.ts changes together with its own work. Both sets of changes are correctly committed, just shared in one commit hash.
- Pre-existing type error in src/knowledge/fts.ts caused by unstaged changes from another plan (knowledge types adding version/updatedBy fields). Not related to our changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Retry infrastructure is in place for context overflow handling (35-02) and graceful degradation (35-03)
- onRetry callback pattern can be extended for other resilience scenarios

## Self-Check: PASSED

All files exist, all commits found, all key functions verified in correct files.

---
*Phase: 35-resilience*
*Completed: 2026-02-22*
