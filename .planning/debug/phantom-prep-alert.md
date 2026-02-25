---
status: diagnosed
trigger: "Phantom prep alert fires for OLD meal after meal plan change. Morning summary is correct but prep_alert is stale."
created: 2026-02-24T00:00:00Z
updated: 2026-02-24T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Race condition between poller markSent and deleteAllPending, combined with past-due time guard preventing recreation of the new prep_alert
test: Traced full code path through generator.ts, repository.ts, poller.ts, sender.ts
expecting: Found the mechanism
next_action: Report root cause

## Symptoms

expected: After meal plan change, ALL reminders (morning_summary, prep_alert, start_cooking) should reflect new meals
actual: Morning summary shows correct NEW meal, but prep_alert still fires for OLD replaced meal
errors: None (functional bug, not crash)
reproduction: Change a meal in plan (e.g., swap Wednesday dinner) after the prep_alert's scheduled time has passed or while poller is mid-delivery
started: After Phase 41 added generateRemindersFn call after save_meal_plan

## Eliminated

- hypothesis: deleteAllPending filters by reminder type and misses prep_alert
  evidence: Code at repository.ts:291-298 shows deleteAllPending uses WHERE household_id=? AND status='pending' with NO type filter. All types are included.
  timestamp: 2026-02-24T00:01:00Z

