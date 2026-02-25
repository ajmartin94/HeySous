---
phase: 41-fix-the-reminder-system-to-avoid-stale-reminders
verified: 2026-02-24T19:10:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 3/3
  gaps_closed:
    - "Regeneration deletes ALL reminders regardless of status (plan 41-02 completed after initial verification)"
    - "After a plan change, no phantom reminders for replaced meals can fire (deleteAllForRegeneration wired in generator)"
  gaps_remaining: []
  regressions: []
---

# Phase 41: Fix the Reminder System to Avoid Stale Reminders — Verification Report

**Phase Goal:** Reminders always reflect the current meal plan by regenerating after every successful plan save
**Verified:** 2026-02-24T19:10:00Z
**Status:** passed
**Re-verification:** Yes — initial verification only covered plan 41-01; plan 41-02 (phantom reminder gap closure) completed afterward and is now included

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When a user changes a meal plan, reminders are regenerated to reflect the new meal | VERIFIED | `generateRemindersFn(householdId)` called at `src/ai/tool-handler.ts` lines 704-707 after successful `planRepository.savePlan()`, before response construction |
| 2 | When a meal is removed from a plan, phantom reminders for that meal no longer fire | VERIFIED | `generateReminders()` calls `reminderRepository.deleteAllForRegeneration(householdId)` at `src/reminders/generator.ts` line 123, which deletes ALL reminders regardless of status before rebuilding |
| 3 | Feedback check-ins are also regenerated when a meal plan changes | VERIFIED | `regenerateReminders` closure in `src/main.ts` lines 124-143 calls both `generateReminders()` and `generateFeedbackCheckins()`; a single `generateRemindersFn(householdId)` call covers both |
| 4 | Regeneration deletes ALL reminders regardless of status (including sent/failed) | VERIFIED | `deleteAllForRegeneration` at `src/reminders/repository.ts` lines 292-299 uses `DELETE FROM reminders WHERE household_id = ?` with no status filter |
| 5 | After plan change, reminders with status='sent' (marked by poller before delivery) are removed | VERIFIED | Test "deletes sent reminders during regeneration (no phantom alerts)" in `tests/reminders/generator.test.ts` lines 629-708 proves this end-to-end |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ai/tool-handler.ts` | `generateRemindersFn(householdId)` call after successful save_meal_plan | VERIFIED | Lines 704-707: guard `if (generateRemindersFn)` then call; placed after conflict null-check (lines 696-702) and before response construction (line 709) |
| `tests/ai/tool-handler.test.ts` | Tests verifying reminder regeneration on plan save | VERIFIED | Lines 191-218: two tests — positive (called with householdId on success) and negative (not called on conflict/null return) |
| `src/reminders/repository.ts` | `deleteAllForRegeneration` method that deletes regardless of status | VERIFIED | Lines 292-299: method exists, SQL is `DELETE FROM reminders WHERE household_id = ?` with no status filter; JSDoc updated accordingly |
| `src/reminders/generator.ts` | Calls `deleteAllForRegeneration` instead of `deleteAllPending` | VERIFIED | Line 123: `reminderRepository.deleteAllForRegeneration(householdId)` with updated comment at lines 120-122 |
| `tests/reminders/generator.test.ts` | Test proving sent reminders are cleared on regeneration | VERIFIED | Lines 629-708: "deletes sent reminders during regeneration (no phantom alerts)" — marks all reminders as 'sent', calls generateReminders, asserts zero sent remain |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ai/tool-handler.ts` | `generateRemindersFn` | call after `planRepository.savePlan` | WIRED | `generateRemindersFn(householdId)` confirmed at line 706; guard at line 705 |
| `src/main.ts` `regenerateReminders` | `generateReminders` + `generateFeedbackCheckins` | both called in function body | WIRED | Lines 126-142: both generator functions called unconditionally inside `regenerateReminders` |
| `createProcessor` | `generateRemindersFn` | dependency injection in main.ts | WIRED | `generateRemindersFn: regenerateReminders` passed to `createProcessor` |
| `src/reminders/generator.ts` | `src/reminders/repository.ts` | `deleteAllForRegeneration` call | WIRED | `reminderRepository.deleteAllForRegeneration(householdId)` at generator.ts line 123; method confirmed at repository.ts line 292 |

### Requirements Coverage

No formal requirement IDs — this is a bugfix phase. No orphaned requirements in REQUIREMENTS.md for phase 41.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments or stub implementations found in any modified file. No remaining references to `deleteAllPending` anywhere in `src/` or `tests/`.

### Human Verification Required

None. Both fixes are deterministic function calls and method renames triggered by existing code paths. No visual, real-time, or external service behavior requires manual verification.

### Commits Verified

| Commit | Message | Status |
|--------|---------|--------|
| `6e56bbe` | fix(41-01): use deleteAllPending to clear stale past-due reminders on regeneration | VERIFIED — adds `generateRemindersFn(householdId)` call in tool-handler save_meal_plan case |
| `c80b56d` | docs(41-01): complete reminder regeneration plan | VERIFIED |
| `b3c51b1` | test(41-02): add failing test for sent-reminder cleanup during regeneration | VERIFIED — RED phase; new test confirms deleteAllPending misses sent reminders |
| `8571a83` | fix(41-02): replace deleteAllPending with status-agnostic deleteAllForRegeneration | VERIFIED — GREEN phase; renames method, removes status filter from SQL |

### Test Results

- `tests/reminders/generator.test.ts`: 19 tests pass (includes "deletes sent reminders during regeneration" from plan 41-02)
- `tests/ai/tool-handler.test.ts`: 31 tests pass (includes two reminder regeneration tests from plan 41-01)
- Full suite: 247 tests pass, 0 regressions

### Implementation Summary

The fix spans two plans:

**Plan 41-01:** A 3-line guard block (`if (generateRemindersFn) { generateRemindersFn(householdId); }`) was inserted in `src/ai/tool-handler.ts` at line 704, after the conflict-null check and before the response object is constructed. This matches the established pattern already used in the `update_reminder_settings` case. Two tests in `tests/ai/tool-handler.test.ts` validate the positive and negative cases.

**Plan 41-02:** The `deleteAllPending` method in `src/reminders/repository.ts` was renamed to `deleteAllForRegeneration` and its SQL was changed from `DELETE FROM reminders WHERE household_id = ? AND status = 'pending'` to `DELETE FROM reminders WHERE household_id = ?`. The corresponding call in `src/reminders/generator.ts` was updated to match. This fixes the phantom reminder bug where the poller could mark a reminder as 'sent' (before actual delivery) and then a plan change would leave that stale reminder in place. The new test in `tests/reminders/generator.test.ts` proves that even reminders with `status='sent'` are deleted when `generateReminders` is called.

---

_Verified: 2026-02-24T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
