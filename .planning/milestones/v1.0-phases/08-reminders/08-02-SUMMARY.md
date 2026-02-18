---
phase: 08-reminders
plan: 02
subsystem: reminders
tags: [reminders, generator, tools, system-prompt, timezone]

dependency-graph:
  requires: ["08-01"]
  provides: ["reminder-generator", "reminder-tools", "reminder-context", "reminder-prompt"]
  affects: ["08-03", "08-04"]

tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat for timezone UTC offset resolution"
    - "REMINDER_TOOLS as separate export (same as PLAN_TOOLS, GROCERY_TOOLS)"
    - "Optional deps with early-return guard for reminder tools in tool handler"
    - "REMINDER_PROMPT always included regardless of reminderContext existence"

key-files:
  created:
    - src/reminders/generator.ts
    - src/reminders/context.ts
  modified:
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts

decisions:
  - id: "08-02-01"
    description: "localTimeToUtc uses Intl.DateTimeFormat to resolve UTC offset for any IANA timezone"
  - id: "08-02-02"
    description: "1-minute dedup window around due_at for hasPendingReminder checks"
  - id: "08-02-03"
    description: "update_reminder_settings auto-regenerates reminders after any change"
  - id: "08-02-04"
    description: "REMINDER_PROMPT always appended to system prompt (after GROCERY_LIST_PROMPT)"
  - id: "08-02-05"
    description: "buildSystemPrompt reminderContext is optional 4th param for backward compat"
  - id: "08-02-06"
    description: "Empty string muted_until in tool input means unmute (null)"

metrics:
  duration: "4 min"
  completed: "2026-02-09"
---

# Phase 8 Plan 2: Reminder Intelligence Layer Summary

**One-liner:** Reminder generator creates morning/prep/cooking rows from meal plans with no-plan nudges, Claude tools manage settings through conversation, REMINDER_PROMPT teaches Sous natural reminder handling.

## What Was Built

### Reminder Generator (`src/reminders/generator.ts`)
- `generateReminders()` creates three types of reminder rows from active meal plans:
  - **morning_summary**: Daily overview at configured morning time; generates "no_plan_nudge" context for days without meals
  - **prep_alert**: Day-before morning alert for recipes with knowledgeItemId; skips meals on today
  - **start_cooking**: Dinner-time nudge for every dinner entry
- Private `localTimeToUtc()` converts user local time to UTC using `Intl.DateTimeFormat` offset resolution
- Only generates for today through end of last active plan; skips past dates
- Uses `hasPendingReminder()` with 1-minute window to prevent duplicates

### Reminder Context Builder (`src/reminders/context.ts`)
- `buildReminderContext()` provides lightweight XML summary of settings for system prompt
- Shows timezone, times, enabled states, and mute status
- Same pattern as `buildGroceryContext()` -- keeps prompt tokens low

### REMINDER_TOOLS (`src/ai/tools.ts`)
- `get_reminder_settings` -- read current settings
- `update_reminder_settings` -- modify timezone, times, enable/disable, mute/unmute
- `regenerate_reminders` -- trigger full reminder regeneration from plans

### Tool Handler Updates (`src/ai/tool-handler.ts`)
- Added optional `reminderRepository` and `generateRemindersFn` deps
- Three new cases dispatch to reminder repository methods
- `update_reminder_settings` auto-regenerates after changes
- Empty string `muted_until` unmutes (sets to null)

### System Prompt Updates (`src/ai/system-prompt.ts`)
- `REMINDER_PROMPT` teaches Sous reminder management conversation patterns
- Covers timezone mapping (PST -> America/Los_Angeles etc.)
- `buildSystemPrompt()` accepts optional 4th `reminderContext` parameter
- `reminderContext` injected after grocery context; REMINDER_PROMPT appended after GROCERY_LIST_PROMPT

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Reminder generator and context builder | 45108cd | src/reminders/generator.ts, src/reminders/context.ts |
| 2 | Reminder tools, tool handler, system prompt | 1ffea5e | src/ai/tools.ts, src/ai/tool-handler.ts, src/ai/system-prompt.ts |

## Decisions Made

1. **Intl.DateTimeFormat for timezone offset** -- Uses the built-in Intl API to resolve UTC offset for any IANA timezone, avoiding external timezone libraries.
2. **1-minute dedup window** -- `hasPendingReminder` checks a +/- 1 minute window around due_at to prevent duplicate reminders during regeneration.
3. **Auto-regenerate on settings change** -- When `update_reminder_settings` is called, reminders are automatically regenerated to reflect the new times/timezone.
4. **REMINDER_PROMPT always present** -- Included in every system prompt regardless of whether reminderContext exists, matching the pattern of MEAL_PLANNING_PROMPT and GROCERY_LIST_PROMPT.
5. **Empty string = unmute** -- Tool input `muted_until: ""` clears the mute (sets to null), following a simple convention for the tool schema.

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

Ready for 08-03 (Reminder Poller): The generator, tools, and prompt are all in place. The poller needs to call `getDueReminders()`, invoke Claude for text generation, and send via Telegram. The `generateRemindersFn` dependency injection pattern is ready for wiring in 08-04.

## Self-Check: PASSED
