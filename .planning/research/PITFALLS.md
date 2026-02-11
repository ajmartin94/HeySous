# Pitfalls Research

**Domain:** Adding multi-user support, household sharing, invite systems, onboarding flows, and feedback mechanisms to an existing single-user Telegram bot (HeySous v1.2)
**Researched:** 2026-02-10
**Confidence:** HIGH (based on thorough codebase audit of 12,726 LOC -- all 47 files with chatId/chat_id usage reviewed, Telegram Bot API deep linking mechanics, SQLite migration patterns, and multi-tenant data isolation best practices)

**Context:** HeySous is a conversational AI meal planning bot. Currently single-user with `chatId` (derived from `ctx.chat.id`) as the sole data isolation key across all 11 tables. Moving to multi-user with per-user identity, household sharing, invite-gated access, guided onboarding, and an app feedback system. The migration must preserve existing data for the original user and not break any existing functionality.

---

## Critical Pitfalls

Mistakes that cause data leaks, data loss, broken production systems, or require rewrites.

### Pitfall 1: chatId-to-userId Migration Breaks Every Query in the System

**What goes wrong:**
The entire codebase uses `chatId` (from `ctx.chat.id`) as the data isolation key. In private Telegram chats, `chat.id === from.id` (user ID), so this works for single-user. When you add multi-user support, you need `userId` (the person) separate from `chatId` (the conversation). Currently, 339 occurrences of `chatId`/`chat_id`/`ctx.chat.id` span 47 source files. Every repository function, every SQL query, every tool handler, the message queue, the processor pipeline, the FTS5 search, the mini-app auth middleware, and the reminder poller all use `chatId` as the identity key. A partial migration -- where some queries use the new `userId` and others still use `chatId` -- creates a split-brain where data written by the new system is invisible to old queries, and vice versa.

**Why it happens:**
The `chatId === userId` assumption was correct for single-user and was never abstracted. It is baked into every layer: schema columns, repository function signatures, tool handler closures, context builders, and the mini-app auth middleware (`res.locals.chatId = String(userId)`). Developers start migrating one repository at a time ("I'll update knowledge first, then planning"), and during the transition, half the system looks up data by `userId` and the other half by `chatId`. Since the existing user's data has `chatId` values that happen to equal their `userId`, it appears to work -- until a second user joins a household and their `userId` differs from the household's data scope.

**How to avoid:**
- Introduce a `userId` column on ALL tables that need per-user attribution (messages, token_usage, cooking_history, feedback_checkins). Do NOT rename `chatId` -- it remains as the household/scope key.
- Introduce a `householdId` concept. For the existing single-user, `householdId` equals their current `chatId`. All data queries that currently filter by `chatId` should filter by `householdId` instead.
- Migrate ALL repositories in a SINGLE phase, not spread across multiple phases. The "half-migrated" state is the dangerous state.
- Create a `resolveScope(ctx)` helper that extracts both `userId` and `householdId` from context, and use it everywhere instead of raw `String(ctx.chat.id)`.
- Write the data migration as a single SQLite transaction: add columns, populate defaults, add indexes. Run it before any code changes go live.

**Warning signs:**
- A user's recipes are visible to one feature (search works) but not another (plan generation can not find them)
- New user joins household but sees empty knowledge base
- FTS5 search returns results from wrong household
- Mini-app shows different data than the bot for the same user

**Phase to address:** Phase 1 (Data Model Migration). This is the foundation -- nothing else works correctly until this is done.

**Severity:** DATA LEAK if households share incorrectly scoped data. DATA LOSS if queries silently return empty results for migrated users.

---

### Pitfall 2: Existing User's Data Orphaned by Migration

**What goes wrong:**
The existing production user has real data: recipes, meal plans, grocery lists, preferences, cooking history, reminders, feedback check-ins. When you add `userId` and `householdId` columns, you must populate them correctly for ALL existing rows. If the migration script sets `householdId = NULL` as a default (or any value that does not match the new lookup logic), the existing user logs in after the migration and sees an empty bot. All their recipes, plans, and preferences are gone -- not deleted, but invisible because queries now filter by a `householdId` that does not match the value stored in old rows.

**Why it happens:**
The migration adds new columns but does not backfill them. Or backfills them with a generated UUID/household ID that the user's session does not resolve to. Or the migration runs but the code deploying alongside it has a bug in the `resolveScope()` function, so the looked-up `householdId` for the existing user does not match what was written to the database.

**How to avoid:**
- For the existing single-user, their `householdId` MUST equal their current `chatId` value. This is the simplest, safest migration: `UPDATE knowledge_items SET household_id = chat_id WHERE household_id IS NULL`.
- Create a `users` table and a `households` table. Insert the existing user into both with IDs derived from their current `chatId`.
- Test the migration on a COPY of the production database before deploying. Run the migration, then verify: `SELECT COUNT(*) FROM knowledge_items WHERE household_id IS NULL` must be 0. Run the same for ALL 11 tables.
- Add a NOT NULL constraint on `householdId` AFTER backfilling, not during column creation. SQLite does not allow adding NOT NULL columns without a default, and the default must be meaningful.
- Deploy the migration and the new code atomically. If the code goes live before the migration runs, queries fail. If the migration runs but old code is still serving, old code ignores the new columns (safe, but confusing).

