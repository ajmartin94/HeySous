# Bot Commands

## Adding a bot command

1. Create handler in `src/bot/handlers/your-command.ts`
2. Export `createYourCommandHandler()` returning `Composer<BotContext>`
3. Create instance in `src/main.ts`, pass to `createBot()`
4. Register in `src/bot/index.ts` middleware chain -- order matters (see comment block at top of file)

## BotContext

Extends grammY Context with `userId`, `householdId`, `user`, and `db` properties. The access gate middleware populates these for registered users. `/start` bypasses the gate.

## Telegram formatting

Messages use HTML parse mode, not Markdown. Use `<b>`, `<i>`, `<blockquote>`. Never use `**`, `##`, triple backticks, or `*` for bullets. Use plain dashes for lists.
