---
phase: 02-async-pipeline-claude-integration
plan: 03
subsystem: pipeline, api, bot
tags: [claude, anthropic, debounce, async-pipeline, token-tracking, admin-commands, retry, timeout]

# Dependency graph
requires:
  - phase: 02-01
    provides: Claude client, system prompt, token usage schema, config with anthropicApiKey/model/adminUserIds
  - phase: 02-02
    provides: MessageQueue with debounce batching, PendingBatch interface, ProcessFn type
  - phase: 01-03
    provides: sendFormattedMessage with HTML fallback and message splitting
provides:
  - Pipeline processor (createProcessor) orchestrating Claude call -> response -> token logging
  - /costs admin command handler (createCostsHandler) with usage summary
  - Message handler factory (createMessageHandler) wired to debounce queue
  - Full end-to-end async pipeline: message -> debounce -> Claude -> response -> log
  - Database context injection into bot handlers
affects: [03-knowledge-system, 04-conversation-memory, 05-recipe-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline processor pattern: typing -> Claude with retry -> timeout warning -> formatted response -> db+pino logging"
    - "Factory injection for all handlers: createMessageHandler(queue, processBatch), createCostsHandler(db)"
    - "BotContext extended with db property via middleware injection"
    - "createBot accepts pre-built handlers via options object"

key-files:
  created:
    - src/pipeline/processor.ts
    - src/bot/handlers/costs.ts
  modified:
    - src/bot/context.ts
    - src/bot/handlers/message.ts
    - src/bot/index.ts
    - src/main.ts
    - src/db/index.ts

key-decisions:
  - "Factory pattern for all new handlers (createMessageHandler, createCostsHandler, createProcessor) -- consistent with existing codebase"
  - "Database injected into BotContext via middleware, not global singleton"
  - "Costs handler registered before message handler to ensure command priority over catch-all"
  - "Processor never throws -- outer try/catch with in-character error message for fire-and-forget safety"
  - "One silent retry before user-facing error (two attempts total)"

patterns-established:
  - "Handler factory injection: createBot(token, { costsHandler, messageHandler, db })"
  - "Pipeline processor: typing -> call with retry -> timeout warning -> send -> log to db + pino"
  - "Admin-only commands: silent return for non-admin users (no error message)"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 2 Plan 3: Async Pipeline Integration Summary

**End-to-end async pipeline: message -> debounce queue -> Claude with retry/timeout -> formatted response -> token usage logged to db and pino, plus /costs admin command**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T13:27:47Z
- **Completed:** 2026-02-06T13:31:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Pipeline processor orchestrates full message lifecycle: typing indicator, Claude call with 1 silent retry, 30s timeout warning, formatted response delivery, token usage to database and pino structured logs
- /costs admin command queries tokenUsage table for aggregate stats (total requests, cost, tokens, cache hit rate)
- Message handler replaced from Phase 1 echo mode to async enqueue pattern (returns immediately, no webhook timeout)
- Complete dependency wiring in main.ts: db -> claudeClient -> queue -> processor -> handlers -> bot
- Graceful shutdown clears queue timers before stopping bot

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline processor with retry, timeout, and token logging** - `6e00235` (feat)
2. **Task 2: Wire the complete async pipeline end-to-end** - `818795f` (feat)

## Files Created/Modified

- `src/pipeline/processor.ts` - Pipeline processor: typing -> Claude with retry -> timeout -> send -> log usage
- `src/bot/handlers/costs.ts` - /costs admin command with aggregate usage stats
- `src/bot/context.ts` - BotContext extended with db property
- `src/bot/handlers/message.ts` - Replaced echo handler with async enqueue factory
- `src/bot/index.ts` - createBot now accepts pre-built handlers via options
- `src/main.ts` - Full dependency wiring: db, claudeClient, queue, processor, handlers, bot
- `src/db/index.ts` - Added DrizzleDatabase type export

## Decisions Made

- Factory pattern for all new handlers (createMessageHandler, createCostsHandler, createProcessor) -- consistent with existing codebase conventions
- Database injected into BotContext via middleware, not a global singleton -- keeps testability
- Costs handler registered before message handler to ensure /costs command is matched before the catch-all message:text handler
- Pipeline processor wrapped in outer try/catch that never throws -- safe for fire-and-forget from debounce queue
- One silent retry before user-facing error message (two attempts total, matching maxRetries: 0 on the SDK client)
- Admin-only /costs: non-admin users see nothing (silent return, no error message) -- per locked decision

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required. ANTHROPIC_API_KEY and ADMIN_USER_IDS were already configured in 02-01 plan.

## Next Phase Readiness

- Complete async pipeline is operational: messages -> debounce -> Claude -> response -> logging
- Phase 2 is fully complete (3/3 plans done)
- Ready for Phase 3 (Knowledge System): conversation context, recipe extraction, preference learning
- Token usage tracking provides cost visibility from day one
- System prompt function (buildSystemPrompt) ready for context injection in Phase 3+

## Self-Check: PASSED

---
*Phase: 02-async-pipeline-claude-integration*
*Completed: 2026-02-06*
