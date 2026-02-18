# Phase 8: Reminders - Research

**Researched:** 2026-02-08
**Domain:** Proactive messaging, job scheduling, timezone handling, recipe analysis for prep timing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Morning summary
- Fixed time delivery -- user sets their preferred morning time (e.g., 8am), same every day
- Full day overview -- includes all planned meals (breakfast/lunch/dinner), not just dinner
- Quick glance format -- 2-3 lines max, like a sticky note (meal names + any heads-up)
- On days with no meal plan, send a brief nudge ("No dinner planned for tonight") rather than staying silent

#### Prep timing alerts
- Claude analyzes recipes to determine what needs advance prep and when (not limited to explicit notes)
- Lead time up to the day before -- can remind the night before for overnight thawing or long marinating
- Heads-up only -- no instructions in the reminder ("Defrost the chicken for tonight's stir fry"), user knows what to do
- For meals with no advance prep, still send a start-cooking nudge at dinner time ("Time to start cooking! Tonight: [meal]")

#### Reminder tone & frequency
- Casual sous chef personality -- same warm Sous persona as conversations, brief and friendly
- No hard frequency cap -- send as many reminders as the meal requires, trust Claude to be reasonable
- Fire and forget -- if user doesn't respond to a reminder, no follow-up or re-reminder
- Varied wording -- Claude writes each reminder fresh, not from templates. Natural, not robotic.

#### User controls
- Both conversational and /reminders command -- "mute reminders until Monday" works, and /reminders shows settings
- Control by type -- morning summary and prep alerts can be toggled independently
- On by default -- reminders activate as soon as a meal plan exists. User mutes if they don't want them.
- No snooze -- fire and forget is sufficient, user can scroll back in chat history

### Claude's Discretion
- Exact default morning summary time (suggest something reasonable)
- How to detect dinner time for start-cooking nudges (user preference or recipe-based)
- Reminder scheduling implementation (poller interval, job queue, etc.)
- How to persist reminder state across restarts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase adds proactive messaging to the HeySous bot -- the bot reaches out to users with morning summaries, prep timing alerts, and start-cooking nudges. The core challenge is building a lightweight, database-backed scheduling system that survives restarts, respects user timezones, and integrates with the existing meal plan data layer.

The recommended approach is a **simple setInterval-based poller** (60-second tick) that queries SQLite for due reminders. No external job queue library is needed -- the project's existing better-sqlite3 (synchronous) makes polling trivially simple, and the scale (single-user or small number of users) does not warrant a heavy scheduler. Reminders are stored as rows in a `reminders` table with UTC `due_at` timestamps. On each tick, the poller queries for overdue reminders, sends them via `bot.api.sendMessage`, and marks them as sent. On startup, the system regenerates reminders from the current meal plan, making it restart-safe by design.

For Claude-generated reminder text, the system calls the Anthropic API with a focused prompt containing the meal context, producing varied, personality-consistent messages. This avoids templates while keeping the Sous persona. The morning summary and start-cooking nudges are short enough that a single haiku-tier API call per reminder is cost-effective.

**Primary recommendation:** Use a 60-second setInterval poller over a SQLite `reminders` table with UTC timestamps. Regenerate reminders from meal plans on startup and when plans change. Use `bot.api.sendMessage` for proactive delivery (HTML parse mode is already globally configured).

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.6.2 | Reminder persistence | Already used; synchronous queries perfect for poller |
| drizzle-orm | ^0.45.1 | Schema + typed queries for reminder tables | Already used for all other tables |
| grammy | ^1.39.3 | `bot.api.sendMessage` for proactive messages | Already used; global HTML parse mode applies |
| @anthropic-ai/sdk | ^0.73.0 | Claude API for generating reminder text | Already used for conversation |
| pino | ^10.3.0 | Logging poller activity | Already used throughout |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/parse-mode | ^1.11.1 | Global HTML parse mode on bot.api | Already configured -- proactive messages get HTML by default |
| @grammyjs/auto-retry | (not yet installed) | Auto-retry on Telegram 429 rate limits | Install if sending many reminders; optional for single-user |

### No New Dependencies Needed
The entire reminder system can be built with existing dependencies. No cron library, no job queue, no timezone library needed.

