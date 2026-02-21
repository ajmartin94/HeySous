---
phase: 31-audit-defect-fixes
plan: 01
subsystem: database, knowledge, ai
tags: [sqlite, migrations, fts5, bm25, source-url, bug-fix]

# Dependency graph
requires:
  - phase: 28-recipe-url-import
    provides: source_url column concept and migration 001
  - phase: 26-save-knowledge-dedup
    provides: BM25 dedup logic in tool-handler
provides:
  - "Guarded migration 001 that skips ALTER TABLE on fresh installs"
  - "source_url in CREATE TABLE, getFullItem SELECT, and get_knowledge_item JSON response"
  - "Corrected BM25 threshold (< 5 for positive relevance values)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sqlite_master guard pattern for migrations that ALTER existing tables"

key-files:
  created:
    - tests/knowledge/fts.test.ts
  modified:
    - src/db/migrations.ts
    - src/knowledge/fts.ts
    - src/ai/tool-handler.ts
    - tests/db/migrations.test.ts
    - tests/ai/tool-handler-dedup.test.ts

key-decisions:
  - "Inline migration logic in tests rather than re-importing cleared module array"
  - "Mock-based BM25 threshold tests for deterministic boundary validation"

patterns-established:
  - "sqlite_master check before ALTER TABLE in migrations for tables created by init functions"

requirements-completed: [MIGR-01, KNOW-01, KNOW-04, IMPORT-04]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 31 Plan 01: Audit Defect Fixes Summary

**Fixed 3 integration defects: migration fresh-install guard, source_url end-to-end retrieval, BM25 dedup threshold correction**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T03:01:57Z
- **Completed:** 2026-02-21T03:06:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Migration 001 now safely skips on fresh installs where knowledge_items table does not yet exist
- source_url flows end-to-end: CREATE TABLE includes it, getFullItem SELECT returns it, get_knowledge_item tool response serializes it
- BM25 dedup threshold corrected from `> -5` (always true for positive values) to `< 5` (correctly filters weak matches)
- 8 new tests covering all 3 defects with both unit and integration approaches

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix all 3 defects in source files** - `1473405` (fix)
2. **Task 2: Add tests covering all 3 fixes** - `87c5f9f` (test)

## Files Created/Modified
- `src/db/migrations.ts` - Added sqlite_master guard to migration 001
- `src/knowledge/fts.ts` - Added source_url to CREATE TABLE and getFullItem SELECT
- `src/ai/tool-handler.ts` - Fixed BM25 threshold to `< 5`, added sourceUrl to get_knowledge_item response
- `tests/db/migrations.test.ts` - 3 new tests: fresh DB guard, column addition, createDatabase integration
- `tests/knowledge/fts.test.ts` - 2 new tests: source_url present and null cases
- `tests/ai/tool-handler-dedup.test.ts` - 3 new tests: real FTS weak match, mock threshold boundary tests

## Decisions Made
- Used inline migration logic in fresh-install tests because the existing test suite clears the shared migrations array in beforeEach -- re-importing does not restore module-level state
- Added mock-based BM25 threshold tests alongside real FTS tests because BM25 scores depend on corpus statistics and single-document corpora produce unpredictable absolute values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Migration test needed careful handling because the existing `runMigrations` describe block clears `migrations.length = 0` in beforeEach, affecting the shared module reference. Solved by re-populating the migrations array with inline copies of the real migration logic in the new describe block.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 audit defects resolved with test coverage
- v1.4 milestone is now fully correct for fresh installs and existing databases
- Ready for PR to main

---
*Phase: 31-audit-defect-fixes*
*Completed: 2026-02-21*
