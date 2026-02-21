# Architecture Patterns

**Domain:** v1.4 Backlog Sweep -- Recipe import (URL + photo), knowledge dedup, migration framework, update notifications, notification tone
**Researched:** 2026-02-19
**Confidence:** HIGH (based on thorough codebase analysis + official Anthropic docs + grammY docs)

## System Overview

v1.4 introduces six features that touch three distinct layers of the existing architecture:

1. **AI Layer** (src/ai/) -- New tools, vision support, system prompt additions
2. **Bot Layer** (src/bot/) -- Photo message handling, notification delivery
3. **Infrastructure Layer** (src/db/) -- Migration framework

```
                     Telegram
                        |
                   [grammY Bot]
                   /    |     \
           [text]  [photo]  [callback]
              |       |
        [MessageQueue + Debounce]
              |       |
        [Pipeline Processor] ---- assembles user content (text + images)
              |
        [Claude API] ---- tools + vision
         /    |    \
   [save_knowledge]  [import_from_url]  [import_from_photo]
         \    |    /
     [Knowledge Repository] ---- dedup search-before-save
              |
         [SQLite DB] ---- managed by migration framework (PRAGMA user_version)
              |
     [Startup Routine] ---- version check + update notifications
```

### New Components (to be created)

| Component | Location | Type |
|-----------|----------|------|
| Recipe URL fetcher | `src/knowledge/url-import.ts` | Utility module |
| Photo message handler | `src/bot/handlers/message.ts` | Extension of existing handler |
| Migration runner | `src/db/migrations.ts` | Infrastructure module (~50 LOC) |
| Migration scripts | `src/db/migrations/` | Numbered TS files |
| Update notifier | `src/notifications/update-notifier.ts` | Startup routine |

### New Dependency

| Package | Purpose |
|---------|---------|
| cheerio ^1.2.0 | HTML parsing for JSON-LD + Microdata extraction from recipe pages |

### Modified Components (existing files that change)

| Component | File | Changes |
|-----------|------|---------|
| Tool definitions | `src/ai/tools.ts` | Add `import_from_url` tool |
| Tool handler | `src/ai/tool-handler.ts` | Add URL import case (async), modify `save_knowledge` for dedup, fix `update_knowledge` validation |
| System prompt | `src/ai/system-prompt.ts` | Recipe import instructions, notification tone overhaul |
| Message handler | `src/bot/handlers/message.ts` | Handle `message:photo` in addition to `message:text` |
| Message queue | `src/pipeline/message-queue.ts` | Support image attachments in batch messages |
| Pipeline processor | `src/pipeline/processor.ts` | Build multimodal content blocks (image + text) for Claude |
| Database init | `src/db/index.ts` | Call migration runner before init functions |
| Main entry | `src/main.ts` | Run update notifications on startup |

## Component Responsibilities

### 1. Recipe URL Import (`src/knowledge/url-import.ts`)

**Responsibility:** Fetch a URL, extract recipe structured data via cheerio, return normalized recipe content.

**Why a separate module (not inline in tool handler):** URL fetching involves HTTP, HTML parsing, and JSON-LD/Microdata extraction -- too much logic for the tool handler switch case. The tool handler calls this module and gets back a clean result.

**Approach:** Three-strategy extraction pipeline using cheerio:
1. **Strategy A (preferred):** Parse HTML with cheerio, extract JSON-LD `<script type="application/ld+json">` with `@type: "Recipe"` (schema.org). Handle `@graph` nesting, arrays, and multiple script blocks. Most major recipe sites include this.
2. **Strategy B (fallback 1):** Extract Microdata via cheerio (`itemprop="recipeIngredient"`, `itemprop="recipeInstructions"`, etc.). Handles older recipe sites that use Microdata instead of JSON-LD.
3. **Strategy C (fallback 2):** Return truncated page text for Claude to parse. Handles sites without any structured data.

**Data flow:**
```
User sends URL message -> Claude calls import_from_url tool
  -> fetchAndParseRecipe(url)
    -> HTTP fetch with 10s timeout + browser-like User-Agent
    -> Parse HTML with cheerio
    -> Try JSON-LD extraction (find Recipe in @graph or top-level)
    -> If not found: try Microdata extraction
    -> If neither found: return truncated text for Claude to parse
    -> Normalize result: parse ISO 8601 durations, strip HTML from text fields
  -> Tool returns extracted recipe data to Claude
  -> Claude formats and presents to user for confirmation
  -> User approves -> Claude calls save_knowledge (with dedup check)
```