| Instead of | Use Instead | Why |
|------------|-------------|-----|
| node-cron / cron | setInterval (60s) | Overkill for a simple poller; no cron expressions needed |
| agenda / bull | SQLite reminders table | Already have SQLite; no need for MongoDB/Redis |
| luxon / moment-timezone | Intl.DateTimeFormat + manual UTC offset | Node.js 22+ has full Intl support; only need UTC storage + offset math |

**Installation:**
```bash
# No new packages needed. Optionally:
npm install @grammyjs/auto-retry
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── reminders/
│   ├── schema.ts          # Drizzle schema for reminders + user_reminder_settings
│   ├── init.ts            # Raw SQL CREATE TABLE IF NOT EXISTS
│   ├── repository.ts      # CRUD for reminders and settings
│   ├── generator.ts       # Generates reminder rows from meal plan data
│   ├── poller.ts          # setInterval loop: query due, send, mark sent
│   ├── sender.ts          # Sends reminder via bot.api + Claude text generation
│   └── types.ts           # Shared types
├── bot/
│   └── handlers/
│       └── reminders.ts   # /reminders command handler
```

### Pattern 1: Database-Backed Polling Scheduler
**What:** A setInterval loop (60s) queries the `reminders` table for rows where `due_at <= NOW` and `status = 'pending'`. Each due reminder is processed, sent, and marked as `sent`.
**When to use:** When you need persistent scheduling that survives restarts without external dependencies.
**Why 60 seconds:** Reminders are time-of-day events (morning summaries, prep alerts). 60-second granularity is more than sufficient -- users won't notice if their 8am summary arrives at 8:00:12 vs 8:00:00. Shorter intervals waste CPU; longer intervals risk noticeable delays.

```typescript
// Source: Project pattern (factory function + setInterval)
export function createReminderPoller(deps: {
  sqlite: BetterSqlite3.Database;
  botApi: Api;
  claudeClient: ClaudeClient;
  logger: Logger;
}) {
  const POLL_INTERVAL_MS = 60_000; // 1 minute
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    try {
      const dueReminders = getDueReminders(deps.sqlite);
      for (const reminder of dueReminders) {
        await sendReminder(reminder, deps);
        markReminderSent(deps.sqlite, reminder.id);
      }
    } catch (error) {
      deps.logger.error({ error }, "Reminder poller tick failed");
    }
  }

  return {
    start() {
      timer = setInterval(() => { tick().catch(() => {}); }, POLL_INTERVAL_MS);
      // Also run immediately on startup to catch any missed reminders
      tick().catch(() => {});
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
```

### Pattern 2: Reminder Regeneration on Plan Change
**What:** When a meal plan is saved or updated, delete future pending reminders for that plan and regenerate them. On process startup, regenerate all reminders for active plans.
**When to use:** Instead of trying to diff plan changes against existing reminders.
**Why:** Simpler than tracking individual entry changes. The generator is idempotent -- run it any time and get correct reminders.

```typescript
// Source: Project pattern
export function regenerateReminders(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  claudeClient: ClaudeClient,
): void {
  // 1. Delete all future pending reminders for this chat
  deleteFutureReminders(sqlite, chatId);

  // 2. Get active meal plans
  const plans = getActivePlans(sqlite, chatId);

  // 3. Get user's reminder settings (timezone, morning time, dinner time)
  const settings = getReminderSettings(sqlite, chatId);
  if (!settings.enabled) return;

  // 4. For each plan entry, generate appropriate reminders
  for (const plan of plans) {
    for (const entry of plan.entries) {
      generateRemindersForEntry(sqlite, chatId, plan, entry, settings);
    }
  }
}
```

### Pattern 3: UTC Storage with User Timezone
**What:** Store all `due_at` timestamps as UTC integers (Unix epoch seconds) in SQLite. Store user's IANA timezone string (e.g., "America/New_York") in their settings. Convert to UTC when creating reminders; convert from UTC when displaying settings.
**When to use:** Always. Never store local times.

```typescript
// Source: Native Node.js Intl API
function userLocalToUtc(
  localHour: number,
  localMinute: number,
  dateStr: string, // "YYYY-MM-DD"
  timezone: string, // "America/New_York"
): Date {
  // Create a date string in the user's local time
  const localStr = `${dateStr}T${String(localHour).padStart(2, "0")}:${String(localMinute).padStart(2, "0")}:00`;

  // Use Intl to find the UTC offset for this timezone at this date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  });

  // Parse the offset and compute UTC
  // Alternative simpler approach: use Date constructor with timezone
  const parts = formatter.formatToParts(new Date(localStr));
  const offsetPart = parts.find(p => p.type === "timeZoneName");
  // ... offset math

  // Simpler approach: trial-and-error with known timezone
  // Create date assuming UTC, then adjust
  const utcGuess = new Date(`${localStr}Z`);
  const localInTz = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(utcGuess);
  // Adjust based on difference
  return utcGuess; // simplified
}
```

