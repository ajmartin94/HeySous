---
phase: 37-streaming
plan: 01
subsystem: ai, telegram
tags: [streaming, anthropic-sdk, telegram-bot-api, progressive-delivery]

# Dependency graph
requires:
  - phase: 35-error-resilience
    provides: retryWithBackoff for 429 handling in claude-client
provides:
  - StreamCallbacks interface for streaming event handling
  - streamMessageWithTools method on Claude client
  - createTelegramStreamSender factory for progressive message delivery
  - getToolStatusLabel mapping for all 18 tools
affects: [37-02-streaming-integration, pipeline, processor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MessageStream API for streaming Claude responses (client.messages.stream)"
    - "Time-based edit pacing (300ms debounce) for Telegram rate limit compliance"
    - "Cursor placeholder pattern for instant user feedback during streaming"
    - "Plain text during streaming, HTML only on final edit"

key-files:
  created:
    - src/ai/tool-status.ts
    - src/telegram/stream-sender.ts
  modified:
    - src/ai/claude-client.ts

key-decisions:
  - "Plain text parse_mode during streaming to avoid HTML errors on partial Claude output; HTML only on final edit"
  - "300ms edit interval balances responsiveness with Telegram rate limits"
  - "Short replies (under 50 chars) sent as fresh messages to avoid cursor flicker"
  - "Long replies (over 4096 chars) delete streamed message and re-send with splitting"
  - "onText callback fires on every iteration; caller decides how to handle partial text before tool calls"

patterns-established:
  - "Stream sender lifecycle: sendPlaceholder -> appendText/showToolStatus -> finalize"
  - "Typing indicator keep-alive alongside streaming content (belt and suspenders)"
  - "All Telegram API errors caught and logged at debug level, never thrown"

requirements-completed: [PERF-04]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 37 Plan 01: Streaming Infrastructure Summary

**Claude client streaming method with multi-iteration tool loop support and Telegram stream sender with cursor, tool status, and 300ms edit pacing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T03:18:03Z
- **Completed:** 2026-02-23T03:22:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Tool status labels for all 18 tools with natural Sous-voice personality
- Claude client streaming method using Anthropic SDK MessageStream API with full tool loop support
- Telegram stream sender managing complete message lifecycle: placeholder cursor, incremental edits, inline tool status, and clean finalization
- Smart finalize path: short replies as fresh messages, normal replies with HTML formatting, long replies with splitting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tool status labels and Claude client streaming method** - `3190b0d` (feat)
2. **Task 2: Create Telegram stream sender module** - `f9dfb2f` (feat)

## Files Created/Modified
- `src/ai/tool-status.ts` - Tool name to friendly status label mapping (18 tools + fallback)
- `src/ai/claude-client.ts` - Added StreamCallbacks interface and streamMessageWithTools method
- `src/telegram/stream-sender.ts` - Progressive message delivery with cursor, edit pacing, tool status

## Decisions Made
- Plain text parse_mode during streaming to avoid HTML errors on partial Claude output; only finalize() uses HTML
- 300ms edit interval chosen as balance between responsiveness and Telegram rate limits
- Short replies (under 50 chars) sent as fresh messages to avoid cursor/edit flicker
- Long replies (over 4096 chars) delete streamed message and use existing sendFormattedMessage with splitting
- onText callback fires on every stream iteration (including tool-use iterations) -- the bridge/caller decides display behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Streaming infrastructure modules compile and are ready for integration
- Plan 02 can wire streamMessageWithTools and createTelegramStreamSender into the processor pipeline
- Existing non-streaming code paths are completely untouched

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 37-streaming*
*Completed: 2026-02-23*
