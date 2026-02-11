# Feature Research: Multi-User, Invites, Onboarding, and Feedback

**Domain:** Telegram bot multi-user access control, household sharing, guided onboarding, app feedback
**Researched:** 2026-02-10
**Confidence:** HIGH (Telegram Bot API mechanisms verified via grammY types in codebase; patterns derived from established bot design conventions and codebase analysis)

## Context: What Exists Today

The existing HeySous bot (v1.0 + v1.1) is **single-user-per-chat** with these key data model traits:

- **chatId as isolation key:** Every table (`knowledge_items`, `meal_plans`, `grocery_lists`, `reminders`, `cooking_history`, `feedback_checkins`) uses `chat_id` as the primary scoping column. In a 1:1 Telegram chat, `chat_id == user_id`, so these are equivalent today.
- **userId tracked but unused for isolation:** The `messages` and `token_usage` tables store `user_id`, but no business logic branches on it. The message handler extracts `ctx.from?.id ?? "unknown"`.
- **Mini App auth extracts userId:** The `auth-middleware.ts` maps `parsed.user.id` to `res.locals.chatId` -- again treating user ID as chat ID.
- **No access control:** Any Telegram user who messages the bot gets a response. No gating, no invite check, no user table.
- **No household concept:** No grouping of users, no shared data, no multi-user awareness in the system prompt or tool handlers.
- **adminUserIds config exists:** `config.ts` already parses `ADMIN_USER_IDS` from env, but only used for the `/costs` command.
- **Factory function pattern:** All services use `createXxx()` factories with dependency injection -- new features follow this pattern.

---

## Feature Landscape

### 1. Invite System

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Deep link invite URLs** | Telegram's standard mechanism for bot onboarding. `t.me/BotName?start=TOKEN` triggers `/start` with payload in `ctx.match`. Users expect to click a link and land in the bot. | LOW | grammY `bot.command("start")` provides `ctx.match` as string payload. 64-char base64url limit per Telegram spec. |
| **Token validation on /start** | Invalid or expired tokens must be rejected with a friendly message. Users must not get silently ignored or see an error. | LOW | Check token against DB. If invalid: "This invite link isn't valid. Ask [admin name] for a new one." |
| **Single-use tokens** | Each invite link works exactly once. Prevents unwanted sharing of invite URLs. Standard for private bots. | LOW | Mark token as `redeemed` with `redeemed_by` and `redeemed_at` after successful use. |
| **Two invite types: household vs independent** | The milestone spec distinguishes household invites (join existing household, share data) from independent invites (new standalone user). This is critical for the sharing model. | MEDIUM | Token record includes `type: "household" \| "independent"` and optional `household_id`. Household tokens link the new user to an existing household. |
| **Gated access (reject non-invited users)** | The bot is private/personal. Unknown users who message the bot without an invite should be politely turned away. | LOW | Middleware before all handlers: check if `userId` exists in `users` table. If not, respond with "I'm a private bot. You need an invite link to get started." |
| **Admin invite generation** | The admin (primary user) must be able to create invite links. `/invite household` or `/invite independent` commands. | LOW | Admin-only command. Generates token, stores in DB, returns `t.me/BotName?start=TOKEN` URL. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Invite link preview message** | When sharing the invite URL in a Telegram chat, show a rich preview: "You've been invited to HeySous, a meal planning assistant!" | LOW | Configure bot description in BotFather. The deep link preview uses the bot's short_description. |
| **Invite expiry** | Tokens expire after 7 days. Prevents stale links floating around. | LOW | `expires_at` column. Check on redemption. Admin can set custom expiry. |
| **Invite tracking dashboard** | Admin can see who was invited, when, status (pending/redeemed/expired). `/invites` command. | LOW | Query invite_tokens table. Format as list. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Self-service registration** | "Let anyone sign up" | This is a private/personal bot. Open registration means strangers using your Claude API credits and polluting the knowledge base. | Invite-only. Admin explicitly controls access. |
| **Multi-use invite codes** | "Share one code with many people" | Loses control over who joins. Cannot revoke for specific people. Hard to track. | Single-use tokens. Admin generates one per person. |
| **Telegram group-based access** | "Add the bot to a group chat" | Group chat dynamics (multiple users typing, @mentions required, message noise) conflict with the conversational 1:1 model. Telegram group bots have different API constraints (privacy mode, etc). | Keep bot as 1:1 private chat. Share data at the household level, not the chat level. |

