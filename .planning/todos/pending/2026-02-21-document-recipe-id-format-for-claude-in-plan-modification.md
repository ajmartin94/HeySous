---
created: 2026-02-21T15:25:00.866Z
title: Document recipe ID format for Claude in plan modification
area: ai
tags: [prompt-quality, audit-medium]
files:
  - src/ai/system-prompt.ts:66-70
  - src/planning/context.ts:31-32
---

## Problem

The plan context uses `[recipe #ID]` notation (context.ts:31-32), and the system prompt mentions it at line 70. But there's no explicit instruction telling Claude: "when you see `[recipe #123]` in the existing plan context, extract that ID and reuse it as the `knowledge_item_id` when modifying the plan."

Claude has to infer this convention. When a user says "change Tuesday to tacos," Claude might re-search for the recipe and get a different ID, or save without linking the recipe at all, losing the existing association.

## Solution

Make the instruction explicit in the system prompt MEAL_PLANNING_PROMPT section:

```
When you see an existing plan entry marked "[recipe #123]", that number (123) is the
knowledge_item_id. Always preserve these IDs when updating entries unless the user
explicitly changes which recipe they want. Only search for a new ID if the recipe itself
is being replaced.
```