**Warning signs:**
- After migration, existing user sees "No recipes yet" or "No meal plan for this week"
- `SELECT COUNT(*) FROM knowledge_items WHERE household_id IS NULL` returns any rows
- Existing user's preferences (dietary restrictions, store names) are not loaded into the system prompt

**Phase to address:** Phase 1 (Data Model Migration). Write migration script, test on copy of production data, verify with count queries.

**Severity:** DATA LOSS (perceived). The data exists but is invisible. Recovery requires a manual SQL fix, but the user may have already re-entered recipes, creating duplicates.

---

### Pitfall 3: FTS5 Virtual Table Not Updated After Schema Migration

**What goes wrong:**
The FTS5 virtual table (`knowledge_fts`) uses external content mode, synced via triggers on `knowledge_items`. When you add a `household_id` column to `knowledge_items`, the FTS5 table itself does not change (it only indexes `title`, `summary`, `content`). However, the search query in `fts.ts` joins `knowledge_fts` with `knowledge_items` and filters by `ki.chat_id = ?`. If you rename the column or change the filter to `ki.household_id = ?`, you must verify the join still works. More dangerously: if the migration alters the `knowledge_items` table structure in a way that requires a table rebuild (SQLite's `ALTER TABLE` limitations), the FTS5 triggers may break because they reference the old table structure.

**Why it happens:**
SQLite `ALTER TABLE` only supports `ADD COLUMN` and `RENAME COLUMN` for simple changes. If the migration does a table rebuild (create new table, copy data, drop old, rename new -- which Drizzle Kit does for complex changes), the FTS5 external-content triggers reference the OLD table. After the rebuild, the triggers point to a table that no longer exists. All inserts, updates, and deletes to `knowledge_items` silently fail to update the FTS5 index. Search returns stale or no results.

**How to avoid:**
- Use `ALTER TABLE knowledge_items ADD COLUMN household_id TEXT` for the new column. This is a simple add that does NOT trigger a table rebuild. The FTS5 triggers survive.
- Do NOT use Drizzle Kit `drizzle-kit push` for this migration. Write raw SQL migration scripts. Drizzle Kit may decide to rebuild the table for schema changes it deems incompatible with ALTER TABLE.
- After the migration, manually verify triggers exist: `SELECT * FROM sqlite_master WHERE type='trigger' AND tbl_name='knowledge_items'`. Must show 3 triggers (insert, delete, update).
- If triggers are lost, re-run `initializeFts()` from `src/knowledge/fts.ts`. The function uses `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, so it is idempotent and safe to re-run.
- After migration, run `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')` to rebuild the FTS5 index from scratch. This ensures the index matches the table.

**Warning signs:**
- Recipe search returns no results after migration (but recipes exist in the table)
- `SELECT * FROM sqlite_master WHERE type='trigger' AND tbl_name='knowledge_items'` returns fewer than 3 rows
- New recipes saved after migration are not found by search, but old recipes are (FTS5 index is stale, not updating)

**Phase to address:** Phase 1 (Data Model Migration). Verify FTS5 triggers survive the migration. Include `rebuild` command in migration script.

**Severity:** FEATURE BROKEN. FTS5 search is the core retrieval mechanism -- the AI assistant cannot find recipes without it, making the bot useless.

---

### Pitfall 4: Deep Link Invite Tokens Leaking or Being Replayable

**What goes wrong:**
Telegram deep links use the format `https://t.me/BotName?start=PAYLOAD` where PAYLOAD is a base64-safe string up to 64 characters. When a user clicks this link, Telegram sends `/start PAYLOAD` to the bot. If the invite token is a simple household ID or a predictable pattern (e.g., `invite_12345`), anyone who guesses or brute-forces the token can join any household. If tokens do not expire, a leaked invite link (shared in a group chat, posted on social media) allows unlimited new users to join the household forever.

**Why it happens:**
Developers use the household ID directly as the invite payload because it is simple. Or they generate a UUID token but do not set an expiration or use limit. Telegram deep links are URLs -- they are shared, bookmarked, and indexed. Unlike a private message, a deep link is a public invitation.

**How to avoid:**
- Generate cryptographically random invite tokens (e.g., `crypto.randomBytes(24).toString('base64url')`). Store them in an `invites` table with `token`, `householdId`, `createdBy`, `expiresAt`, `maxUses`, `currentUses`.
- Set a reasonable default expiration (7 days) and max uses (5). Allow the inviter to configure these.
- When `/start INVITE_TOKEN` is received, validate: token exists, not expired, not exhausted. On success, create the user-household association. On failure, reply with a friendly "This invite link has expired. Ask your household member for a new one."
- After validation, DELETE or mark the token as used (for single-use tokens) or increment `currentUses` (for multi-use tokens).
- Do NOT include the household ID in the token itself (e.g., do not use `household_5_abc123`). The token is an opaque lookup key.
- Rate-limit `/start` with invalid tokens to prevent brute-force enumeration.

**Warning signs:**
- Invite tokens are sequential numbers or obvious patterns
- Tokens never expire (no `expiresAt` column)
- No `maxUses` limit -- a single link can add unlimited users
- The invite payload contains the household ID in plaintext

**Phase to address:** Phase 2 (Invite System). Design the invite table and token generation before implementing the `/start` handler changes.

**Severity:** SECURITY BREACH. Unauthorized users join households and access private recipe collections, dietary restrictions, and meal plans.

---

### Pitfall 5: /start Handler Regression Breaks Existing Single-User Flow

**What goes wrong:**
The current `/start` handler is a simple greeting. The new system gates access behind invite tokens: `/start INVITE_TOKEN` creates the user and joins a household, while bare `/start` (no token) must be rejected for new users. But the existing user already uses the bot -- they never went through an invite flow. If the new `/start` handler requires a token for ALL users, the existing user gets locked out after a bot restart or session clear. If it allows bare `/start` for existing users but blocks new users, there is a branching logic path that is easy to get wrong.

**Why it happens:**
The `/start` command is the entry point for both Telegram deep links (with payload) and the normal "user opens bot for the first time" flow. Telegram sends `/start` every time a user taps the "Start" button or clicks a deep link. The handler must distinguish between: (a) existing user saying hi, (b) new user with valid invite, (c) new user without invite (should be blocked), (d) existing user clicking an invite link (should join new household or be told they are already a member).

**How to avoid:**
- In the `/start` handler, first check if the user exists in the `users` table. If yes, they are an existing user -- greet them normally (or handle the invite-to-new-household case if a payload is present).
- If the user does NOT exist AND there is no invite payload, show a gated message: "HeySous is invite-only. Ask a friend for an invite link!"
- If the user does NOT exist AND there IS an invite payload, validate the token and create the user + household association.
- Seed the existing user into the `users` table during the data migration (Phase 1), so they are always recognized as "existing."
- Write explicit test cases for all 4 scenarios above. The `/start` handler is the most branching-heavy handler in the system.

**Warning signs:**
- Existing user sees "HeySous is invite-only" after bot restart
- New user with valid invite token sees the old greeting instead of onboarding
- Clicking an invite link while already a member creates a duplicate user record
- `/start` with an expired token shows a generic error instead of a helpful message

**Phase to address:** Phase 2 (Invite System), but requires Phase 1 (users table + migration) to be complete first. This is a hard dependency.

**Severity:** LOCKOUT for existing user. Complete system unusability if the single existing user cannot access the bot.

---

### Pitfall 6: Household Data Sharing Without Permission Granularity

**What goes wrong:**
All household members get full read/write access to everything: recipes, meal plans, grocery lists, preferences, reminders. User A saves a private dietary restriction ("allergic to shellfish, severity: allergy"). User B joins the household. User B can now read, modify, and delete User A's allergy preferences. User B changes the grocery list while User A is shopping. User B modifies a meal plan that User A carefully curated. There is no concept of "my recipes" vs "household recipes" or "my preferences" vs "shared preferences."

**Why it happens:**
The simplest household model is "everything is shared." It avoids the complexity of per-item ownership and permission checks. But dietary restrictions, allergies, and personal preferences are inherently per-person. And meal plans often need to account for all household members' restrictions -- but should only be editable by the person who created them (or by explicit permission).

**How to avoid:**
- Add an `ownerId` (userId) column to tables where individual ownership matters: `knowledge_items`, `meal_plans`, `reminder_settings`.
- Recipes and cooking notes are household-shared (anyone can see and edit). Preferences with `severity:allergy` or `severity:restriction` tags are household-visible but only editable by the owner.
- Grocery lists are inherently shared (the household shops together). Meal plans could be per-user or per-household -- decide this early and document the decision.
- Reminders are per-user (User A wants morning reminders at 7am, User B at 9am). The `reminder_settings` table already has per-`chatId` settings; in the new model, these become per-`userId`.
- Start with a simple model: everything shared, preferences per-user. Add granular permissions later if needed. But design the schema to ALLOW future permission columns without another migration.

**Warning signs:**
- User B edits User A's allergy preference and the system no longer avoids shellfish in plans
- User B deletes a recipe that User A added, and User A has no way to know who deleted it
- Reminder settings for one user overwrite settings for another

**Phase to address:** Phase 1 (Data Model). Decide the ownership model during schema design, even if enforcement is deferred to a later phase.

**Severity:** DATA INTEGRITY. Wrong allergy information in meal plans is a health risk, not just a UX issue.

---

### Pitfall 7: Onboarding Flow State Machine Corruption

**What goes wrong:**
The onboarding flow is a multi-step Q&A: collect dietary preferences, cooking skill, household size, store preferences, then seed recipes and show a tour. If the user sends a message mid-onboarding (e.g., types "hello" instead of answering "What are your dietary restrictions?"), the pipeline processor routes the message to Claude, which responds conversationally instead of advancing the onboarding state. The user is now stuck: the bot thinks they are in normal conversation mode, the onboarding state machine thinks they are on step 2. Subsequent onboarding prompts arrive out of order or not at all.

**Why it happens:**
The current message handler is a catch-all: ALL `message:text` events go to the debounce queue and then to Claude. There is no middleware that intercepts messages during onboarding and routes them to the onboarding handler instead. The onboarding state is stored somewhere (database, in-memory map), but the message handler does not check it.

**How to avoid:**
- Store onboarding state in the database: `onboarding_state` table with `userId`, `currentStep`, `answersJson`, `startedAt`.
- Add an onboarding middleware that runs BEFORE the catch-all message handler. If the user has an active onboarding state, intercept the message and route it to the onboarding handler.
- The onboarding handler should be tolerant of unexpected input: if the user says "hello" when asked about dietary restrictions, respond with "I'd love to chat, but let's finish setting you up first! What dietary restrictions should I know about?"
- Implement a `/skip` command and a `/restart_onboarding` command for users who want to skip the onboarding or start over.
- Set a timeout on onboarding state: if the user has not advanced in 24 hours, mark the onboarding as abandoned and let them use the bot normally (with defaults).

**Warning signs:**
- User sends a message during onboarding and gets a Claude response about meal planning instead of the next onboarding question
- Onboarding prompts appear twice or in wrong order
- User completes onboarding but their preferences were not saved
- User gets stuck in onboarding with no way to exit

**Phase to address:** Phase 3 (Onboarding Flow). Must be implemented as middleware that runs before the catch-all message handler.

**Severity:** UX BROKEN. A first-time user who gets stuck in onboarding will abandon the bot. First impressions matter most.

---

### Pitfall 8: Message Queue Keyed by chatId Loses Messages in Multi-User Households

**What goes wrong:**
The `MessageQueue` debounce batching is keyed by `chatId`. In the current single-user model, one user per chat means one debounce timer per user. In a multi-user household, if both User A and User B are messaging the bot simultaneously (in their own private chats with the bot), they have separate `chatId` values, so no conflict. BUT -- if the system ever supports group chats (same `chatId` for multiple users), or if the debounce key changes to `householdId`, messages from User A and User B get batched together. Claude receives "What's for dinner?" from User A concatenated with "Add milk to the list" from User B as a single batch, producing a confused response.

**Why it happens:**
The `MessageQueue.enqueue()` takes `chatId` as the key. In the current code, `chatId = String(ctx.chat.id)` and `userId = String(ctx.from?.id ?? "unknown")`. For private chats, each user has their own chat with the bot, so chatId is unique per user. The pitfall emerges if: (1) group chat support is added (multiple users, one chatId), (2) the debounce key is changed to householdId, or (3) the processor does not correctly attribute messages to users within a batch.

**How to avoid:**
- Keep the debounce queue keyed by the user's private chat ID, NOT by householdId. Each user talks to the bot in their own private chat.
- If group chat support is added later, the debounce key must be `chatId + userId` (composite key), and the processor must handle multi-user batches.
- In the processor, resolve the `householdId` from the `userId` AFTER debounce, not before. The debounce is about message timing; the household scope is about data access.
- Do NOT change the MessageQueue's keying strategy unless group chats are explicitly required.

**Warning signs:**
- Two users' messages appear concatenated in Claude's context
- Response addresses the wrong user's question
- Debounce timer for one user is reset by another user's message

**Phase to address:** Phase 1 (Data Model). Decide early: private-chat-only or group-chat support. If private-chat-only, the message queue needs no changes.

**Severity:** DATA CORRUPTION in Claude context. Wrong responses to wrong users. Potentially reveals one user's private questions to another.

---

### Pitfall 9: System Prompt Injection With Wrong User's Preferences

**What goes wrong:**
The processor builds the system prompt by loading preferences, active plans, grocery context, reminder context, and feedback context -- ALL filtered by `chatId`. In the new multi-user model, these contexts must reflect the CURRENT USER's preferences within the household's shared data. If User A is allergic to shellfish and User B is not, and the system prompt loads household-level preferences without distinguishing who is asking, Claude might suggest shrimp for User A's dinner because User B has no shellfish restriction.

**Why it happens:**
The `buildSystemPrompt()` function receives preference summaries and plan context, all queried by a single `chatId`. In the new model, `chatId` becomes `householdId` (shared data), but preferences are per-user. The system prompt must include BOTH: "Household preferences: prefers Mediterranean cuisine" AND "Current user (User A) preferences: shellfish allergy, vegetarian on Mondays." If the system prompt only includes household-level preferences, per-user restrictions are invisible to Claude.

**How to avoid:**
- When building the system prompt, load two sets of preferences: (1) household-level preferences (shared by all members), (2) current user's personal preferences (allergies, dietary restrictions, schedule).
- Clearly label them in the system prompt: "Household preferences: ..." and "Your preferences: ...". This helps Claude distinguish.
- For meal planning, load ALL household members' restrictions (everyone's allergies matter for a shared meal). For recipe suggestions for a specific user, load only that user's preferences.
- Add a `scope` tag to preferences: `scope:personal` vs `scope:household`. The system prompt builder uses this to partition.