**Note:** The timezone conversion math is the trickiest part of this phase. See the "Don't Hand-Roll" section for the recommended approach.

### Pattern 4: Proactive Message Sending via bot.api
**What:** Send messages to users outside of a handler context using `bot.api.sendMessage(chatId, text)`.
**When to use:** For all reminder messages (morning summary, prep alerts, start-cooking nudges).
**Key insight:** The project already has `bot.api.config.use(parseMode("HTML"))` configured (in `src/bot/index.ts`). Verified from the parse-mode plugin source: the transformer adds `parse_mode: "HTML"` to ALL API method payloads by default (including `sendMessage`). So proactive messages sent via `bot.api.sendMessage` will automatically use HTML formatting.

```typescript
// Source: grammY docs + verified from transformer source
// bot.api.sendMessage already gets HTML parse_mode from global config
await bot.api.sendMessage(chatId, "<b>Good morning!</b>\nTonight: Chicken Parm");
```

### Pattern 5: Claude-Generated Reminder Text
**What:** Use the Anthropic API to generate each reminder's text with the Sous persona, ensuring varied and natural wording.
**When to use:** For all user-facing reminder messages.
**Cost consideration:** One haiku-tier API call per reminder, with a small system prompt and minimal context. At ~$0.001 per call, cost is negligible even with 5-10 reminders per day.

```typescript
// Source: Project pattern (createClaudeClient)
async function generateReminderText(
  claudeClient: ClaudeClient,
  reminderType: "morning_summary" | "prep_alert" | "start_cooking",
  context: { meals: string[]; prepTask?: string; mealName?: string },
): Promise<string> {
  const response = await claudeClient.sendMessage(
    [`Generate a ${reminderType} reminder. Context: ${JSON.stringify(context)}`],
    REMINDER_SYSTEM_PROMPT,
  );
  return response.text;
}
```

### Anti-Patterns to Avoid
- **In-memory timers per reminder:** Using individual `setTimeout` for each reminder loses all state on restart. Use database + poller.
- **Storing local times in the database:** Always store UTC. Convert at the edges (input from user, output to user).
- **Template-based reminder text:** User explicitly wants Claude-generated varied wording. Templates violate this.
- **Diffing plan changes:** Instead of tracking what entries changed, delete and regenerate all future reminders when a plan changes.
- **Tight coupling to message handlers:** The poller runs independently of the bot's update handlers. It needs `bot.api` but not `ctx`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone conversion | Manual UTC offset tables | `Intl.DateTimeFormat` with IANA timezone + `Date` arithmetic | DST transitions are notoriously complex; Intl handles them correctly |
| Cron scheduling | Custom cron parser | Simple `setInterval` (no cron expressions needed) | We only need "run every 60s and check DB"; no complex schedules |
| Rate limiting | Custom queue for Telegram sends | `@grammyjs/auto-retry` plugin (optional) | Handles 429 responses with proper retry_after delays |
| HTML message formatting | Custom HTML builder | Existing `sendFormattedMessage` pattern for long messages, direct `bot.api.sendMessage` for short ones | Reminders are 2-3 lines; splitting is unlikely but safe to reuse |
| Reminder text generation | Template strings with random variations | Claude API call with Sous persona prompt | User wants "varied wording, Claude writes each fresh" |

**Key insight:** The heaviest "don't hand-roll" item is timezone math. Use `Intl.DateTimeFormat` for all conversions. The approach: store user timezone as IANA string (e.g., "America/Chicago"), store `due_at` as UTC epoch, and convert using `new Date().toLocaleString("en-US", { timeZone })` for display and reverse conversion for scheduling.

## Common Pitfalls

### Pitfall 1: Timezone + DST Disasters
**What goes wrong:** Reminder fires at wrong time after daylight saving transition (e.g., 8am becomes 7am or 9am).
**Why it happens:** Storing "8am" as a fixed UTC offset (e.g., "UTC-5") breaks when DST changes the offset to UTC-4.
**How to avoid:** Store user's IANA timezone ("America/New_York") and their desired local time (hour + minute). When generating reminders, compute the UTC `due_at` for the specific date using `Intl.DateTimeFormat`, which correctly handles DST for that date.
**Warning signs:** Reminders consistently off by 1 hour; user complaints after March/November.

