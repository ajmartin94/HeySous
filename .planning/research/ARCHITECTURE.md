# Architecture Research

**Domain:** Multi-user Telegram bot with household sharing, invite system, onboarding, and feedback
**Researched:** 2026-02-10
**Confidence:** HIGH (based on thorough codebase analysis + well-established Telegram Bot API and grammY patterns)

## System Overview

### Current Architecture (v1.1)

```
Telegram User  --->  Telegram Bot API
                          |
                    [grammY webhook/poll]
                          |
                    [Middleware Pipeline]
                    1. hydrateReply
                    2. autoChatAction
                    3. db injection
                    4. callback handlers (grocery, feedback)
                    5. command handlers (/start, /costs, etc.)
                    6. feedbackTextHandler
                    7. messageHandler (catch-all -> debounce queue)
                          |
                    [Pipeline Processor]
                    messages -> context build -> Claude call w/ tools -> response
                          |
              +-----------+-----------+
              |           |           |
         Knowledge    Planning    Grocery    Reminders    Feedback
         (FTS5)       (Plans)    (Lists)    (Poller)     (Check-ins)
              |           |           |           |           |
              +-----+-----+-----+-----+-----+-----+-----+---+
                          |
                    [SQLite via better-sqlite3]
                    (single file, WAL mode)
                          |
                    [Express Server]
                    /webhook, /api, /app (Mini App SPA)
```

**Key observation:** All data is currently keyed by `chatId` (which equals `ctx.chat.id` as a string). In a private Telegram chat, `chat.id == user.id`, so chatId and userId are interchangeable today. The codebase already captures `userId` from `ctx.from?.id` in the message handler but only uses `chatId` for data queries.

### Target Architecture (v1.2)

```
Telegram User  --->  t.me/HeySousBot?start=INVITE_TOKEN
                          |
                    [grammY webhook/poll]
                          |
                    [Middleware Pipeline]
                    1. hydrateReply
                    2. autoChatAction
                    3. db injection
                    4. ACCESS GATE (new) -- verify user registered, else redirect to /start
                    5. HOUSEHOLD RESOLVER (new) -- resolve userId -> householdId, inject ctx
                    6. callback handlers (grocery, feedback)
                    7. ONBOARDING ROUTER (new) -- intercept if onboarding in progress
                    8. command handlers (/start w/ invite, /feedback, etc.)
                    9. feedbackTextHandler
                    10. messageHandler (catch-all)
                          |
                    [Pipeline Processor]
                    (now uses householdId for shared data, userId for personal data)
                          |
              +-----------+--+--------+-----------+-----------+
              |              |        |           |           |
         Knowledge      Planning  Grocery    Reminders    Feedback    Users (new)
         (FTS5)         (Plans)   (Lists)    (Poller)     (App-level) Households (new)
              |              |        |           |           |        Invites (new)
              +--------------+--------+-----------+-----------+--------+
                          |
                    [SQLite via better-sqlite3]
                          |
                    [Express Server]
                    /webhook, /api, /app, /admin (new)
```

## Component Responsibilities

### New Components

| Component | Responsibility | Location |
|-----------|---------------|----------|
| **users table + repository** | Store registered users with Telegram user ID, display name, household assignment, onboarding state | `src/users/` |
| **households table + repository** | Group users into households, manage shared data ownership | `src/users/` (same module -- 1:N relationship) |
| **invites table + repository** | Single-use invite tokens, deep link generation, redemption tracking | `src/invites/` |
| **access gate middleware** | Block unregistered users from all handlers except /start | `src/bot/middlewares/access-gate.ts` |
| **household resolver middleware** | Look up user's household from DB, inject `householdId` into context | `src/bot/middlewares/household-resolver.ts` |
| **onboarding state machine** | Track user through preference Q&A, capability tour, seed recipe flow | `src/onboarding/` |
| **app feedback system** | /feedback command, silent sentiment detection, admin dashboard | `src/app-feedback/` (distinct from existing meal feedback) |
| **admin API routes** | Feedback dashboard data endpoints | `src/mini-app/routes/admin.ts` |