**Warning signs:**
- Claude suggests a meal containing an allergen that one household member is allergic to
- User A asks for recipe suggestions and gets recommendations based on User B's preferences
- Preferences saved by User A appear in User B's `/preferences` output

**Phase to address:** Phase 1 (Data Model) for schema support, Phase 3 (Onboarding) for collecting per-user preferences, Phase 4 for updating the system prompt builder.

**Severity:** HEALTH RISK. Wrong allergy information in meal suggestions is not just a bug -- it is a safety issue.

---

### Pitfall 10: Mini-App Auth Middleware Identity Mismatch After Multi-User Migration

**What goes wrong:**
The current mini-app auth middleware (`src/mini-app/auth-middleware.ts`) extracts `userId` from initData and sets `res.locals.chatId = String(userId)`. All mini-app API routes then use `res.locals.chatId` to query repositories. After the multi-user migration, mini-app routes need BOTH `userId` (who is making the request) and `householdId` (what data scope to query). If `res.locals.chatId` is still set to the user's Telegram ID but repositories now filter by `householdId`, the mini-app returns empty data because the user's Telegram ID does not match any `householdId`.

**Why it happens:**
The identity mapping `userId === chatId` was a convenient shortcut for single-user private chats. The auth middleware set `chatId` to the user's ID because they were the same thing. After migration, the middleware must resolve the user's household membership and provide the correct `householdId` for data queries.

