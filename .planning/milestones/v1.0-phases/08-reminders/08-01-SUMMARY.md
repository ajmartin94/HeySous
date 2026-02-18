---
phase: 08-reminders
plan: 01
subsystem: reminders-data-layer
tags: [sqlite, drizzle, repository, reminders, timezone]
requires:
  - 01-01 (database foundation)
  - 06-01 (planning schema pattern)
  - 07-01 (grocery schema pattern)
provides:
  - reminder_settings table with per-chat timezone and time preferences
  - reminders table with scheduled reminder instances
  - createReminderRepository factory with full CRUD
  - initializeReminders for raw SQL table creation
affects:
  - 08-02 (reminder generator needs repository)
  - 08-03 (poller needs getDueReminders and markSent/markFailed)
  - 08-04 (pipeline wiring needs initializeReminders and repository factory)
tech-stack:
  added: []
  patterns:
    - Factory function repository with raw SQLite queries
    - Named parameter upsert with COALESCE for partial updates
    - UNIQUE constraint on chat_id for one-settings-per-chat
key-files:
  created:
    - src/reminders/types.ts
    - src/reminders/schema.ts
    - src/reminders/init.ts
    - src/reminders/repository.ts
  modified:
    - src/db/schema.ts
key-decisions:
  - Named parameters (@param) for upsert query to avoid positional parameter complexity
  - COALESCE pattern for partial updates preserves existing values when field not provided
  - mutedUntil uses sentinel flag pattern (hasMutedUntilUpdate) since null is a valid value (unmute)
  - CHECK constraints on type and status columns in raw SQL for data integrity
duration: 2 min
completed: 2026-02-09
---

# Phase 8 Plan 1: Reminder Data Layer Summary

**Reminder data layer with Drizzle schema, raw SQL init, and factory repository for settings and scheduled reminders with UTC time handling and per-chat timezone support.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | 2 min |
| Started | 2026-02-09T02:52:44Z |
| Completed | 2026-02-09T02:55:26Z |
| Tasks | 2/2 |
| Files created | 4 |
| Files modified | 1 |

## Accomplishments

1. Created `ReminderType`, `ReminderStatus`, `ReminderSettings`, and `Reminder` TypeScript interfaces with full JSDoc documentation
2. Created Drizzle schema for `reminder_settings` (per-chat settings with timezone, times, enable flags) and `reminders` (scheduled instances with type, due time, status, context)
3. Created `initializeReminders()` raw SQL function with UNIQUE constraint on chat_id, CHECK constraints on type and status enums
4. Created `createReminderRepository()` factory with 11 methods covering full CRUD for both settings and reminders
5. Added re-export of reminder tables from `src/db/schema.ts`

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Reminder schema, types, and table initialization | c6f2116 | types.ts, schema.ts, init.ts, db/schema.ts re-export |
| 2 | Reminder repository with factory function | 047b018 | repository.ts with 11 CRUD methods |

## Files Created

- `src/reminders/types.ts` -- ReminderType, ReminderStatus, ReminderSettings, Reminder interfaces
- `src/reminders/schema.ts` -- Drizzle table definitions for reminder_settings and reminders
- `src/reminders/init.ts` -- initializeReminders() raw SQL with UNIQUE and CHECK constraints
- `src/reminders/repository.ts` -- createReminderRepository() factory with full CRUD

## Files Modified

- `src/db/schema.ts` -- Added re-export of reminderSettings and reminders from reminders/schema.js

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Named parameters for upsert | Avoids positional parameter complexity with 14+ bind values |
| COALESCE for partial updates | Null means "keep existing", non-null means "update" |
| Sentinel flag for mutedUntil | Null is a valid value (unmute), so need explicit "was this field provided?" flag |
| CHECK constraints in raw SQL | Type and status columns validated at database level, not just TypeScript |
| UNIQUE on chat_id in init.ts | One settings row per chat, enforced at DB level for upsert ON CONFLICT |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Repository provides all methods needed by reminder generator (08-02): createReminder, hasPendingReminder, deleteFutureReminders, deleteAllPending
- Repository provides all methods needed by poller (08-03): getDueReminders, markSent, markFailed, getAllActiveSettings
- initializeReminders ready for pipeline wiring (08-04)
- No blockers for subsequent plans

## Self-Check: PASSED