### Modified Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| **BotContext** (`src/bot/context.ts`) | Add `userId`, `householdId`, `user` fields to context type | Every handler needs resolved identity |
| **startHandler** (`src/bot/handlers/start.ts`) | Handle invite token from `ctx.match`, create user, join household | Deep link entry point |
| **Pipeline Processor** (`src/pipeline/processor.ts`) | Use `householdId` instead of `chatId` for shared data queries | Household sharing |
| **Tool Handler** (`src/ai/tool-handler.ts`) | Pass `householdId` to repositories for shared data | Knowledge, plans, grocery are household-scoped |
| **Knowledge Repository** | Query by `householdId` instead of `chatId` | Recipes shared across household |
| **Plan Repository** | Query by `householdId` instead of `chatId` | Meal plans shared |
| **Grocery Repository** | Query by `householdId` instead of `chatId` | Grocery lists shared |
| **Reminder Repository** | Keep per-user (not household) for notification preferences | Different users want different reminder times |
| **FTS5 search** (`src/knowledge/fts.ts`) | Filter by `householdId` instead of `chatId` | Shared recipe search |
| **Mini App auth** (`src/mini-app/auth-middleware.ts`) | Resolve `householdId` from authenticated user | API needs household scope |
| **All existing init.ts files** | Migration logic to add `household_id` columns | Schema evolution |
| **System prompt** (`src/ai/system-prompt.ts`) | Add household context (who's in household, member names) | Claude needs to know about multi-user |

### Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| **Claude client** (`src/ai/claude-client.ts`) | AI interface stays the same |
| **Message queue** (`src/pipeline/message-queue.ts`) | Debounce keyed by chatId still correct (private chats) |
| **Telegram sender/formatter** | Output formatting unchanged |
| **Express server structure** (`src/server.ts`) | Just adds routes |
| **Mini App SPA** (`mini-app/`) | Existing views work with household data transparently via API |

## Recommended Project Structure

```
src/
  users/                      # NEW
    schema.ts                 # users, households Drizzle schema
    init.ts                   # CREATE TABLE for users, households
    repository.ts             # CRUD for users and households
    types.ts                  # User, Household interfaces
  invites/                    # NEW
    init.ts                   # CREATE TABLE for invite_tokens
    repository.ts             # Create, redeem, validate tokens
    deep-link.ts              # Generate t.me/BotName?start=TOKEN URLs
    types.ts                  # InviteToken interface
  onboarding/                 # NEW
    state-machine.ts          # Onboarding state transitions
    preference-questions.ts   # Q&A flow definition (deterministic questions)
    tour.ts                   # Capability tour message sequence
    seed-recipes.ts           # Starter recipe suggestions
    handler.ts                # grammY Composer for onboarding flow
    types.ts                  # OnboardingState, OnboardingStep enums
  app-feedback/               # NEW (distinct from existing meal feedback/)
    init.ts                   # CREATE TABLE for app_feedback
    repository.ts             # App feedback CRUD
    handler.ts                # /feedback command handler
    detector.ts               # Silent sentiment extraction from messages
    admin-routes.ts           # Express routes for dashboard
    types.ts                  # AppFeedback interface
  bot/
    context.ts                # MODIFIED -- add userId, householdId, user
    middlewares/
      access-gate.ts          # NEW -- block unregistered users
      household-resolver.ts   # NEW -- resolve user -> household
      error-handler.ts        # unchanged
    handlers/
      start.ts                # MODIFIED -- handle invite deep links
      ...                     # other handlers unchanged
  ...                         # existing modules unchanged
```

### Structure Rationale

**Why separate `users/` from `invites/`:** Users and invites have different lifecycles. Invites are transient (created, redeemed, expired). Users are permanent. Keeping them in separate modules follows the existing pattern where each domain has its own directory (grocery/, planning/, reminders/, feedback/).

**Why `app-feedback/` not extending existing `feedback/`:** The existing `feedback/` module handles meal-level feedback (how was dinner?). App feedback is a different domain (how is the app itself?). Conflating them would create confusion. The naming `app-feedback` makes the distinction clear.

**Why `onboarding/` as a separate module:** Onboarding is a temporary state machine that runs once per user. It has its own flow, messages, and completion criteria. After completion, it is dormant. This is architecturally distinct from persistent handlers.

## Architectural Patterns

### Pattern 1: The chatId -> householdId Migration

**What:** Systematically replace `chatId` with `householdId` for shared data, keep `chatId`/`userId` for personal data.

**When:** All shared data access (knowledge, plans, grocery lists).

**The key insight:** In the current system, `chatId = ctx.chat.id`, and in private chats `chat.id == from.id`. After the migration, the data ownership model splits into two scopes:

```
HOUSEHOLD-SCOPED (shared between household members):
  knowledge_items.chat_id -> household_id
  meal_plans.chat_id -> household_id
  grocery_lists.chat_id -> household_id
  cooking_history.chat_id -> household_id
  feedback_checkins.chat_id -> household_id
  knowledge_changelog.chat_id -> household_id

USER-SCOPED (personal, per individual):
  reminder_settings.chat_id (stays per-user -- each person wants their own times)
  messages.chat_id (per-chat conversation history)
  token_usage.chat_id (cost tracking per person)
  user_preferences tagged 'subject:self' (personal dietary restrictions)

NOTE on preferences:
  Preferences tagged 'subject:household' (household size, shared store prefs)
  are stored in knowledge_items (household-scoped), so they are shared.
  Preferences tagged 'subject:self' are also in knowledge_items but
  conceptually belong to the user. The agent handles this distinction
  through the existing tag system -- no schema change needed.
```

**Migration approach:** Add a `household_id` column to shared tables. For existing single-user data, the migration sets `household_id = chat_id` (since the solo user forms a household of one). New data uses the resolved household ID. The `chat_id` column is retained for backward compatibility and can be dropped later.

**Implementation pattern:**

```typescript
// Before (current -- every repository method):
const plan = planRepository.getPlan(chatId, weekStartDate);

// After (v1.2):
const plan = planRepository.getPlan(householdId, weekStartDate);
// householdId comes from ctx.householdId, resolved by middleware
```

### Pattern 2: Invite-Gated Access via Telegram Deep Links

**What:** Users can only access the bot through an invite link. The /start command with a payload registers the user.

**How it works in Telegram/grammY:**

1. Admin generates invite token (stored in DB)
2. Deep link URL: `https://t.me/HeySousBot?start=INVITE_abc123`
3. User clicks link, Telegram opens chat and sends `/start INVITE_abc123`
4. grammY's `bot.command('start')` handler receives the payload in `ctx.match`
5. Bot validates token, creates user record, assigns to household
6. Token is marked as redeemed (single-use)

**grammY deep link verification (from node_modules/grammy/out/composer.d.ts):**
> "You can use deep linking to let users start your bot with a custom payload.
> starts your bot, you will receive `custom-payload` in the `ctx.match` property."

```typescript
// In start handler:
startHandler.command("start", async (ctx) => {
  const inviteToken = ctx.match; // deep link payload, e.g. "INVITE_abc123"

  if (!inviteToken) {
    // No token -- check if user is already registered
    const user = userRepository.getByTelegramId(String(ctx.from.id));
    if (user) {
      await ctx.reply("Welcome back!");
      return;
    }
    await ctx.reply(
      "You need an invite link to use HeySous. Ask the household admin for one!"
    );
    return;
  }

  // Validate and redeem token
  const invite = inviteRepository.redeem(inviteToken, String(ctx.from.id));
  if (!invite) {
    await ctx.reply("That invite link is invalid or has already been used.");
    return;
  }

  // Create user and assign to household
  const user = userRepository.create({
    telegramId: String(ctx.from.id),
    displayName: ctx.from.first_name,
    householdId: invite.householdId,
  });

  // Start onboarding
  await onboardingHandler.start(ctx, user);
});
```

**Token format:** Use `crypto.randomUUID()` prefixed with `INV_` for readability. Tokens expire after 7 days. Single-use only.

**Deep link URL format:** `https://t.me/HeySousBot?start=INV_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
Note: Telegram allows 64 characters in the start parameter, base64 encoded. A UUID is 36 chars + 4 prefix = 40 chars, well within limits.

### Pattern 3: Access Gate Middleware

**What:** A middleware that intercepts all updates and blocks unregistered users.

**When:** Every update except /start (which is the registration entry point).

**Why needed:** Without the gate, unregistered users could trigger Claude API calls, access data, or interact with the bot. The gate ensures only invited users proceed past registration.

```typescript
// src/bot/middlewares/access-gate.ts
export function createAccessGate(userRepository: UserRepository) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    // Always allow /start command (registration entry point)
    if (ctx.message?.text?.startsWith("/start")) {
      return next();
    }

    // Always allow callback queries from registered users
    // (grocery buttons, feedback buttons still need to work)

    const telegramId = String(ctx.from?.id);
    if (!telegramId || telegramId === "undefined") return;

    const user = userRepository.getByTelegramId(telegramId);
    if (!user) {
      await ctx.reply(
        "You need an invite link to use HeySous. "
        + "Ask the household admin for one!"
      );
      return; // Block -- do not call next()
    }

    // Inject user info into context for downstream handlers
    ctx.userId = user.telegramId;
    ctx.householdId = user.householdId;
    ctx.user = user;

    return next();
  };
}
```

**Middleware order matters:** Access gate MUST run AFTER db injection but BEFORE all feature handlers. The updated middleware order becomes:

```
1. hydrateReply
2. autoChatAction
3. db injection
4. ACCESS GATE          <-- new
5. callback handlers (grocery, feedback)
6. ONBOARDING ROUTER    <-- new
7. command handlers
8. feedbackTextHandler
9. messageHandler
```

### Pattern 4: Onboarding State Machine

**What:** A stateful flow that guides new users through setup.

**When:** After invite redemption, until onboarding is complete.

**State transitions:**

```
REGISTERED -> PREFERENCES_QA -> TOUR -> SEED_RECIPES -> COMPLETE