### Pitfall 2: Missed Reminders After Restart
**What goes wrong:** Process restarts and past-due reminders never fire.
**Why it happens:** Poller only looks forward from current time; missed reminders are never picked up.
**How to avoid:** On startup, query for ALL pending reminders where `due_at <= NOW`. Process them immediately (they're just late, not lost). For morning summaries that are hours late, consider skipping them or sending with a "sorry, late start today" note.
**Warning signs:** Users report missing reminders after deploys.

### Pitfall 3: Duplicate Reminders
**What goes wrong:** Same reminder sent multiple times.
**Why it happens:** Poller picks up a reminder, sends it, but crashes before marking it `sent`. Next tick sends it again.
**How to avoid:** Mark the reminder as `sending` (or just `sent`) BEFORE attempting to send. If the send fails, mark it as `failed` rather than leaving it as `pending`. A reminder that fails to send is better than one sent twice.
**Warning signs:** Users complain about getting the same reminder twice.

### Pitfall 4: Telegram Bot Can't Initiate Conversations
**What goes wrong:** `bot.api.sendMessage` throws "chat not found" or "bot was blocked by the user".
**Why it happens:** Telegram bots can only message users who have previously messaged the bot. If a user blocks the bot or never started it, sending fails.
**How to avoid:** Wrap all `sendMessage` calls in try/catch. On "bot was blocked" errors, disable reminders for that chat. On "chat not found", skip silently. Store `chatId` from actual conversations, never from external sources.
**Warning signs:** Error logs showing 403 responses from Telegram API.

### Pitfall 5: Claude API Failures Block Reminders
**What goes wrong:** If Claude API is down, no reminders can be generated or sent.
**Why it happens:** Each reminder calls Claude for text generation.
**How to avoid:** Use a fallback plain text template if Claude fails. E.g., if generating morning summary fails, send a simple "Good morning! Today's dinner: [meal name]" without Claude's personality flourish. Log the failure, but don't skip the reminder entirely.
**Warning signs:** Zero reminders sent during Claude API outages.

### Pitfall 6: Reminder Storm on Bulk Plan Changes
**What goes wrong:** User creates a full week plan, triggering regeneration of 14+ reminders, each calling Claude API.
**Why it happens:** Regeneration generates all reminders synchronously, calling Claude for each.
**How to avoid:** Generate reminder ROWS (with `due_at` and context) synchronously, but defer the Claude text generation to send time. The poller generates text just before sending. This also ensures the text is fresh and timely.
**Warning signs:** Long delays after saving a plan; high API costs.

## Code Examples

### Database Schema for Reminders
```typescript
// Source: Following project pattern (drizzle-orm/sqlite-core)
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * User reminder settings -- one row per chat.
 * Stores timezone, preferred times, and toggle states.
 */
export const reminderSettings = sqliteTable("reminder_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull().unique(),
  timezone: text("timezone").notNull().default("America/New_York"),
  morningHour: integer("morning_hour").notNull().default(8),
  morningMinute: integer("morning_minute").notNull().default(0),
  dinnerHour: integer("dinner_hour").notNull().default(17),
  dinnerMinute: integer("dinner_minute").notNull().default(30),
  morningEnabled: integer("morning_enabled", { mode: "boolean" }).notNull().default(true),
  prepEnabled: integer("prep_enabled", { mode: "boolean" }).notNull().default(true),
  mutedUntil: integer("muted_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Individual reminder instances -- one row per scheduled reminder.
 * due_at is UTC epoch (seconds or ms).
 * type distinguishes morning_summary, prep_alert, start_cooking.
 */
export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  type: text("type", {
    enum: ["morning_summary", "prep_alert", "start_cooking"],
  }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  status: text("status", {
    enum: ["pending", "sent", "failed", "skipped"],
  }).notNull().default("pending"),
  /** JSON context for text generation (meal names, prep tasks, etc.) */
  context: text("context").notNull(),
  /** Generated text (populated at send time, null before) */
  generatedText: text("generated_text"),
  /** Reference to meal plan entry that spawned this reminder */
  mealPlanEntryId: integer("meal_plan_entry_id"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Querying Due Reminders (raw SQL pattern)
```typescript
// Source: Following project pattern (better-sqlite3 raw queries)
function getDueReminders(sqlite: BetterSqlite3.Database): ReminderRow[] {
  const now = Math.floor(Date.now() / 1000);
  return sqlite
    .prepare(`
      SELECT r.*, rs.timezone, rs.muted_until
      FROM reminders r
      JOIN reminder_settings rs ON rs.chat_id = r.chat_id
      WHERE r.status = 'pending'
        AND r.due_at <= ?
        AND (rs.muted_until IS NULL OR rs.muted_until < ?)
      ORDER BY r.due_at ASC
    `)
    .all(now, now) as ReminderRow[];
}
```

### Sending Proactive Message
```typescript
// Source: grammY docs + verified parse-mode transformer behavior
import type { Api } from "grammy";

async function sendReminder(
  botApi: Api,
  chatId: string,
  text: string,
  logger: Logger,
): Promise<boolean> {
  try {
    // HTML parse mode is automatically applied by the global transformer
    await botApi.sendMessage(chatId, text);
    return true;
  } catch (error) {
    if (error instanceof GrammyError) {
      if (error.error_code === 403) {
        // Bot was blocked by user -- disable reminders
        logger.warn({ chatId }, "Bot blocked by user, disabling reminders");
        return false;
      }
    }
    logger.error({ chatId, error }, "Failed to send reminder");
    return false;
  }
}
```

### /reminders Command Handler
```typescript
// Source: Following project pattern (createPlanHandler, createPreferencesHandler)
export function createRemindersHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("reminders", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const settings = getReminderSettings(sqlite, chatId);

    if (!settings) {
      await ctx.reply(
        "Reminders are on by default when you have a meal plan! " +
        "Use /reminders to see your settings, or say \"mute reminders\" to pause them."
      );
      return;
    }

    const lines = [
      "<b>Reminder Settings</b>",
      "",
      `Morning summary: ${settings.morningEnabled ? "ON" : "OFF"} (${settings.morningHour}:${String(settings.morningMinute).padStart(2, "0")}am)`,
      `Prep alerts: ${settings.prepEnabled ? "ON" : "OFF"}`,
      `Timezone: ${settings.timezone}`,
      settings.mutedUntil
        ? `\nMuted until: ${formatMutedUntil(settings.mutedUntil, settings.timezone)}`
        : "",
      "",
      '<i>Say "mute reminders until Monday" or "turn off morning summary" to adjust.</i>',
    ].filter(Boolean);

    await sendFormattedMessage(ctx, lines.join("\n"));
  });

  return handler;
}
```

### Timezone Conversion (UTC storage)
```typescript
// Source: MDN Intl.DateTimeFormat docs
/**
 * Convert a user's local time on a specific date to a UTC Date.
 * Handles DST correctly via Intl.DateTimeFormat.
 */
