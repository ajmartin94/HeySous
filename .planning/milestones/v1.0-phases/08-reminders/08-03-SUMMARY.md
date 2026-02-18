---
phase: 08-reminders
plan: "03"
subsystem: reminders
tags: [poller, sender, claude-generation, telegram-api, interval, crash-safety]

dependency-graph:
  requires: ["08-01"]
  provides: ["reminder-sender", "reminder-poller"]
  affects: ["08-04"]

tech-stack:
  added: []
  patterns: ["mark-before-send duplicate prevention", "setInterval poller", "minimal interface deps"]

key-files:
  created:
    - src/reminders/sender.ts
    - src/reminders/poller.ts
  modified: []

decisions:
  - id: "08-03-01"
    description: "Minimal interface types for sender deps (BotApi, ClaudeClient, RetrievalService) to decouple from grammY/Anthropic types"
  - id: "08-03-02"
    description: "Separate PREP_ALERT_SYSTEM_PROMPT with recipe analysis instructions vs generic REMINDER_SYSTEM_PROMPT"
  - id: "08-03-03"
    description: "Plain-text fallbacks per reminder type when Claude API fails"
  - id: "08-03-04"
    description: "Poller tick() exposed publicly for testing"

metrics:
  duration: "2 min"
  completed: "2026-02-09"
---

# Phase 8 Plan 03: Reminder Sender and Poller Summary

**Reminder engine runtime: Claude-powered text generation with crash-safe 60s polling loop**

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Reminder sender with Claude text generation | 97d084d | src/reminders/sender.ts |
| 2 | Reminder poller with 60-second interval | f722e87 | src/reminders/poller.ts |

## What Was Built

### Reminder Sender (`src/reminders/sender.ts`)
- `createReminderSender(deps)` factory with minimal interface dependencies
- Claude generates varied, persona-consistent text per reminder type:
  - **morning_summary**: Cheerful overview of today's meals, or a no-plan nudge
  - **prep_alert**: Analyzes actual recipe content to determine advance prep needs
  - **start_cooking**: Energetic "time to cook" notification
- Fetches recipe content via `retrievalService.getItem()` for prep alerts
- Plain-text fallback messages when Claude API fails
- Telegram 403 (bot blocked) handled as warning, not error
- Outer try/catch ensures sender NEVER throws

### Reminder Poller (`src/reminders/poller.ts`)
- `createReminderPoller(deps)` factory with start/stop/tick lifecycle
- Polls `getDueReminders()` every 60 seconds via `setInterval`
- **Mark-before-send pattern**: Calls `markSent(id, "")` BEFORE delivery attempt to prevent duplicates on crash/restart
- Failed deliveries override via `markFailed(id)`
- Immediate `tick()` call on startup to process overdue reminders
- Sequential processing to respect Telegram rate limits
- Triple-layer error handling (per-reminder, per-tick, per-interval)

## Decisions Made

1. **Minimal interface types** for sender deps (BotApi, ClaudeClient, RetrievalService) rather than importing full module types -- keeps sender decoupled and testable
2. **Separate system prompts** for prep alerts (recipe analysis focus) vs general reminders (persona focus)
3. **Per-type fallback text** when Claude API fails, not a generic "reminder" message
4. **Poller tick() exposed publicly** for testing without needing to wait for setInterval

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- [x] `npx tsc --noEmit` passes
- [x] `createReminderSender` exported from sender.ts
- [x] `createReminderPoller` exported from poller.ts
- [x] Sender fetches recipe content for prep_alert type
- [x] Mark-sent-before-send pattern in poller
- [x] Poller has start/stop/tick lifecycle
- [x] Overdue reminders processed on startup (immediate tick)
- [x] All errors caught -- neither sender nor poller ever crash

## Next Phase Readiness

Plan 08-04 (wiring) can now integrate sender and poller into main.ts. Both modules expose clean factory function interfaces that follow existing codebase patterns.

## Self-Check: PASSED
