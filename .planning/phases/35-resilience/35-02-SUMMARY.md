---
phase: 35-resilience
plan: 02
subsystem: database
tags: [sqlite, optimistic-locking, concurrency, drizzle]

# Dependency graph
requires:
  - phase: 34-observability
    provides: Tool call observability for tracing conflict events
provides:
  - Version columns on knowledge_items, meal_plans, grocery_lists
  - Optimistic locking in knowledge, plan, and grocery repositories
  - Conflict detection in tool handler with structured error responses
affects: [tool-handler, knowledge, planning, grocery]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic-locking-via-version-column, conflict-detection-in-tool-handler]

key-files:
  created: []
  modified:
    - src/db/migrations.ts
    - src/knowledge/schema.ts
    - src/knowledge/types.ts
    - src/knowledge/repository.ts
    - src/knowledge/fts.ts
    - src/planning/schema.ts
    - src/planning/repository.ts
    - src/planning/history.ts
    - src/grocery/init.ts
    - src/grocery/repository.ts
    - src/ai/tool-handler.ts

key-decisions:
  - "Optimistic locking via version column (check-and-increment) rather than pessimistic locks or serialized queues"
  - "Conflict returns null from repository, tool handler converts to structured JSON error with is_error:true and conflict:true"
  - "householdId used as updatedBy for edit metadata since tool handler has householdId context"
  - "Grocery list version checked via atomic updateListVersion() before writes, separate from item-level operations"
  - "record_feedback does not use version checking since feedback append is additive and non-racing"

patterns-established:
  - "Optimistic locking pattern: read version, pass as expectedVersion to update, return null on mismatch"
  - "Conflict error pattern: { error: string, is_error: true, conflict: true } JSON response to Claude"

requirements-completed: [RES-02]

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 35 Plan 02: Optimistic Locking Summary

**Optimistic locking via version columns on knowledge_items, meal_plans, and grocery_lists with conflict detection in tool handler**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T22:07:44Z
- **Completed:** 2026-02-22T22:13:46Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Migration 5 adds version (default 1) and updated_by columns to all three stateful tables
- Knowledge, plan, and grocery repositories support optimistic locking via expectedVersion parameter
- Tool handler detects version conflicts and returns clear structured error messages to Claude
- Version field included in all get/save/update tool responses for Claude visibility
- Edit metadata (version, updated_at, updated_by) tracked on every write

## Task Commits

Each task was committed atomically:

1. **Task 1: Add version columns via migration and update schemas** - `3fda3b3` (feat)
2. **Task 2: Add optimistic locking to repositories and conflict detection to tool handler** - `0c51041` (feat)

## Files Created/Modified
- `src/db/migrations.ts` - Migration 5: add version + updated_by columns to 3 tables
- `src/knowledge/schema.ts` - Drizzle schema: version and updatedBy columns
- `src/knowledge/types.ts` - KnowledgeItem type: version and updatedBy fields
- `src/knowledge/repository.ts` - update() with expectedVersion + updatedBy options
- `src/knowledge/fts.ts` - getFullItem includes version/updatedBy; CREATE TABLE includes new columns
- `src/planning/schema.ts` - Drizzle schema: version and updatedBy columns on mealPlans
- `src/planning/repository.ts` - savePlan() and getPlan() with version tracking and conflict detection
- `src/planning/history.ts` - initializePlanning CREATE TABLE includes version/updated_by
- `src/grocery/init.ts` - initializeGrocery CREATE TABLE includes version/updated_by
- `src/grocery/repository.ts` - GroceryList with version/updatedBy, updateListVersion() for atomic check-and-increment
- `src/ai/tool-handler.ts` - update_knowledge, save_meal_plan, update_grocery_list conflict detection; version in responses

## Decisions Made
- Optimistic locking via version column (check-and-increment) chosen over pessimistic locks or serialized queues for simplicity
- Conflict returns null from repository layer; tool handler translates to structured JSON error
- householdId used as updatedBy since it is the available context in the tool handler
- Grocery list uses atomic updateListVersion() method that checks-and-increments before item operations
- record_feedback skips version checking since feedback annotation appends are additive and do not meaningfully race

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated getFullItem in fts.ts for KnowledgeItem type compatibility**
- **Found during:** Task 2 (optimistic locking in repositories)
- **Issue:** Adding version and updatedBy to KnowledgeItem type caused TypeScript error in fts.ts getFullItem() which returns KnowledgeItem but did not include the new fields
- **Fix:** Updated SELECT query to include version and updated_by, added fields to return object and row type
- **Files modified:** src/knowledge/fts.ts
- **Verification:** npm run typecheck passes
- **Committed in:** 0c51041 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Updated initializePlanning in history.ts for fresh install completeness**
- **Found during:** Task 1 (schema updates)
- **Issue:** Plan instructed updating grocery init and knowledge fts for fresh installs but did not mention planning/history.ts which also has a CREATE TABLE IF NOT EXISTS for meal_plans
- **Fix:** Added version and updated_by columns to the meal_plans CREATE TABLE in history.ts
- **Files modified:** src/planning/history.ts
- **Verification:** npm run typecheck and npm test pass
- **Committed in:** 3fda3b3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Optimistic locking foundation complete for all stateful household data
- Phase 35 plan 03 (context overflow detection) can proceed independently
- No blockers or concerns

---
*Phase: 35-resilience*
*Completed: 2026-02-22*