**How to avoid:**
- Update the auth middleware to: (1) extract `userId` from initData, (2) look up the user's household in the database, (3) set BOTH `res.locals.userId` and `res.locals.householdId`.
- Update ALL mini-app API routes to use `res.locals.householdId` for data queries (grocery lists, recipes, plans) and `res.locals.userId` for user-specific data (preferences, reminder settings).
- If the user has no household (not yet invited), return a 403 with a clear error message, not an empty dataset.
- Add a test that: creates a new user via invite, opens the mini-app, and verifies data is visible.

**Warning signs:**
- Mini-app shows empty grocery list after migration, but bot `/grocery` command shows items
- Mini-app recipe browser shows no recipes for new household members
- `res.locals.chatId` is still being used in API routes after migration

**Phase to address:** Phase 1 (Data Model Migration) for the auth middleware update, Phase 2 (Invite System) for the "no household" error case.

**Severity:** FEATURE BROKEN. All three mini-apps (grocery, recipes, meal plan) return empty data for all users after migration.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `chatId` as `householdId` for existing user instead of generating a proper household ID | Zero-risk migration -- existing data needs no column value change | Household IDs are Telegram user IDs, which are opaque numbers. If the original user leaves the household, their personal Telegram ID remains as the household identifier forever. Confusing for debugging and auditing | Acceptable for v1.2 launch. The existing user IS the household founder. Generate proper IDs in a future version if needed |
| Skipping row-level ownership on knowledge_items ("everything is shared in household") | Simpler queries, fewer authorization checks, faster to implement | Cannot distinguish "my recipe" from "household recipe." Cannot implement per-user recipe collections or "recently added by me" views. No audit trail for who changed what | Acceptable for v1.2 if the household is small (2-3 people). Add ownership tracking in the migration schema even if enforcement is deferred |
| Storing onboarding state in memory instead of database | Faster reads, simpler code | Lost on bot restart. User restarts onboarding from scratch if the bot redeploys during their setup. On Railway, deploys happen frequently | Never. Always use the database for onboarding state. Restarts should resume where the user left off |
| Single invite link per household (no multi-token management) | Simpler UI, one command to generate invite | Cannot revoke individual invites, cannot set per-invite permissions, cannot track which invite each member used | Acceptable for v1.2. Most households will use one invite link. Add revocation in a future version |
| Hardcoding onboarding questions instead of making them data-driven | Faster to implement, no admin UI needed | Changing onboarding requires a code change and deploy. Cannot A/B test different onboarding flows | Acceptable for v1.2. Onboarding questions are unlikely to change frequently |
| Using the bot's private chat for all interaction (no group chat support) | Avoids the massive complexity of multi-user-in-one-chat, debounce conflicts, message attribution | Cannot use the bot in a family group chat. Each user must have a separate private chat | Acceptable and RECOMMENDED for v1.2. Group chat support is a separate, much larger feature |