- hypothesis: Separate generation path for prep_alerts
  evidence: Only one code path generates reminders - generateReminders() in generator.ts. All three types (morning_summary, prep_alert, start_cooking) are generated in the same function. grep for createReminder( confirms only generator.ts and feedback/generator.ts create reminders.
  timestamp: 2026-02-24T00:01:00Z

- hypothesis: planRepository.getActivePlans returns stale/cached data
  evidence: Drizzle ORM over better-sqlite3 doesn't cache. Both planRepository (Drizzle) and reminderRepository (raw sqlite) use the same underlying SQLite connection extracted at main.ts:68. Plan is saved synchronously BEFORE generateRemindersFn is called at tool-handler.ts:691-706.
  timestamp: 2026-02-24T00:03:00Z

- hypothesis: save_meal_plan tool only saves changed entries, losing other entries
  evidence: Tool description explicitly says "Replaces all entries for that week -- always send the COMPLETE plan, not just changes" (tools.ts:230). planRepository.savePlan deletes ALL existing entries then inserts the new ones (planning/repository.ts:84-87). Even if Claude sent partial data, this would cause missing entries, not stale reminders.
  timestamp: 2026-02-24T00:03:00Z

- hypothesis: hasPendingReminder dedup check falsely prevents new reminder creation after deleteAllPending
  evidence: hasPendingReminder checks WHERE status='pending' (repository.ts:313). After deleteAllPending, there are zero pending reminders, so hasPendingReminder always returns false. Sent reminders don't match. New reminders WILL be created if the dueAt > clock.now() guard passes.
  timestamp: 2026-02-24T00:04:00Z

## Evidence

- timestamp: 2026-02-24T00:01:00Z
  checked: repository.ts deleteAllPending implementation
  found: DELETE FROM reminders WHERE household_id = ? AND status = 'pending' -- deletes ALL pending types, no type filter
  implication: deleteAllPending correctly covers all reminder types. The issue is NOT type filtering.

- timestamp: 2026-02-24T00:01:00Z
  checked: poller.ts tick() implementation (lines 77-80)
  found: Poller calls markSent(reminder.id, "") BEFORE calling sender.sendReminder(). Comment says "Mark sent BEFORE delivery -- prevents duplicates if process crashes mid-send"
  implication: markSent changes status from 'pending' to 'sent'. If poller picks up a stale reminder and marks it sent, deleteAllPending cannot touch it (only deletes WHERE status='pending').

- timestamp: 2026-02-24T00:01:00Z
  checked: generator.ts lines 110-123
  found: generateReminders() calls deleteAllPending(householdId) first, then reads meal plan data, then creates new reminders. Sequential logic correct in isolation.
  implication: The generation logic itself is sound. Problem is interaction with poller.

- timestamp: 2026-02-24T00:02:00Z
  checked: generator.ts prep_alert time guard (line 239)
  found: Prep alert creation requires dueAt.getTime() > clock.now(). The prep_alert fires the morning BEFORE the meal (prepDate = addDays(currentDate, -1)). Its dueAt uses morningTime on prepDate.
  implication: CRITICAL - If user changes plan AFTER the prep_alert time has passed for today, the guard prevents creating a new prep_alert for the corrected meal. The old one was already sent (or is being sent by poller), and the new one is not created.

- timestamp: 2026-02-24T00:03:00Z
  checked: generator.ts morning_summary vs prep_alert timing
  found: morning_summary fires on the SAME DAY as the meal. prep_alert fires on the DAY BEFORE the meal. For a Wednesday dinner change: prep_alert fires Tuesday morning, morning_summary fires Wednesday morning.
  implication: This explains the differential behavior. When user changes Wednesday dinner on Tuesday afternoon: (1) Tuesday's prep_alert was already delivered (status='sent'), (2) New prep_alert for Tuesday would have dueAt=Tuesday 08:00 < clock.now() -> NOT created, (3) Wednesday morning_summary has dueAt=Wednesday 08:00 > clock.now() -> IS created with new data.

- timestamp: 2026-02-24T00:04:00Z
  checked: git history - commit 6e56bbe
  found: Changed from deleteFutureReminders (WHERE due_at > now) to deleteAllPending (no time filter). This fixed the case where past-due-but-unsent reminders survived. But it does NOT fix reminders already marked 'sent'.
  implication: The Phase 41 fix was correct for pending past-due reminders but insufficient for the poller race condition.

- timestamp: 2026-02-24T00:04:00Z
  checked: All code paths that create reminders
  found: grep for createReminder( shows only generator.ts (lines 196, 210, 251, 363) and feedback/generator.ts (line 118). No rogue creation paths.
  implication: No alternative generation path can explain stale reminders.

- timestamp: 2026-02-24T00:05:00Z
  checked: sender.ts prep_alert handling
  found: Sender reads recipeName from reminder.contextJson (set at creation time), fetches recipe content from knowledge store using knowledgeItemId from contextJson. The contextJson is immutable after creation.
  implication: Once a reminder is created, its contextJson determines the content. Stale contextJson = stale alert text.

## Resolution

root_cause: Two interacting issues cause stale prep_alerts after meal plan changes:

**Primary issue (common case): Past-due time guard prevents replacement.**
When a user changes a meal plan AFTER the prep_alert's scheduled time has passed (e.g., changing Wednesday dinner on Tuesday afternoon when the prep_alert was due Tuesday morning at 08:00), the generator correctly deletes old pending reminders via deleteAllPending, but the old prep_alert was already delivered by the poller (status='sent', not 'pending'). The generator then tries to create a replacement prep_alert, but the dueAt > clock.now() guard at generator.ts:239 returns false because Tuesday 08:00 AM has already passed. No replacement is created. Meanwhile, the morning_summary for Wednesday fires the next day (still in the future) with correct data.

The differential behavior (correct morning_summary, stale prep_alert) is explained by the fact that prep_alerts fire the DAY BEFORE the meal (generator.ts:229: prepDate = addDays(currentDate, -1)), while morning_summaries fire the SAME DAY as the meal. When a user changes tomorrow's meal today (after morning time), tomorrow's morning_summary is still in the future, but today's prep_alert has already passed.

**Secondary issue (rare race condition): Poller markSent before delivery.**
In the narrow window where the poller has called markSent (changing status to 'sent') but the async sender.sendReminder hasn't completed yet, a concurrent plan change causes deleteAllPending to skip the old reminder (it's no longer 'pending'). The sender then delivers the stale reminder. This is a small timing window (seconds) but theoretically possible since the sender makes async Claude API + Telegram API calls (sender.ts:235-239, 261-264) while the event loop can process the tool handler.

**Key code locations:**
- generator.ts:239 - dueAt > clock.now() guard that prevents past-due prep_alert recreation
- generator.ts:229 - prepDate = addDays(currentDate, -1) causes prep_alert to fire day before meal
- repository.ts:291-298 - deleteAllPending only deletes status='pending'
- poller.ts:80 - markSent before delivery changes status to 'sent'

fix:
verification:
files_changed: []
