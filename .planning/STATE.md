# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** Phase 14 Meal Plan Viewer -- data layer complete, UI next (v1.1 Mini Apps milestone)

## Current Position

Phase: 14 of 14 (Meal Plan Viewer)
Plan: 1 of 2 in current phase (14-01 complete)
Status: Executing Phase 14
Last activity: 2026-02-10 -- 14-01 Meal Plan API & Data Layer complete

Progress: [#########░] 24%

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 30
- Average duration: 2.8 min
- Total execution time: 83 min

**v1.1 Velocity:**
- Total plans completed: 9
- Average duration: 6 min
- Total execution time: 53 min

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 11-01 | API & Auth Infrastructure | 8 min | 2 | 7 |
| 11-02 | Frontend SPA | 21 min | 2 | 19 |
| 11-03 | Bot-to-Mini-App Wiring | 7 min | 2 | 4 |
| 12-01 | Grocery API & Section Utilities | 2 min | 2 | 5 |
| 12-02 | Grocery List React Page | 3 min | 2 | 10 |
| 12-03 | Quick-add, MainButton, Polling | 4 min | 2 | 5 |
| 13-01 | Recipe API, Parser & Hook | 2 min | 2 | 4 |
| 13-02 | Recipe Browser UI | 4 min | 2 | 10 |
| 14-01 | Meal Plan API & Data Layer | 2 min | 2 | 4 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v1.0 decisions documented with outcomes.

v1.1 decisions:
- Recipes counted via knowledge_tags (tag='recipe') since knowledge_items has no type column
- API router created in both webhook and polling modes for dev testing
- Express route order: static -> API -> webhook -> SPA fallback
- Used retrieveRawInitData() instead of retrieveLaunchParams().initDataRaw (SDK v3 API)
- Used --legacy-peer-deps for React 19 + @telegram-apps/telegram-ui peer dep conflict
- BackButton uses isAvailable() guard for graceful non-Telegram env handling
- Plan handler uses ctx.reply with reply_markup instead of sendFormattedMessage for keyboard support
- WebApp button preserved on grocery keyboard rebuild during item toggle callbacks
- Duplicated SECTION_ORDER constants across server/client (no shared imports across build boundary)
- guessSection uses case-insensitive substring matching with ~50 keywords across 6 sections
- Used notificationOccurred('success') for haptic feedback (Android-compatible)
- GroceryItem interface defined locally in useGroceryList.ts (createdAt as string)
- Progress counter shows global totals across all stores
- 800ms animation delay before checked item moves to Done section
- Always poll every 8s on Grocery page (avoids circular hook dependency with hasActiveList)
- mainButton.setParams called directly in handler for loader (avoids useCallback dep cycle)
- QuickAddFab form stays open after add for rapid multi-item entry
- FAB positioned at safe-area + 80px to sit above native MainButton
- FTS5 recipe search defaults to BM25 relevance sort unless explicitly overridden
- GROUP_CONCAT(DISTINCT kt.tag) aggregates tags in single query (avoids N+1)
- Detail endpoint updates last_accessed_at; list endpoint does not
- computeRating labels: favorite/liked/mixed/needs work from net sentiment score
- Tag filter toggle: same tag clears filter (sets null)
- Server-side extractRating parses Feedback from content to return rating on list items without sending content
- RecipeCard filters out redundant 'recipe' tag, shows max 3 with overflow indicator
- Scroll preservation via useRef + requestAnimationFrame on detail close
- Sort picker dropdown uses click-outside listener for close behavior
- Server-side weekStartDate calculation avoids client timezone issues for meal plan API
- Parallel fetch of both weeks on mount for instant tab switching (useMealPlan)
- LEFT JOIN knowledge_items detects orphaned recipes via hasRecipe boolean
- Duplicated date logic client-side per existing no-shared-imports convention

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 14-01-PLAN.md (Meal Plan API & Data Layer)
Resume file: None
Next action: Execute 14-02-PLAN.md (Meal Plan UI).
