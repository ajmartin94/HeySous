# Stack Research

**Domain:** Conversational AI Telegram Bot (Meal Planning Assistant)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 22.x LTS | Runtime | Maintenance LTS until 2027-04. Stable, widely supported. Node 24 (Active LTS) is available but 22 has broader ecosystem compatibility with native modules like better-sqlite3. Choose 22 for stability; upgrade to 24 later is trivial. | HIGH |
| TypeScript | 5.9.x | Language | Type safety across the entire stack -- from Telegram webhook payloads to Claude API calls to database schemas. grammY, Drizzle, and @anthropic-ai/sdk all provide first-class TypeScript types. Non-negotiable for a project that wires multiple APIs together. | HIGH |
| grammY | 1.39.x | Telegram Bot Framework | Dominant Node.js Telegram framework with ~1.2M weekly npm downloads (vs Telegraf's ~160K). Built TypeScript-first with clean types. Powerful middleware and plugin system. Excellent webhook support. Active development with latest release days old. | HIGH |
| @anthropic-ai/sdk | 0.73.x | Claude API Client | Official Anthropic SDK. Native TypeScript. Built-in tool use / function calling support with Zod integration via `betaZodTool`. Structured outputs with `strict: true`. Streaming support. This is the only SDK to use -- no wrappers, no abstraction layers. | HIGH |
| SQLite via better-sqlite3 | 12.6.x | Database Engine | Single-user personal project -- PostgreSQL is overkill. SQLite is zero-config, zero-server, embedded in the process. WAL mode handles concurrent reads/writes. Stores recipe content, conversation history, preferences, grocery lists. File-based backup is trivial (copy one file). | HIGH |
| Drizzle ORM | 0.45.x | Database Access Layer | SQL-first ORM that generates transparent, predictable queries. Native better-sqlite3 driver support. Schema defined in TypeScript with full type inference. Prepared statements for performance. Drizzle Kit for migrations. Lightweight -- no heavy abstraction over SQL. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.x | Schema Validation | Validate all external inputs: Telegram webhook payloads, Claude API responses, user-provided recipe data. Integrates with both Drizzle (schema inference) and @anthropic-ai/sdk (tool definitions via `betaZodTool`). The glue that makes TypeScript types runtime-safe. |
| node-cron | 4.2.x | Job Scheduling | Schedule recurring checks: morning prep reminders, evening feedback prompts, weekly planning nudges. Lightweight, in-process, cron-expression based. No external dependencies (no Redis, no MongoDB). Sufficient for single-user -- if scaling to multi-user, migrate to BullMQ + Redis. |
| pino | 10.3.x | Structured Logging | JSON logging for production. Fast (low overhead). Structured format makes it searchable. Use with pino-pretty (13.1.x) in development for human-readable output. |
| dotenv | 17.2.x | Environment Config | Load ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, and other secrets from .env file. Standard pattern. |
| @grammyjs/conversations | 2.1.x | Multi-step Conversations | Handle multi-turn flows: recipe input, weekly planning dialogue, grocery list review. Manages conversation state across multiple messages without manual state machines. |
| @grammyjs/runner | 2.0.x | Concurrent Update Processing | Process multiple Telegram updates concurrently. Useful when bot handles multiple message types (text, photos for recipes, callback queries). |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| tsx | 4.21.x | TypeScript Runner | Run .ts files directly without compilation step. Powered by esbuild -- fast startup. Use for development (`tsx watch src/index.ts`). Zero config needed. |
| Vitest | 4.0.x | Test Runner | Native TypeScript/ESM support. Fast. Compatible with the same assertion patterns as Jest but without configuration pain. Use for unit tests of recipe parsing, meal planning logic, reminder scheduling. |
| drizzle-kit | 0.31.x | Database Migrations | Generate and run SQL migrations from schema changes. Produces readable .sql files you can inspect. Paired with drizzle-orm. |
| pino-pretty | 13.1.x | Dev Log Formatting | Pretty-print pino JSON logs during development. Do NOT use in production (performance overhead). |
| TypeScript | 5.9.x | Type Checker | Run `tsc --noEmit` for type checking. tsx does not type-check -- it only transpiles. CI should run both `tsc --noEmit` and `vitest`. |

## Project Structure

```
meal-planning-bot/
  src/
    index.ts              # Entry point: webhook server + bot setup
    bot/
      bot.ts              # grammY bot instance, middleware registration
      commands/           # Command handlers (/plan, /recipe, /list, /help)
      conversations/      # Multi-step flows (planning, recipe input)
      middleware/          # Auth, logging, error handling
    ai/
      claude.ts           # Claude API wrapper: send message, tool definitions
      tools/              # Tool implementations Claude can call
      prompts/            # System prompts, prompt templates
    db/
      schema.ts           # Drizzle schema definitions
      migrations/         # SQL migration files
      index.ts            # Database connection, exported queries
    scheduler/
      reminders.ts        # Reminder scheduling logic
      jobs.ts             # Cron job definitions
    types/                # Shared TypeScript types
  drizzle.config.ts       # Drizzle Kit configuration
  tsconfig.json
  .env
  data/                   # SQLite database file lives here
    meal-planner.db
```

## Installation

```bash
# Core dependencies
npm install grammy @grammyjs/conversations @grammyjs/runner @anthropic-ai/sdk better-sqlite3 drizzle-orm zod node-cron pino dotenv

# Type definitions for packages that need them
npm install -D @types/better-sqlite3 @types/node-cron @types/node

# Development tools
npm install -D typescript tsx vitest drizzle-kit pino-pretty
```

## Key Configuration

### tsconfig.json essentials

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### package.json essentials

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --import tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### SQLite with WAL mode

```typescript
import Database from 'better-sqlite3';
const db = new Database('./data/meal-planner.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Telegram Framework | grammY | Telegraf 4.x | Only if maintaining an existing Telegraf codebase. For new projects, grammY is strictly better: cleaner types, more downloads, better docs. |
| Telegram Framework | grammY | node-telegram-bot-api | Never for this project. Low-level, no middleware system, no TypeScript-first design. Only use if you need raw API access without any framework. |
| Database | SQLite + better-sqlite3 | PostgreSQL | When you need multi-user with concurrent write-heavy workloads, or when you need hosted database as a service (e.g., Supabase, Neon). For single-user, PostgreSQL adds operational complexity for zero benefit. |
| Database | SQLite + better-sqlite3 | libSQL (Turso) | When you need edge replication or multi-region access. Turso is SQLite-compatible with sync capabilities. Interesting for v2 multi-user, but premature for v1. |
| ORM | Drizzle | Prisma | When you want a more opinionated, schema-first workflow with auto-generated client. Prisma is heavier, slower cold starts, and the query engine binary adds deployment complexity. Drizzle is lighter and more SQL-transparent. |
| ORM | Drizzle | Raw better-sqlite3 | When the project is tiny (< 5 tables) and you want zero abstraction. Loses type-safe queries and migration tooling. Not recommended -- the tables here (recipes, plans, reminders, preferences, history) already justify an ORM. |
| AI SDK | @anthropic-ai/sdk | Vercel AI SDK (@ai-sdk/anthropic) | When building a streaming chat UI in Next.js where Vercel AI SDK's React hooks and streaming primitives add value. For a Telegram bot backend, the official Anthropic SDK is simpler and has no unnecessary abstractions. |
| Scheduler | node-cron | BullMQ + Redis | When you need persistent job queues that survive restarts, distributed workers, or retry logic. For single-user with a small number of scheduled reminders, node-cron is sufficient. BullMQ is the upgrade path when complexity grows. |
| Scheduler | node-cron | Bree | When you need worker thread isolation for CPU-heavy scheduled tasks. Reminder scheduling is lightweight -- worker threads add unnecessary complexity. |
| Logger | pino | winston | When you need transport flexibility (file rotation, external services) built-in. Pino is 5-10x faster for JSON logging. Winston's flexibility comes at performance cost. |
| Runtime | Node.js 22 | Deno / Bun | When you want built-in TypeScript support (Deno) or faster startup (Bun). Node.js 22 with tsx provides TypeScript execution with the most mature ecosystem. grammY supports Deno natively, but better-sqlite3 does not. Bun has SQLite built-in but ecosystem edge cases remain. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Telegraf 3.x | Unmaintained, no TypeScript support, missing modern Telegram Bot API features | grammY 1.39.x |
| node-telegram-bot-api | Low-level, callback-based, poor TypeScript support, no middleware system | grammY 1.39.x |
| Mongoose / MongoDB | Wrong tool for structured relational data like recipes, meal plans, and grocery lists. NoSQL adds schema flexibility you don't need and loses relational queries you do need. | Drizzle + SQLite |
| Sequelize | Legacy ORM with poor TypeScript support, heavy abstraction, slow updates | Drizzle ORM |
| TypeORM | Buggy, inconsistent behavior, poor maintenance track record | Drizzle ORM |
| Express.js (as primary framework) | grammY has its own webhook handling via `webhookCallback()`. Adding Express just for a webhook endpoint is unnecessary complexity. Only add Express if you need additional HTTP endpoints beyond the Telegram webhook. | grammY's built-in webhook adapter (works with Node.js `http` module, or add Hono if you need more routes) |
| LangChain | Massive abstraction layer over LLM calls. For a project calling one LLM (Claude) with well-defined tools, LangChain adds thousands of lines of dependency for zero value. Call the Anthropic SDK directly. | @anthropic-ai/sdk directly |
| OpenAI SDK | Wrong provider. Use Anthropic's official SDK for Claude. Do not route through OpenAI-compatible endpoints or adapter layers. | @anthropic-ai/sdk |
| Agenda (scheduler) | Requires MongoDB as a dependency just for job scheduling. Unnecessary infrastructure for a single-user bot. | node-cron (in-process) |
| nodemon | Legacy. tsx has built-in watch mode (`tsx watch`). Node.js itself has `--watch` flag. No need for a separate watcher. | `tsx watch` or `node --watch` |
| ts-node | Complex ESM configuration, slower than tsx, frequent compatibility issues with modern TypeScript settings | tsx 4.21.x |

## Stack Patterns

**For webhook-based deployment (recommended for production):**
- Use grammY's `webhookCallback()` to create a request handler
- Deploy behind HTTPS (Railway/Fly.io provide this automatically)
- Set webhook URL via `bot.api.setWebhook(url)` on startup
- Telegram pushes updates to your server -- no polling loop needed
- Lower latency, lower resource usage than long polling

**For local development:**
- Use grammY's `bot.start()` for long polling
- No HTTPS or public URL needed
- Automatically switches between polling (dev) and webhook (prod) based on environment variable

**For Claude API integration:**
- Define tools using Zod schemas + `betaZodTool`
- Use `strict: true` on tool definitions for guaranteed schema compliance
- Keep system prompts in separate files for easy iteration
- Always include conversation context (recent messages) in each Claude call
- Claude is stateless -- your backend must manage conversation history

**For database-backed knowledge:**
- Store recipes as rich text content (not rigid schemas) -- Claude reasons over text
- Store preferences, history, and metadata in structured columns for querying
- Use full-text search (SQLite FTS5) for recipe lookup by ingredient/name
- Keep conversation history for context window management

## Hosting Recommendation

| Platform | Monthly Cost | Why | Confidence |
|----------|-------------|-----|------------|
| **Railway** (recommended) | ~$5-10/mo | Built-in cron jobs, persistent volumes, automatic HTTPS, zero-config Node.js deploys, attached SQLite via volume mount. Push to deploy from GitHub. Best DX for a single-developer project. | HIGH |
| Fly.io (alternative) | ~$5-10/mo | Better for global distribution (edge VMs). Persistent volumes at $0.15/GB/mo. More configuration required than Railway but more flexible. Good if you later need multi-region. | MEDIUM |
| VPS (Hetzner/DigitalOcean) | ~$4-6/mo | Full control, cheapest long-term. Requires manual setup (systemd, nginx, SSL, backups). Best if you're comfortable with server admin. | MEDIUM |
| Vercel/Cloudflare Workers | -- | NOT recommended. Serverless functions have cold starts that hurt bot responsiveness. SQLite on disk is incompatible with serverless. Scheduled jobs require workarounds. Wrong model for a stateful bot with a database. | -- |

**Recommended:** Railway for v1. Simple, affordable, has everything needed (persistent volume for SQLite, cron, HTTPS, GitHub deploys). Migrate to Fly.io or VPS if cost or control becomes an issue.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| better-sqlite3@12.6.x | Node.js 20, 22, 24 | Native addon -- needs node-gyp build. Pre-built binaries available for common platforms. |
| drizzle-orm@0.45.x | better-sqlite3@12.x | Use `drizzle(db)` where db is a better-sqlite3 Database instance. |
| drizzle-kit@0.31.x | drizzle-orm@0.45.x | Must keep drizzle-orm and drizzle-kit versions in sync. Always update together. |
| grammY@1.39.x | Node.js 18+ | Also runs on Deno and Bun, but better-sqlite3 limits us to Node.js. |
| @anthropic-ai/sdk@0.73.x | Node.js 18+ | Uses native `fetch` -- available in Node.js 18+. |
| tsx@4.21.x | Node.js 18+ | Uses esbuild under the hood. Do not use with `--experimental-strip-types` (pick one approach). |
| Zod@4.3.x | TypeScript 5.5+ | Major version bump from Zod 3.x. New API (z.string() unchanged, but some advanced features differ). Ensure @anthropic-ai/sdk supports Zod 4 -- check `betaZodTool` compatibility. |
| pino@10.3.x | Node.js 20+ | Dropped Node.js 18 support in v10. Using Node.js 22 satisfies this. |

**Critical compatibility note:** Zod 4 is a recent major release. The @anthropic-ai/sdk `betaZodTool` helper was originally built for Zod 3. Verify compatibility at project start -- if Zod 4 is incompatible with the SDK's tool helpers, pin Zod at 3.24.x until the SDK updates. This is the single highest-risk version compatibility issue in this stack.

## Sources

- [grammY official site](https://grammy.dev/) -- framework documentation, plugin ecosystem, deployment guides (HIGH confidence)
- [grammY comparison page](https://grammy.dev/resources/comparison) -- grammY vs Telegraf vs others (HIGH confidence)
- [npm trends: grammy vs telegraf](https://npmtrends.com/grammy-vs-node-telegram-bot-api-vs-telegraf-vs-telegram-bot-api) -- download statistics (HIGH confidence)
- [@anthropic-ai/sdk on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- version 0.73.0 verified via `npm view` (HIGH confidence)
- [Claude API docs: Tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- tool use and structured outputs (HIGH confidence)
- [Claude API docs: Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- strict mode for tool definitions (HIGH confidence)
- [Drizzle ORM: SQLite getting started](https://orm.drizzle.team/docs/get-started-sqlite) -- better-sqlite3 integration (HIGH confidence)
- [Node.js releases](https://nodejs.org/en/about/previous-releases) -- LTS schedule, Node 22 and 24 status (HIGH confidence)
- [Railway docs: Cron Jobs](https://docs.railway.com/reference/cron-jobs) -- scheduling capabilities (HIGH confidence)
- [Railway pricing](https://railway.com/pricing) -- cost estimation (HIGH confidence)
- [tsx on npm](https://www.npmjs.com/package/tsx) -- TypeScript runner versioning (HIGH confidence)
- [Zod official site](https://zod.dev/) -- v4 release, API surface (HIGH confidence)
- [better-sqlite3 on npm](https://www.npmjs.com/package/better-sqlite3) -- version, compatibility (HIGH confidence)
- [pino on npm](https://www.npmjs.com/package/pino) -- v10 Node.js requirements (HIGH confidence)
- All package versions verified via `npm view [package] version` on 2026-02-05 (HIGH confidence)

---
*Stack research for: Conversational AI Meal Planning Telegram Bot*
*Researched: 2026-02-05*
