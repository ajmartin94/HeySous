# Phase 1: Bot Foundation - Research

**Researched:** 2026-02-05
**Domain:** Telegram bot infrastructure (grammY, Node.js/TypeScript, SQLite/Drizzle)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- HTML parse mode over MarkdownV2 for Telegram formatting (from roadmap)
- grammY as the Telegram bot framework (from roadmap)
- Node.js + TypeScript + SQLite/Drizzle as the stack (from roadmap)

### Claude's Discretion
User indicated no gray areas need discussion for this phase. All implementation decisions are at Claude's discretion:

- Message formatting approach (HTML formatting density, structure of typical replies)
- Long message splitting strategy (chunk size, split boundaries, delay between messages)
- Typing indicator behavior (when to show/hide, behavior during processing)
- Pre-Claude response behavior (what the bot replies with before Phase 2 integrates Claude)
- Project scaffolding choices (file structure, configuration patterns, tooling setup)

Standard approaches and best practices should be applied throughout.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Summary

This phase establishes the Telegram bot transport layer using grammY (v1.39.x), Node.js with TypeScript, and SQLite via Drizzle ORM with better-sqlite3. The bot must receive messages and respond with cleanly formatted HTML, split long responses at natural boundaries (4096 char Telegram limit), and show typing indicators during processing.

