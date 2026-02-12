# CLAUDE.md

HeySous is a Telegram meal planning bot with a Claude AI agent at its core. Single-process Node.js server handles both the Telegram bot (grammY) and a React Mini App (Vite).

## Commands

```bash
npm run dev          # Start dev mode (tsx watch, polling)
npm run build:all    # Build server + Mini App
npm test             # Run Vitest
npm run typecheck    # TypeScript type check (tsc --noEmit)
```

## Architecture Rules

**ESM with .js extensions.** All TypeScript imports use `.js` extensions. This is required by NodeNext module resolution. Never use extensionless or `.ts` imports.

```typescript
import { config } from "./config.js";       // correct
import { config } from "./config";           // wrong
```

**Factory function pattern.** All modules export `createXxx()` factories (not classes, not default exports). Dependencies are passed as params or an options object.

```typescript
export function createHelpHandler(): Composer<BotContext> { ... }
export function createMeRoute(sqlite: BetterSqlite3.Database) { ... }
```

**HTML parse mode.** Telegram messages use HTML, not Markdown. Use `<b>`, `<i>`, `<blockquote>`. Never use `**`, `##`, triple backticks, or `*` for bullets. Use plain dashes for lists.

**Config and logger.** Import `config` from `./config.js` and `logger` from `./logger.js`. Config validates env vars at startup and throws on missing required values. Don't pass raw env vars around.

**Database access.** Two handles exist:
- `db` (Drizzle ORM) -- for schema-defined tables via query builder
- `sqlite` (raw better-sqlite3) -- for FTS5 queries, raw SQL init scripts, and older repositories

SQLite is passed as first param to standalone repository functions. Use Drizzle when possible.

**BotContext.** Extends grammY Context with `userId`, `householdId`, `user`, and `db` properties. The access gate middleware populates these for registered users. `/start` bypasses the gate.

**Mini App auth.** API routes at `/api/*` are protected by Telegram initData HMAC validation. The middleware sets `res.locals.chatId` and `res.locals.householdId` for downstream handlers.

## Source Layout

```
src/ai/             Claude client, system prompt, tool definitions, tool handler
src/bot/            grammY bot setup, command handlers, middlewares
src/pipeline/       Message queue (debounce) + processor (Claude call orchestration)
src/knowledge/      Recipe/preference storage, FTS5 search, retrieval service
src/planning/       Meal plan CRUD, cooking history, context builder
src/grocery/        Grocery list CRUD, formatter, inline buttons
src/reminders/      Reminder scheduling, polling, delivery
src/feedback/       Meal feedback check-ins, sentiment extraction
src/onboarding/     First-run conversational flow (state machine)
src/invites/        Invite-gated access token system
src/users/          User/household management
src/app-feedback/   App-level feedback collection
src/mini-app/       Express API routes for Mini App
src/db/             Drizzle schema, database init, migrations
src/telegram/       Message splitting, formatting, menu button setup
src/conversation/   Conversation history context builder

mini-app/src/       React SPA (Vite, React Router, @tma.js/sdk-react)
```

## Key Patterns

### Adding a bot command

1. Create handler in `src/bot/handlers/your-command.ts`
2. Export `createYourCommandHandler()` returning `Composer<BotContext>`
3. Create instance in `src/main.ts`, pass to `createBot()`
4. Register in `src/bot/index.ts` middleware chain -- order matters (see comment block at top of file)

### Adding a Claude tool

1. Add tool definition to `src/ai/tools.ts`
2. Add handler case in `src/ai/tool-handler.ts`
3. Add tool to `allTools` array in `src/pipeline/processor.ts`
4. Add behavioral instructions to `src/ai/system-prompt.ts`

### Adding a Mini App API route

1. Create route factory in `src/mini-app/routes/your-route.ts`
2. Register in `src/mini-app/router.ts`
3. Routes receive `sqlite` via closure, use `res.locals.householdId` for data access

### Adding a database table

1. Define schema in the relevant domain module (e.g. `src/yourfeature/schema.ts`)
2. Create an init function with `CREATE TABLE IF NOT EXISTS`
3. Call init from `src/db/index.ts` `createDatabase()`
4. Re-export from `src/db/schema.ts` if using Drizzle

## Testing

- **Framework:** Vitest
- **Test files:** `tests/` directory mirroring `src/` structure
- **Imports:** Use `.js` extensions in test files too
- **Time:** The `Clock` abstraction (`src/clock.ts`) provides testable time -- use `vi.useFakeTimers()` for time-dependent tests

## Git

Branching is managed by the GSD workflow (`.claude/get-shit-done/`). Feature work happens on milestone branches (e.g. `gsd/v1.2-onboarding-and-feedback`). All merges to `main` must go through a pull request -- never push directly to main.

## Environment

- Node.js >= 22 required (uses `import.meta.dirname`)
- TypeScript target: ES2022, module: NodeNext
- Dev mode: polling + pino-pretty + test clock
- Production: webhook + JSON logging
