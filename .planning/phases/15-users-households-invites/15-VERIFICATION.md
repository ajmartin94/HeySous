---
phase: 15-users-households-invites
verified: 2026-02-11T05:15:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 15: Users, Households, and Invites Verification Report

**Phase Goal:** New users can join the bot only via invite link, and every user has a persistent identity within a household

**Verified:** 2026-02-11T05:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Based on ROADMAP.md Success Criteria and PLAN must_haves:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can run /invite to generate a single-use deep link URL, choosing household or independent type | ✓ VERIFIED | invite.ts implements all three flags: default (join admin household), independent (new household), household:ID (specific household). Creates token with 7-day expiry, generates t.me deep link. |
| 2 | A new user clicking an invite link is registered with their Telegram identity, assigned to the correct household, and greeted | ✓ VERIFIED | start.ts Branch 3 handles new user + valid token: calls getAndRedeemToken(), createUser() with token's householdId, replies with warm greeting "Hey {name}! Welcome to HeySous! I'm your meal planning assistant..." |
| 3 | A new user clicking an expired or already-used invite link sees a friendly rejection and cannot use the bot | ✓ VERIFIED | start.ts Branch 4: if getAndRedeemToken returns null, replies "This invite link is no longer valid. Ask for a new one!" Repository checks redeemed_by IS NULL AND expires_at > unixepoch(). |
| 4 | A non-invited user sending any message is blocked from all bot features and told to get an invite | ✓ VERIFIED | access-gate.ts blocks all updates except /start if getUserByTelegramId returns undefined. Replies "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!" |
| 5 | The existing single user is seeded into the users table as admin with a household-of-one, and all current functionality continues to work | ✓ VERIFIED | Database check confirms admin user (telegram_id=ajmartin94, role=admin, household_id=ajmartin94, onboarding_state=complete). init.ts seeds admin if adminUserId set and user doesn't exist, with verification query. |
| 6 | households, users, and invite_tokens tables exist in the database after startup | ✓ VERIFIED | Database verification shows all three tables exist. Created by initializeUsers() and initializeInvites() in db/index.ts lines 46-49. |
| 7 | The existing admin user is seeded into the users table with role='admin' and onboarding_state='complete' on first startup | ✓ VERIFIED | init.ts lines 40-73 implement seeding with verification. Database shows role=admin, onboarding_state=complete. |
| 8 | Admin's household_id equals their telegram_id (for Phase 16 data migration compatibility) | ✓ VERIFIED | Database confirms household_id=telegram_id (both ajmartin94). init.ts line 49-53 creates household with id = adminUserId deliberately. |
| 9 | Invite tokens can be created, validated, and redeemed via repository functions | ✓ VERIFIED | invites/repository.ts exports createInviteToken (creates record), getAndRedeemToken (atomic validate+redeem with SQL WHERE redeemed_by IS NULL AND expires_at > unixepoch()), getTokenByValue (inspection). |
| 10 | User CRUD operations work: create, getByTelegramId, getHouseholdMembers | ✓ VERIFIED | users/repository.ts exports all required functions: getUserByTelegramId (line 51-60), createUser (line 63-86), getHouseholdMembers (line 89-98), plus createHousehold, getHouseholdById, updateHouseholdName, getAdmin. |
| 11 | config.adminUserId returns the first entry from ADMIN_USER_IDS | ✓ VERIFIED | config.ts line 59: adminUserId computed from adminUserIds[0] ?? "". Used by db/index.ts line 46 to pass to initializeUsers(). |
| 12 | A non-invited user sending any message gets the friendly rejection and is blocked from all features | ✓ VERIFIED | Same as truth #4. access-gate.ts middleware blocks all non-/start updates for unregistered users. |
| 13 | An existing registered user can continue using the bot normally with no interruption | ✓ VERIFIED | access-gate.ts lines 44-62: if user found (cache or DB), injects userId/householdId/user into ctx and calls next(). All handlers receive identity. Admin passes gate. |
| 14 | The /start command is exempted from the access gate (it is the registration entry point) | ✓ VERIFIED | access-gate.ts lines 34-36: "if (ctx.message?.text?.startsWith('/start')) return next()". Unconditional passthrough before user lookup. |

