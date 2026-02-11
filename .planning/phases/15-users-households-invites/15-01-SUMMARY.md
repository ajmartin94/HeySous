---
phase: 15-users-households-invites
plan: 01
subsystem: database, auth
tags: [sqlite, drizzle, better-sqlite3, crypto, users, households, invites, deep-link]

# Dependency graph
requires:
  - phase: none
    provides: existing grocery/reminders/feedback init.ts patterns, config.ts ADMIN_USER_IDS
provides:
  - users table with TypeScript types, Drizzle schema, init, and CRUD repository
  - households table with auto-naming logic
  - invite_tokens table with creation, validation, and atomic redemption
  - deep link URL generation and cryptographic token generation
  - config.adminUserId computed property
affects: [15-02, 16-data-migration, 17-guided-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [users module (types/schema/init/repository), invites module (types/schema/init/repository/deep-link), admin seeding at DB init, household auto-naming]

key-files:
  created:
    - src/users/types.ts
    - src/users/schema.ts
    - src/users/init.ts
    - src/users/repository.ts
    - src/invites/types.ts
    - src/invites/schema.ts
    - src/invites/init.ts
    - src/invites/repository.ts
    - src/invites/deep-link.ts
  modified:
    - src/config.ts
    - src/db/index.ts
    - src/db/schema.ts

key-decisions:
  - "Admin household_id equals admin telegram_id for Phase 16 chatId migration compatibility"
  - "Admin seeded with onboarding_state='complete' and verified post-seed with COUNT check"
  - "Invite tokens use crypto.randomBytes(24).toString('base64url') -- 32-char URL-safe, zero deps"
  - "Repository functions use standalone exports (not factory pattern) taking sqlite param directly"

patterns-established:
  - "Users module: types.ts -> schema.ts -> init.ts -> repository.ts structure"
  - "Invites module: same pattern plus deep-link.ts for URL generation"
  - "Admin seeding in initializeUsers() with post-seed verification"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 15 Plan 01: Identity Data Layer Summary

**Users, households, and invite_tokens tables with Drizzle schemas, raw SQL init (including admin seeding), CRUD repositories, and cryptographic deep link token generation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T12:50:37Z
- **Completed:** 2026-02-11T12:54:48Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created users module (types, Drizzle schema, raw SQL init with admin seeding, repository with 7 CRUD functions)
- Created invites module (types, Drizzle schema, raw SQL init, repository with 3 functions, deep link generator)
- Wired both modules into createDatabase() -- tables created at startup in correct order (households -> users -> invite_tokens)
- Added config.adminUserId computed property (first ADMIN_USER_IDS entry)
- Admin user auto-seeded with household_id = telegram_id for Phase 16 migration compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create users and households data module** - `c70bfb0` (feat)
2. **Task 2: Create invites module and wire database initialization** - `368c9b6` (feat)

## Files Created/Modified
- `src/users/types.ts` - User, Household, CreateUserParams interfaces
- `src/users/schema.ts` - Drizzle schema for users and households tables
- `src/users/init.ts` - Raw SQL table creation + admin seeding with verification
- `src/users/repository.ts` - getUserByTelegramId, createUser, getHouseholdMembers, createHousehold, getHouseholdById, updateHouseholdName, getAdmin
- `src/invites/types.ts` - InviteToken, CreateInviteParams interfaces
- `src/invites/schema.ts` - Drizzle schema for invite_tokens table
- `src/invites/init.ts` - Raw SQL table creation with CHECK constraints
- `src/invites/repository.ts` - createInviteToken, getAndRedeemToken, getTokenByValue
- `src/invites/deep-link.ts` - generateDeepLink URL builder, generateToken crypto function
- `src/config.ts` - Added adminUserId computed property
- `src/db/index.ts` - Added initializeUsers() and initializeInvites() calls
- `src/db/schema.ts` - Re-exports for households, users, inviteTokens

## Decisions Made
- Admin's household_id = their telegram_id (deliberate for Phase 16 chatId->householdId migration)
- Admin seeded with onboarding_state='complete' so they pass access gate immediately
- Post-seed verification throws if admin count is 0 (prevents silent seeding failures)
- Used standalone function exports for repository (not factory pattern) -- consistent with plan spec, takes sqlite as first param
- Invite tokens: 192-bit entropy via crypto.randomBytes, base64url encoding (URL-safe, Telegram-compatible)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete: all three tables exist and are initialized at startup
- Admin user auto-seeded with correct household association
- All repository functions verified working (CRUD, token redemption, deep links)
- Ready for Plan 02: access gate middleware, /start handler, and /invite command

## Self-Check: PASSED

All 12 files verified on disk. Both commit hashes (c70bfb0, 368c9b6) found in git log.

---
*Phase: 15-users-households-invites*
*Completed: 2026-02-11*
