---
phase: 02-async-pipeline-claude-integration
plan: 02
subsystem: pipeline
tags: [debounce, message-queue, sliding-window, vitest, fake-timers, tdd]

# Dependency graph
requires:
  - phase: 01-bot-foundation
    provides: "Test infrastructure (vitest), project structure, ESM conventions"
provides:
  - "MessageQueue class with sliding debounce window for batching rapid messages"
  - "PendingBatch and ProcessFn types for pipeline integration"
  - "createMessageQueue factory function"
affects: [02-03-pipeline-processor, message-handler-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Map-based in-process debounce queue per chatId"
    - "Delete-before-process anti-double-processing pattern"
    - "Fire-and-forget processFn with error swallowing"

key-files:
  created:
    - src/pipeline/message-queue.ts
    - tests/pipeline/message-queue.test.ts
  modified: []

key-decisions:
  - "1500ms default debounce window per research recommendation"
  - "Delete batch from map BEFORE calling processFn (Pitfall 3 from research)"
  - "processFn errors caught silently -- queue must never crash on processor errors"
  - "ctx typed as unknown for context-type agnosticism (real BotContext injected at call site)"

patterns-established:
  - "Fake timer testing: vi.useFakeTimers / vi.advanceTimersByTime for precise timing control"
  - "TDD RED-GREEN-REFACTOR with atomic commits per phase"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 2 Plan 2: Message Debounce Queue Summary

**Map-based sliding-window debounce queue batching rapid messages per chatId with delete-before-process anti-double-processing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T13:19:49Z
- **Completed:** 2026-02-06T13:22:06Z
- **Tasks:** 3 (TDD RED/GREEN/REFACTOR)
- **Files created:** 2

## Accomplishments

- MessageQueue class with configurable debounce window (default 1500ms) batches rapid consecutive messages per chatId
- Sliding window resets on each new message -- preventing premature batch delivery
- Anti-double-processing: batch deleted from internal map before processFn fires, allowing new messages during processing to start fresh
- 18 comprehensive tests using vitest fake timers covering all behavior cases
- All 57 tests pass (18 new + 39 existing)

## Task Commits

Each TDD phase was committed atomically:

1. **RED: Failing tests for debounce queue** - `6fa88f9` (test)
2. **GREEN: Implement MessageQueue** - `69b1421` (feat)
3. **REFACTOR: Clean up implementation** - `325b741` (refactor)

## Files Created/Modified

- `src/pipeline/message-queue.ts` (91 lines) - MessageQueue class, PendingBatch interface, ProcessFn type, createMessageQueue factory
- `tests/pipeline/message-queue.test.ts` (324 lines) - 18 tests covering: single/multi message batches, sliding window, independent chats, anti-double-processing, pendingCount, shutdown, configurable window, error handling, factory

## Decisions Made

- **1500ms default debounce:** Per research recommendation -- long enough to catch rapid-fire message bursts (200-800ms), short enough users don't feel ignored
- **Delete-before-process:** Prevents double-processing race condition (Pitfall 3 from research). New messages during async processing start a fresh batch.
- **Fire-and-forget processFn:** Queue calls processFn but does not await it. Errors caught with `.catch()` to prevent queue crashes. Logging deferred to pipeline processor layer.
- **ctx as unknown:** Queue is context-type agnostic. Real BotContext type will be used at the call site in the message handler.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MessageQueue ready for pipeline processor (Plan 02-03) to consume
- ProcessFn signature matches the processor pattern from research
- createMessageQueue factory available for main.ts wiring
- No blockers for Plan 02-03

## Self-Check: PASSED

---
*Phase: 02-async-pipeline-claude-integration*
*Completed: 2026-02-06*