**Score:** 14/14 truths verified

### Required Artifacts

**Plan 01 Artifacts (Data Layer):**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/users/types.ts | User and Household TypeScript interfaces | ✓ VERIFIED | Contains User (9 fields including role, onboardingState), Household (4 fields), CreateUserParams interfaces. 28 lines. |
| src/users/schema.ts | Drizzle schema for users and households tables | ✓ VERIFIED | Exports households and users sqliteTable definitions with Drizzle references, enums, CHECK constraints via Drizzle types. 38 lines. |
| src/users/init.ts | Table creation + admin seeding | ✓ VERIFIED | initializeUsers() with raw SQL CREATE TABLE IF NOT EXISTS, admin seeding logic (lines 40-61), post-seed verification (lines 64-73). 75 lines. |
| src/users/repository.ts | User and household CRUD functions | ✓ VERIFIED | Exports all 7 required functions: getUserByTelegramId, createUser, getHouseholdMembers, createHousehold, getHouseholdById, updateHouseholdName (with auto-naming logic), getAdmin. 167 lines. |
| src/invites/types.ts | InviteToken TypeScript interface | ✓ VERIFIED | Contains InviteToken (9 fields) and CreateInviteParams (5 fields). 20 lines. |
| src/invites/schema.ts | Drizzle schema for invite_tokens table | ✓ VERIFIED | Exports inviteTokens sqliteTable with FK reference to households, enum for inviteType. 24 lines. |
| src/invites/init.ts | Invite tokens table creation | ✓ VERIFIED | initializeInvites() with raw SQL, CHECK constraint on invite_type. 27 lines. |
| src/invites/repository.ts | Invite token CRUD functions | ✓ VERIFIED | Exports createInviteToken (creates record), getAndRedeemToken (atomic validation+redemption), getTokenByValue. 101 lines. |
| src/invites/deep-link.ts | Deep link URL generation | ✓ VERIFIED | Exports generateDeepLink (builds t.me URL) and generateToken (crypto.randomBytes(24).toString('base64url')). 19 lines. |

**Plan 02 Artifacts (Bot Integration):**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/bot/context.ts | Extended BotContext with userId, householdId, user fields | ✓ VERIFIED | Lines 9-14 add userId?: string, householdId?: string, user?: User. Total 16 lines. |
| src/bot/middlewares/access-gate.ts | Access gate middleware blocking unregistered users | ✓ VERIFIED | createAccessGate() factory returns {middleware, addToCache}. In-memory Map cache, /start passthrough, friendly rejection message. 68 lines. |
| src/bot/handlers/start.ts | 4-way /start handler with invite deep link processing | ✓ VERIFIED | createStartHandler() factory. Implements all 4 branches: existing user (with/without token), new user + valid token (registration + greeting + admin notify), new user + invalid/no token (rejection). 111 lines. |
| src/bot/handlers/invite.ts | /invite admin command handler | ✓ VERIFIED | createInviteHandler() factory. Admin-only (ctx.user?.role check). Parses flags: default, independent, household:ID. Generates token, creates invite, builds deep link, replies with URL. 97 lines. |
| src/bot/index.ts | Bot factory with access gate in middleware pipeline | ✓ VERIFIED | CreateBotOptions includes accessGate, startHandler, inviteHandler. Middleware order: db injection (line 81-84), accessGate (line 87), then feature handlers. 109 lines. |
| src/main.ts | Entry point wiring access gate and invite handler | ✓ VERIFIED | Uses grammy Api class to fetch botUsername (lines 67-70). Creates access gate (line 73), start handler (line 74), invite handler (line 75). Passes to createBot (line 176-178). 261 lines. |

### Key Link Verification