**Key decisions:**
- Use Node.js built-in `fetch()` (Node 22) -- no axios/node-fetch needed
- Use cheerio for robust HTML parsing (handles malformed HTML, multiple script blocks, Microdata)
- Set `AbortSignal.timeout(10_000)` and 2MB response size limit
- Set browser-like User-Agent and Accept headers to avoid anti-scraping blocks

**Tool handler async concern:** The current `handleToolCall` returns `string` (synchronous). URL import requires async `fetch()`. Two options:

**Option A (preferred): Make handleToolCall async.**
Change return type to `string | Promise<string>`. Update `claude-client.ts` to `await` the result:
```typescript
const result = await onToolCall(block.name, block.input as Record<string, unknown>);
```
This is a small type change that propagates cleanly.

**Option B: Pre-fetch URL before the Claude tool loop.**
Detect URLs in the user message, fetch and parse before entering the pipeline. Inject parsed data as additional context. Claude sees the parsed recipe alongside the user's message. Downside: the bot pre-fetches every URL, even non-recipe links.

**Recommendation: Option A.** Making the handler async is a cleaner architectural change. Only the URL import case is actually async; all other cases return synchronously and the `await` is a no-op.

### 2. Photo Import (Vision Pipeline Extension)

**Responsibility:** Allow users to send photos of recipes (from cookbooks, handwritten notes, screenshots) and have Claude extract the recipe using vision.

**Why extend the existing pipeline (not a separate tool):** Photo import is fundamentally different from URL import. The user sends a photo message -- there is no tool call involved. The photo goes directly to Claude as a multimodal message content block. Claude sees the image and naturally extracts the recipe from it, then offers to save it -- all within one conversation turn with full access to tools.

**Architecture changes required:**

**a) Message handler (`src/bot/handlers/message.ts`):**
```typescript
// Current: only handles message:text
messageHandler.on("message:text", (ctx) => { ... });

// New: also handle message:photo
messageHandler.on("message:photo", async (ctx) => {
  const photo = ctx.message.photo!;
  const largest = photo[photo.length - 1]; // Telegram sends array, last = largest

  // Check file size before download (5MB Anthropic API limit)
  if (largest.file_size && largest.file_size > 5 * 1024 * 1024) {
    await ctx.reply("That photo is a bit large for me. Try cropping or sending a smaller version.");
    return;
  }

  const file = await ctx.getFile();
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(fileUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  const caption = ctx.message.caption || "";

  queue.enqueue(chatId, userId, caption, ctx, processBatch, [{ base64, mediaType: "image/jpeg" }]);
});
```

**b) Message queue (`src/pipeline/message-queue.ts`):**
```typescript
// Extend PendingBatch to support image attachments
export interface PendingBatch {
  chatId: string;
  userId: string;
  messages: Array<{ text: string; timestamp: Date }>;
  images: Array<{ base64: string; mediaType: string }>; // NEW, default: []
  ctx: unknown;
}
```

**c) Pipeline processor (`src/pipeline/processor.ts`):**
```typescript
// When building the user message, check for images in the batch
if (batch.images && batch.images.length > 0) {
  // Build multimodal content array
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of batch.images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    });
  }
  if (userText) {
    content.push({ type: "text", text: userText });
  }
  fullMessages.push({ role: "user", content });
} else {
  // Existing text-only path -- UNCHANGED
  fullMessages.push({ role: "user", content: userText });
}
```

**d) Claude client (`src/ai/claude-client.ts`):**
The `sendMessageWithTools` method already accepts `Anthropic.MessageParam[]` which supports multimodal content blocks. No changes needed to the Claude client itself.

**Data flow:**
```
User sends photo (with optional caption) to Telegram
  -> grammY delivers message:photo event
  -> Handler checks file size, downloads via Telegram Bot API
  -> Converts to base64
  -> Enqueues with image attachment (images array on PendingBatch)
  -> Debounce timer fires
  -> Processor builds multimodal content block (image before text)
  -> Claude sees image + caption + system prompt + all tools
  -> Claude responds: "I see a recipe for X! Here's what I got: [recipe]"
  -> Claude offers to save -> user confirms -> save_knowledge (with dedup)
```

