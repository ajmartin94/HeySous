# Stack Research: Multi-User, Invites, Onboarding, Feedback

**Domain:** Multi-user Telegram bot with invite-gated access, household sharing, onboarding, and feedback
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

The existing stack (Node.js 22, grammY, better-sqlite3/Drizzle, Express, React+Vite Mini App) requires **zero new npm dependencies** for this milestone. All four feature areas -- invite system, multi-user identity, onboarding flow, and app feedback system -- can be built entirely with existing packages plus Node.js built-ins.

This is deliberate. The project already has all the primitives:
- **Deep link tokens:** grammY `ctx.match` on `/start` command provides deep link payloads natively
- **Token generation:** Node.js 22 `crypto.randomBytes()` with `base64url` encoding (no nanoid/uuid needed)
- **Session/onboarding state:** SQLite table (project pattern) beats grammY session middleware for persistence across restarts
- **Admin dashboard:** Existing Express + React Mini App infrastructure handles new routes/pages
- **Feedback system:** Existing `feedback_checkins` table and patterns extend naturally

The work is **schema design + data migration + code restructuring**, not technology adoption.

---

## Recommended Stack

### Core Technologies (EXISTING -- no changes)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Node.js | 22.x | Runtime | Already installed |
| TypeScript | ^5.9.3 | Type safety | Already installed |
| grammY | ^1.39.3 | Telegram Bot API | Already installed |
| better-sqlite3 | ^12.6.2 | SQLite driver | Already installed |
| drizzle-orm | ^0.45.1 | ORM (schema definition, typed queries) | Already installed |
| Express | ^5.2.1 | HTTP server, API routes | Already installed |
| React | ^19.2.4 | Mini App UI | Already installed |
| Vite | ^7.3.1 | Mini App bundler | Already installed |
| @tma.js/init-data-node | ^2.0.6 | initData HMAC-SHA256 validation | Already installed |
| @tma.js/sdk-react | ^3.0.15 | Mini App SDK (client-side) | Already installed |
| Anthropic SDK | ^0.73.0 | Claude API | Already installed |
| Pino | ^10.3.0 | Logging | Already installed |

### Supporting Libraries (EXISTING -- no additions needed)

| Library | Version | New Usage | Why Sufficient |
|---------|---------|-----------|----------------|
| `node:crypto` | Built-in | Invite token generation | `randomBytes(16).toString('base64url')` generates 22-char URL-safe tokens. No external dependency needed. |
| grammY core | ^1.39.3 | Deep link parsing via `ctx.match` | `bot.command('start', ctx => ctx.match)` provides the `/start TOKEN` payload natively. Documented in grammY composer. |
| react-router-dom | ^7.13.0 | Admin dashboard + onboarding Mini App routes | Already supports nested routes and layout patterns needed. |
| @telegram-apps/telegram-ui | ^2.1.13 | Onboarding UI components, feedback forms | Existing component library covers buttons, inputs, cells, modals. |
| lucide-react | ^0.563.0 | Icons for onboarding steps, feedback UI | Already installed. |
| vitest | ^4.0.18 | Testing invite token logic, migration scripts | Already installed. |

### Development Tools (EXISTING -- no additions needed)

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit ^0.31.8 | Schema generation | Schema-only; project uses raw `CREATE TABLE IF NOT EXISTS` for init |
| vitest ^4.0.18 | Testing | Covers unit tests for new token/invite logic |
| tsx ^4.21.0 | Dev mode runner | No changes needed |

---

## Installation

```bash
# No new packages to install.
# All features are built with the existing stack.

# If starting fresh, the existing install commands cover everything:
npm install
cd mini-app && npm install
```

---

## Stack Patterns for Each Feature Area

### 1. Invite System (Deep Link Tokens)

**How it works (no new packages):**

```
Telegram deep link URL: https://t.me/BotUsername?start=INVITE_TOKEN
User clicks link -> opens bot -> /start command fires
grammY: ctx.match === "INVITE_TOKEN"
```

**Key grammY mechanism (verified from source):**
- `bot.command('start', ctx => { ... })` -- the `ctx.match` property contains everything after `/start `
- This is a `string` type (from `composer.d.ts` line 233: "you will receive `custom-payload` in the `ctx.match` property")
- Telegram deep link `start` parameter limit: 64 characters (A-Z, a-z, 0-9, _, -)
- `base64url` encoding uses only URL-safe chars (A-Z, a-z, 0-9, -, _) -- fits perfectly