---

### 2. Multi-User Identity

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Users table** | Persistent user records with Telegram metadata (user ID, first name, username). Foundation for everything else. | LOW | New `users` table: `telegram_id` (PK), `first_name`, `username`, `role` (admin/member), `household_id`, `created_at`, `onboarding_completed`. |
| **Per-user chatId resolution** | Current code uses `chatId` everywhere. In 1:1 chats, chatId == userId. Must ensure all queries use the correct scope: user's own chatId for personal data, or householdId for shared data. | MEDIUM | Key insight: In Telegram 1:1 private chats, `ctx.chat.id == ctx.from.id`. The existing `chatId`-based isolation already works per-user. The change is adding a **household layer on top**, not replacing chatId. |
| **Admin role** | Primary user (the person running the bot) has admin privileges: invite management, cost visibility, feedback dashboard. | LOW | `role` column in users table. Check `config.adminUserIds` for initial admin seeding. |
| **User context in system prompt** | Claude should know who it's talking to. "You're talking to [Name]. They're part of the [Household Name] household." | LOW | Inject user metadata into system prompt preamble. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Per-user preference profiles** | Each household member can have their own dietary restrictions, taste preferences, etc. Claude reasons over both personal and household preferences. | MEDIUM | Preferences already scoped by chatId. With household sharing, the system prompt includes both the user's personal preferences AND the household's shared preferences. |
| **User activity tracking** | Know which household member last interacted, who generates most plans, etc. | LOW | Already tracked via `user_id` in messages/token_usage tables. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **User profiles with photos/bios** | "Make it feel like a social app" | This is a cooking assistant, not a social network. Users already have Telegram profiles. | Use Telegram's own user metadata (first_name, username). No duplicate profile system. |
| **Role-based permissions beyond admin/member** | "Different permission levels" | Two users (admin + partner) don't need RBAC. Over-engineering for a household of 2-4 people. | Two roles: admin (manages bot) and member (uses bot). |
| **Multi-bot or multi-instance** | "Each household gets their own bot" | Operational complexity explosion. BotFather management, multiple deployments, separate DBs. | Single bot, multi-tenant via household_id scoping in one database. |

---

### 3. Household Sharing

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Households table** | Named group that links users. One household per invite chain. Admin's household is created on first boot. | LOW | New `households` table: `id`, `name`, `created_by`, `created_at`. Users table gets `household_id` FK. |
| **Shared recipes** | All household members see the same recipe library. When one person adds "Chicken Parm", everyone can see it. | HIGH | **This is the hardest feature.** Current `knowledge_items.chat_id` scopes everything per-user. For household sharing, queries must change from `WHERE chat_id = ?` to `WHERE chat_id IN (SELECT telegram_id FROM users WHERE household_id = ?)`. Affects FTS5 queries, retrieval service, knowledge repository, tool handlers, and Mini App API routes. |
| **Shared meal plans** | One meal plan per household per week (not per user). Either member can create or modify the plan. | HIGH | Same scoping challenge as recipes. `meal_plans.chat_id` becomes household-scoped. The plan tool handler must use household_id for lookups. Both users see the same plan in Mini App. |
| **Shared grocery lists** | One active grocery list per household. Both members can check off items (in bot or Mini App). | MEDIUM | Grocery lists already have `chat_id`. Change to household scoping. Polling sync in Mini App (8s) means near-real-time shared checking. |
| **Shared cooking history** | Household members share cooking history so Claude knows what "we" ate recently. | LOW | Same scoping pattern. Query by household_id instead of chat_id. |
| **Shared reminders** | Morning prep summaries and prep alerts go to all household members (or configurable per user). | MEDIUM | Current reminders are per-chat. For households, either: (a) generate one set of reminders and send to all members, or (b) let each member configure their own reminder preferences but base content on the shared plan. Option (b) is better -- people wake up at different times. |

