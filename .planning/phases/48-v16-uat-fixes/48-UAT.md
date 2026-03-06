---
status: diagnosed
phase: 48-v16-uat-fixes
source: [48-01-SUMMARY.md, 48-02-SUMMARY.md]
started: 2026-03-04T00:00:00Z
updated: 2026-03-05T02:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Preference Dedup Catches Near-Identical Entries
expected: Tell the bot a preference similar to one it already knows (e.g. if it knows "Breakfast at 7am", tell it "Breakfast at 8am"). The bot should recognize it as a near-duplicate and ask whether to update the existing preference rather than storing a new one.
result: issue
reported: "Bot called update_reminder_settings instead of save_knowledge — dedup path never triggered. Claude interpreted 'breakfast time' as a reminder change, not a preference update, so the knowledge item was left stale."
severity: major

### 2. Deep-Link Buttons on Response Message
expected: Ask the bot something that triggers deep-link buttons (e.g. ask about meal plan or something that surfaces Mini App actions). The inline keyboard buttons should appear attached to the bot's response message itself — NOT as a separate follow-up "Open in app:" message.
result: pass

### 3. Meal Entry Indentation in Mini App
expected: Open the Mini App meal plan view. Each meal entry (individual dish) should be visually indented under its meal type header (Breakfast, Lunch, Dinner). The entry text should appear lighter weight than the section headers.
result: pass

### 4. Mini App Layout Padding
expected: Open the Mini App in Telegram. The content should have consistent horizontal padding (no edge-to-edge text). The layout should look correct without any awkward spacing shifts — fixed padding throughout.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Near-identical preferences trigger dedup detection and prompt to update"
  status: failed
  reason: "User reported: Bot called update_reminder_settings instead of save_knowledge — dedup path never triggered. Claude interpreted 'breakfast time' as a reminder change, not a preference update, so the knowledge item was left stale."
  severity: major
  test: 1
  root_cause: "Three contradictory system prompt sections for meal time handling: line 272 says use update_reminder_settings, lines 293-294 say use save_knowledge only, lines 646-649 say use both. Claude follows the most specific match (line 272 example) and skips save_knowledge entirely."
  artifacts:
    - path: "src/ai/system-prompt.ts"
      issue: "Three contradictory instruction blocks about meal time preference handling"
    - path: "src/ai/tools.ts"
      issue: "update_reminder_settings description claims meal time statements as its use case"
    - path: "src/ai/tool-handler.ts"
      issue: "Dedup logic correct but unreachable when save_knowledge is never called"
  missing:
    - "Unify to single canonical behavior: meal time changes call save_knowledge (for dedup) AND update_reminder_settings"
    - "Remove/rephrase line 272 example that short-circuits to update_reminder_settings only"
    - "Remove contradictory lines 293-294 saying you DON'T need to call update_reminder_settings"
  debug_session: ".planning/debug/preference-dedup-not-triggered.md"