**Token generation pattern:**
```typescript
import { randomBytes } from "node:crypto";

function generateInviteToken(): string {
  // 16 bytes -> 22 chars base64url, well under 64-char Telegram limit
  return randomBytes(16).toString("base64url");
}
```

**Token storage:** SQLite table `invite_tokens` with columns: `token`, `household_id`, `created_by_user_id`, `expires_at`, `used_by_user_id`, `used_at`.

**Confidence:** HIGH -- verified `ctx.match` behavior from grammY source code (`composer.d.ts` lines 226-237), verified `base64url` encoding from Node.js 22 runtime test.

### 2. Multi-User Identity & Household Data Model

**Current state:** All tables use `chat_id TEXT NOT NULL` as the partition key. `chat_id` is `String(ctx.chat.id)` which in private chats equals the user's Telegram ID.

**Required change:** Introduce `users` and `households` tables. Migrate existing data partition key from `chat_id` to `household_id` across ALL domain tables.

**New tables (using existing `CREATE TABLE IF NOT EXISTS` pattern):**

```sql
-- Core identity tables
users:         id, telegram_id (UNIQUE), household_id (FK), display_name, role, onboarding_status, created_at
households:    id, name, created_by_user_id, created_at
invite_tokens: id, token (UNIQUE), household_id, created_by_user_id, max_uses, use_count, expires_at, created_at
```

**Migration strategy for existing `chat_id` columns:**
- Add `household_id` column to all domain tables (knowledge_items, meal_plans, grocery_lists, reminders, etc.)
- For existing single-user data: create a household per existing `chat_id`, create a user row, set `household_id`
- Uses `ALTER TABLE ADD COLUMN` with `IF NOT EXISTS` pattern (SQLite 3.35+ supports this)

**Key architectural decision:** `household_id` replaces `chat_id` as the data partition key. `chat_id` stays on messages/reminders (for Telegram delivery targeting) but data ownership moves to households.

**No new packages needed.** Drizzle schema definitions + raw SQL init functions.

**Confidence:** HIGH -- pattern matches existing codebase exactly.

### 3. Guided Onboarding Flow

**Implementation approach:** SQLite-backed state machine, NOT grammY conversations plugin.

**Why NOT `@grammyjs/conversations`:**
1. The conversations plugin uses JavaScript generators (`function*`) which are hard to debug and test
2. State is lost on bot restart unless you add persistent storage (back to SQLite anyway)
3. The plugin adds ~15KB and a new abstraction layer for what is essentially a 5-step Q&A
4. The existing codebase has zero generator functions -- introducing them breaks style consistency

**Why SQLite state table:**
1. Existing pattern: `feedback_checkins` already tracks multi-step interaction state (pending -> sent -> responded)
2. Survives bot restarts (critical for onboarding that may span multiple sessions)
3. Can be queried for analytics (how many users completed step 3? where do users drop off?)
4. Simple `switch` on `onboarding_step` in the message handler

**Onboarding state table:**
```sql
onboarding_state: user_id, current_step, preferences_json, started_at, completed_at
```

**Onboarding steps** (each is a message handler check, not a conversation):
1. Welcome + household setup (create or join via invite)
2. Dietary preferences Q&A (via inline keyboard selections)
3. Cooking frequency / household size
4. Cuisine preferences
5. Seed initial recipes (Claude generates based on preferences)

**No new packages needed.** `InlineKeyboard` from grammY core for option selection, SQLite for state persistence.

**Confidence:** HIGH -- matches existing `feedback_checkins` state tracking pattern exactly.

### 4. App Feedback System

**Components:**
- `/feedback` command handler (text + inline keyboard)
- Silent detection (track usage patterns, prompt inactive users)
- Periodic check-in (extends existing `feedback_checkins` system)
- Admin dashboard (new Mini App page at `/admin/feedback`)

**Existing infrastructure that covers this:**
- `feedback_checkins` table and `createFeedbackRepository` already exist
- `feedbackCallbackHandler` and `feedbackTextHandler` already exist
- Express API routes pattern + React pages pattern established
- `config.adminUserIds` already exists for admin gating

