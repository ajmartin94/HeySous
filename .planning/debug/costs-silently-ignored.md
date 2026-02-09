---
status: resolved
trigger: "/costs command silently ignored for admin user"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:00:00Z
---

## Current Focus

hypothesis: ADMIN_USER_IDS contains a Telegram username but costs handler compares against numeric Telegram user ID
test: Compare .env value to what ctx.from.id provides
expecting: Type/format mismatch causes admin check to always fail
next_action: n/a -- root cause confirmed

## Symptoms

expected: /costs replies with usage summary for the admin user
actual: /costs is silently ignored -- no reply, no error
errors: none (silent rejection by design for non-admins)
reproduction: send /costs in Telegram
started: likely since /costs was first deployed

## Eliminated

(none needed -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-09
  checked: src/bot/handlers/costs.ts lines 25-28
  found: |
    Handler converts ctx.from.id to string and checks:
      const userId = String(ctx.from?.id ?? "");
      if (!config.adminUserIds.includes(userId)) { return; }
    ctx.from.id is the Telegram NUMERIC user ID (e.g. 123456789).
  implication: The admin check compares a stringified numeric ID against config.adminUserIds

- timestamp: 2026-02-09
  checked: src/config.ts line 56
  found: |
    adminUserIds is parsed from env var:
      adminUserIds: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean)
  implication: Values come directly from .env ADMIN_USER_IDS

- timestamp: 2026-02-09
  checked: .env line 12
  found: ADMIN_USER_IDS=ajmartin94
  implication: |
    The env var contains a Telegram USERNAME ("ajmartin94"), NOT a numeric user ID.
    The handler does String(ctx.from.id) which produces something like "123456789".
    "123456789" will never match "ajmartin94" via Array.includes().
    Therefore the admin check ALWAYS fails and the handler silently returns.

## Resolution

root_cause: |
  ADMIN_USER_IDS in .env is set to "ajmartin94" (a Telegram username),
  but the costs handler compares it against String(ctx.from.id) which is
  the numeric Telegram user ID (e.g. "123456789"). These can never match,
  so the admin guard on line 26 of costs.ts always rejects, causing the
  silent return on line 27.

fix: |
  The .env ADMIN_USER_IDS value must be changed from the username "ajmartin94"
  to the user's numeric Telegram ID. The user can find their numeric ID by
  messaging @userinfobot on Telegram or by adding temporary logging of
  ctx.from.id in any handler.

  Alternatively, the code could be changed to support username-based matching
  (comparing against ctx.from.username), but numeric IDs are more reliable
  since usernames can change.

verification: (not applicable -- research only)
files_changed: []
