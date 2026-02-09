---
phase: 08-reminders
plan: 04
subsystem: reminders
tags: [integration, wiring, dependency-injection, poller, lifecycle]
depends_on: ["08-01", "08-02", "08-03"]
provides:
  - "/reminders command handler"
  - "Full reminder system wiring in main.ts"
  - "Processor integration (tools + context)"
  - "Database table initialization"
  - "Poller lifecycle management"
affects:
  - "09-polish (full system is now wired)"
tech-stack:
  added: []
  patterns:
    - "Factory function DI wiring in main.ts"
    - "Poller lifecycle: start after bot ready, stop before bot stop"
    - "Startup regeneration for restart safety"
key-files:
  created:
    - "src/bot/handlers/reminders.ts"
  modified:
    - "src/bot/index.ts"
    - "src/db/index.ts"
    - "src/pipeline/processor.ts"
    - "src/main.ts"
decisions:
  - "Bot type cast for sender's minimal BotApi interface (intentional decoupling)"
  - "regenerateReminders helper function in main.ts shared between startup and tool handler"
  - "Poller starts AFTER webhook/polling setup, stops FIRST in shutdown"
metrics:
  duration: "5 min"
  completed: "2026-02-09"
---

# Phase 8 Plan 4: Integration Wiring Summary

**One-liner:** Full reminder system wiring -- /reminders handler, processor tools+context, DB init, poller lifecycle, startup regeneration.

## What Was Done

### Task 1: /reminders command handler and bot registration
- Created `createRemindersHandler` factory in `src/bot/handlers/reminders.ts`
- Handler shows formatted HTML with morning summary ON/OFF, prep alerts ON/OFF, dinner time, timezone, and muted status
- Registered `remindersHandler` in `CreateBotOptions` interface and middleware chain (after groceryHandler, before messageHandler)
- Updated middleware order comment (now 13 middleware slots)

### Task 2: Database init, processor integration, and main.ts wiring
- **db/index.ts:** Added `initializeReminders(sqlite)` call after `initializeGrocery`
- **processor.ts:** Added `REMINDER_TOOLS` to allTools array, `buildReminderContext` injection into system prompt, `reminderRepository` and `generateRemindersFn` to ProcessorDeps and createToolHandler
- **main.ts:** Full wiring:
  - Created `reminderRepository` via factory
  - Created `regenerateReminders` helper function (shared by tool handler and startup)
  - Passed `reminderRepository` and `generateRemindersFn` to processor
  - Created `remindersHandler` and added to bot
  - Created `reminderSender` with `retrievalService` for recipe content fetching
  - Created `reminderPoller` with sender and repository
  - Startup regeneration: iterates all active settings and regenerates reminders
  - Poller starts after webhook/polling setup
  - Shutdown order: poller.stop() -> queue.shutdown() -> bot.stop()

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | /reminders handler + bot registration | 3cafa9c | src/bot/handlers/reminders.ts, src/bot/index.ts |
| 2 | DB init + processor + main.ts wiring | 03ae208 | src/db/index.ts, src/pipeline/processor.ts, src/main.ts |

## Decisions Made

1. **Bot type cast for sender:** The sender's minimal `BotApi` interface is intentionally decoupled from grammY types. Used `Parameters<typeof createReminderSender>[0]["bot"]` cast to bridge the type gap without modifying the sender.
2. **Shared regenerateReminders helper:** Created a helper function in main.ts that wraps `generateReminders` with repository lookups, used both by the tool handler callback and startup regeneration loop.
3. **Startup regeneration before poller start:** Regenerate reminders for all active chats before starting the poller to ensure no lost reminders after restart.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with zero project source errors
- `src/db/index.ts` calls `initializeReminders(sqlite)`
- `/reminders` command registered in bot middleware chain
- `REMINDER_TOOLS` in processor's allTools array
- `reminderContext` injected into `buildSystemPrompt`
- Poller starts on boot, stops first on shutdown
- Reminders regenerated on startup for all active settings
- `createReminderSender` receives `retrievalService`

## Next Phase Readiness

Phase 8 (Reminders) is now complete. The full reminder system is wired and operational:
- Repository (08-01) provides CRUD
- Intelligence (08-02) provides tools, prompts, generator, context
- Sender/Poller (08-03) provides delivery and scheduling
- Integration (08-04) wires everything together

Ready for Phase 9 (Polish) which can focus on final refinements.

## Self-Check: PASSED