**Image limits:** Telegram delivers photos as JPEG, typically ~1280px on long edge. Claude accepts up to 5MB per image via API. At ~1280px, images are well within all Anthropic limits (~2,200 tokens per photo).

### 3. Knowledge Dedup Fix (save_knowledge + update_knowledge)

**Responsibility:** Prevent duplicate recipe cards. Fix the `update_knowledge` silent no-op bug.

**Design philosophy:** Claude-driven dedup, not automatic. The tool provides data (similar items found), Claude reasons about it, and the user makes the final decision. This avoids the v1.3 auto-upsert problem where distinct recipes were wrongly merged.

**Changes to `src/ai/tool-handler.ts`:**

**a) save_knowledge dedup (search-before-save):**
```typescript
case "save_knowledge": {
  const title = input.title as string;
  // Search for existing items with similar title (recipe dedup)
  const { results } = retrievalService.search(householdId, title, 3);

  // Check for exact title match (case-insensitive) -- strongest dedup signal
  const exactMatch = results.find(r =>
    r.title.toLowerCase() === title.toLowerCase()
  );

  if (exactMatch) {
    return JSON.stringify({
      warning: "duplicate_detected",
      message: `Found existing item "${exactMatch.title}" (ID: ${exactMatch.id}). Use update_knowledge to modify it, or save with a different title if this is a distinct recipe.`,
      existingItem: { id: exactMatch.id, title: exactMatch.title, summary: exactMatch.summary },
    });
  }

  // Check for similar matches (weaker signal -- inform Claude but don't block)
  const similarItems = results.filter(r => r.tags.includes("recipe")).slice(0, 2);
  // ... proceed with normal save, include similar items in response for Claude's awareness
}
```

**b) update_knowledge validation:**
```typescript
case "update_knowledge": {
  // Validate at least one content field is provided
  if (title === undefined && summary === undefined && content === undefined && tags === undefined) {
    return JSON.stringify({
      error: "No update fields provided. Include at least one of: title, summary, content, tags.",
    });
  }
  // ... rest of existing handler
}
```

**c) System prompt update:**
Add to `<recipe_management>` section:
```
DEDUP BEHAVIOR:
- save_knowledge checks for duplicates before saving
- If it returns a "duplicate_detected" warning with an existing item, evaluate whether they are truly the same recipe
- Same recipe, different source: use update_knowledge on the existing item
- Different recipe, similar name: save with a more specific title to differentiate
- Ask the user if you are unsure
```

### 4. Data Migration Framework (`src/db/migrations.ts`)

**Responsibility:** Run numbered, idempotent migration scripts on startup. Track which have run via `PRAGMA user_version`.

**Why `PRAGMA user_version`:** It is a single integer built into SQLite -- zero schema overhead, reads/writes atomically, no extra table needed. Sufficient for sequential migrations (no cherry-picking needed in this project).

**Why build our own:** ~50 LOC. The project already has ad-hoc migrations. A dedicated runner is simple and avoids adding a dependency for trivial functionality.

**Design:**

```typescript
// src/db/migrations.ts
import type BetterSqlite3 from "better-sqlite3";
import type { Logger } from "pino";

export interface Migration {
  version: number;
  description: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

export function runMigrations(
  sqlite: BetterSqlite3.Database,
  migrations: Migration[],
  logger: Logger,
): void {
  const current = sqlite.pragma("user_version", { simple: true }) as number;
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const pending = sorted.filter(m => m.version > current);

  for (const migration of pending) {
    logger.info({ version: migration.version, description: migration.description }, "Running migration");
    sqlite.transaction(() => {
      migration.up(sqlite);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();
  }

  if (pending.length > 0) {
    logger.info({ from: current, to: pending[pending.length - 1].version, count: pending.length }, "Migrations complete");
  }
}
```

**Baseline migration (handles existing databases):**
```typescript
// src/db/migrations/001-baseline.ts
// Detects current database state and establishes version 1.
// On a fresh database: no-op (tables created by init functions).
// On existing database: just sets the version marker.
export const migration: Migration = {
  version: 1,
  description: "Baseline -- establish migration versioning",
  up(sqlite) {
    // Nothing to do. The existing database is already at the correct state.
    // This migration exists solely to set user_version = 1 so future
    // migrations know the starting point.
  },
};
```

