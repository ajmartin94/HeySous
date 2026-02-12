---
phase: 15-users-households-invites
plan: 02
subsystem: auth, bot
tags: [grammy, middleware, access-gate, deep-link, invite, telegram, bot-context]

# Dependency graph
requires:
  - phase: 15-01
    provides: users/households/invite_tokens tables, repository CRUD functions, deep link generation
provides:
  - access gate middleware blocking unregistered users with friendly message
  - /start handler processing 4-way invite deep link scenarios
  - /invite admin command generating single-use deep link URLs
  - BotContext extended with userId, householdId, user identity fields
affects: [16-data-migration, 17-guided-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [access gate middleware with in-memory user cache, factory function handlers with dependency injection, grammy Api class for bot info fetch]

key-files:
  created:
    - src/bot/middlewares/access-gate.ts
    - src/bot/handlers/invite.ts
  modified:
    - src/bot/context.ts
    - src/bot/handlers/start.ts
    - src/bot/index.ts
    - src/main.ts

key-decisions:
  - "Access gate returns { middleware, addToCache } so /start handler can immediately cache newly registered users"
  - "Used grammy Api class to fetch botUsername before bot creation, avoiding chicken-and-egg with createBot"
  - "Access gate allows /start through unconditionally -- it is the registration entry point"
  - "/invite admin check uses ctx.user.role from access gate injection, not config.adminUserIds env var"

patterns-established:
  - "Access gate middleware pattern: cache lookup -> DB fallback -> context injection"
  - "Factory function handlers: createStartHandler(deps) returns Composer, replacing static exports"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 15 Plan 02: Bot Integration Summary

**Access gate middleware, 4-way /start deep link handler, /invite admin command, and BotContext identity injection wired into the full middleware pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T12:57:05Z
- **Completed:** 2026-02-11T13:00:37Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created access gate middleware with in-memory user cache, /start passthrough, and friendly rejection for unregistered users
- Rewrote /start handler from static greeting to 4-way deep link processor (existing user, existing+token, new+valid token, new+invalid/no token)
- Created /invite admin command with flag parsing (default, independent, household:ID) and 7-day expiry
- Extended BotContext with userId, householdId, user fields injected by the access gate
- Wired everything into bot middleware pipeline in correct order (accessGate after DB injection, before all feature handlers)
- Bot starts and runs successfully with full invite-gated access system

## Task Commits

Each task was committed atomically:

1. **Task 1: Create access gate middleware and extend BotContext** - `94f7dbb` (feat)
2. **Task 2: Rewrite /start handler and create /invite command** - `603c877` (feat)
3. **Task 3: Wire everything into bot factory and main.ts** - `b30226a` (feat)

## Files Created/Modified
- `src/bot/context.ts` - Extended BotContext with userId, householdId, user optional fields
- `src/bot/middlewares/access-gate.ts` - Access gate middleware with user cache, /start passthrough, friendly rejection
- `src/bot/handlers/start.ts` - Factory function with 4-way deep link processing, registration, admin notification
- `src/bot/handlers/invite.ts` - /invite admin command with flag parsing, token generation, deep link URL output
- `src/bot/index.ts` - Updated middleware pipeline with accessGate, startHandler, inviteHandler
- `src/main.ts` - Wire access gate, start handler, invite handler; fetch bot info via Api class

## Decisions Made
- Access gate returns `{ middleware, addToCache }` to share cache closure with /start handler for immediate post-registration caching
- Used `new Api(config.botToken).getMe()` to fetch botUsername before createBot, avoiding restructuring the factory
- /invite admin check uses `ctx.user.role` from access gate context injection rather than re-checking `config.adminUserIds`
- Access gate allows /start through unconditionally (it is the registration entry point)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bot is fully invite-gated: unregistered users blocked, admin can use all features
- /invite generates deep links, /start processes invite tokens for registration
- All existing functionality (costs, debug, preferences, plan, grocery, reminders, feedback) continues to work for registered users
- Phase 15 complete -- ready for Phase 16 (chatId -> householdId data migration)

## Self-Check: PASSED

All 6 files verified on disk. All 3 commit hashes (94f7dbb, 603c877, b30226a) found in git log.

---
*Phase: 15-users-households-invites*
*Completed: 2026-02-11*
