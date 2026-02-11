---
phase: 16-household-data-migration
plan: 01
subsystem: database
tags: [sqlite, drizzle, better-sqlite3, migration, household, schema]

# Dependency graph
requires:
  - phase: 15-users-households-invites
    provides: users/households tables, admin household_id = telegram_id
provides:
  - Idempotent column rename migration (chat_id -> household_id) for 9 tables
  - All Drizzle schemas mapped to household_id columns
  - All repository functions accept householdId parameter
  - All context builders query household_id in SQL
  - All type interfaces use householdId field
affects: [16-02-handler-pipeline-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: [startup SQL migration with PRAGMA idempotency check, transactional multi-table column rename]

key-files:
  created:
    - src/db/migrate.ts
  modified:
    - src/db/index.ts
    - src/db/schema.ts
    - src/knowledge/fts.ts
    - src/knowledge/schema.ts
    - src/knowledge/types.ts
    - src/knowledge/repository.ts
    - src/knowledge/retrieval.ts
    - src/knowledge/preferences.ts
    - src/planning/schema.ts
    - src/planning/repository.ts
    - src/planning/history.ts
    - src/grocery/schema.ts
    - src/grocery/repository.ts
    - src/grocery/context.ts
    - src/grocery/init.ts
    - src/reminders/schema.ts
    - src/reminders/types.ts
    - src/reminders/repository.ts
    - src/reminders/context.ts
    - src/reminders/init.ts
    - src/feedback/types.ts
    - src/feedback/repository.ts
    - src/feedback/context.ts
    - src/feedback/init.ts

key-decisions:
  - "Messages table keeps chat_id unchanged -- conversation history is per-Telegram-chat"
  - "Migration checks PRAGMA table_info for chat_id presence -- zero-cost idempotency"
  - "All 9 renames in a single SQLite transaction for atomicity"
  - "listByChatId renamed to listByHouseholdId for API clarity"

patterns-established:
  - "Startup migration pattern: PRAGMA check -> transaction -> column renames"
  - "Two-ID model: householdId for data ownership, chatId for Telegram delivery"

# Metrics
duration: 10min
completed: 2026-02-11
---

# Phase 16 Plan 01: Data Layer Migration Summary

**Idempotent SQL column rename migration for 9 tables plus complete chatId-to-householdId refactor across all Drizzle schemas, type interfaces, repositories, and context builders**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-11T17:33:05Z
- **Completed:** 2026-02-11T17:43:20Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Created idempotent migration module that renames chat_id to household_id across 9 data tables in a single atomic transaction
- Updated all 5 init files (CREATE TABLE SQL) to use household_id for fresh databases
- Migrated all Drizzle schema definitions from chatId to householdId (except messages table)
- Renamed all type interface fields from chatId to householdId in knowledge, reminders, and feedback types
- Updated all repository function signatures and SQL queries to use householdId/household_id
- Updated all 3 context builders (grocery, reminders, feedback) to query household_id

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration module and update init functions** - `b48898e` (feat)
2. **Task 2: Update schemas, types, repositories, and context builders** - `37035cc` (feat)

## Files Created/Modified
- `src/db/migrate.ts` - New idempotent migration: PRAGMA check + transactional column renames for 9 tables
- `src/db/index.ts` - Wired migrateToHouseholdId() before all init calls
- `src/db/schema.ts` - tokenUsage chatId -> householdId (messages chatId preserved)
- `src/knowledge/fts.ts` - CREATE TABLE + searchFts/getFullItem use household_id
- `src/knowledge/schema.ts` - knowledgeItems and knowledgeChangelog householdId columns
- `src/knowledge/types.ts` - KnowledgeItem and ChangelogEntry interfaces
- `src/knowledge/repository.ts` - All CRUD methods, listByChatId renamed to listByHouseholdId
- `src/knowledge/retrieval.ts` - search() and getItem() accept householdId
- `src/knowledge/preferences.ts` - getPreferenceSummaries() queries household_id
- `src/planning/schema.ts` - mealPlans and cookingHistory householdId columns
- `src/planning/repository.ts` - savePlan, getPlan, getActivePlans accept householdId
- `src/planning/history.ts` - CREATE TABLE + autoMarkCookedMeals, logMeal, getCookingHistory
- `src/grocery/schema.ts` - groceryLists householdId column
- `src/grocery/init.ts` - CREATE TABLE uses household_id
- `src/grocery/repository.ts` - GroceryList interface and all methods
- `src/grocery/context.ts` - buildGroceryContext queries household_id
- `src/reminders/schema.ts` - reminderSettings and reminders householdId columns
- `src/reminders/init.ts` - CREATE TABLE uses household_id
- `src/reminders/types.ts` - ReminderSettings and Reminder interfaces
- `src/reminders/repository.ts` - All settings and reminder methods, row types
- `src/reminders/context.ts` - buildReminderContext queries household_id
- `src/feedback/init.ts` - CREATE TABLE uses household_id
- `src/feedback/types.ts` - FeedbackCheckin interface
- `src/feedback/repository.ts` - All methods and row types
- `src/feedback/context.ts` - buildFeedbackContext queries household_id

## Decisions Made
- Messages table keeps chat_id unchanged: conversation history is per-Telegram-chat, not per-household
- Migration uses PRAGMA table_info check for idempotency: zero-cost on already-migrated databases
- All 9 column renames wrapped in a single SQLite transaction for atomic rollback safety
- Renamed listByChatId to listByHouseholdId for semantic clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer fully migrated: all schemas, types, repositories, and context builders use householdId
- TypeScript compilation errors exist ONLY in handler/pipeline/sender files (Plan 02 scope)
- Error files: tool-handler.ts, processor.ts, main.ts, reminder/feedback generators, senders, poller
- Ready for Plan 02: Handler and pipeline layer migration

## Self-Check: PASSED

All 7 key files verified on disk. Both commit hashes (b48898e, 37035cc) found in git log. Migration export and wiring confirmed.

---
*Phase: 16-household-data-migration*
*Completed: 2026-02-11*
