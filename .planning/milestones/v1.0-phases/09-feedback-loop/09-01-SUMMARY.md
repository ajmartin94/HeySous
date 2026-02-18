---
phase: 09-feedback-loop
plan: 01
subsystem: feedback
tags: [feedback, inline-keyboard, reminders, scheduling]

dependency-graph:
  requires: [08-reminders]
  provides: [feedback-data-layer, feedback-checkin-generator, feedback-sender, inline-buttons]
  affects: [09-02]

tech-stack:
  added: []
  patterns: [factory-function, never-throw-sender, compact-callback-data, inline-keyboard]

key-files:
  created:
    - src/feedback/types.ts
    - src/feedback/init.ts
    - src/feedback/repository.ts
    - src/feedback/buttons.ts
    - src/feedback/generator.ts
    - src/feedback/sender.ts
  modified:
    - src/reminders/types.ts
    - src/reminders/init.ts

decisions:
  - "Duplicated localTimeToUtc inline in feedback/generator.ts rather than refactoring reminders/generator.ts -- keeps feedback self-contained"
  - "Fixed check-in time at 20:30 local (midpoint of 8-9pm window per user decision)"
  - "Callback data format f:{sentiment}:{reminderId} -- compact, under 64 bytes"
  - "No foreign key on reminder_id in feedback_checkins -- logs persist after deletion"
  - "Migration test-and-recreate approach for existing databases with old CHECK constraint"

metrics:
  duration: 3 min
  completed: 2026-02-09
---

# Phase 9 Plan 1: Feedback Check-in Infrastructure Summary

Feedback check-in scheduling and delivery: tracking table, inline buttons, generator from meal plans at 20:30 local time, and HTML sender with 4 sentiment buttons.

## What Was Built

### Feedback Data Layer
- **types.ts**: FeedbackSentiment enum (positive/neutral/negative/skipped), FeedbackCheckinStatus (pending/sent/responded/expired), FeedbackCheckin interface
- **init.ts**: Raw SQL CREATE TABLE for feedback_checkins with CHECK constraints on status and sentiment columns
- **repository.ts**: Factory function with CRUD: createCheckin, getCheckinByReminderId, getPendingSentCheckins, recordResponse, expireOldCheckins, getRecentFeedback

### Inline Buttons
- **buttons.ts**: Callback data format `f:{sentiment}:{reminderId}` (e.g., `f:pos:42` -- 8 bytes)
- 4-button keyboard in 2 rows: "Loved it" / "It was okay" / "Didn't work" / "Skipped"
- Unicode emoji in button labels for visual recognition
- Encode/parse/build functions matching grocery/buttons.ts pattern

### Check-in Generator
- **generator.ts**: Creates one feedback_checkin reminder per day with meals, scheduled at 20:30 local time
- Consolidates multiple meals per day into a single check-in
- Creates both reminder row (type: feedback_checkin) and feedback_checkins tracking record
- 1-minute dedup window prevents duplicates during regeneration
- Duplicated localTimeToUtc inline to keep feedback module self-contained

### Feedback Sender
- **sender.ts**: Sends HTML messages with inline keyboard via Telegram
- Single meal: "How was the **Chicken Parmesan** tonight?"
- Multiple meals: "How was dinner tonight? You had **Chicken Parm** and **Caesar Salad**."
- Never-throw safety pattern matching reminders/sender.ts
- Handles Telegram 403 (bot blocked) silently

### Reminder System Extension
- Extended ReminderType union with "feedback_checkin"
- Updated CHECK constraint in CREATE TABLE for new installs
- Migration for existing databases: test insert, recreate table if CHECK blocks

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Feedback data layer and inline buttons | fee40e6 | types.ts, init.ts, repository.ts, buttons.ts, reminders/types.ts, reminders/init.ts |
| 2 | Check-in generator and sender | 0db19f7 | generator.ts, sender.ts |

## Decisions Made

1. **Duplicate localTimeToUtc**: Copied the ~20-line utility inline rather than refactoring reminders/generator.ts exports -- keeps feedback module self-contained and avoids touching working code
2. **Fixed 20:30 check-in time**: Per user decision, feedback check-ins always fire at 8:30 PM local (midpoint of 8-9pm window)
3. **Compact callback data**: `f:{sentiment}:{reminderId}` format using abbreviated sentiments (pos/ok/neg/skip) for minimal byte count
4. **No foreign key on reminder_id**: Same rationale as knowledgeChangelog -- tracking records persist after reminder deletion for analytics
5. **Migration strategy**: Test-insert-then-recreate approach for backward-compatible CHECK constraint update on existing databases

## Deviations from Plan

None -- plan executed exactly as written.

## Next Phase Readiness

Plan 09-02 can proceed immediately. It will wire the feedback handler for callback queries and integrate the sender into the poller.

## Self-Check: PASSED
