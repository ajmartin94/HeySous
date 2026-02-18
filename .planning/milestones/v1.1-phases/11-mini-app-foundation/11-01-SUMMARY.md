---
phase: 11-mini-app-foundation
plan: 01
subsystem: api
tags: [telegram-mini-apps, express, initdata, hmac-sha256, middleware, spa]

# Dependency graph
requires:
  - phase: 10-feedback
    provides: "Express server, SQLite database, repository factories"
provides:
  - "initData HMAC-SHA256 auth middleware for /api/* routes"
  - "API router factory with DI pattern (sqlite injection)"
  - "Hub summary endpoint (/api/summary) with grocery, recipe, plan counts"
  - "Static file serving at /app/* with SPA fallback"
  - "miniAppUrl config field for bot web_app button URLs"
affects: [11-02-frontend-spa, 12-grocery-view, 13-recipe-browser, 14-meal-plan-view]

# Tech tracking
tech-stack:
  added: ["@tma.js/init-data-node@2.0.6"]
  patterns: ["initData validation middleware", "API router with DI", "SPA fallback routing"]

key-files:
  created:
    - src/mini-app/auth-middleware.ts
    - src/mini-app/router.ts
    - src/mini-app/routes/summary.ts
  modified:
    - src/config.ts
    - src/server.ts
    - src/main.ts
    - package.json

key-decisions:
  - "Recipes counted via knowledge_tags (tag='recipe') since knowledge_items has no type column"
  - "API router created in both webhook and polling modes for dev testing"
  - "Express route order: static -> API -> webhook -> SPA fallback (prevents catch-all conflicts)"

patterns-established:
  - "API middleware reads X-Init-Data header, validates with botToken, sets res.locals.chatId"
  - "API route factories accept { sqlite } deps, use sqlite.prepare() for queries"
  - "Mini App backend code lives in src/mini-app/ with routes/ subdirectory"

# Metrics
duration: 8min
completed: 2026-02-10
---

# Phase 11 Plan 01: API & Auth Infrastructure Summary

**Express API layer with initData HMAC-SHA256 auth, hub summary endpoint, and /app/* static serving with SPA fallback**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-10T02:02:55Z
- **Completed:** 2026-02-10T02:10:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- initData authentication middleware validates Telegram Mini App requests with 1-hour expiry, extracts chatId from user.id
- API router factory applies auth to all /api/* routes, follows project DI pattern with sqlite injection
- Hub summary endpoint queries three data sources (grocery unchecked items, recipe count via tags, current week meal plan entries)
- Express serves static files at /app/* with SPA fallback for client-side routing
- Route registration order prevents SPA fallback from intercepting API or webhook requests

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth middleware + API router + summary endpoint** - `5cc1df2` (feat)
2. **Task 2: Express integration -- static serving, API mount, config** - `d3943e4` (feat)

## Files Created/Modified
- `src/mini-app/auth-middleware.ts` - initData HMAC-SHA256 validation middleware, extracts chatId
- `src/mini-app/router.ts` - Express Router factory for /api/* with auth and summary route
- `src/mini-app/routes/summary.ts` - Hub dashboard summary endpoint (grocery, recipes, plans counts)
- `src/config.ts` - Added miniAppUrl config field (MINI_APP_URL env var)
- `src/server.ts` - Added /app/* static serving, /api/* mount, SPA fallback routing
- `src/main.ts` - Wires API router with sqlite DI in both webhook and polling modes
- `package.json` - Added @tma.js/init-data-node dependency, build:app and build:all scripts

## Decisions Made
- Recipes counted via knowledge_tags JOIN (tag='recipe') since knowledge_items schema has no 'type' column -- adapts plan intent to actual schema
- API router created outside the webhook/polling branch so both modes get API endpoints, useful for dev testing
- Express route order follows research Pitfall 5: static -> API -> webhook -> SPA fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted recipe count query to use knowledge_tags instead of nonexistent type column**
- **Found during:** Task 1 (summary endpoint)
- **Issue:** Plan specified "count of knowledge entries of type 'recipe'" but knowledge_items has no type column -- recipes are identified via knowledge_tags with tag='recipe'
- **Fix:** Used JOIN query: `SELECT COUNT(DISTINCT ki.id) FROM knowledge_items ki JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id WHERE ki.chat_id = ? AND kt.tag = 'recipe'`
- **Files modified:** src/mini-app/routes/summary.ts
- **Verification:** TypeScript compiles, query structure matches existing FTS pattern
- **Committed in:** 5cc1df2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correction for schema accuracy. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API layer ready for Plan 02 (frontend SPA) to connect to via /api/summary
- Static serving configured at /app/* ready for Vite build output at mini-app/dist/
- Auth middleware in place for all future API routes (grocery, recipes, plans)
- miniAppUrl config available for bot handlers to construct web_app button URLs

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 11-mini-app-foundation*
*Completed: 2026-02-10*