grammY is a mature, well-documented framework with an official plugin ecosystem covering parse mode defaults (`@grammyjs/parse-mode`), auto chat actions (`@grammyjs/auto-chat-action`), and modular code organization via Composer. The recommended pattern uses webhook mode with Express for production (aligned with Phase 2's async processing requirement) but long polling for initial development. Drizzle ORM with better-sqlite3 provides synchronous, high-performance local SQLite access with type-safe schemas and migration support.

The key technical challenges are: (1) HTML formatting with graceful fallback when tags are malformed, (2) splitting messages at paragraph/sentence boundaries without breaking HTML entities, and (3) maintaining typing indicators across processing durations longer than the 5-second auto-clear window. All three have well-established solutions documented below.

**Primary recommendation:** Use grammY with Express webhooks, the parse-mode and auto-chat-action plugins, better-sqlite3 via Drizzle ORM, and a modular Composer-based project structure that anticipates Phase 2's async pipeline integration.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.39.x | Telegram Bot framework | Official, TypeScript-first, plugin ecosystem, active development |
| express | 4.x | HTTP server for webhooks | grammY has first-class `webhookCallback("express")` adapter |
| drizzle-orm | 0.45.x | Type-safe ORM for SQLite | Type-safe schemas, migration support, lightweight |
| better-sqlite3 | 11.x | SQLite driver | Synchronous API, fastest Node.js SQLite driver, simpler than libsql for local use |
| typescript | 5.x | Language | Type safety, required by grammY ecosystem |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/parse-mode | 2.x | Default parse mode + `ctx.replyWithHTML()` | Every message send -- sets HTML as default parse mode |
| @grammyjs/auto-chat-action | 0.x | Automatic typing indicators | Middleware -- auto-sends "typing" during handler execution |
| drizzle-kit | latest | Schema migrations | Development -- generate and run migrations |
| tsx | latest | TypeScript execution | Development -- run TS directly without compile step |
| dotenv | latest | Environment variable loading | Configuration -- load BOT_TOKEN etc. from .env |
| pino | latest | Structured JSON logging | All logging -- structured, fast, production-ready |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | @libsql/client | libsql adds async API and remote DB support, but overkill for local SQLite; better-sqlite3 is faster for local use |
| Express | Hono/Fastify | Hono is lighter, Fastify is faster, but Express has the most grammY documentation and examples |
| pino | winston/console.log | Pino is significantly faster and structured; winston is heavier; console.log has no structure |

**Installation:**
```bash
npm install grammy @grammyjs/parse-mode @grammyjs/auto-chat-action express better-sqlite3 drizzle-orm dotenv pino
npm install -D typescript @types/node @types/express @types/better-sqlite3 drizzle-kit tsx pino-pretty
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  bot/
    index.ts            # Bot instance creation, plugin registration
    context.ts          # Custom context type definition
    handlers/
      start.ts          # /start command handler
      message.ts        # General message handler (pre-Claude echo/ack)
    middlewares/
      error-handler.ts  # Error boundary middleware
  telegram/
    formatter.ts        # HTML formatting utilities
    splitter.ts         # Message splitting logic (4096 char limit)
    sender.ts           # Reliable message delivery (split + typing + send)
  db/
    index.ts            # Database connection (better-sqlite3 + Drizzle)
    schema.ts           # Drizzle table definitions
  config.ts             # Environment variable loading and validation
  server.ts             # Express server with webhook endpoint
  main.ts               # Entry point -- wires everything together
drizzle/                # Generated migration files
drizzle.config.ts       # Drizzle Kit configuration
.env                    # BOT_TOKEN, DB_FILE_NAME, etc.
.env.example            # Template for required env vars
tsconfig.json           # TypeScript configuration
package.json
```

### Pattern 1: Custom Context Type with Plugin Flavors
**What:** grammY uses TypeScript generics to compose context types from plugins
**When to use:** Always -- required for type-safe plugin access
**Example:**
```typescript
// Source: https://grammy.dev/plugins/parse-mode
import { Context } from "grammy";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";

export type BotContext = ParseModeFlavor<AutoChatActionFlavor<Context>>;
```

### Pattern 2: Bot Instance with Plugin Registration
**What:** Create bot with typed context and register plugins as middleware
**When to use:** Bot initialization
**Example:**
```typescript
// Source: https://grammy.dev/plugins/parse-mode, https://grammy.dev/guide/getting-started
import { Bot } from "grammy";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import type { BotContext } from "./context.js";

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Set default parse mode to HTML for all outgoing messages
  bot.api.config.use(parseMode("HTML"));

  // Add plugin middleware
  bot.use(hydrateReply);
  bot.use(autoChatAction());

  return bot;
}
```

### Pattern 3: Modular Handlers via Composer
**What:** Each feature area exports a Composer that the bot mounts
**When to use:** Any handler group (commands, message types, etc.)
**Example:**
```typescript
// Source: https://grammy.dev/advanced/structuring
import { Composer } from "grammy";
import type { BotContext } from "../context.js";

export const startHandler = new Composer<BotContext>();

startHandler.command("start", async (ctx) => {
  await ctx.reply("Welcome! I'm your meal planning assistant.");
});
```

### Pattern 4: Webhook Setup with Express
**What:** Express receives Telegram updates via webhook and passes to grammY
**When to use:** Production deployment (Phase 2 builds async processing on this)
**Example:**
```typescript
// Source: https://grammy.dev/guide/deployment-types
import express from "express";
import { webhookCallback } from "grammy";
import { createBot } from "./bot/index.js";

const app = express();
app.use(express.json());

const bot = createBot(process.env.BOT_TOKEN!);

// Mount grammY webhook handler
app.use(`/webhook/${bot.token}`, webhookCallback(bot, "express"));

// Health check endpoint
app.get("/health", (_req, res) => res.send("ok"));

app.listen(process.env.PORT || 3000);

// Set webhook URL with Telegram
await bot.api.setWebhook(`${process.env.WEBHOOK_URL}/webhook/${bot.token}`);
```

### Pattern 5: Development with Long Polling
**What:** Use `bot.start()` for local development without needing a public URL
**When to use:** Local development only
**Example:**
```typescript
// Source: https://grammy.dev/guide/getting-started
// In development mode, use long polling instead of webhooks
if (process.env.NODE_ENV !== "production") {
  bot.start();
  console.log("Bot started in polling mode");
}
```

### Anti-Patterns to Avoid
- **Calling bot.start() with webhooks:** Never call `bot.start()` when using webhook mode. It starts long polling which conflicts with webhook processing.
- **Blocking webhook handlers:** grammY's webhook handler has a 10-second timeout. Long-running operations must be queued asynchronously (this is Phase 2's domain). For Phase 1, responses should be fast enough to stay within the timeout.
- **Hardcoding parse_mode per message:** Use the parse-mode plugin to set HTML as default globally, not per `ctx.reply()` call.
- **Building custom typing indicator loops:** Use `@grammyjs/auto-chat-action` plugin instead of manual `setInterval` + `sendChatAction` patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parse mode defaults | Per-message `parse_mode: "HTML"` parameter | `@grammyjs/parse-mode` plugin with `parseMode("HTML")` transformer | Plugin handles all API methods automatically, not just `reply` |
| Typing indicators | Manual `setInterval` calling `sendChatAction` | `@grammyjs/auto-chat-action` plugin | Handles repeat interval, cleanup, cancellation automatically |
| Webhook HTTP handling | Custom HTTP server parsing Telegram updates | `webhookCallback(bot, "express")` | Handles signature verification, JSON parsing, error handling |
| HTML entity escaping | Manual regex replacement of `<>&"` | Dedicated escape function (simple but must be consistent) | Must escape user-provided content to prevent HTML injection |
| Database migrations | Manual SQL `CREATE TABLE` scripts | `drizzle-kit push` (dev) / `drizzle-kit generate` + `migrate` (prod) | Tracks schema changes, generates migration SQL, handles rollbacks |