States:
  registered:      User just created, onboarding not started
  preferences_qa:  Asking dietary restrictions, household size, dinner time, stores
  tour:            Showing capability overview messages
  seed_recipes:    Offering to save starter recipes
  complete:        Onboarding finished, normal bot operation
```

**Why a state machine, not free-form conversation:** Onboarding needs deterministic progression. If Claude handles onboarding conversationally, it might skip steps, ask questions in random order, or fail to capture required preferences. A state machine guarantees all steps complete. The questions during `preferences_qa` ARE processed by Claude (to handle natural language answers like "I'm allergic to shellfish"), but the flow control (which question comes next) is deterministic.

**Storage:** The onboarding state is stored in the `users` table as an `onboarding_state` column (text enum). This is simpler than a separate table since it is a 1:1 relationship with the user. An additional `onboarding_step` integer tracks progress within a state (e.g., which preference question they are on).

**Interception pattern:** An onboarding middleware checks `ctx.user.onboardingState`. If not "complete", it routes messages to the onboarding handler instead of the normal pipeline.

```typescript
// Onboarding router middleware (inserted before normal handlers)
export function createOnboardingRouter(onboardingHandler: OnboardingHandler) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.user || ctx.user.onboardingState === "complete") {
      return next(); // Normal flow
    }
    // Route to onboarding handler -- this consumes the update
    return onboardingHandler.handle(ctx);
  };
}
```

### Pattern 5: Extended BotContext

**What:** The grammY context object is extended with user and household identity.

```typescript
// src/bot/context.ts (modified)
import type { User } from "../users/types.js";