**Integration with `src/db/index.ts`:**
```typescript
// Run migrations FIRST, before any init functions
runMigrations(sqlite, allMigrations, logger);

// Then existing init functions (which use CREATE TABLE IF NOT EXISTS)
initializeCoreTables(sqlite);
initializeFts(sqlite);
// ... etc
```

**Why migrations run BEFORE init functions:** If a migration adds a column that an init function's trigger references, the init function must see the updated schema. Running migrations first ensures the database is at the expected state before any init code executes.

### 5. Bot Update Notification System (`src/notifications/`)

**Responsibility:** When the bot version changes, notify users about new features.

**Architecture decision: Startup proactive notification with rate limiting.**

Rationale: On-demand (check version each message) adds latency to every message. A startup-based approach runs once per deploy. The bot already has startup routines (reminder regeneration, feedback expiration).

**Design:**

```typescript
// src/notifications/update-notifier.ts
export function createUpdateNotifier(deps: {
  sqlite: BetterSqlite3.Database;
  bot: BotApi;
  logger: Logger;
  currentVersion: string;
  isDev: boolean;
}) {
  return {
    async notifyAll(): Promise<void> {
      // Skip in dev mode (avoid spam during tsx watch restarts)
      if (deps.isDev) return;

      // Get users with stale version
      const users = deps.sqlite.prepare(
        "SELECT telegram_id FROM users WHERE last_seen_version < ? OR last_seen_version IS NULL"
      ).all(deps.currentVersion) as Array<{ telegram_id: string }>;

      if (users.length === 0) return;

      const notes = RELEASE_NOTES[deps.currentVersion];
      if (!notes) return;

      for (const user of users) {
        try {
          await deps.bot.api.sendMessage(user.telegram_id, notes, { parse_mode: "HTML" });
          deps.sqlite.prepare("UPDATE users SET last_seen_version = ? WHERE telegram_id = ?")
            .run(deps.currentVersion, user.telegram_id);
          // Rate limit: 100ms between sends
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: unknown) {
          const err = error as { error_code?: number };
          if (err.error_code === 403) {
            // User blocked the bot -- skip, do NOT update their version
            deps.logger.warn({ telegramId: user.telegram_id }, "Bot blocked, skipping notification");
          }
        }
      }
    }
  };
}
```

**Version tracking:** Add `last_seen_version TEXT` column to users table via migration 002. Store current version in `package.json` (update to `"1.4.0"`).