#### The chatId-to-householdId Migration Strategy

This is the central architectural challenge. There are two approaches:

**Option A: Introduce householdId column alongside chatId (RECOMMENDED)**
- Add `household_id` column to all shared tables (knowledge_items, meal_plans, grocery_lists, cooking_history)
- Keep `chat_id` as the "created by" audit field
- All sharing queries filter by `household_id`
- Independent (non-household) users have a solo household (household of one)
- FTS5 virtual table needs a content sync approach (FTS5 external content tables can join on household_id)
- Migration: create household for admin, set household_id on all existing rows

**Option B: Rewrite chatId to mean householdId everywhere**
- Rename semantics: chatId becomes householdId
- Breaks the clean mapping of Telegram chat_id to DB chat_id
- Confusing for debugging, logging
- Not recommended

**Decision: Option A.** Add `household_id` as the sharing scope. `chat_id` remains for audit trail and personal data (messages, token_usage, reminder_settings stay per-user).

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **"Who added this?" attribution** | Recipes and plan entries show who contributed them. "Added by [Partner]" tag. | LOW | `chat_id` (creator) stays on records. Display creator's first_name in recipe detail. |
| **Per-member grocery check-off visibility** | See who checked off what item. Useful when both partners are shopping simultaneously at different stores. | LOW | Add `checked_by` column to grocery_list_items. |
| **Household name** | "The Smith Kitchen" or "Our Kitchen" -- personalizes the experience. | LOW | Set during admin onboarding or via command. Used in system prompt. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multiple households per user** | "I want to be in my home kitchen AND my office lunch group" | Massive complexity increase. Which household context is active? Recipes duplicate across households. | One user, one household. Period. |
| **Household permissions (viewer/editor)** | "Partner can view but not modify" | A household of 2-3 people doesn't need ACLs. Both partners should be able to add recipes and modify plans. Trust is implicit in a household invite. | All household members are equal (except admin for bot management). |
| **Real-time collaboration indicators** | "Show who's viewing the grocery list right now" | WebSocket infrastructure, presence tracking, UI complexity. The 8s polling model is good enough. | Polling sync already provides near-real-time. No presence indicators needed. |
| **Household chat / messaging between members** | "Let us discuss meals inside the bot" | They already have Telegram for messaging each other. The bot is an assistant, not a communication channel. | Users message each other directly on Telegram. |

---

### 4. Guided Onboarding

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Welcome message on invite redemption** | After clicking invite link and hitting /start, user gets a warm welcome. "Hey! Welcome to Sous. I'm your meal planning assistant. Let's get you set up!" | LOW | Modify /start handler to detect valid invite token, create user, trigger onboarding flow. |
| **Preference Q&A sequence** | Ask 3-5 key questions to bootstrap the user's preference profile. Essential questions: dietary restrictions, household size, dinner time, preferred stores, cooking comfort level. | MEDIUM | Conversational flow driven by Claude, not hardcoded state machine. System prompt includes onboarding instructions. Claude asks questions, saves preferences via tools. Track progress with `onboarding_step` or let Claude manage it naturally. |
| **Capability tour** | Brief explanation of what the bot can do. "I can help you plan meals, manage grocery lists, save recipes, and send you prep reminders." Show 3-4 examples of commands/interactions. | LOW | After preference Q&A, Claude sends a capability overview. Include inline keyboard buttons: "Plan a meal", "Add a recipe", "See my grocery list". |
| **Seed recipe prompt** | Encourage user to add their first 3-5 recipes. "To start planning meals, I need to know some of your go-to recipes. What's a dinner you make often?" | LOW | Part of the onboarding conversation. Claude guides user through adding recipes naturally. |
| **Onboarding completion flag** | Track that onboarding is done so the bot doesn't re-ask setup questions. | LOW | `onboarding_completed` boolean + `onboarding_completed_at` timestamp on users table. |
| **Skip option** | User can skip onboarding and go straight to using the bot. "/skip or just start chatting." | LOW | Detect "skip" intent. Mark onboarding complete. Use defaults. |