**Key insight:** grammY's plugin ecosystem handles the most common bot infrastructure concerns. The framework is designed so you compose plugins rather than implement infrastructure.

## Common Pitfalls

### Pitfall 1: HTML Formatting Errors Kill Message Delivery
**What goes wrong:** Telegram returns `400 Bad Request: can't parse entities` when HTML is malformed (unclosed tags, unsupported tags like `<br>`, unescaped `<>&` in content).
**Why it happens:** Telegram's HTML parser is strict. User-generated content may contain `<` or `&` characters. Claude responses (in Phase 2) may include unsupported HTML tags.
**How to avoid:** Implement a two-layer strategy: (1) sanitize/escape all dynamic content before inserting into HTML templates, (2) wrap every `sendMessage` call with a try/catch that falls back to plain text (no parse_mode) on formatting errors.
**Warning signs:** `GrammyError` with description containing "can't parse entities"

### Pitfall 2: Message Splitting Breaks HTML Tags
**What goes wrong:** Splitting a 6000-char message at position 4096 lands in the middle of `<b>some text</b>`, producing invalid HTML in both halves.
**Why it happens:** Naive character-count splitting ignores HTML tag boundaries.
**How to avoid:** Split on plain text content boundaries (paragraphs first via `\n\n`, then sentences via `. `, then words), not raw character positions. Count characters after stripping HTML tags, but preserve the tags in the output. Alternatively, split before formatting.
**Warning signs:** First message chunk renders fine, second chunk has broken formatting or plain text where HTML was expected.

### Pitfall 3: Typing Indicator Disappears Before Response
**What goes wrong:** User sees "typing..." briefly, then nothing for 10+ seconds, then a response appears.
**Why it happens:** `sendChatAction("typing")` only lasts 5 seconds. It's also cleared when a message arrives from the bot. Without the auto-chat-action plugin, you must manually repeat the call.
**How to avoid:** Use `@grammyjs/auto-chat-action` middleware which automatically repeats the typing indicator every ~5 seconds until processing completes.
**Warning signs:** Typing indicator flickers or disappears during long operations.

### Pitfall 4: Webhook Timeout (10 seconds)
**What goes wrong:** grammY throws an error if middleware doesn't complete within 10 seconds in webhook mode.
**Why it happens:** Telegram expects a quick HTTP response to webhook deliveries. grammY enforces this with a timeout.
**How to avoid:** For Phase 1, this is unlikely since responses are simple. For Phase 2 (Claude integration), the async pipeline pattern is critical. Design Phase 1's architecture to support easy insertion of async processing.
**Warning signs:** `Error: Request timed out` in webhook mode.

### Pitfall 5: Telegram Rate Limits
**What goes wrong:** Bot gets rate-limited when sending many messages quickly (e.g., splitting a long response into 5 chunks sent instantly).
**Why it happens:** Telegram limits ~1 message/second per chat, ~30 messages/second globally.
**How to avoid:** Add a small delay (300-500ms) between sending split message chunks. The auto-chat-action plugin handles typing indicator rate limiting automatically.
**Warning signs:** `GrammyError` with error code 429 (Too Many Requests) and `retry_after` parameter.

