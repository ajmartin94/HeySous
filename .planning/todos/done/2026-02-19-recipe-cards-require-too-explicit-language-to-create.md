---
created: 2026-02-19T02:03:54.431Z
title: Recipe cards require too explicit language to create
area: ai
files:
  - src/ai/system-prompt.ts
  - src/ai/tools.ts
  - src/knowledge/
---

## Problem

Users need to use very explicit language to get Sous to create recipe cards (e.g., "save this as a recipe"). Sous should be more proactive about recognizing when a user is sharing or discussing a recipe and offer to save it, or save it automatically when appropriate.

## Solution

- Refine system prompt instructions to make Sous more proactive about recipe card creation
- Add heuristics: if user shares ingredients + steps, treat as implicit recipe save intent
- Consider a confirmation flow: "Want me to save this as a recipe card?" rather than requiring explicit commands
- Research what language patterns users naturally use when sharing recipes
