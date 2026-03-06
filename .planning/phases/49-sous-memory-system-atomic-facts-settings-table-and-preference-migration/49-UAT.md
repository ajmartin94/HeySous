---
status: complete
phase: 49-sous-memory-system
source: 49-01-SUMMARY.md, 49-02-SUMMARY.md, 49-03-SUMMARY.md
started: 2026-03-06T04:10:00Z
updated: 2026-03-06T04:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Save a Memory via Chat
expected: Tell the bot a preference or dietary fact. It should acknowledge and save it as a memory (atomic fact). Natural conversational response confirming it remembered.
result: pass

### 2. Duplicate Memory Detection
expected: Tell the bot the same preference again (e.g. repeat "I'm allergic to shellfish"). It should recognize the duplicate via FTS5 dedup and NOT create a duplicate entry -- either update the existing one or acknowledge it already knows this.
result: pass

### 3. /memory Command
expected: Send /memory in chat. Bot responds with all saved memories grouped by category (e.g. dietary, preference, allergy). Severity markers like [ALLERGY] or [RESTRICTION] should appear on relevant items.
result: pass

### 4. /preferences Alias
expected: Send /preferences in chat. Same output as /memory -- this is a backward-compatible alias.
result: pass

### 5. Memory Appears in System Prompt Context
expected: After saving a memory, ask the bot something related (e.g. "suggest a dinner"). The bot should incorporate your saved preferences/allergies into its response without you re-stating them.
result: pass
note: Memories were used correctly, but bot implied user had no saved recipes when they have 14. May be unrelated to phase 49.

### 6. Mini App Settings - Memory List
expected: Open the Mini App and navigate to Settings. You should see a "Memory" section showing all saved memories grouped by category, each with an X/delete button.
result: pass

### 7. Mini App Settings - Delete Memory
expected: In the Mini App Settings memory list, tap the X/delete button on a memory item. It should disappear immediately (optimistic delete). Refreshing confirms it's gone.
result: pass

### 8. Mini App Settings - Meal Times Form
expected: In Settings, below the Memory section, there should be a "Meal Times & Reminders" section with time inputs and toggles. Changing a value should auto-save (debounced).
result: pass

### 9. Settings Tool Rename
expected: The bot should respond to settings-related requests using the renamed tools (get_settings/update_settings). Ask the bot to show or change your reminder settings -- it should work without errors.
result: issue
reported: "pass with concerns. it properly updated the settings, but also added a memory that conflicts with a prior memory."
severity: minor

### 10. Preference Migration Preserved
expected: If you had preferences saved before this update (via the old knowledge_items system), they should have been migrated to the new memories table. Check /memory to see if old preferences appear with correct categories.
result: issue
reported: "grocery stores was saved under category 'cooking_style' -- should not be cooking style"
severity: minor

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Bot should not create conflicting memories when updating settings"
  status: failed
  reason: "User reported: properly updated the settings, but also added a memory that conflicts with a prior memory"
  severity: minor
  test: 9
  root_cause: "System prompt instructs bot to call BOTH save_memory AND update_settings for meal time changes. FTS5 dedup may not match 'dinner at 7pm' against existing 'Dinner Time: 6pm' (different time = different content), so bot creates a new conflicting memory instead of updating. Prompt needs to instruct bot to UPDATE existing meal time memories rather than blindly adding."
  artifacts:
    - path: "src/ai/system-prompt.ts"
      issue: "MEMORY_INSTRUCTIONS_PROMPT and REMINDER_MANAGEMENT_PROMPT instruct dual save_memory+update_settings but don't emphasize updating existing meal time memories"
  missing:
    - "Prompt should instruct: when saving a meal time fact, always check dedup results and UPDATE existing meal time memory rather than adding a new one"
  debug_session: ""

- truth: "Grocery store preferences should be categorized appropriately, not as cooking_style"
  status: failed
  reason: "User reported: grocery stores was saved under category 'cooking_style' -- should not be cooking style"
  severity: minor
  test: 10
  root_cause: "Migration v10 in src/db/migrations.ts maps pref:grocery to cooking_style category. Schema defines 'logistics' category specifically for 'stores, delivery preferences, pantry staples'. pref:grocery should map to logistics."
  artifacts:
    - path: "src/db/migrations.ts"
      issue: "Line 334: pref:grocery grouped with pref:cooking/pref:budget/pref:serving under cooking_style"
  missing:
    - "Add separate branch: if tag is pref:grocery, map to logistics category"
    - "Re-migrate affected rows (UPDATE memories SET category='logistics' WHERE content LIKE '%store%' OR content LIKE '%shop%')"
  debug_session: ""
