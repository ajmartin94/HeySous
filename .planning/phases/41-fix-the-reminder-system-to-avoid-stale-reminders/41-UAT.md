---
status: diagnosed
phase: 41-fix-the-reminder-system-to-avoid-stale-reminders
source: [41-01-SUMMARY.md]
started: 2026-02-25T02:30:00Z
updated: 2026-02-25T03:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Meal plan change still works
expected: Tell Sous to change a meal in your current plan (e.g., "swap Wednesday dinner to tacos"). Sous should confirm the change was saved successfully. No errors or regressions.
result: pass

### 2. Reminders reflect updated meal after plan change
expected: After changing a meal, check that the next reminder for that meal slot references the NEW meal (not the old one). You can verify by asking Sous "what reminders do I have?" or waiting for the next morning summary / start-cooking reminder to see if it mentions the updated meal.
result: pass

### 3. No duplicate or phantom reminders after plan change
expected: After modifying a meal plan, you should NOT receive reminders for the old meal that was replaced. Only reminders for the current plan meals should fire.
result: issue
reported: "Got a morning summary for the correct meal, but a prep alert for the wrong (old) meal"
severity: major

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "After modifying a meal plan, only reminders for the current plan meals should fire — no phantom reminders for replaced meals"
  status: failed
  reason: "User reported: Got a morning summary for the correct meal, but a prep alert for the wrong (old) meal"
  severity: major
  test: 3
  root_cause: "Prep alerts fire the day BEFORE the meal (prepDate = addDays(currentDate, -1)). When a user changes tomorrow's dinner after today's 08:00 prep_alert time, the old alert was already delivered (status='sent'). deleteAllPending only clears 'pending' reminders, so the sent stale alert remains. The future-only guard (dueAt > now) prevents creating a replacement since the slot is past. Morning summaries work because they fire the same day as the meal — still in the future."
  artifacts:
    - path: "src/reminders/generator.ts"
      issue: "Line 229: prep_alert fires day before meal; Line 239: past-due guard prevents replacement"
    - path: "src/reminders/repository.ts"
      issue: "Lines 291-298: deleteAllPending only deletes status='pending', not 'sent'"
    - path: "src/reminders/poller.ts"
      issue: "Line 80: markSent before delivery creates secondary race condition"
  missing:
    - "Delete ALL future reminders (pending AND sent) on regeneration, or delete by householdId regardless of status"
    - "Consider also deleting 'sent' reminders whose dueAt is still in the future (queued but not yet delivered)"
  debug_session: ".planning/debug/phantom-prep-alert.md"
