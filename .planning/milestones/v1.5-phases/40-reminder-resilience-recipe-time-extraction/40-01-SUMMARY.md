---
phase: 40-reminder-resilience-recipe-time-extraction
plan: 01
subsystem: database, ai
tags: [sqlite, migrations, knowledge-base, recipe-time, fts5, tool-handler]

# Dependency graph
requires:
  - phase: 35-optimistic-locking-budget-trimming
    provides: "Version columns and optimistic locking on knowledge_items"
provides:
  - "Structured time columns (prep_time_minutes, cook_time_minutes, total_time_minutes) on knowledge_items"
  - "Auto-extraction of recipe time data from content on save/update"
  - "Plan-recipe linking guard warning for unlinked recipes in save_meal_plan"
  - "Exported parseTimeToMinutes from reminders/generator.ts for reuse"
affects: [reminder-generation, recipe-display, meal-plan-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auto-extraction with explicit param override pattern in tool handlers"
    - "Non-blocking linking guard pattern (warn but don't block save)"

key-files:
  created: []
  modified:
    - src/db/migrations.ts
    - src/knowledge/schema.ts
    - src/knowledge/fts.ts
    - src/knowledge/types.ts
    - src/knowledge/repository.ts
    - src/ai/tool-handler.ts
    - src/ai/tools.ts
    - src/reminders/generator.ts

key-decisions:
  - "Exported parseTimeToMinutes from generator.ts rather than duplicating in migration"
  - "Non-blocking linking guard: unlinked_recipes returned as warning alongside successful save, not as error"
  - "Time auto-extraction uses content regex parsing with explicit Claude params taking precedence"

patterns-established:
  - "Auto-extract pattern: parse structured data from free-text content, allow explicit overrides"
  - "Linking guard pattern: post-save FTS search for unlinked references, non-blocking warning"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 40 Plan 01: Recipe Time Extraction Summary

**Structured time columns on knowledge_items with migration backfill, auto-extraction on save/update, and plan-recipe linking guard for unlinked recipes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T02:21:13Z
- **Completed:** 2026-02-24T02:25:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added prep_time_minutes, cook_time_minutes, total_time_minutes columns to knowledge_items with migration 6 that backfills existing recipes
- save_knowledge and update_knowledge auto-extract time fields from recipe content, with explicit Claude params taking precedence
- save_meal_plan returns non-blocking unlinked_recipes warning when entries match knowledge base recipes but lack knowledge_item_id
- Exported parseTimeToMinutes from generator.ts for reuse across migration and tool handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Add structured time columns to knowledge_items with migration and backfill** - `cd5d720` (feat)
2. **Task 2: Auto-extract time fields on knowledge save/update and add plan-recipe linking guard** - `e2edd22` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/db/migrations.ts` - Migration 6: add time columns and backfill existing recipes
- `src/knowledge/schema.ts` - Drizzle schema with three nullable time integer columns
- `src/knowledge/fts.ts` - CREATE TABLE includes time columns for fresh installs; getFullItem returns time fields
- `src/knowledge/types.ts` - KnowledgeItem interface with optional time fields
- `src/knowledge/repository.ts` - CreateKnowledgeInput/UpdateKnowledgeInput accept time fields; create/update pass them through
- `src/ai/tool-handler.ts` - Auto-extract time on save/update; plan-recipe linking guard in save_meal_plan
- `src/ai/tools.ts` - prep_time, cook_time, total_time params on save_knowledge and update_knowledge
- `src/reminders/generator.ts` - Exported parseTimeToMinutes for reuse

## Decisions Made
- Exported parseTimeToMinutes from generator.ts rather than duplicating a lightweight version in the migration -- keeps a single source of truth for time parsing
- Linking guard uses case-insensitive title comparison OR BM25 relevance < 5 to determine a match -- consistent with existing dedup check pattern
- Auto-extraction runs for all recipe-tagged items, computing total from prep+cook when both available, falling back to parseRecipeTotalMinutes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Time columns are live and backfilled for existing recipes
- Linking guard is operational for new meal plan saves
- Ready for Plan 02 (reminder resilience with 45min fallback and structured time usage)

## Self-Check: PASSED

All 8 modified files verified present. Both task commits (cd5d720, e2edd22) verified in git history.

---
*Phase: 40-reminder-resilience-recipe-time-extraction*
*Completed: 2026-02-24*