#### Household-Specific Onboarding

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Household join message** | When a user joins via household invite: "Welcome! You're joining [Partner]'s kitchen. You'll share recipes, meal plans, and grocery lists." | LOW | Check invite type. If household, load household name and members. |
| **Abbreviated onboarding for household members** | Don't ask about dinner time and stores again -- those are household-level. Ask about personal dietary restrictions and preferences only. | MEDIUM | Claude's onboarding instructions must differentiate: new household (full Q&A) vs joining household (personal preferences only). |
| **Shared context inheritance** | New household member immediately sees existing recipes, plans, and grocery lists. No cold start. | LOW | Household scoping handles this automatically. The new user's queries hit the same household_id data. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Progressive onboarding** | Don't ask everything upfront. Ask the most critical questions first (allergies, dinner time), then learn the rest over the first week of usage. | LOW | This is natural for an AI-driven flow. Claude's instructions say "Ask the essential 3 questions now, then learn the rest organically from conversation." |
| **Onboarding recap** | After a week, send a message: "Here's what I've learned about your preferences so far: [list]. Anything I'm missing?" | LOW | Scheduled message (like a reminder) triggered 7 days after onboarding_completed_at. |
| **Interactive recipe seeding** | Instead of just "tell me a recipe", offer to generate recipes from description: "What's a weeknight dinner you make a lot? I'll draft the recipe and you can tweak it." | LOW | Already supported by the recipe creation flow. Just needs to be part of the onboarding prompt. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Form-based onboarding (Mini App)** | "A nice form UI for entering preferences" | Breaks the conversational model. The bot IS the interface. Forms feel impersonal and miss the opportunity to establish the assistant relationship. | Conversational onboarding via Claude. Natural, warm, builds rapport from the first interaction. |
| **Mandatory onboarding** | "Don't let users do anything until they complete setup" | Frustrating. Some users want to dive right in. Forced flows feel like corporate software. | Gentle guidance with skip option. If a user starts chatting about recipes without finishing onboarding, Claude adapts. |
| **Onboarding wizard with progress bar** | "Show step 2 of 5" | Rigid. Makes the conversation feel like a form. Loses the natural flow. | Claude manages the conversation naturally. No visible step counter. |

---

### 5. App Feedback System

