---
status: investigating
trigger: "Admin notification fails when invited user joins household"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: The admin notification sendMessage call fails due to chat_id type mismatch (string from DB vs expected number) combined with the global HTML parse_mode transformer applying to an unescaped display name
test: Traced full code path from invite redemption through admin notification
expecting: Identified two compounding issues in ctx.api.sendMessage call
next_action: Report diagnosis

## Symptoms

expected: After a new user redeems an invite, the admin (invite creator) should receive a message like "X has joined your household!"
actual: Invite redemption works, new user gets registered and greeted, but admin does NOT receive notification. Server error is logged.
errors: logger.warn({ error: err }, "Failed to notify admin of new user") fires at start.ts:86
reproduction: New user clicks valid invite deep link, gets greeted, admin gets no notification
started: Phase 15-02 introduced /start handler with admin notification

## Eliminated

- hypothesis: getAdmin returns undefined (no admin in DB)
  evidence: initializeUsers seeds admin on startup, verifies with COUNT query, UAT tests 1-4 pass (admin can chat and create invites)
  timestamp: 2026-02-11

- hypothesis: admin.telegramId === telegramId (same user check skips notification)
  evidence: UAT test 5 uses a different account for the new user; the check on line 79 would silently skip without triggering the catch block
  timestamp: 2026-02-11

- hypothesis: access gate or middleware blocks the sendMessage call
  evidence: access gate only applies to incoming updates, not outgoing API calls; autoChatAction transformer has no extractors for sendMessage method
  timestamp: 2026-02-11

- hypothesis: database corruption or race condition
  evidence: better-sqlite3 is synchronous; all prior DB operations (token redemption, user creation, household update) succeed before getAdmin is called
  timestamp: 2026-02-11

- hypothesis: webhook reply envelope interference
  evidence: webhookReplyEnvelope defaults to {} in ApiClient constructor; hasUsedWebhookReply is true after ctx.reply(greeting), so notification uses normal HTTP path
  timestamp: 2026-02-11

## Evidence

- timestamp: 2026-02-11
  checked: start.ts lines 76-87 (notification code)
  found: |
    try {
      const admin = getAdmin(deps.sqlite);
      if (admin && admin.telegramId !== telegramId) {
        await ctx.api.sendMessage(admin.telegramId, `${displayName} just joined your household!`);
      }
    } catch (err) {
      logger.warn({ error: err }, "Failed to notify admin of new user");
    }
  implication: Error is caught and logged as warn, explaining the "server error" user reported

- timestamp: 2026-02-11
  checked: bot/index.ts line 74
  found: bot.api.config.use(parseMode("HTML")) -- global HTML parse mode transformer applied to ALL outgoing API calls
  implication: The notification sendMessage gets parse_mode:"HTML" automatically injected

- timestamp: 2026-02-11
  checked: @grammyjs/parse-mode/dist/transformer.js lines 20-51
  found: Transformer adds parse_mode to payload UNLESS already present; for sendMessage (default case), it spreads parse_mode:"HTML" into the payload
  implication: ctx.api.sendMessage(chatId, text) becomes sendMessage with parse_mode:"HTML"

- timestamp: 2026-02-11
  checked: start.ts line 31
  found: displayName = ctx.from?.first_name ?? "there" -- raw Telegram first_name, NOT HTML-escaped
  implication: If name contains <, >, &, or incomplete HTML tags, Telegram rejects with "can't parse entities"

- timestamp: 2026-02-11
  checked: telegram/sender.ts lines 44-59
  found: The codebase ALREADY has HTML fallback handling in sendFormattedMessage -- catches "can't parse entities" GrammyError and resends with parse_mode:undefined
  implication: The developers are aware that global HTML parse mode can cause failures; the admin notification lacks this protection

- timestamp: 2026-02-11
  checked: start.ts line 72 (greeting) vs line 80 (notification)
  found: Both use displayName, both go through parseMode("HTML") transformer. Greeting uses ctx.reply (chat_id is number from ctx.chat.id). Notification uses ctx.api.sendMessage (chat_id is string from admin.telegramId).
  implication: The key difference is chat_id type (number vs string) and target chat (new user's chat vs admin's chat)

- timestamp: 2026-02-11
  checked: Telegram Bot API docs for sendMessage chat_id parameter
  found: "Integer or String - Unique identifier for the target chat or username of the target channel (in the format @channelusername)" -- String format is for @channelusername, not numeric strings
  implication: Sending chat_id as JSON string "123456789" instead of JSON integer 123456789 may cause unexpected behavior

- timestamp: 2026-02-11
  checked: users/repository.ts getAdmin function and UserRow interface
  found: getAdmin returns User with telegramId as string (from TEXT column in SQLite). This string is passed directly to ctx.api.sendMessage.
  implication: chat_id is always a string when coming from DB, but ctx.reply uses ctx.chat.id which is always a number

- timestamp: 2026-02-11
  checked: grammy/out/core/api.js line 139-140
  found: sendMessage(chat_id, text, other) creates { chat_id, text, ...other } -- preserves the type of chat_id as-is
  implication: If chat_id is string "123456789", it stays as string in JSON payload

- timestamp: 2026-02-11
  checked: UAT tests 1-4 pass
  found: Admin can chat normally, /start shows welcome back, /invite generates links -- confirms admin is correctly registered with valid numeric telegram_id
  implication: Rules out username-as-telegram-id hypothesis (from separate admin-blocked-by-access-gate debug session)

## Resolution

root_cause: |
  The admin notification at start.ts:80-83 has TWO issues that cause it to fail:

  1. CHAT_ID TYPE: admin.telegramId is a string from the database (e.g., "123456789").
     ctx.api.sendMessage passes this string directly. The JSON payload contains
     "chat_id":"123456789" (JSON string). The Telegram Bot API documents chat_id as
     "Integer or String" where String means @channelusername format. While the API
     often accepts numeric strings, this is not guaranteed behavior and may fail
     depending on the Telegram server handling the request. In contrast, ctx.reply
     uses ctx.chat.id which is always a number, producing "chat_id":123456789 (JSON integer).

  2. HTML PARSE MODE WITHOUT ESCAPING: The global parseMode("HTML") transformer
     (bot/index.ts:74) adds parse_mode:"HTML" to the notification. The displayName
     (ctx.from.first_name) is interpolated raw into the message text without HTML
     escaping. If the name contains <, >, &, or partial HTML tags, Telegram rejects
     the message with "400: Bad Request: can't parse entities". The codebase already
     has a pattern for handling this (telegram/sender.ts:44-59 catches this error
     and retries with parse_mode:undefined), but the admin notification lacks this
     protection.

  Either issue alone can cause the sendMessage to throw a GrammyError, which is
  caught by the try/catch and logged as a warn -- matching the reported "server error."

fix: ""
verification: ""
files_changed: []
