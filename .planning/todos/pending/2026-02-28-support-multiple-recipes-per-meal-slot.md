---
created: 2026-02-28T17:00:05.959Z
title: Support multiple recipes per meal slot
area: planning
files:
  - src/planning/
  - src/ai/tools.ts
  - src/ai/system-prompt.ts
  - src/db/schema.ts
---

## Problem

Currently each meal slot (e.g., Monday dinner) supports only a single recipe. Real meals often have multiple components — spaghetti dinner with garlic bread on the side, or a main dish with a separate salad recipe. Users can't express multi-recipe meals, forcing them to either combine everything into one recipe or lose the side dish.

## Solution

Allow multiple recipes to be associated with a single meal slot. This likely involves:
- Schema change: meal plan slots become one-to-many with recipes (or add a junction table)
- Tool updates: `set_meal_plan` and related tools need to accept/return multiple recipe IDs per slot
- System prompt: instruct Claude that meals can have multiple recipes (main + sides)
- Mini app: update plan view to show stacked recipes per slot
- Grocery list: already aggregates across recipes, but verify it handles multi-recipe slots correctly