**Plan 01 Links (Data Layer Wiring):**

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| src/db/index.ts | src/users/init.ts | initializeUsers() call in createDatabase() | ✓ WIRED | Line 46: initializeUsers(sqlite, config.adminUserId). Import on line 11. |
| src/db/index.ts | src/invites/init.ts | initializeInvites() call in createDatabase() | ✓ WIRED | Line 49: initializeInvites(sqlite). Import on line 12. Comes AFTER initializeUsers (correct order). |
| src/db/schema.ts | src/users/schema.ts | re-export of users and households Drizzle tables | ✓ WIRED | Line 53: export { households, users } from "../users/schema.js". |
| src/db/schema.ts | src/invites/schema.ts | re-export of inviteTokens Drizzle table | ✓ WIRED | Line 55: export { inviteTokens } from "../invites/schema.js". |
| src/users/init.ts | src/config.ts | adminUserId parameter for admin seeding | ✓ WIRED | initializeUsers() receives adminUserId param (line 14), used in seeding logic (lines 41-61). db/index.ts passes config.adminUserId (line 46). |

**Plan 02 Links (Bot Integration Wiring):**

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| src/bot/middlewares/access-gate.ts | src/users/repository.ts | getUserByTelegramId lookup for gate check | ✓ WIRED | Import line 12. Called line 46 with sqlite param. Result used to block/allow (lines 52-63). |
| src/bot/handlers/start.ts | src/invites/repository.ts | getAndRedeemToken for invite validation | ✓ WIRED | Import line 16. Called line 47 with token and telegramId. Result determines registration vs rejection (lines 49-92). |
| src/bot/handlers/start.ts | src/users/repository.ts | createUser for new user registration | ✓ WIRED | Import line 15 (getUserByTelegramId, createUser, updateHouseholdName, getAdmin). createUser called line 51-58 with params from token+ctx. |
| src/bot/handlers/invite.ts | src/invites/repository.ts | createInviteToken for generating invites | ✓ WIRED | Import line 16. Called line 74-80 with token, householdId, inviteType, createdBy, expiresAt. |
| src/bot/handlers/invite.ts | src/invites/deep-link.ts | generateDeepLink + generateToken for URL creation | ✓ WIRED | Import line 17. generateToken() called line 71, generateDeepLink() called line 83 with botUsername and token. |
| src/bot/index.ts | src/bot/middlewares/access-gate.ts | accessGate registered after db injection, before feature handlers | ✓ WIRED | CreateBotOptions includes accessGate (line 35). Registered bot.use(accessGate) line 87, after db injection (81-84), before groceryCallbackHandler (89). |

All key links verified. No orphaned artifacts or broken wiring found.

### Requirements Coverage

From ROADMAP.md Phase 15 Requirements: INVITE-01 through INVITE-06, USER-01 through USER-03

| Requirement | Status | Supporting Evidence |
|-------------|--------|---------------------|
| INVITE-01: Admin can generate invite links | ✓ SATISFIED | /invite command (invite.ts) generates deep links with 3 invite types |
| INVITE-02: New users register via invite links | ✓ SATISFIED | /start handler processes deep links, validates tokens, creates users |
| INVITE-03: Expired/used links rejected | ✓ SATISFIED | getAndRedeemToken checks redeemed_by IS NULL AND expires_at > unixepoch() |
| INVITE-04: Non-invited users blocked | ✓ SATISFIED | access-gate.ts blocks all non-/start updates for unregistered users |
| INVITE-05: Single-use tokens | ✓ SATISFIED | getAndRedeemToken sets redeemed_by + redeemed_at, preventing reuse |
| INVITE-06: 7-day expiry | ✓ SATISFIED | invite.ts line 72: expiresAt = now + 7 * 24 * 60 * 60 |
| USER-01: Persistent user identity | ✓ SATISFIED | users table with telegram_id, households table, FK relationships |
| USER-02: Household membership | ✓ SATISFIED | users.household_id references households.id, auto-naming on join |
| USER-03: Admin seeding | ✓ SATISFIED | initializeUsers seeds admin with role=admin, household_id=telegram_id |

