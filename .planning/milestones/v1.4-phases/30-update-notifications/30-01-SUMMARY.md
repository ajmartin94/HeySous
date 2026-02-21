---
phase: 30-update-notifications
plan: 01
subsystem: notifications, pipeline, db
tags: [notifications, lazy-delivery, migration, release-notes]

requires:
  - phase: 25
    provides: migration framework for schema changes
  - phase: 27
    provides: Sous personality voice for notifications
provides:
  - Update notification system with lazy per-interaction delivery
  - notifications and notification_deliveries tables
  - Release notes in Sous's conversational voice
affects: []

tech-stack:
  added: []
  patterns: [lazy-delivery, seed-on-startup, exactly-once-per-household]

key-files:
  created:
    - src/notifications/update-notifier.ts
    - src/notifications/release-notes.ts
    - tests/notifications/update-notifier.test.ts
  modified:
    - src/db/migrations.ts
    - src/pipeline/processor.ts
    - src/main.ts

key-decisions:
  - "Lazy delivery over startup broadcast -- only active users see notifications"
  - "Dev mode skips notification delivery (prevents spam during tsx watch restarts)"
  - "Release notes hand-written in Sous voice, not auto-generated"
  - "One notification delivered per interaction (oldest first), not all at once"
  - "Seeding is idempotent via INSERT OR IGNORE on unique version"

patterns-established:
  - "Lazy delivery: check-on-interaction instead of broadcast-on-deploy"
  - "Release notes as TypeScript record: version -> HTML content"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03]

duration: 3min
completed: 2026-02-20
---

# Phase 30 Plan 01: Update Notifications Summary

**Lazy-delivery update notification system with per-household tracking and Sous-voice release notes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Created migration 002 for notifications and notification_deliveries tables
- Created update-notifier module with seedNotifications and checkPendingNotification
- Release notes for v1.4.0 written in Sous's conversational voice (recipe links, photos, smarter saving)
- Lazy delivery integrated into pipeline processor (before Claude call)
- Dev mode skips delivery to prevent spam during development
- Exactly-once delivery per household tracked via notification_deliveries table
- Multiple notifications delivered one at a time in chronological order
- Seeding is idempotent (INSERT OR IGNORE on unique version)
- 7 new tests covering seeding, delivery, idempotency, per-household isolation, ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration, notifier module, release notes, tests** - `7e3c09b` (feat)
2. **Task 2: Pipeline processor and main.ts integration** - `2595737` (feat)

## Files Created/Modified
- `src/notifications/update-notifier.ts` - seedNotifications + checkPendingNotification
- `src/notifications/release-notes.ts` - Version-keyed release notes in Sous voice
- `tests/notifications/update-notifier.test.ts` - 7 tests for notification logic
- `src/db/migrations.ts` - Migration 002: notifications tables
- `src/pipeline/processor.ts` - Lazy notification check before Claude call
- `src/main.ts` - seedNotifications call on startup

## Decisions Made
- Lazy delivery chosen over startup broadcast for efficiency and simplicity
- One notification per interaction (not all at once) to avoid message flood
- Dev mode check uses config.isDev (already available in processor)
- Notification content uses HTML format (consistent with Telegram parse mode)

## Deviations from Plan
None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- notifications are seeded automatically from code on startup.

## Next Phase Readiness
- This is the final phase of v1.4 milestone
- All 20 requirements across 6 phases complete
- Ready for milestone completion

---
*Phase: 30-update-notifications*
*Completed: 2026-02-20*