**Important distinction:** This is feedback about the **bot itself** (app feedback: "the grocery list is hard to use"), NOT feedback about meals (meal feedback: "the chicken was dry"). Meal feedback already exists in v1.0.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **/feedback command** | Explicit way for users to submit feedback about the app. `/feedback The recipe search could be better`. | LOW | New command handler. Store in `app_feedback` table with `user_id`, `text`, `source: "command"`, `created_at`. |
| **Feedback confirmation** | After submitting feedback, acknowledge it warmly. "Thanks for the feedback! I've noted that down." | LOW | Simple reply after storing. |
| **Admin feedback dashboard** | Admin can view all feedback. `/feedback-admin` or a Mini App page. | MEDIUM | Query app_feedback table. Show chronologically with user attribution. Filtering by date range. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Silent sentiment detection** | Claude detects frustration or delight in normal conversation and logs it as implicit feedback. "ugh this isn't working" -> negative implicit feedback. "this is amazing!" -> positive implicit feedback. | MEDIUM | Add sentiment extraction to the pipeline processor. When Claude detects strong sentiment about the bot (not about food), log to app_feedback with `source: "implicit"`. Must distinguish "this chicken is terrible" (meal feedback) from "this bot is terrible" (app feedback). |
| **Hub feedback button** | "Give Feedback" button in the Mini App hub dashboard. Opens a simple text input. | LOW | New Mini App route. Simple form: textarea + submit. Posts to `/api/feedback`. |
| **Periodic "how am I doing?" check-in** | Every 2 weeks (configurable), the bot proactively asks: "Hey, how's everything going? Anything I could do better?" | MEDIUM | Scheduled message via the existing reminder/poller infrastructure. New reminder type `app_checkin`. Frequency configurable. Response processed as app feedback. |
| **Feedback categorization** | Auto-categorize feedback: UX, recipes, planning, grocery, reminders, general. | LOW | Claude extracts category when processing feedback. Stored as `category` column. Useful for admin dashboard filtering. |
| **Feedback sentiment scoring** | Rate each feedback as positive/neutral/negative/suggestion. | LOW | Claude extracts sentiment alongside category. Stored as `sentiment` column. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **In-app feedback forms with ratings** | "Rate us 1-5 stars" | Impersonal. Quantitative ratings are meaningless with 2-3 users. Qualitative feedback is far more valuable for a personal bot. | Free-text feedback. Let users say what they think in their own words. |
| **Feedback reply system** | "Admin can reply to feedback" | You're the admin AND the only other users are your household. Just message them on Telegram directly. | Direct Telegram communication for feedback follow-up. |
| **Anonymous feedback** | "Let users submit without attribution" | With 2-3 users, anonymity is meaningless. And you need to know who said what to improve their experience. | All feedback attributed to user. |
| **Public feedback board / changelog** | "Show all users what feedback was addressed" | Overkill for a household. | Mention changes in conversation: "Hey, I noticed you mentioned X was tricky -- I've improved that!" |

---

## Feature Dependencies

```
users table ─────────────────┬──> invite system (needs user records)
                             ├──> onboarding (needs user state tracking)
                             ├──> household sharing (needs user-to-household mapping)
                             └──> app feedback (needs user attribution)

households table ────────────┬──> household sharing (needs household grouping)
                             └──> household onboarding (needs household context)

invite system ───────────────┬──> gated access middleware (needs token validation)
                             └──> onboarding trigger (invite redemption starts onboarding)

gated access middleware ─────┬──> ALL bot handlers (must run before everything)
                             └──> Mini App auth (must check user exists)

household sharing ───────────┬──> shared recipes (householdId scoping on knowledge_items)
                             ├──> shared meal plans (householdId scoping on meal_plans)
                             ├──> shared grocery lists (householdId scoping on grocery_lists)
                             ├──> shared cooking history (householdId scoping)
                             ├──> shared reminders (household-aware reminder generation)
                             └──> Mini App routes (resolve householdId from userId)

onboarding ──────────────────┬──> preference Q&A (uses existing preference system)
                             ├──> capability tour (static content + buttons)
                             └──> seed recipe prompt (uses existing recipe entry)

app feedback ────────────────┬──> /feedback command (standalone)
                             ├──> silent sentiment detection (adds to pipeline processor)
                             ├──> hub button (adds to Mini App)
                             └──> periodic check-in (adds to reminder system)
                             └──> admin dashboard (reads app_feedback table)
```

### Critical Ordering Constraint

```
1. users + households tables   (foundation -- everything depends on this)
2. invite system + gated access  (must exist before onboarding can work)
3. multi-user identity refactor  (chatId -> householdId scoping layer)
4. household sharing             (depends on identity + scoping)
5. onboarding                    (depends on invite system + user records)
6. app feedback                  (depends on user records, otherwise independent)
```

Onboarding and app feedback are relatively independent of each other and can be developed in parallel after the identity/sharing foundation is in place.

---