export type BotContext = ParseModeFlavor<Context & AutoChatActionFlavor> & {
  db: DrizzleDatabase;
  userId?: string;        // Telegram user ID (string)
  householdId?: string;   // Resolved household ID
  user?: User;            // Full user record from DB
};
```

**Why optional fields:** The access gate middleware sets these. Handlers that run before the gate (like the /start command) will not have them set. Making them optional prevents type errors in those cases.

## Data Flow

### Request Flow (After v1.2)

```
1. Telegram update arrives
2. grammY parses update
3. hydrateReply middleware
4. autoChatAction middleware
5. db injection middleware
6. ACCESS GATE:
   - Is this /start? -> PASS THROUGH (allow registration)
   - Is user registered? Look up by ctx.from.id
     - NO -> reply "need invite link", STOP
     - YES -> inject userId, householdId, user into ctx, CONTINUE
7. ONBOARDING ROUTER:
   - Is onboarding complete? Check ctx.user.onboardingState
     - NO -> route to onboarding handler, STOP
     - YES -> CONTINUE
8. Normal handler pipeline (unchanged from v1.1)
   - callback handlers, command handlers, message handler
9. Pipeline processor uses ctx.householdId for shared data queries
```

### Invite Redemption Flow

```
1. Admin calls /invite command in their chat
2. Bot generates token: "INV_" + crypto.randomUUID()
3. Token stored in invite_tokens table with admin's household_id
4. Bot replies with deep link: t.me/HeySousBot?start=INV_xxxx
5. Admin shares link with invitee (via any messaging channel)
6. Invitee clicks link -> Telegram opens chat -> /start INV_xxxx
7. Start handler validates token (exists, not redeemed, not expired)
8. User record created with household assignment
9. Token marked redeemed (redeemed_by, redeemed_at set)
10. Onboarding begins
```

### Onboarding Flow

```
1. User registered (onboarding_state = 'registered')
2. Bot sends welcome + first preference question
3. State -> 'preferences_qa', step 0
4. Q&A loop (deterministic questions, Claude processes answers):
   a. Dietary restrictions?     -> save as preference knowledge item
   b. Household size?           -> save as preference
   c. Usual dinner time?        -> save as preference + update reminder_settings
   d. Preferred grocery stores? -> save as preference
   e. (any additional Qs)
