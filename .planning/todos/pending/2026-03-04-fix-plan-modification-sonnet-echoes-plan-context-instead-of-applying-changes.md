---
created: 2026-03-04T01:51:30.216Z
title: Fix plan modification - Sonnet echoes plan context instead of applying changes
area: ai
files:
  - src/ai/system-prompt.ts:140-156
  - src/ai/tool-handler.ts:588-710
---

## Problem

When a user reports eating something different from the plan AND requests a plan modification in the same message (e.g., "We had the curry tonight, pizza last night, and will have the teriyaki on Friday"), Claude Sonnet:

1. Correctly calls `log_meal` for the unplanned meals (easy, well-defined trigger)
2. Calls `save_meal_plan` but passes the **original plan entries from system prompt context** verbatim, without applying the requested modifications
3. Displays a "revised" plan in chat text that either shows the same original plan or claims changes were made that weren't

This happened 5 times in a row before the user explicitly confronted Sous about it. All `save_meal_plan` calls returned success because the tool faithfully saved whatever it was given -- it just received the wrong data.

### Root Cause Analysis

The system prompt has a conflicting trigger pattern:

- Line 155: `log_meal: Use when user mentions an unplanned meal ("we had pizza tonight")` -- this is a direct pattern match for the user's phrasing, giving Claude a clear simple action
- Lines 140-141: Plan adjustment instructions require Claude to construct a COMPLETE modified plan with all 7 days, look up knowledge_item_ids, etc. -- significantly more cognitive effort

Claude takes the easy path (log_meal) and half-asses the hard path (save_meal_plan), copying the plan from context instead of reasoning about modifications. The `log_meal` instruction makes it feel like the "recording" part is handled, so it skips actual plan modification.

### Evidence

- Prod logs confirm `save_meal_plan` was called with identical entries to the existing plan (LOG_TOOL_INPUTS=true captured the tool input)
- Cooking history shows `log_meal` was correctly called every time
- Required 5 explicit user corrections across 2 sessions before Sonnet actually modified the plan entries

## Solution

Potential approaches (scope during milestone planning):

1. **System prompt clarification**: Add explicit instruction that when a user reports eating something different from the plan, the plan entries for those days MUST be updated to reflect reality, not just logged. Clarify the relationship between log_meal and save_meal_plan when they overlap.

2. **No-op save detection**: In the `save_meal_plan` tool handler, compare new entries against existing entries. If identical, return a warning: "The plan you saved is identical to the existing plan. No changes were applied." This forces Claude to re-examine its work.

3. **Reduce save_meal_plan complexity**: The requirement to send the COMPLETE plan with knowledge_item_ids for every modification creates friction. Consider a lighter `update_plan_entry` tool for single-day changes, or have server-side auto-linking handle all ID resolution (already partially implemented).

4. **Log tool inputs always for save_meal_plan**: Even with LOG_TOOL_INPUTS=false globally, always log inputs for save operations to aid debugging.