All 9 requirements satisfied.

### Anti-Patterns Found

Scanned all phase 15 files for TODO/FIXME/XXX/HACK/PLACEHOLDER comments, empty implementations, console.log-only functions, stub patterns.

**Result:** None found.

All functions have substantive implementations:
- Repository functions query database and return mapped results
- Handlers perform business logic (validation, registration, notification)
- No placeholder return values (return null, return {}, etc.)
- No console.log-only implementations

### Human Verification Required

The following behaviors require manual testing as they involve real-time Telegram interactions:

#### 1. Admin invite link generation and redemption flow

**Test:**
1. As admin user (telegram_id=ajmartin94), send /invite to the bot
2. Copy the generated deep link URL
3. Open the link in a second Telegram account (new user)
4. Verify new user receives welcome message
5. Verify admin receives notification "{DisplayName} just joined your household!"

**Expected:**
- /invite returns a t.me deep link with 32-char base64url token
- New user receives: "Hey {name}! Welcome to HeySous! I'm your meal planning assistant -- I remember recipes, plan weekly dinners, build grocery lists, and send prep reminders. Tell me about a recipe you love, or ask me to plan your week!"
- Admin receives: "{name} just joined your household!"
- Household name updates to "Admin & {name}'s household"

**Why human:** Requires two Telegram accounts, deep link navigation, real-time message delivery, notification timing.

#### 2. Access gate blocks unregistered users

**Test:**
1. Using a third Telegram account (not admin, no invite), send any message to the bot (e.g., "hello")
2. Verify rejection message appears
3. Send /plan, /grocery, or any other command
4. Verify all commands are blocked

**Expected:**
- All messages except /start receive: "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!"
- No commands or features accessible

**Why human:** Requires testing with unregistered Telegram account, verifying multiple command paths blocked.

#### 3. Expired invite link rejection

**Test:**
1. Modify database to set an invite token's expires_at to past timestamp
2. Use that invite link from a new account
3. Verify rejection message

**Expected:**
- Message: "This invite link is no longer valid. Ask for a new one!"
- User not registered (remains blocked by access gate)

**Why human:** Requires database manipulation + Telegram interaction. Could be automated with test harness but not in production environment.

#### 4. Already-used invite link rejection

**Test:**
1. Generate an invite link
2. Use it to register a new user (successfully)
3. Try using the same link again from another account
4. Verify rejection

**Expected:**
- Second use receives: "This invite link is no longer valid. Ask for a new one!"
- Token shows redeemed_by = first user's telegram_id

**Why human:** Requires coordination of multiple Telegram accounts and timing.

#### 5. Independent household invite

**Test:**
1. As admin, send /invite independent
2. Use the link to register a new user
3. Verify the new user is in a separate household (not admin's)
4. Check database: user's household_id should NOT equal admin's

**Expected:**
- New user gets their own household (new UUID)
- Household name initially "New Household", updates to "{name}'s household" after join
- Independent from admin's household

**Why human:** Requires verifying household isolation, checking database state.

---

**Note:** All automated verifications passed. Human testing recommended before Phase 16 to ensure end-to-end invite flow works in production Telegram environment.

### Gaps Summary

**No gaps found.** All must-haves verified at all three levels:
1. Existence: All 15 artifacts exist with expected file sizes (19-167 lines)
2. Substantive: All artifacts contain required patterns, exports, logic
3. Wired: All 11 key links verified (imports + usage + correct parameters)

Database initialized successfully with all three tables (households, users, invite_tokens). Admin user seeded with correct role, household_id, and onboarding_state. TypeScript compiles with zero errors. All commits documented in SUMMARY files exist in git history.

Phase 15 goal fully achieved: invite-gated access with persistent user identity within households.

---

_Verified: 2026-02-11T05:15:00Z_
_Verifier: Claude (gsd-verifier)_
