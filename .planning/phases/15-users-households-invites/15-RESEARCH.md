# Phase 15: Users, Households, and Invites - Research

**Researched:** 2026-02-10
**Domain:** Invite-gated access control, persistent user identity, household grouping, Drizzle migration
**Confidence:** HIGH

## Summary

Phase 15 establishes the multi-user foundation for HeySous: a `users` table, `households` table, `invite_tokens` table, an access gate middleware, and a modified `/start` handler that processes deep link invite tokens. The existing single-user bot becomes invite-gated: only registered users (those who redeemed an invite or the seeded admin) can interact with it. This phase does NOT migrate existing data from `chatId` to `householdId` (that is Phase 16's scope), but it creates the identity infrastructure that Phase 16 depends on.

The implementation requires zero new npm dependencies. Invite tokens use Node.js built-in `crypto.randomBytes(24).toString('base64url')` (32 chars, well within Telegram's 64-character deep link limit). grammY's `ctx.match` natively provides the deep link payload. The DB tables follow the existing init.ts pattern (raw SQL `CREATE TABLE IF NOT EXISTS` via better-sqlite3). The admin seeding and household creation happen in a single migration function that runs at startup, before the bot accepts messages.

The critical risk is the existing user getting locked out. The migration MUST seed the current admin user (identified by `ADMIN_USER_IDS[0]` env var) into the users table with `onboarding_state = 'complete'`, and create their household-of-one, BEFORE the access gate middleware starts rejecting unregistered users. The second risk is the `/start` handler, which must correctly handle four distinct scenarios: existing user (no token), existing user (with token), new user (valid token), and new user (no/invalid token).

**Primary recommendation:** Build the three tables, the access gate middleware, and the modified /start handler as a tight unit. Seed the existing admin at startup via the same init function that creates the tables. Gate the entire bot except /start behind the access check. Keep chatId-based data queries unchanged (Phase 16 scope).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Invite flow
- `/invite` accepts optional inline flags (e.g., `/invite independent`, `/invite household:3`) but works with sensible defaults (join admin's household)
- Invited user receives a warm Claude greeting with personality -- "Hey! Welcome to HeySous..." introducing the bot conversationally
- Admin is notified when someone redeems an invite ("Sarah just joined your household")
- Generic rejection for invalid/expired/used invite links: "This invite link is no longer valid. Ask for a new one!" -- no specific reason disclosed

#### Household model
- "Independent" users are just a household of one -- same data model, they could invite others later
- Households are auto-named from member names (e.g., "John & Sarah's household") -- no manual naming needed
- One global admin (the bot owner), identified by `ADMIN_USER_ID` in config -- NOT per-household admins
- Admin creates all invites and chooses which household the invited person joins (existing household or new solo one)

#### Access gate
- Friendly rejection for uninvited users: "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!"
- Gate check cached after first verification per session -- not checked on every single message
- No admin notifications for failed access attempts or invalid invite usage -- rejections happen quietly

#### Admin & permissions
- Single global admin identified by `ADMIN_USER_ID` environment variable (survives DB resets)
- No `/users` listing command in this phase -- can check DB directly if needed
- No user removal capability in this phase -- future feature
- All DB schema changes and admin/household seeding handled by structured Drizzle migrations, completely outside bot runtime

### Claude's Discretion

- Invite link expiry policy (single-use with or without time limit)
- Exact greeting message copy and personality
- Session cache implementation for gate checks
- How `/invite` flags are parsed and validated

### Deferred Ideas (OUT OF SCOPE)

- `/users` admin command to list all users and households -- future phase
- `/removeuser` to revoke access -- future phase
- User self-service (leaving a household, managing own profile) -- future phase
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammY | ^1.39.3 | Bot framework, `ctx.match` deep link payload, middleware pipeline | Already in use; `ctx.match` natively extracts `/start` payload |
| better-sqlite3 | ^12.6.2 | Raw SQL for table creation, migration scripts | Existing init.ts pattern uses raw SQL, not Drizzle push |
| drizzle-orm | ^0.45.1 | Schema definitions for new tables, typed queries | Existing pattern; schema.ts defines columns, init.ts creates tables |
| Node.js crypto | built-in | `crypto.randomBytes(24).toString('base64url')` for invite tokens | Zero dependencies, 192-bit entropy, 32-char output |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.0 | Logging invite creation, redemption, access gate rejections | Already in use for all logging |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crypto.randomBytes | nanoid or uuid | Adds a dependency for no gain; built-in crypto is sufficient |
| Raw SQL init.ts | drizzle-kit push | Drizzle push may trigger table rebuilds; raw SQL is explicit and safe |
| In-memory gate cache | grammY sessions plugin | Sessions add complexity; a simple Map with TTL is lighter |

**Installation:**
```bash
# No new packages needed -- all existing dependencies
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  users/                      # NEW module
    schema.ts                 # Drizzle schema: users, households tables
    init.ts                   # CREATE TABLE IF NOT EXISTS + admin seed
    repository.ts             # CRUD: getByTelegramId, create, updateName, getHouseholdMembers
    types.ts                  # User, Household interfaces
  invites/                    # NEW module
    init.ts                   # CREATE TABLE IF NOT EXISTS for invite_tokens
    repository.ts             # create, redeem, validate, getByToken
    deep-link.ts              # Generate t.me/BotName?start=TOKEN URLs
    types.ts                  # InviteToken interface
  bot/
    context.ts                # MODIFIED: add userId, householdId, user fields
    middlewares/
      access-gate.ts          # NEW: block unregistered users
    handlers/
      start.ts                # MODIFIED: handle invite deep links + registration
      invite.ts               # NEW: /invite command for admin
```

### Pattern 1: Table Initialization with Admin Seeding

**What:** Create users/households/invites tables at startup and seed the existing admin.
**When to use:** During `createDatabase()` flow, before bot starts.

```typescript
// Source: Follows existing init.ts pattern (grocery/init.ts, reminders/init.ts, feedback/init.ts)
export function initializeUsers(sqlite: BetterSqlite3.Database, adminUserId: string): void {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'My Household',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      username TEXT,
      household_id TEXT NOT NULL REFERENCES households(id),
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      onboarding_state TEXT NOT NULL DEFAULT 'registered'
        CHECK(onboarding_state IN ('registered', 'complete')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Seed admin if ADMIN_USER_ID is set and user doesn't exist yet
  if (adminUserId) {
    const existing = sqlite.prepare(
      `SELECT id FROM users WHERE telegram_id = ?`
    ).get(adminUserId);

    if (!existing) {
      // Create household using admin's telegram_id as household_id
      // This ensures existing chatId-based data will match when Phase 16 migrates
      sqlite.prepare(
        `INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)`
      ).run(adminUserId, 'My Household', adminUserId);

      sqlite.prepare(
        `INSERT INTO users (telegram_id, display_name, household_id, role, onboarding_state)
         VALUES (?, ?, ?, 'admin', 'complete')`
      ).run(adminUserId, 'Admin', adminUserId);
    }
  }
}
```

### Pattern 2: Access Gate Middleware with Session Cache

**What:** A middleware that blocks unregistered users, caches the result per session.
**When to use:** Runs after db injection, before all feature handlers.

```typescript
// Source: Follows existing middleware pattern in src/bot/index.ts
export function createAccessGate(deps: { sqlite: BetterSqlite3.Database }) {
  // Simple in-memory cache: telegramId -> User (cleared on bot restart)
  const userCache = new Map<string, User>();

  return async (ctx: BotContext, next: () => Promise<void>) => {
    // Always allow /start command (registration entry point)
    if (ctx.message?.text?.startsWith("/start")) {
      return next();
    }

    const telegramId = String(ctx.from?.id ?? "");
    if (!telegramId) return;

    // Check cache first
    let user = userCache.get(telegramId);
    if (!user) {
      // DB lookup
      user = getUserByTelegramId(deps.sqlite, telegramId);
      if (user) {
        userCache.set(telegramId, user);
      }
    }

    if (!user) {
      await ctx.reply(
        "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!"
      );
      return; // Block
    }

    // Inject identity into context
    ctx.userId = user.telegramId;
    ctx.householdId = user.householdId;
    ctx.user = user;

    return next();
  };
}
```

### Pattern 3: Deep Link Invite Handling in /start

**What:** The /start handler checks `ctx.match` for an invite token payload.
**When to use:** Replaces the existing simple /start greeting.

```typescript
// Source: grammY docs (verified in node_modules/grammy/out/composer.d.ts lines 226-237)
startHandler.command("start", async (ctx) => {
  const inviteToken = ctx.match; // Deep link payload, e.g. "abc123..."
  const telegramId = String(ctx.from!.id);

  // Check if user already exists
  const existingUser = getUserByTelegramId(sqlite, telegramId);

  if (existingUser) {
    // Existing user -- welcome back (ignore any invite token)
    await ctx.reply("Welcome back! What can I help you with?");
    return;
  }

  // New user without token -- reject
  if (!inviteToken) {
    await ctx.reply(
      "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!"
    );
    return;
  }

  // New user with token -- validate and redeem
  const invite = getAndRedeemToken(sqlite, inviteToken, telegramId);
  if (!invite) {
    await ctx.reply(
      "This invite link is no longer valid. Ask for a new one!"
    );
    return;
  }

  // Create user record
  const displayName = ctx.from!.first_name;
  createUser(sqlite, {
    telegramId,
    displayName,
    username: ctx.from!.username ?? null,
    householdId: invite.householdId,
    role: "member",
    onboardingState: "complete", // Phase 17 will change this to "registered"
  });

  // Update household name from member names
  updateHouseholdName(sqlite, invite.householdId);

  // Warm greeting
  await ctx.reply(
    `Hey ${displayName}! Welcome to HeySous! I'm your meal planning assistant. ` +
    `I remember recipes, plan weekly meals, build grocery lists, and send prep reminders. ` +
    `Go ahead and tell me about a recipe you love, or ask me to plan your week!`
  );

  // Notify admin
  const admin = getAdmin(sqlite);
  if (admin && admin.telegramId !== telegramId) {
    await ctx.api.sendMessage(
      admin.telegramId,
      `${displayName} just joined your household!`
    );
  }
});
```

### Pattern 4: /invite Command with Flag Parsing

**What:** Admin command to generate invite links with optional flags.
**When to use:** Admin runs `/invite`, `/invite independent`, or `/invite household:3`.

```typescript
// Source: Follows existing command handler factory pattern (createCostsHandler, etc.)
export function createInviteHandler(deps: InviteHandlerDeps): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("invite", async (ctx) => {
    // Admin check using ctx.user (set by access gate)
    if (ctx.user?.role !== "admin") return;

    const args = (ctx.match ?? "").trim();

    // Parse flags
    let targetHouseholdId: string;
    if (args === "independent") {
      // Create a new solo household for the invitee
      targetHouseholdId = crypto.randomUUID();
      createHousehold(deps.sqlite, {
        id: targetHouseholdId,
        name: "New Household",
        createdBy: ctx.user.telegramId,
      });
    } else if (args.startsWith("household:")) {
      // Join a specific household by ID
      const householdId = args.slice("household:".length);
      const household = getHouseholdById(deps.sqlite, householdId);
      if (!household) {
        await ctx.reply("Household not found.");
        return;
      }
      targetHouseholdId = householdId;
    } else {
      // Default: join admin's household
      targetHouseholdId = ctx.user.householdId;
    }

    // Generate token
    const token = crypto.randomBytes(24).toString("base64url");
    createInviteToken(deps.sqlite, {
      token,
      householdId: targetHouseholdId,
      createdBy: ctx.user.telegramId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Build deep link URL
    const botUsername = deps.botUsername; // from bot.botInfo.username
    const url = `https://t.me/${botUsername}?start=${token}`;

    await ctx.reply(
      `Invite link (expires in 7 days, single use):\n\n${url}\n\n` +
      `Share this with the person you want to invite.`
    );
  });

  return handler;
}
```

### Pattern 5: Extended BotContext

**What:** Add user identity fields to the grammY context type.

```typescript
// Source: Existing src/bot/context.ts pattern
import type { User } from "../users/types.js";

export type BotContext = ParseModeFlavor<Context & AutoChatActionFlavor> & {
  db: DrizzleDatabase;
  userId?: string;        // Telegram user ID (set by access gate)
  householdId?: string;   // Resolved household ID (set by access gate)
  user?: User;            // Full user record (set by access gate)
};
```

### Anti-Patterns to Avoid

- **Using grammY sessions for user state:** The codebase uses SQLite for all persistence. Do not introduce the sessions plugin for tracking user identity -- the access gate middleware and DB lookup handle this.
- **Two separate /start handlers:** Do not create a second Composer for invite handling. The existing startHandler must be modified to handle all four /start scenarios in a single handler.
- **Storing the household ID in the invite token itself:** The token must be an opaque random string. The household association is stored in the DB, not encoded in the token. This prevents enumeration attacks.
- **Using drizzle-kit push for table creation:** The existing pattern uses raw SQL in init.ts files. Stay consistent; drizzle-kit push may trigger unexpected table rebuilds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random token generation | Custom token generator | `crypto.randomBytes(24).toString('base64url')` | Built-in, cryptographically secure, URL-safe, 32 chars |
| Deep link URL construction | Custom URL builder | Template literal with `bot.botInfo.username` | grammY provides the username; Telegram format is fixed |
| Deep link payload extraction | Manual text parsing | `ctx.match` from grammY `bot.command("start")` | grammY automatically extracts the payload after `/start ` |
| Admin check | Custom admin middleware | Check `ctx.user?.role === 'admin'` (set by access gate) | The access gate already loads the user; just check the role field |

**Key insight:** grammY handles deep link mechanics natively. The invite system is fundamentally a database CRUD problem, not a Telegram API problem.

## Common Pitfalls

### Pitfall 1: Existing Admin User Locked Out After Deploy

**What goes wrong:** The access gate middleware rejects all unregistered users. If the admin seed fails or runs after the bot starts accepting messages, the existing admin cannot interact with the bot.
**Why it happens:** The init function that creates tables and seeds the admin runs in `createDatabase()`. If the admin's Telegram ID is not provided (missing env var) or the seed INSERT fails silently, the users table is empty.
**How to avoid:** Make the admin seed a hard requirement. If `ADMIN_USER_ID` is not set and the users table is empty, throw a startup error. Run the seed in the same function that creates the tables. Verify with a `SELECT COUNT(*) FROM users WHERE role = 'admin'` check after seeding.
**Warning signs:** After deploying Phase 15, the admin sends a message and gets "I'm an invite-only bot."

### Pitfall 2: /start Handler Does Not Distinguish Four Scenarios

**What goes wrong:** The handler either (a) always requires a token (locks out returning existing users), (b) always allows access (bypasses the gate), (c) creates duplicate user records for existing users clicking an invite link, or (d) lets the old greeting slip through for new users with a token.
**Why it happens:** The /start command is overloaded: it handles both deep link entry and normal bot start. Four distinct scenarios exist: existing user (no token), existing user (with token), new user (valid token), new user (no/invalid token). Missing any branch causes a regression.
**How to avoid:** Write the handler as an explicit 4-way branch. First check: does user exist in DB? Second check: is there a token? Test all four paths.
**Warning signs:** Returning user sees onboarding flow; new user with valid invite sees the rejection message.

### Pitfall 3: Gate Check on Every Single Message Causes DB Thrashing

**What goes wrong:** Without caching, every message, callback query, and inline query triggers a `SELECT * FROM users WHERE telegram_id = ?` lookup. For a single user sending 10 messages a day, this is negligible. But it adds latency to every interaction.
**Why it happens:** The simplest access gate implementation queries the DB on every update.
**How to avoid:** Use an in-memory `Map<telegramId, User>` cache with the entire user record. The cache is populated on first access and lives for the bot's process lifetime (cleared on restart, which re-populates from DB). New user registrations add to the cache immediately.
**Warning signs:** Noticeable latency on every message; high SQLite read volume in logs.

### Pitfall 4: Invite Token Characters Incompatible with Telegram Deep Links

**What goes wrong:** The generated token contains characters not allowed in the Telegram start parameter. Telegram silently strips invalid characters, causing the token to not match the DB record.
**Why it happens:** Telegram's `/start` parameter allows only `A-Z, a-z, 0-9, _ and -`, max 64 characters. If using `base64url` encoding (which uses A-Z, a-z, 0-9, -, _), this is safe. But `base64` encoding (with + and /) would fail.
**How to avoid:** Use `crypto.randomBytes(24).toString('base64url')` -- base64url is safe. Output is 32 characters. Verify the regex `/^[A-Za-z0-9_-]+$/` matches the generated token.
**Warning signs:** Invite links generate correctly but when clicked, `ctx.match` contains a truncated or mangled token.

### Pitfall 5: Household Auto-Naming Race Condition

**What goes wrong:** The household name is auto-generated from member names (e.g., "John & Sarah's household"). If the name update happens before the new user's display name is saved, the name generation sees incomplete data.
**How to avoid:** Update the household name AFTER inserting the new user record. Use a synchronous sequence: insert user, then query all members, then update household name.
**Warning signs:** Household named "Admin's household" even after a second member joins.

### Pitfall 6: Config Mismatch -- ADMIN_USER_ID vs ADMIN_USER_IDS

**What goes wrong:** The CONTEXT.md specifies `ADMIN_USER_ID` (singular), but the existing config has `ADMIN_USER_IDS` (plural, comma-separated). If a new env var is created, existing deployments break. If the plural is reused, the semantics change (first element is the global admin).
**Why it happens:** The existing `adminUserIds` array is used for the /costs command. Phase 15 needs a single global admin concept.
**How to avoid:** Reuse the existing `ADMIN_USER_IDS` config. The first entry is the global admin. Add a computed `config.adminUserId` property (singular) that returns `adminUserIds[0]`. This maintains backward compatibility.
**Warning signs:** Admin seeding fails because the env var name is wrong.

## Code Examples

Verified patterns from the codebase and grammY source:

### Deep Link Payload Extraction (grammY)

```typescript
// Source: grammy/out/composer.d.ts lines 226-237
// When user clicks t.me/BotName?start=PAYLOAD, Telegram sends /start PAYLOAD
// grammY provides the payload in ctx.match

bot.command("start", async (ctx) => {
  const payload = ctx.match; // type: string, e.g. "abc123..."
  // Empty string if no payload (bare /start)
  if (payload) {
    // User clicked a deep link
  }
});
```

### Bot Username for Deep Link URL

```typescript
// Source: grammy/out/bot.d.ts, @grammyjs/types/manage.d.ts
// UserFromGetMe guarantees username: string (non-optional for bots)

// After bot.init() or bot.start(), bot.botInfo is populated
const botUsername = bot.botInfo.username; // guaranteed string
const deepLink = `https://t.me/${botUsername}?start=${token}`;
```

### Token Generation (Node.js Crypto)

```typescript
// Source: Node.js built-in crypto module
import { randomBytes } from "node:crypto";

const token = randomBytes(24).toString("base64url");
// Output: 32-character URL-safe string, e.g. "epsIV5lZ-3TyCcAFwCW85hAXUgFIcMd3"
// Allowed chars: A-Z, a-z, 0-9, -, _ (matches Telegram start param requirements)
// 192-bit entropy -- collision probability negligible at household scale
```

### Existing Init Pattern (Raw SQL)

```typescript
// Source: src/grocery/init.ts, src/reminders/init.ts, src/feedback/init.ts
// All existing table creation uses raw SQL via better-sqlite3
export function initializeXxx(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS table_name (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ...columns...
    )
  `);
}
```

### Existing Admin Check Pattern

```typescript
// Source: src/bot/handlers/costs.ts lines 26-31
const numericId = String(ctx.from?.id ?? "");
const username = ctx.from?.username ?? "";
const isAdmin = config.adminUserIds.some(
  (adminId) => adminId === numericId ||
  (username && adminId.toLowerCase() === username.toLowerCase())
);
```

### Middleware Order (Existing Pattern)

```typescript
// Source: src/bot/index.ts lines 57-79
// Middleware runs in registration order. Access gate must go AFTER db injection
// but BEFORE all feature handlers.

bot.use(hydrateReply);
bot.use(autoChatAction());
bot.use(dbInjection);
// NEW: access gate goes here
bot.use(accessGate);        // <-- blocks unregistered users
bot.use(groceryCallbackHandler);
bot.use(feedbackCallbackHandler);
bot.use(startHandler);      // <-- handles /start with invite tokens
bot.use(inviteHandler);     // <-- NEW: /invite command for admin
bot.use(costsHandler);
// ... rest of handlers
bot.use(messageHandler);    // catch-all MUST be last
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chatId` as sole identity key | `chatId` + new `userId` and `householdId` in context | Phase 15 | Context carries both; data queries still use chatId until Phase 16 |
| No access control (open bot) | Invite-gated access with access gate middleware | Phase 15 | Only registered users can interact |
| Simple /start greeting | /start with deep link token processing | Phase 15 | Entry point for invite redemption flow |
| `ADMIN_USER_IDS` for /costs only | `ADMIN_USER_IDS[0]` as global admin, seeded in DB | Phase 15 | Admin role persists in DB, env var used for seeding |

**Deprecated/outdated:**
- The simple startHandler (plain greeting) is replaced with invite-aware handler
- Open access (any Telegram user can interact) is replaced with invite gating

## Database Schema Design

### households table

```sql
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,              -- admin's telegram_id for initial household; UUID for new ones
  name TEXT NOT NULL DEFAULT 'My Household',
  created_by TEXT NOT NULL,         -- telegram_id of creator
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Design note:** The initial admin's household ID equals their `telegram_id` value. This is deliberate -- it means that when Phase 16 adds `household_id` columns to shared tables and backfills with `household_id = chat_id`, the existing admin's data will automatically belong to their household (since in private chats, `chat_id == telegram_user_id`). New households created via `/invite independent` use `crypto.randomUUID()`.

### users table

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,       -- from ctx.from.first_name
  username TEXT,                    -- from ctx.from.username (optional)
  household_id TEXT NOT NULL REFERENCES households(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  onboarding_state TEXT NOT NULL DEFAULT 'registered'
    CHECK(onboarding_state IN ('registered', 'complete')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Design note:** `onboarding_state` has only two values in Phase 15 ('registered' and 'complete'). Phase 17 (Guided Onboarding) will add intermediate states via a migration that recreates the CHECK constraint (following the existing pattern in `reminders/init.ts` lines 40-61). The admin is seeded with `onboarding_state = 'complete'`.

### invite_tokens table

```sql
CREATE TABLE IF NOT EXISTS invite_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  household_id TEXT NOT NULL REFERENCES households(id),
  invite_type TEXT NOT NULL DEFAULT 'household' CHECK(invite_type IN ('household', 'independent')),
  created_by TEXT NOT NULL,         -- telegram_id of admin
  redeemed_by TEXT,                 -- telegram_id of user who redeemed (NULL if unused)
  redeemed_at INTEGER,              -- unix timestamp
  expires_at INTEGER NOT NULL,      -- unix timestamp, default 7 days from creation
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### Household Auto-Naming Logic

```typescript
// Auto-name from member names: "John & Sarah's household"
function generateHouseholdName(members: { displayName: string }[]): string {
  if (members.length === 0) return "My Household";
  if (members.length === 1) return `${members[0].displayName}'s household`;
  if (members.length === 2) {
    return `${members[0].displayName} & ${members[1].displayName}'s household`;
  }
  // 3+: "John, Sarah & Mike's household"
  const allButLast = members.slice(0, -1).map(m => m.displayName).join(", ");
  return `${allButLast} & ${members[members.length - 1].displayName}'s household`;
}
```

## Discretion Recommendations

### Invite Link Expiry Policy

**Recommendation:** Single-use tokens with 7-day expiry.

- Each token can be redeemed exactly once. After redemption, `redeemed_by` and `redeemed_at` are set, and the token is no longer valid.
- Tokens expire 7 days after creation (`expires_at` column). This gives enough time for the admin to share the link and the invitee to click it, while preventing stale links from floating around indefinitely.
- No time limit after a token is unredeemed -- 7 days is generous for a personal invite.
- The validation check is: `WHERE token = ? AND redeemed_by IS NULL AND expires_at > unixepoch()`.

### Session Cache Implementation for Gate Checks

**Recommendation:** Simple `Map<string, User>` in the access gate closure.

- Populated on first lookup per user, persists for bot process lifetime.
- Cleared on bot restart (re-populated from DB on next message).
- New user registrations (via /start invite) add to the cache immediately after DB insert.
- No TTL needed -- user records change infrequently (only display name updates). If a user is somehow removed from the DB (future feature), the stale cache entry is harmless until restart.
- This is simpler and faster than a TTL-based cache and aligns with the "gate check cached after first verification per session" decision.

### /invite Flag Parsing

**Recommendation:** Simple string matching, not a CLI argument parser.

- `/invite` (no args) -> join admin's household (default)
- `/invite independent` -> create a new solo household for invitee
- `/invite household:HOUSEHOLD_ID` -> join a specific existing household
- Any unrecognized flag -> show usage help: "Usage: /invite, /invite independent, or /invite household:ID"
- This is simple, discoverable, and matches the `/invite independent` example from CONTEXT.md.

## Open Questions

1. **What happens if the admin user interacts with the bot BEFORE Phase 15 tables are created?**
   - What we know: The admin is seeded during `initializeUsers()` which runs in `createDatabase()` at startup. As long as the init runs before the bot starts accepting messages, there is no gap.
   - What's unclear: If the bot is already running and a deploy adds Phase 15 code, there is a brief window where the access gate is active but the users table might not have the admin seeded (depends on startup order).
   - Recommendation: The init function runs synchronously in `createDatabase()` (same as all other init functions). The bot does not accept messages until after `createDatabase()` completes. This is already the existing pattern -- no gap.

2. **Should the access gate allow callback queries from unregistered users?**
   - What we know: The grocery and feedback callback handlers process inline button clicks. If an unregistered user somehow has a message with inline buttons (unlikely, but possible if they were interacting before the gate was added), their callback would be blocked.
   - What's unclear: Whether blocking callbacks for unregistered users causes silent errors or visible error messages.
   - Recommendation: Block all updates (messages, callbacks, inline queries) for unregistered users except /start. This is simpler and more secure. If a callback is blocked, the user sees no response -- which is fine since they should not have gotten the buttons in the first place.

3. **How does `bot.botInfo.username` get populated for deep link URLs?**
   - What we know: grammY automatically calls `getMe()` during `bot.start()` or `bot.init()`. After that, `bot.botInfo.username` is available. The invite handler needs this value to construct `t.me/BotUsername?start=TOKEN` URLs.
   - What's unclear: In webhook mode, does `bot.botInfo` get populated before handlers are registered?
   - Recommendation: Call `await bot.init()` explicitly after `new Bot()` and before registering handlers, or pass the bot username into the invite handler factory. The existing codebase does not call `bot.init()` explicitly -- it relies on `bot.start()` in polling mode and `setWebhook()` in webhook mode. For webhook mode, the bot username should be fetched via `await bot.api.getMe()` at startup and stored in config or passed to the invite handler. The simplest approach: pass `bot.botInfo.username` (available after `bot.init()`) to the invite handler.

## Sources

### Primary (HIGH confidence)
- **grammY deep link support** -- `/workspace/node_modules/grammy/out/composer.d.ts` lines 226-237: `ctx.match` provides deep link payload. Confirmed `UserFromGetMe.username` is `string` (non-optional) at `/workspace/node_modules/@grammyjs/types/manage.d.ts` line 60.
- **Telegram deep link spec** -- [core.telegram.org/bots/features#deep-linking](https://core.telegram.org/bots/features#deep-linking): 64-character limit, `A-Z, a-z, 0-9, _, -` allowed, base64url recommended.
- **Node.js crypto** -- `crypto.randomBytes(24).toString('base64url')` tested in workspace: produces 32-character URL-safe string (verified).
- **Existing codebase patterns** -- init.ts (grocery, reminders, feedback), admin check (costs handler), middleware order (bot/index.ts), context type (bot/context.ts), config (config.ts with ADMIN_USER_IDS) -- all verified by direct file reads.
- **SQLite ALTER TABLE** -- `ADD COLUMN` is safe, does not trigger table rebuild, FTS5 triggers survive (from existing pitfalls research and SQLite documentation).

### Secondary (MEDIUM confidence)
- **Household auto-naming** -- Pattern derived from user decision ("auto-named from member names"). Implementation approach is straightforward string concatenation.
- **Cache implementation** -- Simple `Map<string, User>` with no TTL. Pattern is common in Node.js middleware. No specific external source.

### Tertiary (LOW confidence)
- **bot.botInfo availability in webhook mode** -- Training data suggests `bot.init()` must be called explicitly in webhook mode for `botInfo` to be populated. Should be verified at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing patterns verified in codebase
- Architecture: HIGH -- follows all existing patterns (init.ts, factory functions, middleware pipeline, Composer handlers)
- Schema design: HIGH -- follows existing table patterns (raw SQL, INTEGER timestamps, TEXT enums with CHECK), household_id = admin's telegram_id deliberate for Phase 16 compat
- Pitfalls: HIGH -- all based on direct codebase analysis and verified grammY/Telegram behavior
- Discretion recommendations: MEDIUM -- reasonable defaults based on research, but preferences (expiry period, cache strategy) are subjective

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain -- Telegram Bot API deep linking and grammY patterns are mature)