5. State -> 'tour', step 0
6. Bot sends 3-4 capability overview messages:
   a. "I can remember your recipes..."
   b. "I plan weekly meals..."
   c. "I generate grocery lists..."
   d. "I send reminders..."
7. State -> 'seed_recipes', step 0
8. Bot offers starter recipe suggestions based on stated preferences
9. User can save some, skip, or add their own
10. User signals done (or bot detects 5+ recipes saved)
11. State -> 'complete'
12. Normal bot operation begins
```

### Data Ownership Model

```
                    +------------------+
                    |   Household      |
                    |   id: "h_abc"    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
      +-------+-------+            +-------+-------+
      | User A (admin)|            | User B        |
      | telegram: 111 |            | telegram: 222 |
      | household: h_abc           | household: h_abc
      +-------+-------+            +-------+-------+
              |                             |
   PERSONAL DATA:                PERSONAL DATA:
   - messages (chat_id=111)      - messages (chat_id=222)
   - reminder_settings           - reminder_settings
   - token_usage                 - token_usage
   - onboarding_state            - onboarding_state

              SHARED DATA (household_id = h_abc):
              - knowledge_items (recipes, shared preferences)
              - meal_plans
              - grocery_lists
              - cooking_history
              - feedback_checkins (meal feedback)
```

## New Database Schema

### users table

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  household_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  onboarding_state TEXT NOT NULL DEFAULT 'registered'
    CHECK(onboarding_state IN (
      'registered', 'preferences_qa', 'tour', 'seed_recipes', 'complete'
    )),
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### households table

```sql
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,           -- UUID string for non-enumerable IDs
  name TEXT NOT NULL DEFAULT 'My Household',
  created_by TEXT NOT NULL,      -- telegram_id of creator
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### invite_tokens table

```sql
CREATE TABLE IF NOT EXISTS invite_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  household_id TEXT NOT NULL,
  created_by TEXT NOT NULL,      -- telegram_id of admin who created it
  redeemed_by TEXT,              -- telegram_id of user who used it (NULL if unused)
  redeemed_at INTEGER,
  expires_at INTEGER NOT NULL,   -- unix timestamp, default 7 days from creation
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### app_feedback table (distinct from meal feedback_checkins)

```sql
CREATE TABLE IF NOT EXISTS app_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_telegram_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('command', 'button', 'detected', 'checkin')),
  sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative')),
  content TEXT,                  -- free-text feedback
  context_json TEXT,             -- conversation context when auto-detected
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### Migration columns for existing tables