function localTimeToUtc(
  dateStr: string,    // "2026-02-10"
  hour: number,       // 8 (8am local)
  minute: number,     // 0
  timezone: string,   // "America/New_York"
): Date {
  // Strategy: Create a UTC date, format it in the target timezone,
  // then find the offset and adjust.

  // Step 1: Start with a naive UTC guess
  const naive = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

  // Step 2: See what time that UTC instant represents in the user's timezone
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(naive);

  const localHour = Number(localParts.find(p => p.type === "hour")?.value ?? 0);
  const localMin = Number(localParts.find(p => p.type === "minute")?.value ?? 0);

  // Step 3: Calculate the difference (offset)
  const diffMinutes = (localHour * 60 + localMin) - (hour * 60 + minute);

  // Step 4: Adjust -- if local time is ahead, UTC is behind, so subtract
  const utc = new Date(naive.getTime() - diffMinutes * 60 * 1000);

  return utc;
}
```

## Discretion Recommendations

These are areas where the user gave Claude discretion to decide.

### Default Morning Summary Time: 8:00 AM local
**Rationale:** Common wake-up time for meal planners. Early enough to review before starting the day, late enough to not disturb. User can change this.

### Dinner Time Detection: User-configurable preference, default 5:30 PM
**Rationale:** Recipe-based detection is unreliable (recipes don't specify "when to eat"). A user preference (stored in reminder_settings as `dinner_hour`/`dinner_minute`) is simpler and more predictable. Default 5:30pm is a reasonable weeknight dinner start time. User can say "we eat at 6:30" and it adjusts. The start-cooking nudge fires at this time.

### Scheduling Implementation: setInterval poller (60s) over SQLite
**Rationale:**
- No new dependencies needed
- better-sqlite3 is synchronous, making polling trivially simple
- Scale is small (handful of users), no need for Redis/MongoDB-backed queue
- 60-second granularity is more than sufficient for meal reminders
- Restart safety comes from the database, not the timer

### Reminder Persistence: SQLite `reminders` table + regeneration on startup
**Rationale:**
- Reminders are rows in SQLite, queried on each poll tick
- On restart, regenerate all future reminders from active meal plans
- On plan change (save/update), delete future reminders for that plan and regenerate
- This is simpler than trying to "resume" in-flight timers

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| moment-timezone for TZ math | Intl.DateTimeFormat (built-in) | Node.js 16+ (stable in 22+) | No dependency needed for timezone handling |
| node-cron for scheduling | setInterval + DB polling | Always valid for simple cases | Fewer dependencies, simpler code |
| Template-based bot messages | LLM-generated text | 2023+ | More natural, varied, personality-consistent |

## Open Questions

1. **Exact timezone detection strategy**
   - What we know: User needs an IANA timezone stored in their settings
   - What's unclear: How to initially detect/ask for the user's timezone. Telegram doesn't provide timezone info.
   - Recommendation: Default to a reasonable timezone (America/New_York or UTC) and prompt the user on first interaction: "What timezone are you in?" Store as IANA string. Alternatively, parse from conversational cues ("I'm in Chicago" -> "America/Chicago"). The /reminders command should show current timezone so user can correct it.

2. **When to generate prep timing analysis**
   - What we know: Claude needs to analyze recipes for prep requirements (thawing, marinating, etc.)
   - What's unclear: Should this happen at plan save time or at reminder generation time?
   - Recommendation: At reminder generation time (when plan is saved/updated). The generator fetches recipe content from knowledge items, sends it to Claude with a focused prompt asking "what prep steps need advance timing?", and creates reminder rows based on Claude's analysis. This happens once per plan change, not on every poller tick.

3. **Cost of Claude calls for reminder text**
   - What we know: Each reminder calls Claude for text generation
   - What's unclear: Whether deferred text generation (at send time) vs. pre-generation (at plan save) is better
   - Recommendation: Generate text at send time (in the poller). Benefits: text is fresher, context is current, and if the plan changes between generation and delivery the reminder is already regenerated. Cost: one haiku call (~$0.001) per reminder is negligible.

## Sources

### Primary (HIGH confidence)
- **grammY parse-mode transformer source** (`node_modules/@grammyjs/parse-mode/dist/transformer.js`) -- verified that `parseMode("HTML")` adds `parse_mode: "HTML"` to ALL API method payloads via default switch case
- **grammY docs** (https://grammy.dev/guide/api) -- `bot.api.sendMessage(chatId, text)` for proactive messages
- **grammY auto-retry docs** (https://grammy.dev/plugins/auto-retry) -- handles Telegram 429 rate limits
- **MDN Intl.DateTimeFormat** (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) -- timezone-aware date formatting
- **Codebase analysis** -- existing patterns (factory functions, raw SQL init, Drizzle schema, handler Composers)
- **Telegram Bot FAQ** (https://core.telegram.org/bots/faq) -- bots cannot initiate conversations; users must message first

### Secondary (MEDIUM confidence)
- **grammY flood limits docs** (https://grammy.dev/advanced/flood) -- rate limits are "unspecified and flexible", ~30 messages/second for bulk, ~1/second per chat
- **Better Stack schedulers comparison** (https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) -- confirms setInterval is appropriate for simple polling

### Tertiary (LOW confidence)
- None -- all key claims verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using only existing project dependencies, verified from source
- Architecture: HIGH -- patterns directly mirror existing codebase (factory functions, raw SQL init, Drizzle schema, Composer handlers)
- Pitfalls: HIGH -- timezone/DST issues well-documented; Telegram restrictions verified from official FAQ
- Proactive messaging: HIGH -- `bot.api.sendMessage` + parse_mode verified from grammY source code
- Claude text generation: MEDIUM -- cost estimates are approximate; actual token usage depends on prompt design

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (stable stack, no fast-moving dependencies)
