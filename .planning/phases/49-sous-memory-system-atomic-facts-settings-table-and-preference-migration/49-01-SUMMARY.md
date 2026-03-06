---
phase: 49-sous-memory-system
plan: 01
subsystem: database
tags: [sqlite, fts5, drizzle, memories, migration]

requires:
  - phase: knowledge-fts
    provides: FTS5 pattern (escapeForFts5, external content mode, triggers)
provides:
  - memories table with FTS5 search index
  - CRUD repository for atomic facts (save, update, delete, getAll, getById)
  - Migration v9 (memories table + application_settings rename)
  - Migration v10 (preference data migration from knowledge_items)
affects: [49-02-tool-integration, 49-03-mini-app-memory-ui]

tech-stack:
  added: []
  patterns: [memories FTS5 external content with sync triggers, atomic fact repository pattern]

key-files:
  created:
    - src/memory/schema.ts
    - src/memory/repository.ts
    - src/memory/fts.ts
  modified:
    - src/db/migrations.ts
    - src/db/index.ts
    - src/db/schema.ts
    - src/reminders/init.ts
    - src/reminders/repository.ts
    - src/reminders/context.ts
    - src/reminders/schema.ts

key-decisions:
  - "FTS5 indexes only content column (not category) since memories are short atomic facts"
  - "Migration v10 skips knowledge_items that are also tagged as recipe to preserve recipes"
  - "Severity markers ([ALLERGY], [RESTRICTION]) prepended to content during migration for preservation"

patterns-established:
  - "Memory repository: standalone functions (not factory) matching preferences.ts pattern"
  - "Memory FTS: single-column external content FTS5 with porter unicode61 tokenizer"

requirements-completed: [MEM-01, MEM-02, SET-01]

duration: 3min
completed: 2026-03-06
---

# Phase 49 Plan 01: Database Foundation Summary

**Memories table with FTS5 search, CRUD repository, application_settings rename, and preference data migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T03:51:31Z
- **Completed:** 2026-03-06T03:54:41Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created `src/memory/` module with Drizzle schema, FTS5 initialization, and CRUD repository for atomic facts
- Added migration v9 (memories table creation + reminder_settings renamed to application_settings)
- Added migration v10 (preference-tagged knowledge_items migrated into memories with category mapping and severity markers)
- Updated all src/reminders/ SQL references from reminder_settings to application_settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create memories table schema, FTS5 index, and repository** - `b1a3d09` (feat)
2. **Task 2: Database migrations and initialization wiring** - `698a893` (feat)

## Files Created/Modified
- `src/memory/schema.ts` - Drizzle schema for memories table with MemoryCategory type
- `src/memory/fts.ts` - FTS5 virtual table init and search with BM25 ranking
- `src/memory/repository.ts` - CRUD functions: saveMemory, updateMemory, deleteMemory, getMemoriesByHousehold, getMemoryById
- `src/db/migrations.ts` - Added migrations v9 (memories table + settings rename) and v10 (preference data migration)
- `src/db/index.ts` - Added initializeMemoryFts call after knowledge FTS init
- `src/db/schema.ts` - Re-exports memories schema
- `src/reminders/init.ts` - CREATE TABLE uses application_settings
- `src/reminders/repository.ts` - All SQL queries use application_settings
- `src/reminders/context.ts` - SELECT query uses application_settings
- `src/reminders/schema.ts` - Drizzle table name changed to application_settings

## Decisions Made
- FTS5 virtual table indexes only the `content` column since memories are short atomic facts (unlike knowledge_items which have title/summary/content)
- Migration v10 skips rows that are also tagged as 'recipe' to preserve recipe data in knowledge_items
- Severity markers ([ALLERGY], [RESTRICTION]) are prepended to migrated content to preserve severity metadata

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory table, FTS, and repository ready for Plan 02 (tool integration: save_memory, delete_memory, search_memories, update_settings)
- Remaining reminder_settings references in src/ai/, src/bot/, src/onboarding/ deferred to Plan 02 as specified

---
*Phase: 49-sous-memory-system*
*Completed: 2026-03-06*