### Pitfall 6: Bot Token Exposure
**What goes wrong:** Bot token committed to git or logged in console output.
**Why it happens:** Token placed directly in code rather than environment variables.
**How to avoid:** Always load token from environment variables via dotenv. Add `.env` to `.gitignore`. Provide `.env.example` with placeholder values. Never log the full token.
**Warning signs:** `.env` file in git history.

## Code Examples

### HTML Formatting Utilities
```typescript
// Escape user-provided content for safe HTML embedding
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Format a bot response with HTML
export function formatResponse(text: string): string {
  // Example: wrap section headers in bold
  return text.replace(/^(#{1,3})\s+(.+)$/gm, "<b>$2</b>");
}
```

### Message Splitting at Natural Boundaries
```typescript
// Source: Custom implementation based on Telegram 4096 char limit
const MAX_LENGTH = 4096;

export function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LENGTH) {
    let splitAt = remaining.lastIndexOf("\n\n", MAX_LENGTH);  // paragraph
    if (splitAt === -1 || splitAt < MAX_LENGTH * 0.3) {
      splitAt = remaining.lastIndexOf("\n", MAX_LENGTH);       // line break
    }
    if (splitAt === -1 || splitAt < MAX_LENGTH * 0.3) {
      splitAt = remaining.lastIndexOf(". ", MAX_LENGTH);       // sentence
    }
    if (splitAt === -1 || splitAt < MAX_LENGTH * 0.3) {
      splitAt = remaining.lastIndexOf(" ", MAX_LENGTH);        // word
    }
    if (splitAt === -1) {
      splitAt = MAX_LENGTH;                                     // hard cut (last resort)
    }

    chunks.push(remaining.substring(0, splitAt).trimEnd());
    remaining = remaining.substring(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
```

