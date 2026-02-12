# Phase 16: Household Data Migration - Research

**Researched:** 2026-02-11
**Domain:** Codebase-internal migration (chatId -> householdId)
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Everything is household-level: recipes, meal plans, grocery lists, preferences, dietary restrictions, cooking history
- Users are identities for access control only -- not data partitions
- No per-user data beyond Telegram identity (stored in users table from Phase 15)
- Single shared taste/dietary profile per household
- No per-user attribution on data tables (no created_by/updated_by columns)
- Household is the unit of ownership for all data
- Households are fully isolated silos -- no data crosses household boundaries
- Both invite types (household-join and independent) work in this phase
- No admin cross-household visibility
- Household is plumbing, not personality -- Claude just talks to whoever is messaging it
- No "we" framing, no "your household" language -- just natural "you" conversation
- System prompt includes the current user's first name (from Telegram profile) -- that is it
- No household size hints or household context in system prompt
- Claude addresses the user by name naturally, treats all shared data as "yours"

### Claude's Discretion
- Migration strategy (how to move chatId -> householdId across tables)
- Transaction safety and rollback approach
- FTS5 trigger handling during migration
- Order of table migrations

### Deferred Ideas (OUT OF SCOPE)
- Household manager role
- Household merging (moving standalone user's data into a household they join)
- Per-user activity attribution / "added by [name]"
- Onboarding name override (let user set preferred name vs Telegram name) -- Phase 17

</user_constraints>

## Summary

This phase migrates the data ownership model from per-Telegram-chat (chatId = Telegram user ID) to per-household (householdId). Currently, every data table uses `chat_id TEXT` as the partition key. After migration, these same columns will store `household_id` values instead, and all repository/query code will use `ctx.householdId` (from the access gate) rather than `ctx.chat.id`.

The migration is simplified by a Phase 15 design decision: the admin's household_id equals their telegram_id. This means the admin's existing data already has `chat_id` values that match their `household_id`. For the admin (the only existing user with data), no actual data rows need to change -- only the code paths that provide the ID values need updating.

The scope divides naturally into three layers: (1) schema/SQL layer -- renaming `chat_id` columns to `household_id` or updating column semantics, (2) repository/query layer -- changing every function that accepts `chatId` to accept `householdId` and sourcing it from `ctx.householdId`, and (3) handler/pipeline layer -- changing every handler that extracts `String(ctx.chat.id)` to use `ctx.householdId` instead. There is also a critical distinction: **data ownership** uses householdId, but **message delivery** (reminders, feedback) must still use Telegram chat IDs for `bot.api.sendMessage`.

**Primary recommendation:** Rename the semantic meaning of chat_id columns to household_id across all 9 affected tables, update all 48 files that reference chatId, and add a SQL migration that runs on startup. Maintain the `chatId` in the `messages` table for conversation history (scoped to Telegram chat for delivery context) but add householdId for data partitioning. For reminder/feedback delivery, introduce a lookup from householdId to all member Telegram IDs.

## Standard Stack

### Core (existing -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | existing | Raw SQL for migrations, FTS5 | Already used for all init functions |
| drizzle-orm | existing | Type-safe queries | Already used in repository layer |
| grammy | existing | Bot context, middleware | ctx.householdId already set by access gate |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | existing | Migration logging | Log migration progress, errors |

**No new dependencies needed.** This is purely a codebase-internal refactor.

## Architecture Patterns

### Pattern 1: Two-ID Model (householdId for data, telegramId for delivery)

**What:** Data tables use `household_id` as the partition key. Message delivery (bot.api.sendMessage) uses Telegram user IDs. The `messages` table is the only table that needs BOTH a chat-level scope (for conversation context per-user) and a household-level scope (for data queries).

**When to use:** Every data access and every Telegram send operation.

**Critical insight:** Reminders and feedback check-ins currently store `chat_id` as the Telegram ID to send messages to. After migration, reminder_settings, reminders, and feedback_checkins need `household_id` for data grouping but the SENDER still needs individual Telegram user IDs. The sender must look up all household members and send to each one.

### Pattern 2: Startup SQL Migration

**What:** Add SQL migration logic in `db/index.ts` (or a new migration module) that runs on startup, using `ALTER TABLE ... RENAME COLUMN` to rename `chat_id` to `household_id` in all affected tables. Use a version marker or existence check to make it idempotent.

**Why:** The codebase already uses this pattern -- `initializeReminders` does a migration with CREATE TABLE/INSERT/DROP/RENAME to upgrade a CHECK constraint. SQLite supports `ALTER TABLE ... RENAME COLUMN` since version 3.25.0 (2018), and better-sqlite3 bundles a recent SQLite.

**Example migration approach:**
```sql
-- Idempotency check: does column still have old name?
-- PRAGMA table_info(knowledge_items) shows column names
-- If chat_id exists, rename it

ALTER TABLE knowledge_items RENAME COLUMN chat_id TO household_id;
ALTER TABLE knowledge_changelog RENAME COLUMN chat_id TO household_id;
ALTER TABLE meal_plans RENAME COLUMN chat_id TO household_id;
ALTER TABLE cooking_history RENAME COLUMN chat_id TO household_id;
ALTER TABLE grocery_lists RENAME COLUMN chat_id TO household_id;
ALTER TABLE reminder_settings RENAME COLUMN chat_id TO household_id;
ALTER TABLE reminders RENAME COLUMN chat_id TO household_id;
ALTER TABLE feedback_checkins RENAME COLUMN chat_id TO household_id;
ALTER TABLE messages RENAME COLUMN chat_id TO household_id;
-- OR for messages: keep chat_id AND add household_id
```

### Pattern 3: Handler-Level ID Source Change

**What:** Every bot handler currently does `const chatId = String(ctx.chat.id)`. After migration, data-access handlers use `ctx.householdId` (already set by access gate from Phase 15). Handlers that need the Telegram chat ID for message delivery still use `String(ctx.chat.id)`.

**Key files that extract chatId from ctx.chat.id (must change to ctx.householdId):**
- `src/bot/handlers/message.ts` (line 27) -- enqueues with chatId, this flows to processor
- `src/bot/handlers/grocery.ts` (line 35) -- /grocery command
- `src/bot/handlers/plan.ts` (line 110) -- /plan command
- `src/bot/handlers/reminders.ts` (line 31) -- /reminders command
- `src/bot/handlers/preferences.ts` (line 141) -- /preferences command
- `src/bot/handlers/debug.ts` (line 113) -- /debug command
- `src/bot/handlers/feedback.ts` (line 95) -- feedback text handler

### Anti-Patterns to Avoid
- **Changing column name in Drizzle schema without SQL migration:** Drizzle schemas define TypeScript mappings but do NOT run migrations. The actual SQLite column must be renamed via raw SQL first.
- **Losing the Telegram chat ID entirely:** The messages table and reminder sender need the Telegram chat ID. Don't conflate "which household's data" with "which Telegram chat to send to."
- **Editing FTS5 triggers during migration without rebuilding:** If column names change in the base table, FTS5 triggers referencing old column names will break. Must recreate triggers.

## Comprehensive chatId Usage Map

### Database Tables with chat_id Column (9 tables)

| Table | Column | Current Value | After Migration | Notes |
|-------|--------|---------------|-----------------|-------|
| `knowledge_items` | `chat_id` | telegram_id | household_id | Recipes, preferences, cooking notes |
| `knowledge_changelog` | `chat_id` | telegram_id | household_id | Audit log |
| `meal_plans` | `chat_id` | telegram_id | household_id | Weekly plans |
| `cooking_history` | `chat_id` | telegram_id | household_id | What was cooked |
| `grocery_lists` | `chat_id` | telegram_id | household_id | Active grocery lists |
| `reminder_settings` | `chat_id` | telegram_id | household_id | One per household (UNIQUE constraint) |
| `reminders` | `chat_id` | telegram_id | household_id | Scheduled reminders |
| `feedback_checkins` | `chat_id` | telegram_id | household_id | Feedback tracking |
| `messages` | `chat_id` | telegram_id | **SPECIAL** | See Messages Table section |
| `token_usage` | `chat_id` | telegram_id | household_id | Cost tracking |

### Messages Table (Special Case)

The `messages` table stores conversation history per-Telegram-chat. Each user has their own conversation with the bot. Conversation context is built per-user (sliding window of recent turns). However, data queries (knowledge search, plan retrieval) during that conversation must use `householdId`.

**Decision:** The messages table should keep `chat_id` as the Telegram chat identifier (for loading the correct conversation history per user). Add a `household_id` column for any data-scoped queries if needed, but conversation history is inherently per-user-chat.

Alternatively, the messages table can stay as-is with `chat_id` being the Telegram ID. The processor needs `householdId` for data operations but uses `chatId` for conversation loading. Both are available in the PendingBatch.

### Reminder Delivery (Critical Distinction)

Currently: `reminder.chatId` = Telegram user ID, used directly in `bot.api.sendMessage(reminder.chatId, text)`.

After migration: `reminder.household_id` = household ID. To send reminders, the sender must:
1. Look up all members of the household: `SELECT telegram_id FROM users WHERE household_id = ?`
2. Send the reminder to EACH member's Telegram chat

This applies to:
- `src/reminders/sender.ts` -- `sendReminder()` calls `bot.api.sendMessage(reminder.chatId, text)`
- `src/feedback/sender.ts` -- `sendCheckin()` calls `bot.api.sendMessage(reminder.chatId, text)`

**Recommended approach:** Add a helper function `getHouseholdTelegramIds(sqlite, householdId): string[]` and loop over members in the sender. This fulfills requirement HOUSE-05 (prep reminders sent to ALL household members).

### Mini-App Auth Middleware (Critical)

`src/mini-app/auth-middleware.ts` sets `res.locals.chatId = String(userId)` from the Telegram initData. After migration, the mini-app needs to:
1. Look up the user by Telegram ID
2. Set `res.locals.householdId` (for data queries) from the user's household
3. All mini-app routes then use `householdId` instead of `chatId`

### Pipeline Processor / Message Queue

The `MessageQueue` and `PendingBatch` use `chatId` for debouncing messages per-chat. The debounce key should remain per-Telegram-chat (each user has their own conversation). But the processor needs `householdId` for data operations.

**Change needed in message handler:**
```typescript
// Current:
const chatId = String(ctx.chat.id);
queue.enqueue(chatId, userId, text, ctx, processBatch);

// After: Keep chatId for debounce, but processor extracts householdId from ctx
// The PendingBatch already stores ctx, which has ctx.householdId
```

The processor currently uses `batch.chatId` for everything. After migration:
- Use `batch.chatId` (Telegram ID) for: messages table insert, conversation history load, Telegram API calls (editMessage, etc.)
- Use `ctx.householdId` for: all data operations (knowledge, plans, grocery, reminders, etc.)

### Tool Handler

`src/ai/tool-handler.ts` takes `chatId` as a constructor dep and passes it to every tool operation. After migration, this becomes `householdId`.

### System Prompt

`src/ai/system-prompt.ts` `buildSystemPrompt()` currently takes preferences, planContext, etc. The locked decision adds: **include the current user's first name**. The system prompt function needs a `userName` parameter.

Per CONTEXT.md: "Claude addresses the user by name naturally, treats all shared data as 'yours'." Add `userName` to the system prompt personality section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL column rename | Manual INSERT/SELECT/DROP dance | `ALTER TABLE ... RENAME COLUMN` | SQLite supports this natively since 3.25.0, much safer |
| Idempotent migration check | Custom version table | `PRAGMA table_info()` check for old column name | Simpler, no new table needed |
| FTS5 trigger recreation | Manual trigger SQL | Call existing `initializeFts()` function | Already handles DROP IF EXISTS + CREATE pattern |
| Household member lookup | New repo function | Existing `getHouseholdMembers()` in users/repository.ts | Already returns all members with telegramId |

## Common Pitfalls

### Pitfall 1: FTS5 Triggers Break After Column Rename
**What goes wrong:** FTS5 sync triggers reference `knowledge_items` columns by name. If the table columns change (rename chat_id), the triggers themselves don't break, BUT the `initializeFts()` function recreates them every startup using DROP/CREATE. As long as the FTS5 triggers don't reference `chat_id` directly (they don't -- they only reference `title`, `summary`, `content`, `rowid`), the rename is safe.
**Verification:** Confirmed by reading `src/knowledge/fts.ts` -- triggers only reference `new.id`, `new.title`, `new.summary`, `new.content`. The `chat_id` column is NOT referenced in any FTS5 trigger. **This is safe.**
**Risk level:** LOW -- no action needed beyond verifying triggers still work after migration.

### Pitfall 2: UNIQUE Constraint on reminder_settings.chat_id
**What goes wrong:** `reminder_settings` has `UNIQUE ON chat_id` (from init.ts). After renaming to `household_id`, this constraint persists (SQLite renames the column in all constraints). This is correct behavior -- one settings row per household.
**Risk level:** LOW -- works correctly.

### Pitfall 3: Messages Table Conversation Loading
**What goes wrong:** If messages table chat_id is renamed to household_id, conversation history loads for the entire household (all members' messages). This breaks the per-user sliding window (users would see each other's conversation turns).
**How to avoid:** Keep the messages table's `chat_id` as the Telegram chat ID. Or rename it but ensure the conversation loading query filters by the individual's Telegram ID, not householdId.
**Recommendation:** Keep `chat_id` in messages table as-is (Telegram ID). Add a separate `household_id` column if needed. The processor should use Telegram ID for conversation loading and householdId for data operations.

### Pitfall 4: Token Usage Table
**What goes wrong:** `token_usage` table has `chat_id` and `user_id`. Currently both are Telegram IDs. The chat_id could become householdId for cost aggregation per household. But the /costs handler currently shows global totals, not per-chat.
**Recommendation:** Rename to `household_id` for consistency. The `user_id` column already tracks the individual.

### Pitfall 5: Reminder Delivery to Multiple Users
**What goes wrong:** After migration, `reminders.household_id` identifies the household, not a Telegram chat. The sender calls `bot.api.sendMessage(reminder.chatId, text)` which now has a householdId -- not a valid Telegram chat ID.
**How to avoid:** Sender must resolve householdId to member Telegram IDs. Use `getHouseholdMembers()`.
**Warning signs:** Reminders silently fail (Telegram returns 400 for invalid chat ID).

### Pitfall 6: Handler chatId Extraction Inconsistency
**What goes wrong:** Some handlers extract `chatId = String(ctx.chat.id)`, others could use `ctx.householdId` from the access gate. If even one handler is missed, that code path silently creates data under the wrong ID.
**How to avoid:** Grep for ALL occurrences of `ctx.chat.id` and `String(ctx.chat.id)` and audit each one.

### Pitfall 7: Grocery List Message Editing
**What goes wrong:** `ctx.api.editMessageText(chatId, activeList.messageId, ...)` in processor.ts uses the Telegram chat ID to edit a specific message. This must remain the Telegram chat ID (not householdId).
**How to avoid:** Use `batch.chatId` (Telegram ID) for Telegram API operations, `householdId` for data operations.

### Pitfall 8: The MessageQueue Debounce Key
**What goes wrong:** If the debounce key is changed from Telegram chatId to householdId, messages from two household members within the debounce window (1.5s) would be merged into one batch. This is likely undesirable -- each user should have their own conversation flow.
**How to avoid:** Keep Telegram chat ID as the debounce key.

## Code Examples

### Migration SQL (idempotent column rename)
```typescript
// Source: codebase pattern from reminders/init.ts

function migrateToHouseholdId(sqlite: BetterSqlite3.Database): void {
  // Check if migration is needed by looking for chat_id column
  const tableInfo = sqlite.prepare("PRAGMA table_info(knowledge_items)").all() as Array<{ name: string }>;
  const hasChatId = tableInfo.some(col => col.name === "chat_id");

  if (!hasChatId) {
    // Already migrated
    return;
  }

  // Run all renames in a transaction
  sqlite.transaction(() => {
    sqlite.exec(`ALTER TABLE knowledge_items RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE knowledge_changelog RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE meal_plans RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE cooking_history RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE grocery_lists RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE reminder_settings RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE reminders RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE feedback_checkins RENAME COLUMN chat_id TO household_id`);
    sqlite.exec(`ALTER TABLE token_usage RENAME COLUMN chat_id TO household_id`);
    // messages table: keep chat_id, add household_id
    // Actually: messages stay with chat_id for conversation context
  })();
}
```

### Handler Pattern Change
```typescript
// BEFORE (current pattern):
handler.command("grocery", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const activeList = groceryRepository.getActiveList(chatId);
  // ...
});

// AFTER (household pattern):
handler.command("grocery", async (ctx) => {
  const householdId = ctx.householdId!;
  const activeList = groceryRepository.getActiveList(householdId);
  // ...
});
```

### Reminder Sender Pattern Change
```typescript
// BEFORE:
await bot.api.sendMessage(reminder.chatId, text, { parse_mode: "HTML" });

// AFTER:
const members = getHouseholdMembers(sqlite, reminder.householdId);
for (const member of members) {
  try {
    await bot.api.sendMessage(member.telegramId, text, { parse_mode: "HTML" });
  } catch (error) {
    // Log per-member failures but continue sending to others
  }
}
```

### System Prompt User Name Injection
```typescript
// Source: locked decision -- system prompt includes current user's first name

export function buildSystemPrompt(
  preferences?: PreferenceSummary[],
  planContext?: string,
  groceryContext?: string,
  reminderContext?: string,
  feedbackContext?: string,
  userName?: string,
): string {
  // Add user name to personality section
  const userNameLine = userName
    ? `\nThe user's name is ${userName}. Address them by name naturally.`
    : "";

  return `You are Sous, a friendly and knowledgeable kitchen sidekick...
${userNameLine}
...`;
}
```

### Mini-App Auth Middleware Change
```typescript
// BEFORE:
res.locals.chatId = String(userId);

// AFTER:
const user = getUserByTelegramId(sqlite, String(userId));
if (!user) {
  res.status(401).json({ error: "User not registered" });
  return;
}
res.locals.householdId = user.householdId;
// Keep chatId for any per-user needs
res.locals.chatId = String(userId);
```

## Complete File-by-File Change Map

### Layer 1: Schema / SQL (column renames)

| File | Change | Details |
|------|--------|---------|
| `src/knowledge/fts.ts` | Update CREATE TABLE SQL | Change `chat_id` to `household_id` in knowledge_items, knowledge_tags, knowledge_changelog |
| `src/planning/history.ts` | Update CREATE TABLE SQL | Change `chat_id` to `household_id` in meal_plans, cooking_history |
| `src/grocery/init.ts` | Update CREATE TABLE SQL | Change `chat_id` to `household_id` in grocery_lists |
| `src/reminders/init.ts` | Update CREATE TABLE SQL | Change `chat_id` to `household_id` in reminder_settings, reminders |
| `src/feedback/init.ts` | Update CREATE TABLE SQL | Change `chat_id` to `household_id` in feedback_checkins |
| `src/db/schema.ts` | Update Drizzle schema | Change `chatId: text("chat_id")` to `householdId: text("household_id")` in messages, token_usage |
| `src/knowledge/schema.ts` | Update Drizzle schema | Change chatId column mapping |
| `src/planning/schema.ts` | Update Drizzle schema | Change chatId column mapping |
| `src/grocery/schema.ts` | Update Drizzle schema | Change chatId column mapping |
| `src/reminders/schema.ts` | Update Drizzle schema | Change chatId column mapping |
| NEW: `src/db/migrate.ts` | Create migration module | Idempotent column rename SQL |

### Layer 2: Repository / Query (chatId -> householdId parameter)

| File | Change | Details |
|------|--------|---------|
| `src/knowledge/repository.ts` | Rename chatId params to householdId | All 5 methods: create, getById, update, delete, listByChatId |
| `src/knowledge/fts.ts` | Rename chatId params | searchFts, getFullItem |
| `src/knowledge/retrieval.ts` | Rename chatId params | search, getItem, getMetrics |
| `src/knowledge/preferences.ts` | Rename chatId param | getPreferenceSummaries |
| `src/knowledge/types.ts` | Rename chatId field | KnowledgeItem.chatId, ChangelogEntry.chatId |
| `src/planning/repository.ts` | Rename chatId params | savePlan, getPlan, getActivePlans |
| `src/planning/history.ts` | Rename chatId params | autoMarkCookedMeals, logMeal, getCookingHistory |
| `src/grocery/repository.ts` | Rename chatId params | createList, getActiveList, completeList + GroceryList interface |
| `src/reminders/repository.ts` | Rename chatId params | All methods + types |
| `src/reminders/types.ts` | Rename chatId fields | ReminderSettings.chatId, Reminder.chatId |
| `src/feedback/repository.ts` | Rename chatId params | createCheckin, getPendingSentCheckins, getRecentFeedback |
| `src/feedback/types.ts` | Rename chatId field | FeedbackCheckin.chatId |
| `src/conversation/types.ts` | Keep chatId | ConversationTurn.chatId stays (Telegram chat context) |
| `src/ai/tool-handler.ts` | Rename chatId dep to householdId | Constructor param and all internal uses |

### Layer 3: Handler / Pipeline (ID source change)

| File | Change | Details |
|------|--------|---------|
| `src/bot/handlers/message.ts` | Use ctx.householdId for data ops | Keep chatId for debounce key |
| `src/bot/handlers/grocery.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/bot/handlers/plan.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/bot/handlers/reminders.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/bot/handlers/preferences.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/bot/handlers/debug.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/bot/handlers/feedback.ts` | Use ctx.householdId | Replace `String(ctx.chat.id)` |
| `src/pipeline/processor.ts` | Split: householdId for data, chatId for conversation | Critical: must use correct ID for each operation |
| `src/pipeline/message-queue.ts` | Keep chatId for debounce | PendingBatch.chatId stays as Telegram ID |
| `src/ai/system-prompt.ts` | Add userName parameter | Inject user's first name per locked decision |
| `src/mini-app/auth-middleware.ts` | Resolve householdId from user lookup | Set res.locals.householdId |
| `src/mini-app/routes/grocery.ts` | Use householdId | Replace res.locals.chatId usage |
| `src/mini-app/routes/meal-plan.ts` | Use householdId | Replace res.locals.chatId usage |
| `src/mini-app/routes/recipes.ts` | Use householdId | Replace res.locals.chatId usage |
| `src/mini-app/routes/summary.ts` | Use householdId | Replace res.locals.chatId usage |

### Layer 4: Delivery (reminders/feedback to all members)

| File | Change | Details |
|------|--------|---------|
| `src/reminders/sender.ts` | Send to all household members | Resolve householdId -> member telegramIds |
| `src/feedback/sender.ts` | Send to all household members | Same pattern as reminder sender |
| `src/reminders/generator.ts` | Use householdId | Already receives chatId param, rename |
| `src/feedback/generator.ts` | Use householdId | Already receives chatId param, rename |
| `src/main.ts` | Pass householdId in regenerateReminders | Update startup regeneration loop |

### Layer 5: Context Builders (system prompt injection)

| File | Change | Details |
|------|--------|---------|
| `src/planning/context.ts` | No change | Receives plan data, not IDs |
| `src/grocery/context.ts` | Use household_id in SQL | Change `WHERE gl.chat_id = ?` |
| `src/reminders/context.ts` | Use household_id in SQL | Change `WHERE chat_id = ?` |
| `src/feedback/context.ts` | Use household_id in SQL | Change `WHERE fc.chat_id = ?` |

## Recommended Migration Strategy

### Order of Operations

1. **Create migration module** (`src/db/migrate.ts`) with idempotent column rename SQL
2. **Update init functions** to use `household_id` in CREATE TABLE IF NOT EXISTS
3. **Run migration in `createDatabase()`** before any init functions
4. **Update Drizzle schemas** to map to new column names
5. **Update types/interfaces** (rename chatId fields to householdId where appropriate)
6. **Update repositories** (rename parameters)
7. **Update context builders** (rename SQL references)
8. **Update handlers** (change ID source from ctx.chat.id to ctx.householdId)
9. **Update pipeline processor** (split chatId vs householdId usage)
10. **Update tool handler** (rename chatId dep)
11. **Update senders** (add household member resolution)
12. **Update mini-app middleware and routes**
13. **Update system prompt** (add userName parameter)
14. **Update main.ts** wiring

### Transaction Safety

The SQL migration should run as a single transaction. If any ALTER TABLE fails, all renames roll back. SQLite transactions are atomic -- either all columns are renamed or none are.

```typescript
sqlite.transaction(() => {
  // All ALTER TABLE RENAME COLUMN statements here
})();
```

### Rollback

If the migration breaks something, the database file can be restored from backup. The migration is idempotent (checks for old column name before running). In practice, since this is a column rename (not data transformation), rollback would mean renaming columns back.

## Open Questions

1. **Messages table: rename or keep chat_id?**
   - What we know: Messages need per-user conversation history (not shared across household members). The sliding window loads turns by chatId.
   - What's unclear: Should messages stay purely per-user (keep chat_id as Telegram ID) or should we add a household_id column too?
   - Recommendation: **Keep chat_id in messages table.** Conversation history is inherently per-Telegram-chat. The processor already has access to householdId from ctx for data operations. No need to add household_id to messages.

2. **Token usage table: rename or keep?**
   - What we know: /costs shows global totals. The chat_id could be useful for per-household cost tracking.
   - Recommendation: **Rename to household_id** for consistency. Individual user attribution is handled by the existing `user_id` column.

3. **Grocery list editMessageText in processor**
   - What we know: `ctx.api.editMessageText(chatId, messageId, ...)` needs the Telegram chat ID, not householdId. The grocery list message was sent to a specific user's chat.
   - Recommendation: When editing grocery list messages, use the Telegram chat ID from the batch, not householdId. In a multi-user household, the list message exists only in the chat of whoever triggered the last grocery command. Future: could send list updates to all members.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 48 files containing chatId/chat_id
- `src/users/schema.ts` -- households table with `id TEXT PRIMARY KEY`
- `src/users/init.ts` -- admin household_id = admin telegram_id (line 53)
- `src/bot/middlewares/access-gate.ts` -- ctx.householdId already set (line 61)
- `src/bot/context.ts` -- BotContext already has householdId field (line 12)
- `src/knowledge/fts.ts` -- FTS5 triggers do NOT reference chat_id (lines 64-91)
- All init.ts files for CREATE TABLE IF NOT EXISTS SQL

### Secondary (MEDIUM confidence)
- SQLite ALTER TABLE RENAME COLUMN support (3.25.0+) -- well-documented, better-sqlite3 bundles recent SQLite

## Metadata

**Confidence breakdown:**
- Data table mapping: HIGH -- every table and column enumerated from source
- Handler mapping: HIGH -- every file with chatId identified and change documented
- Migration strategy: HIGH -- uses patterns already in the codebase
- Reminder delivery: HIGH -- clear requirement, solution uses existing getHouseholdMembers
- Messages table decision: MEDIUM -- reasonable but involves judgment call

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- codebase-internal, no external dependency concerns)