```sql
-- Add household_id to all shared tables
ALTER TABLE knowledge_items ADD COLUMN household_id TEXT;
ALTER TABLE meal_plans ADD COLUMN household_id TEXT;
ALTER TABLE grocery_lists ADD COLUMN household_id TEXT;
ALTER TABLE cooking_history ADD COLUMN household_id TEXT;
ALTER TABLE feedback_checkins ADD COLUMN household_id TEXT;
ALTER TABLE knowledge_changelog ADD COLUMN household_id TEXT;

-- Backfill: for existing single-user data, household_id = chat_id
-- (solo user's Telegram chat_id IS their user ID IS their household)
UPDATE knowledge_items SET household_id = chat_id WHERE household_id IS NULL;
UPDATE meal_plans SET household_id = chat_id WHERE household_id IS NULL;
UPDATE grocery_lists SET household_id = chat_id WHERE household_id IS NULL;
UPDATE cooking_history SET household_id = chat_id WHERE household_id IS NULL;
UPDATE feedback_checkins SET household_id = chat_id WHERE household_id IS NULL;
UPDATE knowledge_changelog SET household_id = chat_id WHERE household_id IS NULL;
```

**Migration strategy:** Follow the existing init.ts pattern (CREATE TABLE IF NOT EXISTS + ALTER TABLE wrapped in try/catch for idempotency). Each domain's init.ts adds the `household_id` column if missing. SQLite's ALTER TABLE ADD COLUMN is safe because it defaults to NULL and the backfill UPDATE sets the value for existing rows.

### FTS5 Impact

The FTS5 virtual table (`knowledge_fts`) uses `content='knowledge_items'` (external content mode). It does NOT store `chat_id` or `household_id` -- it only stores `title`, `summary`, `content`. The filtering happens in the JOIN clause:

```sql
-- Before:
WHERE knowledge_fts MATCH ? AND ki.chat_id = ?

-- After:
WHERE knowledge_fts MATCH ? AND ki.household_id = ?
```

This is a clean migration -- FTS5 structure is unchanged, only WHERE clauses in queries change.

## Scaling Considerations

| Concern | 1 household | 10 households | 100 households |
|---------|-------------|---------------|----------------|
| SQLite file size | < 10 MB | < 100 MB | < 1 GB, still fine |
| FTS5 search speed | Instant | Instant (per-household filter) | Still fast (BM25 + WHERE) |
| Concurrent writes | No issue (WAL mode) | Minimal contention | May need write queue |
| Claude API costs | $1-5/month | $10-50/month | Consider Haiku for onboarding |
| Reminder poller | Iterates all settings | Still fine | Add index on due_at |
| Invite token lookups | Trivial | Trivial | UNIQUE index on token |
| Onboarding load | None after completion | Negligible | Negligible |

**Key insight:** At the scale this project targets (personal use + a few households), SQLite with WAL mode handles everything. The architecture does not need to optimize for thousands of concurrent users.

## Anti-Patterns

### Anti-Pattern 1: Group Chat for Household Sharing

**What:** Using a Telegram group chat to share data between household members.

**Why bad:** Group chats have different Telegram Bot API semantics (different update types, message permissions, admin controls, bot privacy mode). The bot would need to handle group-specific edge cases (members joining/leaving, admin privileges, message visibility). The entire existing per-private-chat architecture would need rewriting.

**Instead:** Each household member uses the bot in their own private chat. Data sharing happens through the `household_id` in the database. Both users see the same recipes, plans, and grocery lists, each in their own private conversation with Sous.

### Anti-Pattern 2: Using grammY Sessions for Onboarding State

**What:** Storing onboarding state in grammY's session middleware (in-memory or external storage adapter).

**Why bad:** grammY sessions are designed for ephemeral per-update state. Onboarding state must survive bot restarts. The codebase already uses SQLite for all persistence. Adding a second persistence layer via grammY sessions creates unnecessary complexity. Sessions would need a storage adapter backed by SQLite anyway, duplicating what a simple column in the users table achieves.

