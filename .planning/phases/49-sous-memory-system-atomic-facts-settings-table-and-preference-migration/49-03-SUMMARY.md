---
phase: 49-sous-memory-system
plan: 03
subsystem: ui
tags: [telegram-bot, mini-app, react, express, memory-ui, settings-api]

requires:
  - phase: 49-sous-memory-system
    provides: memories table with CRUD repository (plan 01)
provides:
  - /memory bot command (with /preferences alias)
  - GET/DELETE /api/memories endpoints for Mini App
  - GET/PUT /api/settings endpoints for Mini App
  - Settings page with Memory list, Meal Times form, and Appearance sections
affects: []

tech-stack:
  added: []
  patterns: [grouped memory display by category, debounced settings auto-save, optimistic delete]

key-files:
  created:
    - src/bot/handlers/memory.ts
    - src/mini-app/routes/memory.ts
    - src/mini-app/routes/settings.ts
  modified:
    - src/bot/index.ts
    - src/main.ts
    - src/mini-app/router.ts
    - mini-app/src/pages/Settings.tsx

key-decisions:
  - "/memory and /preferences both registered in single handler via grammy array command syntax"
  - "Settings API uses dynamic UPDATE with only provided fields for partial updates"
  - "Memory delete is optimistic in UI -- removes from local state immediately before API confirms"
  - "Timezone field displayed as read-only in Mini App (changed via chat)"

patterns-established:
  - "Settings API: upsert pattern (INSERT OR IGNORE then UPDATE) for households without existing row"
  - "Memory grouping: Map<category, items[]> on both server and client side"

requirements-completed: [MEM-06, MEM-07, SET-03]

duration: 4min
completed: 2026-03-06
---

# Phase 49 Plan 03: User-Facing Memory & Settings Surfaces Summary

**/memory bot command, memory/settings API routes, and extended Settings page with grouped memories and meal time form**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T03:57:15Z
- **Completed:** 2026-03-06T04:01:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created /memory bot command that displays all atomic facts grouped by category with severity markers preserved
- Added memory API endpoints (GET grouped list, DELETE by id with household guard) and settings API endpoints (GET with defaults, PUT partial update)
- Extended Mini App Settings page with three sections: Memory (grouped list with X delete buttons), Meal Times & Reminders (time inputs + toggles with debounced save), and Appearance (existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /memory bot command and API routes** - `5c951e5` (feat)
2. **Task 2: Extend Mini App Settings page with Memory and Settings sections** - `d08dadc` (feat)

## Files Created/Modified
- `src/bot/handlers/memory.ts` - /memory + /preferences command handler reading from memories table
- `src/mini-app/routes/memory.ts` - GET /api/memories (grouped) and DELETE /api/memories/:id
- `src/mini-app/routes/settings.ts` - GET /api/settings and PUT /api/settings for application_settings
- `src/bot/index.ts` - Replaced preferencesHandler with memoryHandler in middleware chain
- `src/main.ts` - Replaced createPreferencesHandler import/usage with createMemoryHandler
- `src/mini-app/router.ts` - Registered memory and settings route handlers
- `mini-app/src/pages/Settings.tsx` - Added Memory and Meal Times sections above Appearance

## Decisions Made
- Both /memory and /preferences registered via `handler.command(["memory", "preferences"], ...)` for backward compatibility
- Settings API uses INSERT OR IGNORE + UPDATE pattern to handle households that don't have a settings row yet
- Timezone displayed read-only in Mini App (users change it via chat conversation)
- Memory delete is optimistic -- UI removes immediately, API call fires in background

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three plans of phase 49 complete
- Memory system fully operational: table + FTS (plan 01), Claude tools (plan 02), user surfaces (plan 03)

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 49-sous-memory-system*
*Completed: 2026-03-06*
