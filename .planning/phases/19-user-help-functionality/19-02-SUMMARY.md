---
phase: 19-user-help-functionality
plan: 02
subsystem: ui, api
tags: [react, express, help-page, admin-detection, telegram-mini-app]

# Dependency graph
requires:
  - phase: 15-household-invites
    provides: user role (admin/member) in users table
  - phase: 18-app-feedback
    provides: Feedback.tsx pattern, Hub card pattern
provides:
  - Help.tsx page with comprehensive hardcoded feature documentation
  - GET /api/me endpoint returning user role
  - useUserRole hook for admin detection in Mini App
  - Hub Help card navigating to /help
affects: [19-user-help-functionality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useUserRole hook pattern for role-based conditional rendering"
    - "/api/me endpoint for client-side user metadata access"

key-files:
  created:
    - mini-app/src/pages/Help.tsx
    - mini-app/src/hooks/useUserRole.ts
    - src/mini-app/routes/me.ts
  modified:
    - mini-app/src/pages/Hub.tsx
    - mini-app/src/router.tsx
    - src/mini-app/router.ts

key-decisions:
  - "Admin section placed at bottom of Help page to avoid layout shift during role fetch"
  - "Default to non-admin on /api/me error for safe degradation"

patterns-established:
  - "useUserRole hook: fetch role from /api/me with cancelled flag cleanup"
  - "/api/me returns { role } using chatId from auth middleware"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 19 Plan 02: Mini App Help Page Summary

**Help page with categorized feature docs, inline tips, conditional admin commands, /api/me endpoint, and Hub Help card**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T21:47:03Z
- **Completed:** 2026-02-11T21:50:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Help page renders all bot features in 6 categories (Recipes, Meal Planning, Grocery Lists, Reminders, Preferences, Commands) with inline tips
- Admin users see admin-only commands (/invite, /costs, /debug); regular users see no admin section
- GET /api/me endpoint returns user role from database using auth middleware's chatId
- useUserRole hook provides isAdmin boolean with safe async cleanup
- Hub dashboard includes Help card as last item with HelpCircle icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/me endpoint and useUserRole hook** - `edca6ef` (feat)
2. **Task 2: Create Help page, Hub card, and router route** - `9e86b64` (feat)

## Files Created/Modified
- `src/mini-app/routes/me.ts` - GET /me endpoint returning user role
- `mini-app/src/hooks/useUserRole.ts` - Hook to fetch user role with admin detection
- `mini-app/src/pages/Help.tsx` - Comprehensive help page with conditional admin section
- `mini-app/src/pages/Hub.tsx` - Added Help card with HelpCircle icon
- `mini-app/src/router.tsx` - Added /help route
- `src/mini-app/router.ts` - Registered /me endpoint

## Decisions Made
- Admin section at bottom of help page to avoid layout shift during role resolution
- Non-admin default on error for safe degradation (security-first)
- Followed Feedback.tsx pattern for BackButton setup and page structure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Help page and /api/me endpoint complete
- Ready for plan 19-01 if not yet executed (help command handler and system prompt)

## Self-Check: PASSED

All key files verified on disk. All commit hashes verified in git log.

---
*Phase: 19-user-help-functionality*
*Completed: 2026-02-11*