**Instead:** Store `onboarding_state` and `onboarding_step` as columns in the `users` table. The access gate middleware already loads the user record on every request, so onboarding state is available without an additional query.

### Anti-Pattern 3: Big-Bang chatId Rename

**What:** Renaming all `chat_id` columns to `household_id` in one migration.

**Why bad:** This breaks the existing single-user setup during development. If the migration has a bug, all existing data becomes inaccessible. The codebase has many raw SQL queries (not just Drizzle) that reference `chat_id`. A rename requires updating every query simultaneously.

**Instead:** Add `household_id` as a NEW column alongside `chat_id`. Backfill from `chat_id`. Update queries incrementally to use `household_id`. Keep `chat_id` columns until fully migrated and tested. This allows incremental migration and easy rollback.

### Anti-Pattern 4: Making Onboarding Claude-Driven

**What:** Sending the entire onboarding conversation through the normal Claude pipeline and hoping it asks the right questions.

**Why bad:** Claude might skip questions, ask them in random order, go off on tangents ("oh you like Italian food, let me tell you about..."), or fail to extract and save the specific preferences needed. Onboarding needs deterministic completion of all required steps.

**Instead:** Use a state machine for flow control (which question, what order, when to advance). Use Claude only for processing natural language answers within each step (e.g., extracting "shellfish allergy" from "I can't eat shellfish"). The state machine guarantees progress; Claude handles language understanding.

### Anti-Pattern 5: Separate Admin Web App for Feedback Dashboard

**What:** Building a full separate web application for the admin feedback dashboard.

**Why bad:** Overkill for the current scope. The admin is one person. A full web app needs its own auth system, deployment, and maintenance.

**Instead:** Start with a `/feedback-report` bot command for admin users (identified by existing `ADMIN_USER_IDS` config) that sends aggregated feedback stats inline in the chat. If a richer UI is needed later, add a simple Express route at `/admin/feedback` with basic auth, or a Mini App page accessible only to admin users.

## Integration Points

### External Services

| Service | Integration | Notes |
|---------|------------|-------|
| **Telegram Bot API** | Deep links via `t.me/BotName?start=TOKEN` | Well-documented, payload in ctx.match. 64 char limit on start param. |
| **Telegram Bot API** | `ctx.from.id` for user identity | Available on every update in private chats |
| **Anthropic Claude API** | Unchanged | Used in onboarding for answer processing, otherwise same as v1.1 |
| **crypto.randomUUID()** | Invite token generation | Node.js built-in, no external dependency |

### Internal Boundaries

| Boundary | From | To | Interface |
|----------|------|-----|-----------|
| Access gate -> All handlers | middleware | handlers | ctx.user, ctx.householdId set; unregistered users blocked |
| Onboarding router -> Normal flow | middleware | handlers | Intercepts when `onboarding_state !== 'complete'` |
| Start handler -> Invite repo | handler | repository | `redeem(token, telegramId)` -> Invite or null |
| Start handler -> User repo | handler | repository | `create({ telegramId, displayName, householdId })` |
| Start handler -> Onboarding | handler | state machine | `start(ctx, user)` triggers first onboarding message |
| Household resolver -> All repos | middleware/processor | repositories | `householdId` replaces `chatId` in shared data queries |
| Pipeline processor -> Tool handler | processor | tool-handler | `householdId` passed for shared data; `userId` for personal |
| /invite command -> Invite repo | handler | repository | `create(householdId, createdBy)` -> token string |
| /feedback command -> App feedback repo | handler | repository | `create({ userId, householdId, source, content })` |
| Admin routes -> App feedback repo | Express route | repository | `getAll()`, `getStats()` |
| Reminder poller -> User repo | poller | repository | May need household context for shared plan data |
| Mini App auth -> User repo | middleware | repository | Resolve `householdId` from authenticated Telegram user ID |

### Config Changes Needed

```typescript
// No new env vars required for core functionality.
// ADMIN_USER_IDS already exists for admin commands.
// Invite system uses existing BOT_TOKEN for deep link URL construction.

// The bot username is needed for deep link URLs:
// t.me/{BOT_USERNAME}?start=TOKEN
// This can be fetched via bot.api.getMe() at startup.
```