## MVP Definition

### Launch With (v1.2)

**Must ship together -- these form a coherent "multi-user" release:**

1. **Users + Households tables** -- foundation for everything
2. **Invite system** -- deep link tokens, admin /invite command, single-use, two types (household/independent), token expiry
3. **Gated access middleware** -- reject non-invited users, check user exists before all handlers
4. **Multi-user identity** -- per-user context, user metadata in system prompt
5. **Household data sharing** -- shared recipes, meal plans, grocery lists, cooking history via household_id scoping
6. **Guided onboarding** -- welcome message, preference Q&A (3-5 questions), capability tour, seed recipe prompt, skip option
7. **/feedback command** -- basic app feedback collection
8. **Admin feedback view** -- /feedback-admin command to see all feedback
9. **Periodic "how am I doing?"** -- bi-weekly check-in using existing reminder infrastructure

### Add After Validation (v1.x)

These are valuable but not essential for the v1.2 launch:

10. **Silent sentiment detection** -- implicit feedback from conversation. Needs careful tuning to avoid false positives (meal frustration vs bot frustration).
11. **Hub feedback button** -- Mini App integration. Nice but /feedback command covers the use case.
12. **Per-member grocery check-off attribution** -- "checked by [Partner]". Nice touch but not blocking.
13. **Onboarding recap** -- 7-day follow-up message. Requires scheduling infrastructure (already exists via reminders).
14. **Invite tracking dashboard** -- /invites command to see all invite status.

### Future Consideration (v2+)

15. **Feedback categorization + admin dashboard Mini App** -- Rich filtering, trends, sentiment analysis over time.
16. **Per-user preference profiles within household** -- "Partner doesn't eat mushrooms but I do." Currently household preferences are shared.
17. **Notification preferences per household member** -- Fine-grained control over which reminders each person gets.

---

## Feature Prioritization Matrix

| Feature | User Value | Technical Risk | Dependency Weight | Priority |
|---------|-----------|---------------|-------------------|----------|
| Users + Households tables | Critical (foundation) | LOW | Blocks everything | P0 |
| Gated access middleware | Critical (security) | LOW | Blocks all handlers | P0 |
| Invite system (deep links) | Critical (access control) | LOW | Blocks onboarding | P0 |
| Household data sharing | Critical (core value) | HIGH | Requires schema changes to 5+ tables, FTS5 changes | P0 |
| Multi-user identity in prompts | HIGH | LOW | Requires users table | P0 |
| Guided onboarding flow | HIGH | MEDIUM | Requires invite system, users table | P0 |
| /feedback command | MEDIUM | LOW | Requires users table | P0 |
| Admin feedback view | MEDIUM | LOW | Requires /feedback | P0 |
| Periodic check-in | MEDIUM | LOW | Reuses reminder infra | P0 |
| Silent sentiment detection | MEDIUM | MEDIUM | Requires pipeline changes | P1 |
| Hub feedback button | LOW | LOW | Mini App addition | P1 |
| Invite tracking | LOW | LOW | Standalone | P1 |
| Grocery check-off attribution | LOW | LOW | Schema addition | P1 |
| Onboarding recap | LOW | LOW | Scheduled message | P1 |
| Per-user preference profiles | MEDIUM | HIGH | Complex preference merging | P2 |
| Admin dashboard Mini App | LOW | MEDIUM | New Mini App route | P2 |

---

## Key Implementation Notes

### Telegram Deep Link Mechanics (Verified via grammY Types)

- Deep link URL format: `t.me/BotName?start=PAYLOAD`
- Payload limit: 64 characters (base64url safe)
- In grammY: `bot.command("start")` handler receives payload as `ctx.match` (type: `string`)
- The user automatically opens a chat with the bot and sends `/start PAYLOAD`
- Bot receives this as a regular message update with the `/start` command

