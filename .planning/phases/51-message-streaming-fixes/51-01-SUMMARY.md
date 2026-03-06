---
phase: 51-message-streaming-fixes
plan: 01
subsystem: telegram
tags: [streaming, stream-sender, processor]
requirements-completed: [STREAM-FIX]
dependency-graph:
  requires: []
  provides: [stream-sender-accumulation, processor-accumulated-text]
  affects: [src/telegram/stream-sender.ts, src/pipeline/processor.ts]
tech-stack:
  added: []
  patterns: [tool-status-persistence, multi-turn-accumulation]
key-files:
  created:
    - tests/telegram/stream-sender.test.ts
  modified:
    - src/telegram/stream-sender.ts
    - src/pipeline/processor.ts
decisions:
  - Tool status hints persisted as <i> HTML tags in accumulated text
  - finalize override only used when onboarding marker extraction changes text
  - Non-streaming fallback path intentionally unchanged
metrics:
  duration: 3min
  completed: "2026-03-06T14:46:21Z"
  tasks: 2
  files: 3
---

# Phase 51 Plan 01: Message Streaming Fixes Summary

Stream-sender now accumulates tool status hints as persistent `<i>` HTML and exposes `getAccumulatedText()`; processor uses accumulated text for finalize/DB-save instead of overriding with last-turn-only `response.text`.

## What Shipped

Three streaming bugs fixed:

1. **Finalize no longer overwrites multi-turn text.** The processor previously passed `response.text` (last turn only) as the finalize override, wiping all accumulated multi-turn content. Now it passes `undefined` to let the stream-sender's accumulated text be used.

2. **Intermediate text before tool calls preserved.** Text streamed before a tool call (e.g., "OK I'll look that up") is now part of the accumulated text and survives through finalize.

3. **Tool status labels persist as faded hints.** `showToolStatus()` now appends `<i>label</i>` to the accumulated text permanently. `clearToolStatus()` only clears the live streaming indicator, not the persisted hint.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 (RED) | Stream-sender failing tests | b5a213c | tests/telegram/stream-sender.test.ts (12 tests) |
| 1 (GREEN) | Stream-sender accumulation | 72ca22e | src/telegram/stream-sender.ts |
| 2 | Processor uses accumulated text | fa49080 | src/pipeline/processor.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx vitest run tests/telegram/stream-sender.test.ts` -- 12/12 pass
- `npx vitest run tests/pipeline/` -- 40/40 pass
- `npm test` -- 321/327 pass (6 pre-existing failures in reminders/notifications, unrelated)
- `npm run typecheck` -- 1 pre-existing error in onboarding/prompt.ts, unrelated

## Pre-existing Issues (Out of Scope)

- `src/onboarding/prompt.ts:35` -- TypeScript error: `'"recipes"'` not comparable to `'"preferences" | "tour" | "tour_only"'`
- `tests/reminders/generator.test.ts` -- 12 failing tests related to start_cooking behavior
- `tests/notifications/update-notifier.test.ts` -- 4 failing tests related to notification delivery
