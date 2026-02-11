# Project Research Summary

**Project:** HeySous v1.2 - Multi-User Support
**Domain:** Multi-user Telegram bot with household sharing, invite-gated access, onboarding, and app feedback
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

HeySous v1.2 transforms a single-user meal planning bot into a multi-user system with household data sharing. The research reveals this is fundamentally a **data model migration challenge**, not a technology adoption problem. The existing stack (Node.js 22, grammY, SQLite/Drizzle, Express, React) requires **zero new npm dependencies**. All four feature areas -- invite system, multi-user identity, onboarding, and app feedback -- can be built entirely with existing packages plus Node.js built-ins.

The core challenge is migrating from `chatId` as the sole data isolation key (339 occurrences across 47 files) to a dual-scope model: `householdId` for shared data (recipes, meal plans, grocery lists) and `userId` for personal data (messages, reminders, token usage). This is not a simple find-replace -- it requires systematic refactoring of every repository, tool handler, FTS5 query, and Mini App API route. The migration must preserve all existing data for the current user while establishing the foundation for household sharing. A partial migration creates a split-brain system where data written by new code is invisible to old queries.

Ten critical pitfalls were identified, most centered on migration safety: orphaned existing user data, lost FTS5 triggers, cross-household data leaks, and identity mismatches between bot and Mini App. The recommended approach is a 4-phase execution: (1) foundational data model with users, households, invites, and access gating, (2) comprehensive chatId-to-householdId migration across all repositories, (3) guided onboarding with SQLite-backed state machine, (4) app feedback system. Phase 1 and 2 are tightly coupled and must be executed atomically -- the "half-migrated" state is the dangerous state.

## Key Findings

### Recommended Stack

**No new dependencies required.** The existing stack covers all v1.2 requirements:

**Core technologies (all existing):**
- **Node.js 22** (built-in): `crypto.randomBytes().toString('base64url')` for invite token generation -- no nanoid/uuid needed
- **grammY ^1.39.3**: Deep link payload via `ctx.match` provides invite token mechanism natively
- **SQLite/better-sqlite3 ^12.6.2**: `ALTER TABLE ADD COLUMN` for migration, WAL mode handles multi-user concurrency
- **Drizzle ORM ^0.45.1**: Schema definitions extend naturally with new tables (users, households, invites, app_feedback)
- **Express ^5.2.1**: Admin API routes follow existing Mini App pattern
- **React ^19.2.4 + Vite**: Admin dashboard pages fit existing SPA structure

**Key insight:** The work is schema design, data migration, and code restructuring -- not technology adoption. Deep link tokens use grammY's native `ctx.match`, token generation uses Node.js crypto, onboarding state uses SQLite table (not grammY sessions plugin), and the admin dashboard extends the existing Express/React Mini App.

### Expected Features

**Must have (table stakes for v1.2):**
- Multi-user identity with users and households tables
- Invite-gated access via Telegram deep links (`t.me/BotName?start=TOKEN`)
- Household data sharing for recipes, meal plans, grocery lists, cooking history
- Guided onboarding flow (preference Q&A, capability tour, seed recipes)
- /feedback command for app feedback collection
- Admin feedback view for collected feedback

**Should have (differentiators):**
- Single-use invite tokens with 7-day expiry
- Two invite types: household (join existing) vs independent (new household)
- SQLite-backed onboarding state (survives restarts, enables analytics)
- Periodic "how am I doing?" check-in every 2 weeks
- Per-user preference profiles within household context

**Defer (v2+):**
- Silent sentiment detection for implicit feedback (needs careful tuning)
- Hub feedback button in Mini App (command covers use case)
- Per-member grocery check-off attribution ("checked by Partner")
- Invite tracking dashboard with status monitoring
- Feedback categorization with rich admin dashboard filtering

### Architecture Approach

The architecture shifts from single-scope (`chatId`) to dual-scope (`userId` for personal, `householdId` for shared). Three new middleware components gate access and resolve identity: (1) access gate blocks unregistered users except /start, (2) household resolver injects `userId` and `householdId` into context, (3) onboarding router intercepts messages during onboarding. The migration preserves private-chat-only design (no group chat support) -- each household member uses the bot in their own private chat, sharing happens through database scope, not Telegram chat scope.

**Major components:**
1. **users + households tables** -- foundational identity and grouping (users.household_id FK)
2. **invites table + deep link handler** -- token generation, validation, redemption tracking
3. **access gate middleware** -- blocks non-invited users before all handlers
4. **household resolver middleware** -- resolves user -> household, injects context
5. **onboarding state machine** -- SQLite-backed Q&A flow (not grammY conversations plugin)
6. **app_feedback table + handlers** -- /feedback command, admin view (distinct from meal feedback)
7. **chatId -> householdId migration** -- systematic refactor of all repositories, tool handlers, FTS5 queries, Mini App routes

