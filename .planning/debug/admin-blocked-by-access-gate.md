---
status: resolved
trigger: "Admin user's Telegram ID is configured in ADMIN_USER_IDS but gets blocked by access gate middleware"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - initializeUsers is called with correct adminUserId, seeds DB correctly, but access gate middleware runs BEFORE /start handler and does not auto-seed admin into cache
test: Traced full code path from config -> db init -> access gate -> /start
expecting: Admin should be found in DB by access gate on any message
next_action: Report root cause

## Symptoms

expected: Admin user should be recognized by access gate and allowed through on any message
actual: Admin gets blocked with "invite-only bot" message
errors: None (just user-facing rejection message)
reproduction: Admin sends any non-/start message to bot
started: After Phase 15-02 introduced access gate

## Eliminated

- hypothesis: Admin user ID not loaded from env correctly
  evidence: config.ts parses ADMIN_USER_IDS correctly at line 58-59, adminUserId is first element
  timestamp: 2026-02-11

- hypothesis: Admin user not seeded into DB
  evidence: initializeUsers (users/init.ts) correctly seeds admin with adminUserId, and db/index.ts calls it at line 46
  timestamp: 2026-02-11

## Evidence

- timestamp: 2026-02-11
  checked: config.ts lines 58-59
  found: adminUserIds parsed from ADMIN_USER_IDS env var as comma-split array, adminUserId is first element. .env.example comment says "numeric user IDs or usernames, e.g. 123456789,ajmartin94"
  implication: If someone puts a username like "ajmartin94" instead of a numeric ID, it will be stored as "ajmartin94" in the DB

- timestamp: 2026-02-11
  checked: users/init.ts lines 41-61
  found: Admin IS correctly seeded into DB with telegram_id = adminUserId value from config
  implication: DB has the admin record

- timestamp: 2026-02-11
  checked: access-gate.ts line 38
  found: telegramId is derived as `String(ctx.from?.id ?? "")` -- ctx.from.id is Telegram's NUMERIC user ID
  implication: Access gate always looks up by numeric Telegram ID

- timestamp: 2026-02-11
  checked: access-gate.ts line 46
  found: getUserByTelegramId queries `WHERE telegram_id = ?` with the numeric string
  implication: If DB has "ajmartin94" but access gate queries with "123456789", no match

- timestamp: 2026-02-11
  checked: .env.example line 13
  found: Comment says "numeric user IDs or usernames" -- this is misleading. Usernames will NOT work because access gate always queries by numeric ID from ctx.from.id
  implication: ROOT CAUSE if admin configured username instead of numeric ID

- timestamp: 2026-02-11
  checked: access-gate.ts lines 25-67, main.ts lines 72-75
  found: createAccessGate returns { middleware, addToCache }. addToCache is passed to startHandler. But addToCache is NEVER called during admin seeding in initializeUsers. The access gate has its own in-memory cache that starts empty.
  implication: On first non-/start message, access gate checks cache (miss), then checks DB. If DB has admin record with correct telegram_id, it WILL find them. The cache miss is not the root cause -- the DB lookup should work.

## Resolution

root_cause: |
  The .env.example documents ADMIN_USER_IDS as accepting "numeric user IDs or usernames" but this is incorrect.

  The access gate middleware (access-gate.ts:38) derives the lookup key as `String(ctx.from?.id)` which is always
  Telegram's NUMERIC user ID. The initializeUsers function (users/init.ts) seeds the admin record with whatever
  value is in config.adminUserId verbatim.

  If the admin configures ADMIN_USER_IDS with a username string (e.g. "ajmartin94") instead of a numeric Telegram
  ID (e.g. "123456789"), the DB will contain telegram_id = "ajmartin94" but the access gate will query with
  telegram_id = "123456789" -- no match, admin gets blocked.

  Additionally, there is a secondary issue: even with numeric IDs, /start is the ONLY command let through the
  gate unconditionally, and the /start handler only creates users via invite tokens -- it does NOT recognize
  the admin as already seeded. However, since the admin IS seeded in the DB during initializeUsers, the access
  gate's DB lookup WOULD find them if the telegram_id matches. So the primary root cause is the ID format mismatch.

fix: |
  1. Fix .env.example comment to only say "numeric Telegram user IDs" (not usernames)
  2. Add validation in config.ts to warn/error if ADMIN_USER_IDS contains non-numeric values
  3. Consider: pre-populate the access gate cache with admin user on startup in main.ts

verification: N/A (diagnosis only)
files_changed: []
