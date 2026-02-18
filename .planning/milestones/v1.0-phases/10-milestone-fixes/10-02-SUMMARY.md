---
phase: 10-milestone-fixes
plan: 02
subsystem: ai, knowledge, bot
tags: [anthropic, tool-use, is_error, retrieval, metrics, debug]

# Dependency graph
requires:
  - phase: 03-knowledge-system
    provides: "Retrieval service with search and getMetrics"
  - phase: 02-async-pipeline-claude-integration
    provides: "Claude client with sendMessageWithTools tool loop"
provides:
  - "Error-resilient tool use loop returning is_error results on exceptions"
  - "Per-chat retrieval metrics scoped by chatId"
  - "Chat-aware /debug command showing per-user stats"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "is_error tool_result pattern for graceful tool failure recovery"
    - "Per-chat Map for scoping metrics to individual conversations"

key-files:
  created: []
  modified:
    - "src/ai/claude-client.ts"
    - "src/knowledge/retrieval.ts"
    - "src/bot/handlers/debug.ts"

key-decisions:
  - "is_error: true with JSON-stringified error message lets Claude see and recover from tool failures"
  - "metricsPerChat Map replaces global lastMetrics -- each chat tracks its own retrieval stats independently"
  - "getMetrics accepts optional chatId for backward compatibility (returns zeroes without chatId)"

patterns-established:
  - "is_error tool_result: catch tool exceptions and return structured error to Claude instead of crashing"
  - "Per-chat Map scoping: use Map<string, T> keyed by chatId for per-conversation state"

# Metrics
duration: 2min
completed: 2026-02-09
---

# Phase 10 Plan 02: Resilience and Observability Fixes Summary

**Tool call error resilience via is_error results and per-chat /debug metrics scoped by chatId**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-09T15:31:24Z
- **Completed:** 2026-02-09T15:33:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Tool call exceptions are caught and returned as `is_error: true` tool results to Claude, preventing pipeline crashes
- Retrieval metrics are tracked per-chat via a `Map<string, RetrievalMetrics>` instead of a global variable
- `/debug` passes `chatId` to `getMetrics()` so each user sees only their own chat's retrieval stats
- Improved "no stats" message tells users what triggers a knowledge search

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap tool calls in try/catch with is_error result** - `0d684f8` (fix)
2. **Task 2: Per-chat retrieval metrics and /debug fix** - `774714f` (fix)

## Files Created/Modified
- `src/ai/claude-client.ts` - Added try/catch around onToolCall in tool use loop, returns is_error on exception
- `src/knowledge/retrieval.ts` - Replaced global lastMetrics with metricsPerChat Map, getMetrics accepts optional chatId
- `src/bot/handlers/debug.ts` - Extracts chatId from ctx.chat.id, passes to getMetrics, improved no-stats message

## Decisions Made
- is_error: true with JSON.stringify({ error: message }) as content -- follows Anthropic ToolResultBlockParam API convention
- getMetrics(chatId?: string) with optional parameter preserves backward compatibility
- No-stats message is actionable: tells user what to do to generate retrieval stats

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Gap 3 (tool call crashes) and Gap 7 (global debug metrics) are closed
- TypeScript compiles cleanly with all changes
- Ready for remaining milestone fix plans

## Self-Check: PASSED

---
*Phase: 10-milestone-fixes*
*Completed: 2026-02-09*