**Critical architectural decision:** Add `household_id` as NEW column alongside `chat_id`. Do NOT rename -- partial migration with both columns allows incremental refactor and easy rollback. For existing single-user, `household_id = chat_id` (solo user forms household of one). FTS5 search changes WHERE clause from `ki.chat_id = ?` to `ki.household_id = ?` -- virtual table structure unchanged, triggers survive.

### Critical Pitfalls

1. **chatId-to-householdId migration breaks every query** -- 339 occurrences across 47 files. Partial migration creates split-brain where data written by new system is invisible to old queries. **Prevention:** Migrate ALL repositories in single phase, introduce `householdId` as new column (not rename), create `resolveScope(ctx)` helper.

2. **Existing user's data orphaned by migration** -- Backfill must set `household_id = chat_id` for all existing rows. If backfill fails or resolveScope() has bug, existing user sees empty bot after migration. **Prevention:** Test migration on copy of production DB, verify `SELECT COUNT(*) FROM knowledge_items WHERE household_id IS NULL` returns 0, deploy migration and code atomically.

3. **FTS5 virtual table not updated after schema migration** -- Adding `household_id` column via `ALTER TABLE` is safe, but Drizzle Kit `push` may trigger table rebuild that breaks FTS5 triggers. Search returns stale/no results. **Prevention:** Use raw SQL `ALTER TABLE ADD COLUMN`, verify triggers survive (`SELECT * FROM sqlite_master WHERE type='trigger'`), run `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')` after migration.

4. **Deep link invite tokens leaking or replayable** -- If tokens are predictable or never expire, leaked invite link allows unlimited unauthorized joins. **Prevention:** `crypto.randomBytes(24).toString('base64url')`, store in invites table with `expires_at`, `max_uses`, single-use by default, rate-limit /start with invalid tokens.

5. **/start handler regression breaks existing single-user flow** -- Handler must distinguish: existing user (greet), new user with valid invite (onboard), new user without invite (block), existing user with invite (join household or notify). **Prevention:** Seed existing user into users table during migration, write explicit test cases for all 4 branches.

6. **Household data sharing without permission granularity** -- All members get full read/write to everything including personal allergies. **Prevention:** Add `owner_id` (userId) to tables where ownership matters, preferences with `severity:allergy` visible but only editable by owner, reminders per-user.

7. **Onboarding flow state machine corruption** -- User sends unexpected message mid-onboarding, catch-all message handler routes to Claude instead of onboarding handler, user stuck. **Prevention:** Store state in database (not memory), onboarding middleware intercepts BEFORE catch-all, implement /skip and /restart_onboarding commands, timeout abandoned flows after 24h.

8. **System prompt injection with wrong user's preferences** -- Household-level preferences loaded without distinguishing current user. User A (shellfish allergy) gets plan with shrimp because User B has no restriction. **Prevention:** Load TWO sets -- household-level AND current user's personal preferences, clearly label in system prompt, for meal planning load ALL members' allergies.

9. **Mini-App auth middleware identity mismatch** -- Current middleware sets `res.locals.chatId = String(userId)`. After migration, if repositories filter by `household_id`, Mini App returns empty because userId does not match any household_id. **Prevention:** Update middleware to resolve both `res.locals.userId` and `res.locals.householdId`, update ALL Mini App routes to use correct scope.

10. **Message queue keyed by chatId loses messages** -- If debounce key changes to `householdId`, User A and User B messages batch together producing confused response. **Prevention:** Keep debounce keyed by user's private chat ID (not householdId), resolve householdId AFTER debounce for data access, maintain private-chat-only design.

## Implications for Roadmap

Based on research, suggested 4-phase structure with hard dependencies:

### Phase 1: Users + Households + Invites + Access Gate
**Rationale:** Foundation for everything. Multi-user identity must exist before any sharing can work. Invite system gates access before onboarding can function. Phase 1 and 2 are tightly coupled -- partial completion of either creates non-functional system.

**Delivers:**
- users, households, invites tables with initialization
- User and household repositories with CRUD operations
- Invite token generation and deep link URL construction
- Access gate middleware (blocks non-invited users)
- Household resolver middleware (injects userId, householdId into context)
- Updated /start handler supporting invite redemption flow
- Extended BotContext type with userId, householdId, user fields

**Addresses:**
- Table stakes: multi-user identity, invite-gated access
- Pitfalls 4, 5 (invite security, /start regression)

