---
phase: 54-hide-release-notes-for-new-users
plan: 01
subsystem: notifications
tags: [notifications, update-notifier, user-filter]
requirements-completed: [NOTIF-HIDE]
dependency-graph:
  requires: [users table (telegram_id, created_at)]
  provides: [filtered notification query with user creation time check]
  affects: [src/notifications/update-notifier.ts]
tech-stack:
  added: []
  patterns: [COALESCE subquery for optional user lookup]
key-files:
  created: []
  modified:
    - src/notifications/update-notifier.ts
    - tests/notifications/update-notifier.test.ts
decisions:
  - "COALESCE fallback to 0 when no user row exists (safe default -- delivers all notifications)"
  - "Strict > comparison (not >=) excludes notifications at exact user join timestamp"
metrics:
  duration: 4min
  completed: "2026-03-06"
  tasks: 1
  files: 2
---

# Phase 54 Plan 01: Hide Release Notes for New Users Summary

COALESCE subquery on users.created_at filters stale release notes for new users while preserving delivery for existing users.

## Task Completion

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Filter notifications by user creation time | auto (tdd) | e2e9c2c | src/notifications/update-notifier.ts, tests/notifications/update-notifier.test.ts |

## What Changed

### SQL Query Enhancement (update-notifier.ts)

Added a `WHERE n.created_at > COALESCE((SELECT created_at FROM users WHERE telegram_id = ?), 0)` clause to the `checkPendingNotification` query. This filters out notifications that were created before the user's account, preventing new users from receiving stale release notes on their first interaction. The COALESCE fallback to 0 means if no user row exists (should not happen in practice), all notifications remain eligible.

### Test Updates (update-notifier.test.ts)

- Added `users` table to `createTestDb()` helper
- Added `insertUser()` helper for test setup
- Updated all existing tests to insert user rows with `created_at=0`
- New tests: skip old notifications, deliver new ones, same-second strict > edge case, COALESCE fallback for missing user row, existing user sees all

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing fragile test assertions**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Two existing tests ("returns null after notification has been delivered" and "delivers independently to different users") used `seedNotifications()` which inserts 2 release notes, but expected only 1 notification to be pending. Tests were passing coincidentally when only 1 release note existed.
- **Fix:** Replaced `seedNotifications()` with manual single-notification inserts for deterministic behavior
- **Files modified:** tests/notifications/update-notifier.test.ts
- **Commit:** e2e9c2c

## Verification

- `npx vitest run tests/notifications/update-notifier.test.ts` -- 12/12 tests pass
- `npm run typecheck` -- clean
- `npm test` -- 340/340 tests pass (full suite)