**New admin route protection:**
```typescript
// In auth-middleware.ts -- add admin check
export function validateAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = res.locals.chatId; // Already set by validateInitData
  if (!config.adminUserIds.includes(userId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
```

**No new packages needed.** The admin dashboard is a new React page served from the same Mini App SPA, protected by an admin middleware on API routes.

**Confidence:** HIGH -- direct extension of existing patterns.

---

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| `crypto.randomBytes` (Node.js built-in) | `nanoid` | Adds a dependency for a one-liner. Node.js 22 `base64url` encoding is native and sufficient. |
| SQLite onboarding state table | `@grammyjs/conversations` plugin | Conversations plugin uses generators, loses state on restart, adds unfamiliar abstraction. SQLite matches existing patterns. |
| SQLite onboarding state table | `@grammyjs/session` with SQLite adapter | Session plugin requires external storage adapter package (`@grammyjs/storage-*`). Adds complexity for what is just a table row. |
| Raw `InlineKeyboard` for onboarding | `@grammyjs/menu` plugin | Menu plugin adds a DSL on top of inline keyboards. Project already uses raw `InlineKeyboard` everywhere (grocery, feedback). Keep consistent. |
| Express admin middleware | `passport` / auth library | Single auth provider (Telegram) + simple admin ID list. Full auth framework is massive overkill. |
| `ALTER TABLE ADD COLUMN` migration | Drizzle Kit `generate` + `push` | Project uses raw SQL `CREATE TABLE IF NOT EXISTS` pattern consistently. Mixing Drizzle migrations would create two competing schema management approaches. |
| SQLite for all state | Redis for session/invite state | No caching layer needed. SQLite WAL handles this concurrency level. Redis would add operational complexity (another service to run). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nanoid` / `uuid` / `cuid2` | Node.js 22 has native `crypto.randomBytes().toString('base64url')`. Adding a package for token generation is unnecessary. | `import { randomBytes } from 'node:crypto'` |
| `@grammyjs/conversations` | Generator-based conversations are fragile, lose state on restart, and introduce a paradigm foreign to this codebase. | SQLite `onboarding_state` table + state machine pattern (matches existing `feedback_checkins`) |
| `@grammyjs/session` with external storage | Adds storage adapter dependency + config for something a single SQLite table handles. | Direct SQLite table access via `better-sqlite3` |
| `jsonwebtoken` / `jose` | No JWT needed. Telegram initData provides auth. Admin is an ID check. | `@tma.js/init-data-node` (already installed) + `config.adminUserIds` (already exists) |
| `Redis` / `ioredis` | No caching layer needed. SQLite WAL handles this concurrency level. Would add operational complexity. | SQLite with WAL mode (already configured) |
| `@grammyjs/menu` | Plugin for menu-style inline keyboards. Adds abstraction over what the project already does manually with `InlineKeyboard`. | `InlineKeyboard` from grammY core (already used throughout) |
| Any ORM migration tool | Project pattern is `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN`. Drizzle Kit is installed but only for schema type generation, not runtime migrations. | Raw SQL in `init*.ts` files following existing pattern |
| `passport` / `express-session` | Full auth framework for a single-provider (Telegram) system is massive overkill. | `validateInitData` middleware (already exists) + admin ID check |
| React Query / SWR | Over-engineering for the admin dashboard's simple data fetching. Existing Mini App pages use plain `fetch`. | `useEffect` + `fetch` (matches existing Mini App pattern) |

---

## Data Model Changes (Schema, Not Stack)

While no new packages are needed, the data model changes are significant. This section documents what the schema work involves:

### New Tables

1. **`users`** -- Maps Telegram user IDs to internal user records with household membership
2. **`households`** -- Groups of users sharing meal plans, recipes, and grocery lists
3. **`invite_tokens`** -- Invite links with expiry, usage tracking, and household binding
4. **`onboarding_state`** -- Tracks each user's progress through guided setup
5. **`app_feedback`** -- General app feedback (distinct from meal feedback in `feedback_checkins`)

### Modified Tables (add `household_id` column)

All existing domain tables currently keyed on `chat_id` need a `household_id` column:
- `knowledge_items`, `knowledge_changelog`
- `meal_plans`, `cooking_history`
- `grocery_lists`
- `reminder_settings`, `reminders`
- `feedback_checkins`

`chat_id` remains for message-delivery targeting (which Telegram chat to send to), but data ownership moves to `household_id`.

### Migration Safety

SQLite `ALTER TABLE ... ADD COLUMN` is safe and fast (no table rewrite). The migration:
1. Add `household_id TEXT` column (nullable initially)
2. Create households for each unique `chat_id`
3. Backfill `household_id` from the new households
4. For new rows, `household_id` is required (enforced in application code, not `NOT NULL` constraint, to avoid breaking existing data)

---

## Version Compatibility

| Package | Current | Required | Compatible? |
|---------|---------|----------|-------------|
| Node.js | 22.x | 22.x | YES -- `crypto.randomBytes` with `base64url` works natively |
| grammY | ^1.39.3 | ^1.39.3 | YES -- `ctx.match` for deep links, `InlineKeyboard` for onboarding |
| better-sqlite3 | ^12.6.2 | ^12.6.2 | YES -- `ALTER TABLE ADD COLUMN` supported |
| drizzle-orm | ^0.45.1 | ^0.45.1 | YES -- schema definitions extend naturally |
| Express | ^5.2.1 | ^5.2.1 | YES -- admin middleware follows existing pattern |
| React | ^19.2.4 | ^19.2.4 | YES -- new pages fit existing SPA structure |
| react-router-dom | ^7.13.0 | ^7.13.0 | YES -- add routes for admin dashboard, onboarding pages |
| @telegram-apps/telegram-ui | ^2.1.13 | ^2.1.13 | YES -- UI components for feedback forms, admin dashboard |
| @tma.js/init-data-node | ^2.0.6 | ^2.0.6 | YES -- same initData validation, admin check added on top |
| TypeScript | ^5.9.3 | ^5.9.3 | YES -- no new type features needed |

**No version bumps required.** All existing packages at their current versions support the new features.

---

## Node.js Built-in Capabilities Used (No External Packages)

These Node.js 22 built-ins replace what would otherwise require npm packages:

| Built-in | Purpose | Replaces |
|----------|---------|----------|
| `crypto.randomBytes(16).toString('base64url')` | Invite token generation | nanoid, uuid |
| `crypto.randomUUID()` | Internal IDs if needed | uuid |
| `crypto.createHmac()` | Already used via @tma.js for initData | jsonwebtoken |
| `URL` / `URLSearchParams` | Deep link URL construction | url-parse, query-string |
| `structuredClone()` | Deep-cloning preferences during onboarding | lodash.cloneDeep |

All verified working in the Node.js 22 runtime in this environment.

---

## Sources

- **grammY deep link / `ctx.match`:** Verified from `/workspace/node_modules/grammy/out/composer.d.ts` lines 226-237 -- `ctx.match` contains the deep link payload as a `string`
- **grammY `SessionFlavor`:** Verified from `/workspace/node_modules/grammy/out/convenience/session.d.ts` -- in-memory by default, requires external adapter for persistence
- **Node.js `crypto.randomBytes` with `base64url`:** Verified by runtime test in Node.js 22 -- `randomBytes(16).toString('base64url')` produces 22-char URL-safe tokens
- **Telegram deep link `start` parameter:** From `@grammyjs/types` types verified in `/workspace/node_modules/@grammyjs/types/`
- **Existing project patterns:** All assertions about `chatId`, `CREATE TABLE IF NOT EXISTS`, `InlineKeyboard` usage, and factory function patterns verified by reading source files in `/workspace/src/`
- **`config.adminUserIds`:** Verified in `/workspace/src/config.ts` line 16 and 57 -- already parsed from `ADMIN_USER_IDS` env var
- **`validateInitData` middleware:** Verified in `/workspace/src/mini-app/auth-middleware.ts` -- sets `res.locals.chatId` from Telegram user ID
- **SQLite `ALTER TABLE ADD COLUMN`:** Standard SQLite feature, safe with no table rewrite. Supported in better-sqlite3.
- **Existing feedback system:** Verified `feedback_checkins` table and `createFeedbackRepository` in `/workspace/src/feedback/`

---
*Stack research for: HeySous v1.2 -- Multi-user, invites, onboarding, feedback*
*Researched: 2026-02-10*
