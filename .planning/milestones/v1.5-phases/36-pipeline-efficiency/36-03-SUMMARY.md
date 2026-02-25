---
phase: 36-pipeline-efficiency
plan: 03
subsystem: knowledge
tags: [fts5, bm25, dedup, jaccard, similarity, recipes, preferences]

# Dependency graph
requires:
  - phase: 36-pipeline-efficiency
    provides: "Knowledge FTS5 infrastructure and tool handler dedup"
provides:
  - "Content-weighted FTS5 search (searchFtsContent) for dedup matching"
  - "Ingredient overlap computation via Jaccard similarity"
  - "Content similarity computation via word-level Jaccard"
  - "Content-aware dedup in save_knowledge tool handler"
affects: [knowledge, ai-tools, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [jaccard-similarity, content-weighted-bm25, ingredient-extraction]

key-files:
  created: []
  modified:
    - src/knowledge/fts.ts
    - src/ai/tool-handler.ts

key-decisions:
  - "85% overlap threshold for content dedup (conservative to avoid false positives)"
  - "Jaccard similarity for both ingredient and content comparison (simple, no dependencies)"
  - "Content dedup wrapped in try/catch as best-effort, same as existing title dedup"
  - "Extract top 3-5 ingredient names for recipe content search query"

patterns-established:
  - "Content-weighted BM25: bm25(knowledge_fts, 1.0, 1.0, 10.0) for content-priority search"
  - "Ingredient extraction: strip quantities/units from recipe list items for comparison"

requirements-completed: [PROMPT-06]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 36 Plan 03: Content-Aware Knowledge Dedup Summary

**Content-aware dedup using ingredient overlap (recipes) and word-level Jaccard similarity (preferences) with 85% threshold**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T02:32:56Z
- **Completed:** 2026-02-23T02:36:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Content-weighted FTS5 search function (searchFtsContent) with inverted BM25 weights prioritizing content over title
- Ingredient overlap calculator that extracts ingredient names (stripping quantities/units) and computes Jaccard similarity
- Content similarity calculator using word-level Jaccard with stop word filtering
- Enhanced save_knowledge dedup flow: title match -> content match -> BM25 fallback, all best-effort

## Task Commits

Each task was committed atomically:

1. **Task 1: Add content search function and ingredient overlap utility** - `6c3894e` (feat)
2. **Task 2: Enhance save_knowledge dedup to use content matching** - `b9b5fc8` (feat)

## Files Created/Modified
- `src/knowledge/fts.ts` - Added searchFtsContent(), computeIngredientOverlap(), computeContentSimilarity(), and helper functions (extractIngredients, UNIT_PATTERN, STOP_WORDS)
- `src/ai/tool-handler.ts` - Enhanced save_knowledge dedup block with content-aware matching for recipes (ingredient overlap) and preferences (content similarity)

## Decisions Made
- 85% overlap threshold chosen per plan specification (conservative, catches near-exact duplicates only)
- Jaccard similarity used for both ingredient and content comparison (simple set math, no external dependencies)
- Content dedup is best-effort with try/catch, same pattern as existing title dedup
- Content search query built differently for recipes (key ingredient names) vs preferences (title + first sentence)
- Only top 3 content matches checked via getItem to limit retrieval overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Content-aware dedup is fully integrated into the existing dedup flow
- All existing tests pass, skip_dedup bypass still works
- Ready for any subsequent knowledge or pipeline plans

## Self-Check: PASSED

- All created/modified files verified present on disk
- All task commits verified in git history (6c3894e, b9b5fc8)

---
*Phase: 36-pipeline-efficiency*
*Completed: 2026-02-22*