**Token format recommendation:** Use `nanoid(21)` (URL-safe, 21 chars) for invite tokens. Well within the 64-char limit. Prefix with invite type: `h_` for household, `i_` for independent. Example: `h_V1StGXR8_Z5jdHi6B-myT`

### Household Scoping Strategy for Existing Data

All shared data tables need a `household_id` column. The resolution flow:

```
User sends message
  -> Extract userId from ctx.from.id
  -> Look up user record -> get household_id
  -> Pass household_id to all repository/tool calls
  -> Queries use WHERE household_id = ? instead of WHERE chat_id = ?
```

For the **Mini App**, the same flow applies:
```
Mini App sends request with initData
  -> Extract userId from parsed initData
  -> Look up user record -> get household_id
  -> Pass household_id to route handlers
```

**chat_id stays on records** as an audit trail (who created/modified this). But **household_id** becomes the query scope for all shared data.

### FTS5 Virtual Table Impact

The `knowledge_items_fts` virtual table currently includes `chat_id` in its content. For household sharing, the FTS5 search function (`searchFts`) needs to change from filtering by `chat_id` to filtering by a set of chat_ids belonging to the household, OR by adding `household_id` to the FTS5 content table.

**Recommended approach:** Add `household_id` to `knowledge_items` table. The FTS5 search query changes to:
```sql
SELECT ... FROM knowledge_items_fts
JOIN knowledge_items ON knowledge_items.rowid = knowledge_items_fts.rowid
WHERE knowledge_items.household_id = ?
AND knowledge_items_fts MATCH ?
```

This is a JOIN-based approach rather than storing household_id in the FTS5 table itself, avoiding FTS5 rebuild complexity.

### Onboarding Flow (Claude-Driven, Not State Machine)

The onboarding should NOT be a hardcoded state machine with numbered steps. Instead:

1. **System prompt includes onboarding instructions** when `user.onboarding_completed == false`
2. **Claude manages the conversation** -- asks about allergies, dinner time, stores, comfort level
3. **Claude uses existing tools** (save_knowledge) to store preferences as it learns them
4. **Claude decides when onboarding is "done"** and calls a new `complete_onboarding` tool
5. **The tool marks the user** as onboarding_completed and sends the capability tour

This approach:
- Matches the agent-first architecture (Claude drives, not hardcoded flows)
- Handles interruptions naturally (user asks a question mid-onboarding, Claude answers, then returns)
- Feels conversational, not like filling out a form
- Adapts to the user's pace and verbosity

### App Feedback vs Meal Feedback Distinction

The existing **meal feedback** system (v1.0 Phase 9-10) handles:
- Post-meal check-ins ("how was the chicken parm?")
- Sentiment extraction (positive/neutral/negative/skipped)
- Recipe annotations based on feedback

The new **app feedback** system is completely separate:
- Feedback about the bot itself, not about meals
- Stored in a new `app_feedback` table (not in `feedback_checkins`)
- Different schema: `user_id`, `text`, `category`, `sentiment`, `source` (command/implicit/checkin/hub)
- Admin-facing (not used to modify recipes or plans)

---

## Sources

- grammY types inspected at `/workspace/node_modules/grammy/out/context.d.ts` -- CommandContext, ctx.match for deep link payloads (HIGH confidence)
- Telegram Bot API deep linking spec -- 64 character base64url payload limit for `/start` parameter (HIGH confidence, well-established Telegram API feature)
- Existing codebase schema analysis -- all table structures, chatId scoping pattern, factory function conventions (HIGH confidence, direct inspection)
- `config.ts` adminUserIds pattern -- already parsed from env, used for /costs (HIGH confidence)
- Mini App auth middleware -- userId extraction from initData, mapped to chatId (HIGH confidence)
- Existing reminder/feedback infrastructure -- poller, sender, generator pattern for scheduled messages (HIGH confidence)

---

*Feature research for: Multi-user Telegram bot with household sharing, invite system, onboarding, and feedback*
*Researched: 2026-02-10*