**Critical success criteria:**
- Existing user seeded into users table with `onboarding_state = 'complete'`
- Invite deep link flow tested for all 4 branches (existing user bare /start, existing with invite, new without invite, new with valid invite)
- Access gate blocks non-registered users but allows registered
- No breaking changes to existing single-user functionality

### Phase 2: chatId -> householdId Migration
**Rationale:** Must happen immediately after Phase 1 while codebase is in controlled state. Enables all household sharing features. This is the largest mechanical phase -- systematic refactor of every data access path. Partial completion creates split-brain.

**Delivers:**
- `household_id` column added to all shared tables (knowledge_items, meal_plans, grocery_lists, cooking_history, feedback_checkins, knowledge_changelog)
- Migration script with backfill: existing data sets `household_id = chat_id`
- ALL repositories refactored to use householdId for shared data queries
- Tool handler updated to pass householdId to shared-data tools
- Pipeline processor context building uses householdId
- FTS5 search queries updated to filter by `ki.household_id`
- Mini App auth middleware resolves householdId
- All Mini App API routes updated to use `res.locals.householdId`
- System prompt builder loads household AND user preferences separately

**Addresses:**
- Table stakes: household data sharing for recipes, plans, grocery lists
- Pitfalls 1, 2, 3, 6, 8, 9 (migration correctness, FTS5, permissions, system prompt, Mini App auth)

**Critical success criteria:**
- `SELECT COUNT(*) FROM knowledge_items WHERE household_id IS NULL` returns 0
- FTS5 triggers intact: `SELECT * FROM sqlite_master WHERE type='trigger' AND tbl_name='knowledge_items'` shows 3 triggers
- Existing user can search recipes, view plans, see grocery lists after migration
- New user joining household sees household's existing recipes
- Mini App shows household data for all household members

### Phase 3: Guided Onboarding
**Rationale:** Depends on users table (Phase 1) and household-scoped preference saving (Phase 2). Once multi-user data model is stable, onboarding provides new user experience. Independent of app feedback (Phase 4).

**Delivers:**
- Onboarding state machine with states: registered, preferences_qa, tour, seed_recipes, complete
- Onboarding middleware intercepting messages when `user.onboarding_state !== 'complete'`
- Preference Q&A flow: dietary restrictions, household size, dinner time, stores
- Capability tour messages showing bot features
- Seed recipe prompt and collection
- /skip command and timeout for abandoned flows
- Onboarding completion tool marking user complete

**Addresses:**
- Table stakes: guided onboarding flow
- Should have: SQLite-backed state, abbreviated onboarding for household members
- Pitfall 7 (state machine corruption)

**Critical success criteria:**
- New user completes invite redemption and immediately enters onboarding
- Preferences saved during onboarding appear in next system prompt
- User can skip onboarding and use bot with defaults
- Bot restart mid-onboarding preserves state
- Unexpected message during onboarding redirects to current question

### Phase 4: App Feedback System
**Rationale:** Most independent feature. Only depends on user identity (Phase 1), not household migration. Placed last to avoid context-switching and let team focus on core multi-user flow first.

**Delivers:**
- app_feedback table and repository
- /feedback command handler with confirmation
- Admin feedback view command (/feedback-report or Mini App route)
- Periodic "how am I doing?" check-in using reminder infrastructure
- Feedback sentiment/category extraction (optional)

**Addresses:**
- Table stakes: /feedback command, admin feedback view, periodic check-in
- Defer: silent sentiment detection, hub feedback button (Mini App)

**Critical success criteria:**
- User can submit feedback via /feedback command
- Admin can view all feedback via command or dashboard
- Bi-weekly check-in scheduled correctly
- Feedback distinct from meal feedback (separate table)

### Phase Ordering Rationale

**Why Phase 1 before Phase 2:** Users and households tables are foundation. Without user identity resolution, household scoping has nowhere to resolve to. Access gate prevents unauthorized access during migration window.

**Why Phase 1 and 2 tightly coupled:** The "half-migrated" state (users table exists but repositories still use chatId) is dangerous. Some data visible, some invisible. Phases should be executed in rapid succession, ideally same day.

**Why Phase 2 before Phase 3:** Onboarding saves preferences via existing tools. If household scoping is broken, preferences save incorrectly and onboarding appears complete but preferences are lost. Migration must be stable first.

**Why Phase 4 last:** App feedback is orthogonal to onboarding and household sharing. Can be developed in parallel with Phase 3 but sequencing it last avoids context-switching and allows focus on harder migration work.