---

## Integration Gotchas

Common mistakes when connecting these new features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **userId vs chatId in tool handler** | Passing `householdId` as `chatId` to `createToolHandler`, which then passes it to all tool operations. Tools that should be user-scoped (feedback, preferences) incorrectly operate at household scope | Create separate parameters: `createToolHandler({ userId, householdId, ... })`. Tools that read shared data (recipes, plans, grocery) use `householdId`. Tools that write personal data (preferences, feedback) use `userId`. Tools that need both (meal planning that respects allergies) receive both |
| **Message history mixing users** | Loading conversation history by `householdId` instead of by the user's private chat. User A sees User B's conversation with the bot in their context window | Conversation history MUST remain per private chat (keyed by the user's chat ID with the bot). Never load another user's conversation turns into Claude's context. Shared data (recipes, plans) is loaded via the system prompt, not via conversation history |
| **Reminder sender targeting wrong chat** | Reminder poller iterates over `reminder_settings` rows. Currently, `chatId` in reminders is used to `bot.api.sendMessage(chatId, ...)`. After migration, if `chatId` was changed to `householdId`, reminders are sent to a non-existent chat (householdId is not a valid Telegram chat ID) | Store BOTH `userId` (for targeting: `bot.api.sendMessage(userId, ...)`) and `householdId` (for data context) in reminder_settings. Or keep `chatId` as the user's private chat ID and add `householdId` as a separate column |
| **Onboarding middleware vs feedback text handler** | Both onboarding middleware and feedback text handler (`feedbackTextHandler`) intercept messages before the catch-all. If onboarding middleware runs first and swallows all messages during onboarding, feedback replies during onboarding are lost. If feedback handler runs first, it may intercept onboarding answers as feedback | Onboarding middleware MUST be the first interceptor. During onboarding, all messages go to onboarding handler. Feedback text handler should check onboarding state and skip if active. Middleware order in `createBot()` is critical |
| **Invite deep link vs existing /start** | The `/start` command handler is currently a simple `Composer`. Deep link payloads arrive as `/start PAYLOAD`. If the new invite handler is a separate Composer that only matches `/start` with a payload, the bare `/start` falls through to the old handler (or to the catch-all message handler, causing a Claude call for "/start") | Replace the existing `startHandler` with a unified handler that checks for payload, checks user existence, and routes to the appropriate flow. Do not have two separate `/start` handlers |
| **Grocery list toggle without ownership check** | The mini-app grocery toggle endpoint (`POST /api/grocery/toggle`) currently does not verify that the item belongs to the requesting user's household. Any authenticated user could toggle any item by ID | Add a check: look up the item's list, verify the list's householdId matches the requesting user's householdId. This is the same pattern already partially implemented in the existing `toggleItem` route (it checks `getListIdForItem` then `getActiveList`) but needs the householdId comparison |
| **Knowledge changelog missing userId** | The `knowledge_changelog` table has `chatId` but no `userId`. After multi-user, you cannot tell which household member made a change. "Who deleted my recipe?" is unanswerable | Add `userId` column to `knowledge_changelog` during migration. Populate existing rows with the original user's ID |

---

## Performance Traps

Patterns that work for a single user but degrade with multiple users and shared data.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading ALL household members' preferences into system prompt | System prompt grows linearly with household size. At 5 members with 10 preferences each, that is 50 preference summaries injected into every Claude call. Token cost increases significantly | Load current user's preferences fully. Load only allergy/restriction preferences (tagged `severity:allergy` or `severity:restriction`) from other household members. Cap total preference count | At 3+ household members with many preferences. Each Claude call costs more tokens |
| FTS5 search across household returns too many results | With multiple users adding recipes, the knowledge base grows. FTS5 search for "chicken" returns 30 results instead of 5, overwhelming the two-pass retrieval token budget | Keep the search `LIMIT` at 5-10. Add tag-based filtering (e.g., search only `recipe`-tagged items, not preferences). Consider adding a `household_id` column to the FTS5 join query for scoping |
| Reminder poller iterates over all users | Currently iterates over `getAllActiveSettings()`. With multiple users per household, the poller processes more settings. Each setting may trigger a Claude call for generating reminder text | The poller is already designed for multiple settings. But ensure `generateReminders` does not make a Claude API call for each user -- it should be plan-based, not user-based. Cache generated text and share across household members with the same plan |
| Mini-app polling from multiple household members simultaneously | 3 household members with the grocery mini-app open = 3x the polling load. Each polls every 8 seconds = ~22 requests/minute to SQLite | This is fine for SQLite with WAL mode and better-sqlite3's synchronous reads. Only a concern at 10+ concurrent mini-app users, which is unlikely for a household bot |

---

## Security Mistakes

Multi-user-specific security issues beyond the existing single-user security model.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Household ID enumeration via invite tokens | If invite tokens contain or are derived from household IDs, an attacker can enumerate households by trying sequential IDs | Use cryptographically random tokens with no relationship to household IDs. Tokens are opaque lookup keys only |
| Cross-household data access via direct item ID | A user in Household A guesses an item ID (e.g., knowledge item #42) that belongs to Household B. If the API does not check household membership, they can read or modify it | EVERY data access must verify `householdId` matches. Never trust item IDs from the client without scoping them to the household. This is already done for `chatId` in the knowledge repository (`getById(id, chatId)`) -- just ensure it is updated to `householdId` |
| Invite link shared publicly allows unlimited household growth | A user shares their invite link on social media. 100 strangers join the household and access all recipes, plans, and preferences | Set `maxUses` on invite tokens (default: 5). Add a household member cap (e.g., 10 members). Allow the household owner to remove members |
| No way to revoke access after household member is removed | User B is removed from the household but has cached mini-app data. Or their ongoing Claude conversation still has system prompt context from the household | When a user is removed from a household: (1) their `householdId` association is deleted, (2) their next bot interaction resolves to "no household" and shows a gated message, (3) their mini-app API calls return 403. Cached data in the mini-app is stale but read-only -- acceptable |
| Admin commands accessible to non-admin household members | Currently, `/costs` is presumably admin-only. In a multi-user household, who is the admin? If all members can see API costs, that may be acceptable. But if admin commands include "delete all data" or "remove member," access control matters | Define a `role` column in the users-households association table: `owner`, `member`. Gate admin commands behind `role === 'owner'`. For v1.2, the person who creates the household is the owner |

---

## UX Pitfalls

User experience issues specific to these new features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Onboarding asks too many questions upfront | User abandons onboarding at question 4 of 8. They wanted to try the bot, not fill out a survey | Ask 3 essential questions max: (1) dietary restrictions/allergies, (2) household size, (3) store preference. Make everything else discoverable through conversation. "You can always tell me more preferences as we go!" |
| No way to skip onboarding | User knows what they want and does not need guided setup. But the bot forces 5 minutes of Q&A before they can say "plan my meals" | Add a "Skip setup" option at the start of onboarding. Seed with safe defaults (no restrictions, 2 servings, generic store). Add a `/preferences` reminder after first plan generation |
| Invite flow is confusing for non-technical users | User receives a `https://t.me/HeySousBot?start=abc123...` link. They do not know what to do with it. They paste it into the bot chat instead of opening it in a browser | When generating an invite link, also send a short explanation: "Share this link with your household member. When they tap it, they'll be added to your household automatically." On the receiving end, confirm clearly: "You've been invited to join [Inviter Name]'s household. Welcome!" |
| No feedback that household data is shared | User A saves a recipe. User B asks the bot about recipes and sees User A's recipe. User B is confused about where it came from | When displaying shared data, attribute it: "Chicken Parmesan (added by User A)". When saving new items, confirm: "Saved to your household's recipes (visible to all members)." |
| Feedback system overwhelms new users | New user completes onboarding, cooks their first meal, and gets hit with a feedback check-in prompt. They do not yet have the context to give meaningful feedback | Delay feedback check-ins until the user has completed at least 2-3 meal plans. Set a `firstFeedbackAfter` timestamp during onboarding. Feedback for new users should be opt-in via conversation, not proactive via reminders |
| Onboarding preferences not reflected immediately | User tells onboarding they are vegetarian. Their first meal plan includes chicken. Preferences were saved to the knowledge store but the system prompt did not load them for the plan generation call | After onboarding completes, explicitly verify that preferences are saved AND retrievable. Run a test query: load preferences for this user, confirm the allergy/restriction is present. Log a warning if preferences are empty after onboarding |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Users table exists** -- but does the existing user have a row? If the migration did not seed the existing user, they are treated as a new user and blocked by the invite gate
- [ ] **Household sharing works** -- but can User B see recipes that User A added BEFORE User B joined? If the join date is checked against recipe creation date, pre-existing recipes may be invisible
- [ ] **Invite link generates** -- but does it work when the recipient has never interacted with the bot before? Telegram's `/start` with payload only works if the user has not blocked the bot
- [ ] **Onboarding saves preferences** -- but does the system prompt builder load them? Check that `getPreferenceSummaries()` is called with the correct userId/householdId, not the old chatId
- [ ] **Multi-user data isolation works** -- but does the FTS5 search respect household boundaries? The FTS5 query joins on `knowledge_items.chat_id` -- verify this is updated to `household_id`
- [ ] **Reminders work for multiple users** -- but do they send to the correct private chat? `bot.api.sendMessage()` needs the user's Telegram chat ID, not the household ID
- [ ] **Mini-app shows household data** -- but does the auth middleware resolve householdId? If `res.locals.chatId` is still set to the user's Telegram ID, queries against `household_id`-scoped tables return empty
- [ ] **Onboarding can be skipped** -- but are defaults actually set? A skipped onboarding with no defaults means the system prompt has no preferences, and Claude does not know about dietary restrictions
- [ ] **Feedback system works** -- but is it per-user or per-household? If check-ins are per-household, User B gets asked about User A's dinner. If per-user, each user needs their own feedback schedule
- [ ] **Knowledge changelog has userId** -- but does the existing data have the original user's ID backfilled? If existing changelog rows have NULL userId, audit trails are incomplete
- [ ] **Invite tokens expire** -- but what happens when an expired token is used? Does the user get a helpful message, or a generic "invalid invite" error?
- [ ] **Grocery list toggle verifies household** -- but what about the grocery callback handler in the bot? `createGroceryCallbackHandler` toggles items without any household check. A user could craft a callback with another household's item ID

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| chatId-to-householdId migration incomplete (some tables not updated) | MEDIUM | Write a remediation migration that backfills missing `household_id` values from the users-households mapping. Run `UPDATE table SET household_id = (SELECT household_id FROM user_households WHERE user_id = table.chat_id)` for each affected table. Rebuild FTS5 index |
| Existing user's data orphaned | LOW | Single SQL statement: `UPDATE knowledge_items SET household_id = chat_id WHERE household_id IS NULL`. Same for all other tables. Run immediately upon detection |
| FTS5 triggers lost after migration | LOW | Re-run `initializeFts(sqlite)` which re-creates all three triggers. Then run `INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')` to rebuild the index. No data loss |
| Invite tokens leaked publicly | LOW | Add an `/admin revoke_invites` command that deletes all pending invite tokens for the household. Generate a new token. Existing members are not affected (they are already joined) |
| /start handler locks out existing user | LOW | Manually insert the existing user into the `users` table: `INSERT INTO users (id, telegram_id, ...) VALUES (...)`. Or deploy a hotfix that adds a fallback: if user has data but no `users` row, create the row automatically |
| Cross-household data leak via item ID | HIGH | Audit all data access paths for household scoping. Add `household_id` checks to every repository function that accepts an item ID. For any exposed data, notify affected users (GDPR/privacy concern). Run `SELECT * FROM knowledge_items ki WHERE NOT EXISTS (SELECT 1 FROM user_households uh WHERE uh.household_id = ki.household_id AND uh.user_id = ?)` to find any items accessed outside their household |
| Onboarding state lost on restart | LOW | If state is in the database (as recommended), no recovery needed -- it persists. If state was in memory (pitfall occurred), the user restarts onboarding from step 1. Add a welcome-back message: "Looks like we got interrupted! Let's pick up where we left off" |
| System prompt has wrong user's preferences | MEDIUM | Fix the system prompt builder to separate household vs personal preferences. No data migration needed. But any meals planned with wrong preferences should be flagged for review with the user |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| chatId-to-userId migration | Phase 1: Data Model | Run `SELECT COUNT(*) FROM knowledge_items WHERE household_id IS NULL` -- must be 0. Same for all tables |
| Existing user data orphaned | Phase 1: Data Model | After migration, log in as existing user. Verify `/preferences` shows saved preferences. Verify recipe search returns existing recipes |
| FTS5 triggers lost | Phase 1: Data Model | `SELECT * FROM sqlite_master WHERE type='trigger' AND tbl_name='knowledge_items'` -- must show 3 triggers. Search for an existing recipe -- must return results |
| Deep link token security | Phase 2: Invite System | Generate 10 invite tokens -- verify none contain household ID or sequential patterns. Verify expired tokens are rejected with friendly message |
| /start handler regression | Phase 2: Invite System | Test all 4 scenarios: existing user bare /start, existing user with invite payload, new user bare /start (should be gated), new user with valid invite (should onboard) |
| Household permission model | Phase 1: Data Model (schema), Phase 2: Invite System (enforcement) | User A saves a recipe, User B queries recipes -- User B sees it. User A saves an allergy preference -- only User A can edit it |
| Onboarding state machine | Phase 3: Onboarding | Start onboarding, send a non-answer message ("hello"), verify bot redirects to the current onboarding question. Restart bot mid-onboarding, verify state is preserved |
| Message queue keying | Phase 1: Data Model (design decision) | Two users message the bot simultaneously in their private chats. Verify each gets their own response, not a mixed response |
| System prompt injection | Phase 1: Data Model (schema), Phase 3-4 (implementation) | User A has shellfish allergy. User B has no allergy. Verify User A's meal plan avoids shellfish. Verify User B's plan may include shellfish |
| Mini-app auth identity mismatch | Phase 1: Data Model | After migration, open grocery mini-app -- verify items are visible. Open recipe browser -- verify recipes are visible. New user joins household and opens mini-app -- verify they see household data |
| Grocery toggle cross-household | Phase 2: Invite System | Manually call toggle API with an item ID from another household -- verify 403 response |
| Invite link UX confusion | Phase 2: Invite System | Send invite link to a non-technical tester. Observe whether they can successfully join without help |
| Onboarding preferences not reflected | Phase 3: Onboarding | Complete onboarding stating "vegetarian." Immediately ask for a meal plan. Verify plan contains no meat |
| Feedback timing for new users | Phase 4: Feedback | New user completes onboarding. Cook one meal. Verify no proactive feedback check-in for the first week |

---

## SQLite-Specific Migration Pitfalls

Issues unique to adding columns and tables in SQLite (relevant because HeySous uses better-sqlite3).

### SQLite Pitfall 1: ALTER TABLE Limitations

**What happens:** SQLite only supports `ADD COLUMN` and `RENAME COLUMN` via ALTER TABLE. You cannot add NOT NULL columns without a default, add UNIQUE constraints, change column types, or drop columns (before SQLite 3.35.0). Adding `household_id TEXT NOT NULL` requires either: (a) a default value, or (b) a table rebuild (create new, copy, drop old, rename).

**Prevention:** Add columns as nullable first: `ALTER TABLE knowledge_items ADD COLUMN household_id TEXT`. Backfill with `UPDATE`. Then enforce NOT NULL in application code (not schema). Or use a table rebuild wrapped in a transaction, but beware of FTS5 trigger breakage (see Pitfall 3).

### SQLite Pitfall 2: No Concurrent Schema Changes

**What happens:** While the migration is running (in a transaction), all other database operations are blocked. If the bot is running and processing messages during migration, those operations will get `SQLITE_BUSY` errors.

**Prevention:** Run migrations at startup, BEFORE the bot starts accepting messages. The current `createDatabase()` function initializes tables on startup -- add migration logic to the same flow. Ensure the bot webhook is not set until after migration completes.

### SQLite Pitfall 3: Foreign Key Checks During Migration

**What happens:** The new `users` and `households` tables reference each other (or are referenced by other tables). If foreign keys are enabled (`PRAGMA foreign_keys = ON`, which they are in HeySous), inserting data in the wrong order causes constraint violations.

**Prevention:** Temporarily disable foreign keys during migration: `PRAGMA foreign_keys = OFF`, run migration, `PRAGMA foreign_keys = ON`. Or carefully order inserts: create tables first, insert parent rows before child rows.

---

## Sources

- **Codebase audit:** All 47 source files with `chatId`/`chat_id` usage reviewed, including all schema definitions, repository functions, tool handler, pipeline processor, message queue, mini-app routes, and auth middleware
- **Telegram Bot API deep linking:** Training data knowledge of `/start PAYLOAD` mechanism, 64-character base64url payload limit, deep link format `https://t.me/BotName?start=PAYLOAD`
- **SQLite documentation:** ALTER TABLE limitations, WAL mode concurrent access, foreign key enforcement during migrations, FTS5 external content mode trigger behavior
- **Drizzle ORM:** better-sqlite3 synchronous API, schema push behavior for complex changes (table rebuilds)
- **Multi-tenant data isolation patterns:** Row-level security, scope-based query filtering, composite key strategies for shared-data systems
- **Telegram user/chat ID relationship:** In private chats, `user.id === chat.id`. In groups, `chat.id` is the group ID, `from.id` is the user. Mini-app initData provides `user.id` only
- **Previous research:** `.planning/research/PITFALLS.md` (v1.1 Mini Apps), `.planning/research/ARCHITECTURE.md` (v1.1 system architecture) -- existing patterns for auth middleware, repository reuse, and Express routing

**Confidence notes:**
- HIGH confidence on all codebase-specific pitfalls (direct code audit)
- HIGH confidence on SQLite migration pitfalls (well-documented behavior)
- HIGH confidence on Telegram deep linking mechanics (core Bot API feature)
- MEDIUM confidence on optimal household permission model (design decision, not a technical fact)
- LOW confidence on specific grammY deep link payload parsing (training data only, should verify at implementation time that `ctx.match` or `ctx.message.text` correctly extracts the payload)

---
*Pitfalls research for: Adding multi-user support, household sharing, invite systems, onboarding flows, and feedback mechanisms to HeySous (v1.2)*
*Researched: 2026-02-10*
