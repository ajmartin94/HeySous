# CLAUDE.md

HeySous is a Telegram meal planning bot. A single-process Node.js server handles the Telegram bot (grammY) and a React Mini App (Vite). The AI agent powering the bot is called **Sous** — always use "Sous" when discussing the bot's AI behavior to avoid confusion with Claude (the model used here in Claude Code).

## Commands

```bash
npm run dev          # Start dev mode (tsx watch, polling)
npm run build:all    # Build server + Mini App
npm test             # Run Vitest
npm run typecheck    # TypeScript type check (tsc --noEmit)
```

## Architecture Rules

- **ESM with .js extensions.** All TypeScript imports use `.js` extensions (NodeNext module resolution). Never use extensionless or `.ts` imports.
- **Factory function pattern.** All modules export `createXxx()` factories (not classes, not default exports). Dependencies are passed as params or an options object.
- **HTML parse mode.** Telegram messages use HTML, not Markdown. Use `<b>`, `<i>`, `<blockquote>`. Never use `**`, `##`, triple backticks, or `*` for bullets.
- **Config and logger.** Import from `./config.js` and `./logger.js`. Config validates env vars at startup. Don't pass raw env vars around.
- **Database access.** `db` (Drizzle ORM) for schema-defined tables; `sqlite` (raw better-sqlite3) for FTS5 and raw SQL. Use Drizzle when possible.

## Source Layout

```
src/ai/             Sous agent: client, system prompt, tools, tool handler
src/bot/            grammY bot setup, command handlers, middlewares
src/pipeline/       Message queue (debounce) + processor (Sous call orchestration)
src/knowledge/      Recipe storage, FTS5 search, retrieval service
src/memory/         Atomic fact memory system (memories table, FTS5 dedup)
src/planning/       Meal plan CRUD, cooking history, context builder
src/grocery/        Grocery list CRUD, formatter, inline buttons
src/reminders/      Reminder scheduling, polling, delivery
src/deep-links/     Deep-link builder for Mini App inline buttons
src/notifications/  Release notes, update notification delivery
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

Subsystem-specific patterns (adding commands, tools, routes, tables) are documented in CLAUDE.md files within each `src/` subdirectory.

## Testing

- **Framework:** Vitest
- **Test files:** `tests/` directory mirroring `src/` structure
- **Imports:** Use `.js` extensions in test files too
- **Time:** The `Clock` abstraction (`src/clock.ts`) provides testable time -- use `vi.useFakeTimers()` for time-dependent tests

### TDD Policy

Default to TDD for any task involving business logic, data transformations, validation, algorithms, or state machines. Use `tdd="true"` with a `<behavior>` block in GSD plans, or `type: tdd` for dedicated TDD plans. Only skip TDD for configuration, UI styling, glue code, migrations, and documentation.

## Releasing

Release process is managed by the `/release` skill. See `.claude/skills/release/` for details.

## Git

Branching is managed by the GSD workflow (`.claude/get-shit-done/`). Feature work happens on milestone branches (e.g. `gsd/v1.2-onboarding-and-feedback`). Never commit directly to `main` -- all changes reach `main` via pull request only.

## Environment

- Node.js >= 22 required (uses `import.meta.dirname`)
- TypeScript target: ES2022, module: NodeNext
- Dev mode: polling + pino-pretty + test clock
- Production: webhook + JSON logging
