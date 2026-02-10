---
phase: 13-recipe-browser
plan: 01
subsystem: api, ui
tags: [fts5, sqlite, react-hooks, recipe-parser, express]

requires:
  - phase: 11-mini-app-foundation
    provides: "Express API router, auth middleware, apiFetch, React SPA infrastructure"
  - phase: 03-knowledge-system
    provides: "knowledge_items, knowledge_tags, FTS5 search, escapeForFts5"
  - phase: 06-meal-planning
    provides: "cooking_history table with knowledge_item_id linkage"
provides:
  - "GET /api/recipes endpoint with FTS5 search, tag filter, and sort"
  - "GET /api/recipes/:id endpoint for full recipe detail"
  - "parseRecipeContent utility for structured recipe rendering"
  - "computeRating utility for feedback sentiment aggregation"
  - "useRecipes hook with debounced search, tag filter, sort, and detail state"
affects: [13-02-recipe-browser-ui, 13-03-recipe-browser-polish]

tech-stack:
  added: []
  patterns:
    - "Recipe API routes using factory pattern matching grocery.ts"
    - "FTS5 search combined with tag filter via subquery"
    - "Debounced search input with 300ms delay"
    - "Content parser for recipe text sections"

key-files:
  created:
    - src/mini-app/routes/recipes.ts
    - mini-app/src/utils/recipeParser.ts
    - mini-app/src/hooks/useRecipes.ts
  modified:
    - src/mini-app/router.ts

key-decisions:
  - "FTS5 default sort is relevance (BM25) unless explicitly overridden to alphabetical or most_cooked"
  - "Recipe list uses GROUP_CONCAT for tags to avoid N+1 queries"
  - "Detail endpoint updates last_accessed_at (acceptable browse side-effect)"
  - "computeRating derives labels: favorite, liked, mixed, needs work"
  - "Tag toggle: setting same tag clears filter (null)"

patterns-established:
  - "Recipe API factory: createRecipeRoutes(sqlite) returning getList/getDetail"
  - "Four query paths: base, tag-only, search-only, search+tag"
  - "FTS5 fallback: catch block falls back to non-search query on parse error"

duration: 2min
completed: 2026-02-10
---

# Phase 13 Plan 01: Recipe API, Parser & Hook Summary

**Recipe API endpoints with FTS5 search and tag filtering, content parser for structured rendering, and useRecipes hook with debounced search and sort**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T13:20:37Z
- **Completed:** 2026-02-10T13:23:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Two recipe API endpoints registered under /api/recipes with auth middleware
- FTS5 full-text search with BM25 ranking, combinable with tag filter and three sort modes
- Recipe content parser handles ingredients (with sub-groups), steps, metadata, notes, and feedback
- useRecipes hook provides debounced search, tag filter, sort, and detail state management

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recipe API routes and register in router** - `a9c6a25` (feat)
2. **Task 2: Create recipe content parser and useRecipes hook** - `87031f2` (feat)

## Files Created/Modified
- `src/mini-app/routes/recipes.ts` - Recipe API route handlers (getList with search/filter/sort, getDetail)
- `src/mini-app/router.ts` - Registered recipe routes on /recipes paths
- `mini-app/src/utils/recipeParser.ts` - Parses recipe content text into structured sections
- `mini-app/src/hooks/useRecipes.ts` - Data fetching hook with search, filter, sort, and detail state

## Decisions Made
- FTS5 results default to relevance sort (BM25 lower = better) unless user explicitly picks alphabetical or most_cooked
- Used GROUP_CONCAT(DISTINCT kt.tag) to aggregate tags in a single query, avoiding N+1 tag fetching
- Detail endpoint updates last_accessed_at for recency tracking (list endpoint does not)
- computeRating uses net sentiment score: favorite (net >= 2, total >= 2), liked (net > 0), mixed (net == 0), needs work (net < 0)
- Tag filter toggles off when same tag is tapped again

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recipe API and data layer complete, ready for Plan 02 (React UI components)
- useRecipes hook provides all state management needed by UI components
- parseRecipeContent ready for RecipeDetail component rendering

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

---
*Phase: 13-recipe-browser*
*Completed: 2026-02-10*
