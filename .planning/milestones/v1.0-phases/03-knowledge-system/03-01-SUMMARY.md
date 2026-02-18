---
phase: 03-knowledge-system
plan: 01
subsystem: database
tags: [sqlite, fts5, drizzle, bm25, full-text-search, token-budget]

# Dependency graph
requires:
  - phase: 01-bot-foundation
    provides: Database infrastructure (createDatabase, Drizzle schema patterns)
provides:
  - knowledge_items and knowledge_tags Drizzle schema
  - FTS5 virtual table with porter unicode61 tokenizer and BM25 search
  - Knowledge CRUD repository (createKnowledgeRepository factory)
  - Token estimation and budget allocation utilities
affects: [03-02 retrieval service, 03-03 context injection, phase-4 agent tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FTS5 external content mode with sync triggers for automatic index maintenance"
    - "Two-pass retrieval: BM25 search (lightweight) then full content fetch"
    - "Token budget with soft/hard limits and knowledge-priority allocation"
    - "Raw better-sqlite3 for FTS5 operations, Drizzle for regular CRUD"

key-files:
  created:
    - src/knowledge/types.ts
    - src/knowledge/schema.ts
    - src/knowledge/fts.ts
    - src/knowledge/repository.ts
    - src/knowledge/token-budget.ts
  modified:
    - src/db/schema.ts
    - src/db/index.ts

key-decisions:
  - "initializeFts creates base tables via raw SQL (CREATE TABLE IF NOT EXISTS) since FTS5 external content requires the content table to exist before the virtual table"
  - "Foreign keys enabled via PRAGMA for CASCADE delete support on knowledge_tags"
  - "BM25 weights: title 10x, summary 5x, content 1x -- titles are most discriminative"
  - "FTS5 query escaping wraps terms in double quotes with LIKE fallback on parse errors"
  - "Repository uses .returning().get() for Drizzle better-sqlite3 insert+return pattern"

patterns-established:
  - "Knowledge repository factory: createKnowledgeRepository(db) returns CRUD methods"
  - "FTS5 initialization: raw SQL in initializeFts() called during createDatabase()"
  - "Per-chat isolation: all repository and search operations filter by chatId"
  - "Token budget factory: createTokenBudget(config?) with allocate and fitItemsWithinBudget"

# Metrics
duration: 6min
completed: 2026-02-06
---

# Phase 3 Plan 1: Knowledge Storage Summary

**SQLite knowledge schema with FTS5 full-text search, BM25-ranked retrieval, CRUD repository, and token budget utilities**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-06T18:30:03Z
- **Completed:** 2026-02-06T18:36:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- knowledge_items and knowledge_tags tables with Drizzle schema and raw SQL initialization
- FTS5 virtual table with porter unicode61 tokenizer, external content mode, and 3 sync triggers
- BM25-ranked search with title/summary/content weighting and LIKE fallback
- CRUD repository with per-chat isolation, tag management, and recency tracking
- Token estimation (4 chars/token) and budget allocation with 4K soft / 6K hard limits

## Task Commits

Each task was committed atomically:

1. **Task 1: Knowledge schema, types, and FTS5 initialization** - `aa338d1` (feat)
2. **Task 2: Knowledge repository and token budget** - `8cb8673` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/knowledge/types.ts` - TypeScript interfaces (KnowledgeItem, SearchResult, RetrievalMetrics, TokenBudgetConfig)
- `src/knowledge/schema.ts` - Drizzle schema for knowledge_items and knowledge_tags tables
- `src/knowledge/fts.ts` - FTS5 virtual table creation, triggers, BM25 search, query escaping, full item retrieval
- `src/knowledge/repository.ts` - CRUD repository factory with tag management and chatId filtering
- `src/knowledge/token-budget.ts` - Token estimation and budget allocation with soft/hard limits
- `src/db/schema.ts` - Re-exports knowledge schema for Drizzle schema object
- `src/db/index.ts` - Calls initializeFts during database creation, enables foreign keys

## Decisions Made
- [03-01]: initializeFts creates base tables via raw SQL since FTS5 external content mode requires the content table to exist at virtual table creation time
- [03-01]: Foreign keys pragma enabled in createDatabase for CASCADE delete support
- [03-01]: BM25 weights title 10x, summary 5x, content 1x for search relevance
- [03-01]: FTS5 query escaping wraps each term in double quotes, falls back to LIKE on parse error
- [03-01]: Repository uses Drizzle .returning().get() for synchronous insert-and-return

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added base table creation in initializeFts**
- **Found during:** Task 1 (FTS5 initialization)
- **Issue:** FTS5 external content mode (`content='knowledge_items'`) requires the knowledge_items table to exist before the virtual table can be created. Drizzle schema defines tables but doesn't auto-create them at runtime.
- **Fix:** Added CREATE TABLE IF NOT EXISTS for knowledge_items and knowledge_tags in initializeFts before FTS5 virtual table creation. Drizzle schema remains source of truth for drizzle-kit.
- **Files modified:** src/knowledge/fts.ts
- **Verification:** createDatabase successfully creates all tables, triggers, and FTS5 index
- **Committed in:** aa338d1 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Enabled foreign keys pragma**
- **Found during:** Task 1 (database initialization)
- **Issue:** SQLite foreign keys are off by default. Without PRAGMA foreign_keys = ON, CASCADE DELETE on knowledge_tags would not work.
- **Fix:** Added sqlite.pragma("foreign_keys = ON") in createDatabase before initializeFts
- **Files modified:** src/db/index.ts
- **Verification:** Delete of knowledge_items row cascades to knowledge_tags
- **Committed in:** aa338d1 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes essential for correct operation. No scope creep.

## Issues Encountered
- Drizzle better-sqlite3 `.returning()` returns a thenable that can't be array-destructured; resolved by using `.returning().get()` for single-item insert-and-return pattern

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Knowledge storage layer complete, ready for Plan 02 (retrieval service)
- FTS5 search and repository provide the query interface retrieval service needs
- Token budget utilities provide budget enforcement for context injection (Plan 03)
- No blockers identified

## Self-Check: PASSED

---
*Phase: 03-knowledge-system*
*Completed: 2026-02-06*