## Build Order (Dependency-Driven)

The features have hard dependencies that constrain build order:

```
Phase 1: Users + Households + Invites + Access Gate
  (everything else depends on user identity existing)
  |
Phase 2: chatId -> householdId Migration
  (repositories, tool handler, pipeline processor, FTS5 queries, Mini App auth)
  |
Phase 3: Onboarding State Machine
  (requires user table, preference tools working with household scope)
  |
Phase 4: App Feedback System
  (requires user identity, independent of onboarding)
```

**Phase 1** is foundational: without user identity and household resolution, nothing else works. It includes the access gate and household resolver middleware because they are needed immediately.

**Phase 2** is the largest but most mechanical phase: systematically updating every repository and query to use `householdId` instead of `chatId` for shared data. It is mostly search-and-replace with careful testing.

**Phase 3** (onboarding) depends on the preference-saving pipeline working with household scope, so it follows Phase 2.

**Phase 4** (app feedback) is the most independent feature. It only needs user identity (Phase 1), not household data migration. It could theoretically be built before Phase 2 or 3, but placing it last avoids context-switching and lets the team focus on the core multi-user flow first.

## Key Design Decisions

### Decision 1: householdId as string (not integer)

Use a string ID (UUID or nanoid) for households. This allows generating household IDs before database insertion (needed for the invite token flow where the household might be created simultaneously). It also prevents enumeration.

### Decision 2: First user auto-migrated, not onboarded

The current admin user (who has been using the bot since v1.0) should NOT go through onboarding. They already have recipes, preferences, and plans. During migration, the system creates a household using the admin's existing chat_id, creates a user record with `onboarding_state = 'complete'`, and backfills `household_id` on all their existing data. Zero disruption.

### Decision 3: Invites always join an existing household

Invites are tied to a specific household. There is no "create a new household" flow for invitees. The admin creates the household (implicitly, by being the first user), then invites others to join it. This significantly simplifies the model.

### Decision 4: Keep both userId and householdId in context

Even after migration, some operations genuinely need the per-user chat ID (messages, token usage, reminder settings). The context carries both `userId` and `householdId`. Repository methods explicitly declare which scope they operate in.

### Decision 5: Preferences stay in knowledge_items

User preferences are currently stored as knowledge_items tagged with "preference". This pattern works for household sharing because:
- Shared preferences (store prefs, household size) are tagged `subject:household` and scoped to `household_id`
- Personal preferences (dietary restrictions) are tagged `subject:self` and the agent knows they belong to a specific person
- No schema change needed for preferences -- the existing tag taxonomy handles the distinction

### Decision 6: Admin dashboard starts as a bot command

Rather than building a web UI for the feedback dashboard immediately, start with a `/feedback-report` command that admin users can run in their chat. This leverages existing infrastructure (bot commands, admin user ID check) and avoids building auth for a web dashboard. A Mini App or web page can be added later if needed.

## Sources

- grammY deep linking: verified in `node_modules/grammy/out/composer.d.ts` lines 228-237 -- `ctx.match` receives the deep link payload from `/start` commands
- grammY session middleware: verified in `node_modules/grammy/out/convenience/session.d.ts` -- `getSessionKey` defaults to `ctx.chatId`, supports custom key functions
- grammY middleware pipeline: verified in existing `src/bot/index.ts` -- middleware order is explicit and deterministic
- Existing codebase patterns: all factory functions, init.ts migration patterns, repository patterns verified by reading all source files
- SQLite ALTER TABLE ADD COLUMN: standard SQLite feature, safe for incremental migration (new column defaults to NULL)
- Telegram deep link format: `t.me/BotName?start=PAYLOAD` with 64-character limit -- well-established stable API (MEDIUM confidence, from training data, not verified against current docs but unchanged for 5+ years)
- Telegram `ctx.from.id` availability: standard in private chats, verified by existing usage in `src/bot/handlers/message.ts` line 28

---
*Architecture research for: Multi-user Telegram bot with household sharing, invite system, onboarding, and feedback*
*Researched: 2026-02-10*