**Release notes:** Simple TypeScript map in `src/notifications/release-notes.ts`:
```typescript
export const RELEASE_NOTES: Record<string, string> = {
  "1.4.0": `<b>What's new!</b>\n\n- Send me a recipe link and I'll save it for you\n- Snap a photo of a recipe and I'll read it\n- Smarter recipe saving with duplicate detection`,
};
```

### 6. Notification Tone Overhaul

**Purely a content change, not an architecture change.** Files to modify:

| File | What Changes |
|------|-------------|
| `src/reminders/sender.ts` | `REMINDER_SYSTEM_PROMPT`, `PREP_ALERT_SYSTEM_PROMPT`, `getFallbackText()` |
| `src/feedback/sender.ts` | Check-in message templates |
| `src/ai/system-prompt.ts` | Audit prompt sections for consistency with Sous persona |

**No new modules needed.**

## Patterns to Follow

### Pattern 1: Tool Handler Delegation
**What:** Tool handlers delegate complex logic to dedicated modules.
**When:** Any tool handler case exceeding ~20 lines of logic.
**Example:** URL import: `tool-handler.ts` calls `fetchAndParseRecipe()` from `url-import.ts`.

### Pattern 2: Graceful Degradation for External Fetches
**What:** URL import and photo download fail gracefully with user-friendly messages.
**When:** Any operation hitting an external service.
**Example:**
```typescript
try {
  const result = await fetchAndParseRecipe(url);
  return JSON.stringify(result);
} catch (error) {
  return JSON.stringify({
    error: "Could not fetch that URL. The site might be down or blocking bots.",
    suggestion: "Try copy-pasting the recipe text directly instead."
  });
}
```

### Pattern 3: Migration Idempotency
**What:** Every migration must be safe to run on a database where it has partially completed.
**When:** Writing any migration.
**Example:** The transaction wrapper in `runMigrations` ensures atomicity. Use defensive SQL (`ALTER TABLE ... ADD COLUMN` with a pre-check via `PRAGMA table_info()` for older SQLite versions).

### Pattern 4: Claude as Reasoning Engine
**What:** Tools provide data, Claude makes decisions. Dedup, format validation, extraction quality -- all Claude's job.
**When:** Any feature where the "right" action depends on context.
**Example:** Dedup returns similar items to Claude. Claude evaluates whether they're duplicates. Claude asks user if uncertain.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Claude Call for Photo Processing
**What:** Creating a dedicated Claude API call just for image analysis, separate from the main pipeline.
**Why bad:** Doubles API costs, breaks conversation context, loses access to tools.
**Instead:** Extend the existing pipeline to support multimodal messages. Photo becomes part of the user's message content block.

### Anti-Pattern 2: Eager URL Fetching in Message Handler
**What:** Detecting URLs in the message handler and pre-fetching them before passing to Claude.
**Why bad:** The bot can't know if a URL is a recipe link. Claude should decide whether to call the import tool.
**Instead:** Let Claude see the URL, decide it's a recipe link, and call `import_from_url`.

### Anti-Pattern 3: Hard Dedup (Rejecting Saves)
**What:** Making `save_knowledge` refuse to save when a duplicate is detected.
**Why bad:** Users might genuinely want separate copies. The v1.3 auto-upsert was reverted for this reason.
**Instead:** Return a warning with existing item details. Let Claude and user decide.

### Anti-Pattern 4: Over-engineered Migration Framework
**What:** Building rollback support, dry-run mode, CLI tool, version branches.
**Why bad:** HeySous has ~12 tables and will add 2-3 more. Enterprise-grade framework for a single-developer project.
**Instead:** ~50 LOC runner, `PRAGMA user_version`, forward-only migrations, run on startup.

## Build Order (Dependency-Aware)

```
Phase 1: Migration Framework          (no dependencies, enables everything else)
Phase 2: Knowledge Dedup Fix          (no schema changes needed, pure logic fix)
Phase 3: Notification Tone Overhaul   (no dependencies, pure content)
Phase 4: Recipe URL Import            (depends on: dedup fix, cheerio installed)
Phase 5: Recipe Photo Import          (depends on: URL import patterns established)
Phase 6: Update Notification System   (depends on: migration framework for schema)
```

**Rationale:**
- Migration framework first because update notifications need a schema change (`last_seen_version` column).
- Dedup fix before URL/photo import because imported recipes should go through dedup check.
- URL import before photo import because they share the save-to-knowledge flow, and URL is simpler.
- Update notifications last because they depend on migration framework and are least time-sensitive.
- Notification tone is independent and slots early to establish voice before new notification types.

## Integration Points Summary

| Feature | Touches | Integration Complexity |
|---------|---------|----------------------|
| Migration framework | `src/db/index.ts`, new `src/db/migrations.ts`, new `src/db/migrations/` | LOW -- isolated infrastructure |
| Knowledge dedup | `src/ai/tool-handler.ts`, `src/ai/tools.ts`, `src/ai/system-prompt.ts` | LOW -- modifying existing switch cases |
| Notification tone | `src/reminders/sender.ts`, `src/feedback/sender.ts` | LOW -- text changes only |
| URL import | New `src/knowledge/url-import.ts`, `src/ai/tools.ts`, `src/ai/tool-handler.ts`, `src/ai/system-prompt.ts`, `src/pipeline/processor.ts` | MEDIUM -- new tool + module + async handler change |
| Photo import | `src/bot/handlers/message.ts`, `src/pipeline/message-queue.ts`, `src/pipeline/processor.ts` | MEDIUM -- pipeline extension (highest regression risk) |
| Update notifications | New `src/notifications/`, `src/main.ts`, migration for schema | MEDIUM -- new subsystem + startup hook |

## Sources

- [Anthropic Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- image content block format, size limits, supported types (HIGH confidence)
- [grammY File Handling](https://grammy.dev/guide/files) -- photo download via bot API (HIGH confidence)
- [Schema.org Recipe type](https://schema.org/Recipe) -- JSON-LD recipe structured data format (HIGH confidence)
- [cheerio documentation](https://cheerio.js.org/) -- HTML parsing API (HIGH confidence)
- SQLite `PRAGMA user_version` -- built-in migration tracking (HIGH confidence)
- Codebase analysis of all files in src/ (HIGH confidence)
