---
phase: 08-reminders
verified: 2026-02-08T19:30:00Z
status: passed
score: 5/5 success criteria verified
---

# Phase 8: Reminders Verification Report

**Phase Goal:** System proactively sends prep reminders that survive restarts and respect the user's schedule

**Verified:** 2026-02-08T19:30:00Z

**Status:** PASSED

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User receives a morning prep summary -- what's for dinner, what needs doing today | ✓ VERIFIED | `generateReminders()` creates `morning_summary` reminders at `settings.morningTime` with meal context. Sender generates text via Claude with meal details. Poller queries and delivers daily. |
| 2 | Time-aware reminders fire based on recipe analysis ("defrost chicken by 8am") | ✓ VERIFIED | `prep_alert` reminders created day-before at `morningTime`. Sender fetches recipe via `retrievalService.getItem()`, passes full content to Claude with `PREP_ALERT_SYSTEM_PROMPT` for advance prep analysis. |
| 3 | Reminders persist across process restarts -- no lost reminders on deploy or crash | ✓ VERIFIED | All reminders stored in SQLite `reminders` table. `main.ts` regenerates on startup via `getAllActiveSettings()` loop. Poller mark-before-send pattern prevents duplicates. `getDueReminders()` processes overdue on first `tick()`. |
| 4 | All reminders respect the user's timezone | ✓ VERIFIED | `ReminderSettings.timezone` stored as IANA string. `localTimeToUtc()` in generator converts user local time to UTC using `Intl.DateTimeFormat` offset resolution. All `dueAt` times stored/queried in UTC. |
| 5 | User can mute or adjust reminders through conversation | ✓ VERIFIED | `update_reminder_settings` tool accepts `muted_until`, `morning_time`, `dinner_time`, `timezone`, enable/disable toggles. Tool handler calls `upsertSettings()` then auto-regenerates. Claude has `REMINDER_PROMPT` instructions for natural conversation. `/reminders` command shows current settings. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/reminders/types.ts` | Shared TypeScript interfaces | ✓ VERIFIED | 51 lines. Exports `ReminderType`, `ReminderStatus`, `ReminderSettings`, `Reminder`. All with JSDoc. |
| `src/reminders/schema.ts` | Drizzle schema for tables | ✓ VERIFIED | 51 lines. Exports `reminderSettings` and `reminders` tables. Matches types exactly. |
| `src/reminders/init.ts` | Raw SQL CREATE TABLE IF NOT EXISTS | ✓ VERIFIED | 38 lines. `initializeReminders()` creates both tables. UNIQUE constraint on chat_id. CHECK constraints on type/status enums. |
| `src/reminders/repository.ts` | CRUD operations factory | ✓ VERIFIED | 325 lines. `createReminderRepository()` returns 11 methods. Raw SQLite queries. Boolean/timestamp conversions. COALESCE upsert pattern. |
| `src/reminders/generator.ts` | Generates reminder rows from plans | ✓ VERIFIED | 293 lines. `generateReminders()` creates 3 types. `localTimeToUtc()` timezone conversion. No-plan nudge logic. 1-minute dedup window. |
| `src/reminders/context.ts` | System prompt context builder | ✓ VERIFIED | 56 lines. `buildReminderContext()` returns XML summary. Same pattern as grocery/planning context. |
| `src/reminders/sender.ts` | Claude-powered Telegram delivery | ✓ VERIFIED | 297 lines. `createReminderSender()` factory. Fetches recipe content for prep alerts. Separate system prompts per type. Fallback text. Never throws. |
| `src/reminders/poller.ts` | 60s interval polling loop | ✓ VERIFIED | 143 lines. `createReminderPoller()` factory. Mark-before-send duplicate prevention. Immediate overdue processing. start/stop/tick lifecycle. |
| `src/bot/handlers/reminders.ts` | /reminders command handler | ✓ VERIFIED | 54 lines. Shows formatted settings with timezone, times, toggles, muted status. Factory pattern matches existing handlers. |
| `src/ai/tools.ts` | REMINDER_TOOLS definitions | ✓ VERIFIED | Contains `get_reminder_settings`, `update_reminder_settings`, `regenerate_reminders`. Exported as `REMINDER_TOOLS` array. |
| `src/ai/tool-handler.ts` | Tool dispatch for reminder tools | ✓ VERIFIED | 3 new cases dispatch to `reminderRepository` methods. Auto-regenerates after settings update. Optional deps with guards. |
| `src/ai/system-prompt.ts` | REMINDER_PROMPT instructions | ✓ VERIFIED | `REMINDER_PROMPT` constant teaches timezone mapping, settings management, casual tone. `buildSystemPrompt()` accepts 4th `reminderContext` param. Injected after grocery context. |
| `src/db/index.ts` | Table initialization | ✓ VERIFIED | Calls `initializeReminders(sqlite)` in `createDatabase()` after grocery init. |
| `src/db/schema.ts` | Re-exports reminder tables | ✓ VERIFIED | Re-exports `reminderSettings` and `reminders` from `../reminders/schema.js`. |
| `src/pipeline/processor.ts` | Processor integration | ✓ VERIFIED | `REMINDER_TOOLS` in allTools array. `buildReminderContext()` called and injected. `reminderRepository` and `generateRemindersFn` in deps. |
| `src/bot/index.ts` | Handler registration | ✓ VERIFIED | `remindersHandler` in `CreateBotOptions`. Registered after groceryHandler, before messageHandler. Middleware order comment updated (13 slots). |
| `src/main.ts` | Full wiring and lifecycle | ✓ VERIFIED | Creates reminderRepository, sender (with retrievalService), poller. Regenerates on startup for all active chats. Poller starts after bot ready. Shutdown: poller.stop() -> queue.shutdown() -> bot.stop(). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `generator.ts` | `repository.ts` | Calls createReminder, hasPendingReminder | ✓ WIRED | `generateReminders()` calls `reminderRepository.createReminder()` for each type. Uses `hasPendingReminder()` with ±1min window to prevent duplicates. |
| `tool-handler.ts` | `repository.ts` | Tool cases call CRUD methods | ✓ WIRED | `get_reminder_settings` calls `getOrCreateSettings()`. `update_reminder_settings` calls `upsertSettings()`. Both guard on `reminderRepository` existence. |
| `system-prompt.ts` | `reminderContext` | New parameter injected | ✓ WIRED | `buildSystemPrompt(preferences, planContext, groceryContext, reminderContext)` signature. Context injected: `${reminderContext ? "\n" + reminderContext : ""}${REMINDER_PROMPT}`. |
| `poller.ts` | `repository.ts` | Queries getDueReminders every 60s | ✓ WIRED | `tick()` calls `getDueReminders()`. Marks sent before send. Overrides to failed on delivery failure. |
| `sender.ts` | `bot.api.sendMessage` | Sends proactive Telegram messages | ✓ WIRED | `sendReminder()` calls `bot.api.sendMessage(chatId, text, {parse_mode: "HTML"})`. Handles 403 (blocked) gracefully. |
| `sender.ts` | Anthropic API | Generates reminder text with Claude | ✓ WIRED | `claudeClient.sendMessage([prompt], systemPrompt)` called for each reminder. Token usage logged. Fallback on error. |
| `sender.ts` | `retrievalService` | Fetches recipe content for prep alerts | ✓ WIRED | For `prep_alert` type: calls `retrievalService.getItem(knowledgeItemId, chatId)`. Passes full recipe content to Claude for analysis. Fallback if item missing. |
| `main.ts` | `poller.start()` | Poller starts on boot | ✓ WIRED | After webhook/polling setup: creates sender, poller, regenerates for all active chats, calls `poller.start()`. Immediate tick processes overdue. |
| `main.ts` | `poller.stop()` | Poller stops on shutdown | ✓ WIRED | Shutdown handler: `poller.stop()` FIRST, then queue, then bot. Registered on SIGINT and SIGTERM. |
| `processor.ts` | `REMINDER_TOOLS` | Tools available to Claude | ✓ WIRED | `allTools = [...KNOWLEDGE_TOOLS, ...PLAN_TOOLS, ...GROCERY_TOOLS, ...REMINDER_TOOLS]`. Passed to `sendMessageWithTools()`. |
| `processor.ts` | `buildReminderContext` | Context injected into system prompt | ✓ WIRED | Step g5: `const reminderContext = deps.reminderRepository ? buildReminderContext(deps.sqlite, chatId) : ""`. Passed as 4th arg to `buildSystemPrompt()`. |
| `bot/index.ts` | `remindersHandler` | Handler registered in middleware chain | ✓ WIRED | `bot.use(remindersHandler)` after groceryHandler, before messageHandler. Handler in CreateBotOptions interface. |
| `db/index.ts` | `initializeReminders` | Tables created on database init | ✓ WIRED | `createDatabase()` calls `initializeReminders(sqlite)` after grocery init. Tables exist before repository use. |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| REMIND-01: Daily prep summary sent each morning | ✓ SATISFIED | `morning_summary` reminders generated for each day in active plan range. Sender delivers with meal list or no-plan nudge. |
| REMIND-02: Time-aware prep reminders based on recipe analysis | ✓ SATISFIED | `prep_alert` reminders fetch actual recipe content via retrievalService. Claude analyzes with `PREP_ALERT_SYSTEM_PROMPT` to determine advance prep needs. |
| REMIND-03: Reminders persist across process restarts | ✓ SATISFIED | All reminders in SQLite. Startup regeneration for all active chats. Poller immediate tick processes overdue. Mark-before-send prevents duplicates. |
| REMIND-04: Reminders respect user's timezone | ✓ SATISFIED | IANA timezone in settings. `localTimeToUtc()` converts local time to UTC. All queries/comparisons in UTC. |
| REMIND-05: User can mute or adjust reminders through conversation | ✓ SATISFIED | `update_reminder_settings` tool with all fields. Claude has `REMINDER_PROMPT` for natural conversation. `/reminders` command shows current state. |

### Anti-Patterns Found

None. All reminder files are substantive implementations with no TODOs, placeholders, or stub patterns.

### Human Verification Required

#### 1. Morning Summary Delivery

**Test:** Set morning time to a few minutes in the future. Create a meal plan for today. Wait for morning time.

**Expected:** Receive a Telegram message with cheerful summary of today's meals.

**Why human:** Requires waiting for real time-based trigger and verifying actual Telegram delivery.

#### 2. No-Plan Nudge

**Test:** Set morning time to a few minutes in the future. Ensure no meal plan exists for today. Wait for morning time.

**Expected:** Receive a friendly nudge asking if you want to plan something for today. Not guilt-trippy, just helpful.

**Why human:** Requires verifying tone and phrasing of nudge message matches persona.

#### 3. Prep Alert with Recipe Analysis

**Test:** Create a recipe with marinating or defrosting step. Add to tomorrow's plan. Set morning time to a few minutes ahead. Wait.

**Expected:** Receive reminder mentioning the specific prep need (e.g., "defrost the chicken", "start marinating the steak"). Recipe-specific, not generic.

**Why human:** Requires Claude recipe analysis quality check -- does it identify the right prep task?

#### 4. Start-Cooking Nudge

**Test:** Set dinner time to a few minutes ahead. Have a dinner planned for today. Wait.

**Expected:** Receive energetic "time to start cooking [recipe name]!" message.

**Why human:** Requires verifying message tone and timing accuracy.

#### 5. Timezone Handling

**Test:** Set timezone to Pacific. Set morning time to 8:00am. Check what UTC time the reminder is actually scheduled for.

**Expected:** Reminder due_at is 8:00am Pacific converted to UTC (e.g., 16:00 UTC during PST, 15:00 UTC during PDT).

**Why human:** Requires manual timezone offset verification and DST handling check.

#### 6. Restart Safety

**Test:** Create reminders for future times. Stop bot process. Restart bot. Check if reminders still fire.

**Expected:** Reminders fire at their scheduled times even after restart. No duplicates sent.

**Why human:** Requires process control and observing behavior across restart boundary.

#### 7. Conversational Settings Management

**Test:** Say "mute reminders until next Monday" or "change my morning time to 7am" or "turn off prep alerts".

**Expected:** Claude uses the tool, confirms the change naturally, and settings actually update. Reminders regenerate to reflect new times.

**Why human:** Requires natural language interaction and verifying Claude's conversational flow.

#### 8. /reminders Command Display

**Test:** Run `/reminders` command.

**Expected:** Clean HTML-formatted display showing timezone, morning time (with ON/OFF), prep alerts (ON/OFF), dinner time, and muted status if applicable.

**Why human:** Requires visual verification of Telegram HTML rendering.

---

## Gaps Summary

No gaps found. All success criteria are verified through code inspection and structural verification.

The reminder system is fully implemented with:
- Complete data layer with timezone-aware UTC storage
- Intelligent generator creating 3 types of reminders from meal plans
- Claude-powered sender fetching recipe content for prep alert analysis
- Crash-safe 60-second poller with mark-before-send duplicate prevention
- Startup regeneration for restart safety
- Full conversational tools and system prompt integration
- /reminders command for instant settings display
- Proper dependency injection and lifecycle management

All must-haves from all 4 plans are present, substantive, and wired correctly.

Human verification is needed only to confirm real-time behavior, timezone accuracy, and Claude's tone/quality in generated messages -- all things that cannot be verified by static code analysis.

---

_Verified: 2026-02-08T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