### Reliable Message Sender with Fallback
```typescript
// Source: Pattern combining grammY docs with Telegram API error handling
import { GrammyError } from "grammy";
import type { BotContext } from "./bot/context.js";

const CHUNK_DELAY_MS = 300;

export async function sendFormattedMessage(
  ctx: BotContext,
  text: string,
): Promise<void> {
  const chunks = splitMessage(text);

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await delay(CHUNK_DELAY_MS);
    }

    try {
      // Attempt HTML-formatted send (parse_mode set globally by plugin)
      await ctx.reply(chunks[i]);
    } catch (error) {
      if (
        error instanceof GrammyError &&
        error.description.includes("can't parse entities")
      ) {
        // Fallback: send as plain text
        await ctx.api.sendMessage(ctx.chat!.id, chunks[i]);
      } else {
        throw error;
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Database Setup with Drizzle + better-sqlite3
```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const sqlite = new Database(process.env.DB_FILE_NAME || "data/heysous.db");

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
```

### Drizzle Schema Example (minimal for Phase 1)
```typescript
// Source: https://orm.drizzle.team/docs/column-types/sqlite
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Minimal schema for Phase 1 -- will be extended in later phases
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Error Handler Setup
```typescript
// Source: https://grammy.dev/guide/errors
import { GrammyError, HttpError } from "grammy";
import type { BotError } from "grammy";
import type { BotContext } from "./context.js";
import { logger } from "../logger.js";

export function setupErrorHandler(bot: Bot<BotContext>): void {
  bot.catch((err: BotError<BotContext>) => {
    const ctx = err.ctx;
    logger.error(
      {
        updateId: ctx.update.update_id,
        error: err.error,
      },
      `Error while handling update ${ctx.update.update_id}`,
    );

    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error({ description: e.description }, "Telegram API error");
    } else if (e instanceof HttpError) {
      logger.error("Could not contact Telegram");
    }
  });
}
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node for dev | tsx (esbuild-powered) | 2023-2024 | Faster startup, better ESM support, zero config |
| Manual typing loops | @grammyjs/auto-chat-action | grammY plugin ecosystem | No manual setInterval/clearInterval, automatic cleanup |
| Per-message parse_mode | @grammyjs/parse-mode transformer | grammY plugin ecosystem | Global default, specialized reply methods, fmt template literals |
| CommonJS modules | ESM (NodeNext) | Node.js 18+ | Native ESM support, better tree-shaking |
| Drizzle push-only | Drizzle generate + migrate | Drizzle Kit improvements | Proper migration files for production deployments |

**Deprecated/outdated:**
- **ts-node:** Slower, frequent ESM compatibility issues. Use tsx instead.
- **MarkdownV2 parse mode:** Extremely finicky escaping rules. HTML parse mode is simpler and more reliable (project decision already locked this).
- **node-telegram-bot-api:** Older, less maintained Node.js Telegram library. grammY is the modern TypeScript-first choice.

## Open Questions

1. **Database schema scope for Phase 1**
   - What we know: Phase 1 needs basic message logging at minimum. Later phases add knowledge, recipes, preferences, reminders.
   - What's unclear: Should Phase 1 define a minimal schema or just set up the connection and migration infrastructure?
   - Recommendation: Define a minimal `messages` table for logging. The migration infrastructure will allow easy extension in later phases.

2. **Pre-Claude response behavior**
   - What we know: Phase 1 has no Claude integration. The bot needs to respond to messages.
   - What's unclear: Should it echo messages, respond with a static greeting, or something else?
   - Recommendation: Echo the user's message back (proves message receipt and response delivery work). Add a `/start` command with a welcome message. This makes Phase 1 independently testable.

3. **Webhook vs polling for Phase 1 development**
   - What we know: Phase 2 requires webhooks for async processing. Local development is easier with long polling.
   - What's unclear: Should Phase 1 implement both modes or start with one?
   - Recommendation: Implement both, controlled by `BOT_MODE` env var ("polling" for dev, "webhook" for prod). This matches the bot-base template pattern and avoids a rewrite in Phase 2.

4. **Zod version pinning**
   - What we know: STATE.md flags Zod 4 incompatibility with @anthropic-ai/sdk (Phase 2 concern).
   - What's unclear: Whether to preemptively pin Zod 3.24.x now.
   - Recommendation: Do not install Zod in Phase 1 at all. It's not needed for bot foundation. Address in Phase 2 when the Anthropic SDK is introduced.

## Sources

### Primary (HIGH confidence)
- [grammY official docs](https://grammy.dev/) - Getting started, deployment types, error handling, structuring, plugins
- [grammY parse-mode plugin](https://grammy.dev/plugins/parse-mode) - Installation, setup, ctx.replyWithHTML, parseMode transformer
- [grammY auto-chat-action plugin](https://github.com/grammyjs/auto-chat-action) - README with setup and usage
- [Telegram Bot API](https://core.telegram.org/bots/api) - HTML formatting tags, sendMessage, sendChatAction, message limits
- [Drizzle ORM docs](https://orm.drizzle.team/docs/get-started/sqlite-new) - SQLite setup, schema definition, migrations
- [Telegram limits](https://limits.tginfo.me/en) - 4096 char message limit, rate limits

### Secondary (MEDIUM confidence)
- [bot-base/telegram-bot-template](https://github.com/bot-base/telegram-bot-template) - Community template showing project structure patterns, verified against grammY docs
- [Better Stack tsx guide](https://betterstack.com/community/guides/scaling-nodejs/tsx-explained/) - tsx runner recommendation, verified against official tsx docs
- [SQLite driver benchmark](https://sqg.dev/blog/sqlite-driver-benchmark) - better-sqlite3 vs libsql performance comparison

### Tertiary (LOW confidence)
- WebSearch results for Telegram message splitting patterns - community approaches, not officially documented
- WebSearch results for tsconfig recommended settings - aggregated from multiple sources, may vary by project needs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, versions confirmed via npm
- Architecture: HIGH - Patterns from official grammY docs and established community template
- Pitfalls: HIGH - HTML formatting errors and typing indicator behavior confirmed via official Telegram API docs and grammY issue tracker
- Message splitting: MEDIUM - Telegram 4096 limit is official, but splitting strategy is custom implementation (no standard library for this)
- Project structure: MEDIUM - Based on community template and grammY structuring guide, adapted for this project's needs

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stack is stable, grammY has frequent but non-breaking minor releases)