**Critical constraint:** Phase 1 and 2 form atomic unit. Do not deploy Phase 1 to production and wait days before Phase 2. The access gate works, but without household scoping, new invited users see empty data.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (migration):** Deep dive on FTS5 external content trigger behavior during ALTER TABLE, confirm better-sqlite3 WAL mode concurrency under multi-user load, validate Drizzle schema generation does not trigger unwanted rebuilds. This phase has highest technical risk.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Users/households/invites are standard multi-tenant tables. grammY deep links are documented. Node.js crypto is well-understood. No novel patterns.
- **Phase 3:** Onboarding state machines are common bot pattern. SQLite state storage matches existing feedback_checkins pattern. Claude-driven Q&A follows existing pipeline model.
- **Phase 4:** App feedback table mirrors meal feedback structure. Admin commands follow existing /costs pattern. Express routes follow Mini App pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified in node_modules. Zero new dependencies confirmed. grammY ctx.match deep link payload verified in source. Node.js 22 crypto.randomBytes with base64url tested. |
| Features | HIGH | Feature dependencies mapped from codebase patterns. Telegram Bot API deep linking is stable, well-documented feature. Multi-tenant data scoping is established pattern. |
| Architecture | HIGH | All architectural patterns derived from existing codebase analysis (12,726 LOC audited). Factory functions, init.ts migrations, repository patterns, Mini App structure all follow current conventions. |
| Pitfalls | HIGH | 339 chatId occurrences across 47 files audited individually. FTS5 trigger behavior confirmed from SQLite docs. Migration risks based on direct codebase inspection. |

**Overall confidence:** HIGH

Research based on thorough codebase audit, verified grammY source code, Node.js built-in testing, and SQLite documentation. The technical approach is conservative -- no experimental packages, no novel patterns. All new features use existing infrastructure (grammY commands, SQLite tables, Express routes, React pages).

### Gaps to Address

**Migration testing gap:** While migration strategy is clear, testing on exact copy of production database is required before deployment. Current codebase has no production data to test against. Create seed data mimicking production scale (100+ recipes, 50+ meal plans, active grocery lists, reminders, feedback check-ins) to validate migration correctness.

**FTS5 rebuild timing:** Research confirms `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')` rebuilds index, but performance characteristics at scale (1000+ recipes) unknown. May need to run during maintenance window if rebuild is slow.

**Invite token collision:** `crypto.randomBytes(24)` provides 192-bit entropy -- collision probability is negligible for household scale (< 100 invites ever). No collision detection implemented in initial version. Add uniqueness constraint on invites.token column to handle unlikely collision gracefully.

**Onboarding question sequence:** Research identifies categories (dietary restrictions, household size, dinner time, stores) but exact question phrasing and order should be user-tested. Current plan is deterministic 4-question flow. May need iteration after initial deployment based on completion rates.

**Admin role definition:** Currently, "admin" is the original user (defined by ADMIN_USER_IDS env var). Multi-household system needs per-household ownership. Phase 1 schema includes users.role column (admin/member) but enforcement strategy needs refinement during implementation. For v1.2, treat original user as global admin, household creator as household owner.

## Sources

### Primary (HIGH confidence)
- **Codebase audit:** All 47 files with chatId/chat_id usage reviewed (339 occurrences). Complete schema analysis of 11 tables. Repository patterns, factory functions, init.ts migrations, tool handlers, Mini App auth middleware all inspected.
- **grammY source code:** `/workspace/node_modules/grammy/out/composer.d.ts` lines 226-237 -- `ctx.match` type and deep link payload mechanism verified
- **Node.js 22 runtime:** `crypto.randomBytes().toString('base64url')` tested directly in environment
- **SQLite documentation:** ALTER TABLE ADD COLUMN behavior, WAL mode, FTS5 external content triggers, foreign key enforcement
- **better-sqlite3 ^12.6.2:** Synchronous API, transaction handling, prepared statement patterns from existing usage in codebase

### Secondary (MEDIUM confidence)
- **Telegram Bot API deep linking:** 64-character base64url payload limit, `t.me/BotName?start=PAYLOAD` format -- stable API feature (training data, not verified against current docs but unchanged for 5+ years)
- **Multi-tenant data isolation patterns:** Row-level scoping, composite keys, scope resolution middleware -- established patterns from training data, not codebase-specific

### Tertiary (LOW confidence)
- **Optimal household permission model:** Whether preferences should be personal-editable-only vs household-editable is design decision, not technical fact. Research recommends personal-only for allergies but this needs validation with actual users.
- **Onboarding completion rates:** No data on how many questions users tolerate before abandoning. 4-question flow is hypothesis based on bot onboarding best practices (training data), needs validation in production.

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
