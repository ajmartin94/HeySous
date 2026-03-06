---
status: diagnosed
trigger: "preference dedup path not triggered when user updates breakfast time"
created: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - contradictory system prompt instructions cause Claude to call update_reminder_settings instead of save_knowledge for meal time preferences, bypassing the dedup path entirely
test: Read system prompt sections for reminder_management and preference_management
expecting: Find conflicting guidance about which tool to use for meal time changes
next_action: Return diagnosis

## Symptoms

expected: When user says "i want my breakfast time to be 7:30am" and a knowledge item "Breakfast Time: 8am" exists, Claude should call save_knowledge which triggers dedup (0.70 similarity threshold for preferences) and prompts user to update the existing item
actual: Claude calls update_reminder_settings only, never calls save_knowledge, dedup logic in tool-handler.ts never fires
errors: None (silent wrong behavior)
reproduction: Tell bot "i want my breakfast time to be 7:30am" with existing "Breakfast Time" knowledge item
started: Since reminder_management prompt was added

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-04T00:01:00Z
  checked: src/ai/system-prompt.ts REMINDER_PROMPT section (lines 252-295)
  found: Line 272 says `"I eat breakfast at 9am" -> update_reminder_settings with breakfast_time: "09:00"` as a direct example mapping. Lines 293-294 say "If the user updates any meal time preference... the preference_management section handles syncing it to reminder settings automatically" and "You do NOT need to manually update reminder settings when meal times change -- just save the preference and the sync handles the rest"
  implication: CONTRADICTION - the UPDATING SETTINGS examples on line 272 tell Claude to call update_reminder_settings directly for "I eat breakfast at 9am". But lines 293-294 say the opposite -- save the preference and let sync handle reminder settings. Claude follows the explicit example (line 272) because it's a direct pattern match.

- timestamp: 2026-03-04T00:02:00Z
  checked: src/ai/system-prompt.ts PREFERENCE_MANAGEMENT_PROMPT section (lines 607-684)
  found: Lines 646-649 say "When a user states a meal time... save it as a preference AND call update_reminder_settings with the corresponding time param". This tells Claude to do BOTH -- save_knowledge AND update_reminder_settings.
  implication: The preference_management section correctly says to do both, but the reminder_management section's examples (line 272-273) only show update_reminder_settings, creating ambiguity. Claude sees the direct example match first and stops there.

- timestamp: 2026-03-04T00:03:00Z
  checked: src/ai/system-prompt.ts REMINDER_PROMPT lines 291-294 (MEAL TIME SYNC subsection)
  found: Lines 293-294 say "the preference_management section handles syncing it to reminder settings automatically" and "You do NOT need to manually update reminder settings when meal times change -- just save the preference and the sync handles the rest"
  implication: This is the OPPOSITE of what the preference_management section says at lines 646-649, which instructs Claude to do BOTH save_knowledge AND update_reminder_settings. The reminder section says "just save the preference" while the preference section says "save AND update_reminder_settings". Meanwhile, the UPDATING SETTINGS examples (line 272) say to ONLY call update_reminder_settings. Three conflicting instructions.

- timestamp: 2026-03-04T00:04:00Z
  checked: src/ai/tools.ts update_reminder_settings description (lines 470-478)
  found: Tool description says "Use this when users say things like... 'I eat breakfast at 9am'... 'set my lunch time to 1pm'". This is the tool-level description that also directs Claude to this tool for meal time statements.
  implication: The tool description itself reinforces using update_reminder_settings for meal time statements, adding a FOURTH source of "use this tool" guidance that competes with the preference_management instruction to use save_knowledge.

- timestamp: 2026-03-04T00:05:00Z
  checked: src/ai/tool-handler.ts save_knowledge dedup logic (lines 253-351)
  found: Dedup logic at lines 276-324 checks for preference tag and uses computeContentSimilarity with 0.70 threshold. This code is correct and would catch "Breakfast Time: 7:30am" vs existing "Breakfast Time: 8am" -- but it ONLY runs inside the save_knowledge handler. If Claude never calls save_knowledge, this code never executes.
  implication: The dedup implementation is fine. The bug is upstream -- Claude's tool selection, driven by conflicting prompt instructions.

## Resolution

root_cause: Three-way contradiction in the system prompt causes Claude to call only update_reminder_settings (not save_knowledge) for meal time preferences. (1) REMINDER_PROMPT line 272 provides a direct example mapping "I eat breakfast at 9am" -> update_reminder_settings. (2) REMINDER_PROMPT lines 293-294 say "just save the preference, sync handles the rest" (save_knowledge only). (3) PREFERENCE_MANAGEMENT_PROMPT lines 646-649 say "save as preference AND call update_reminder_settings" (both tools). The tool description for update_reminder_settings also explicitly lists "I eat breakfast at 9am" as a use case. Claude follows the most specific pattern match (the direct example in UPDATING SETTINGS), so it calls update_reminder_settings only and never calls save_knowledge, which means the dedup path never fires.
fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
