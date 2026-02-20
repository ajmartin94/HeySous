---
created: 2026-02-19T02:03:54.431Z
title: Variation handling research and refinement
area: ai
files:
  - src/ai/system-prompt.ts
  - src/knowledge/
  - src/planning/
---

## Problem

When users want variations of existing recipes (e.g., "make it spicier", "swap chicken for tofu", "the vegetarian version"), the handling is unclear. Should Sous create a new recipe card? Modify the existing one? Track variations as linked recipes? Needs research into what makes sense UX-wise and data-model-wise.

## Solution

- Research: How do users naturally talk about recipe variations?
- Design decision: variations as separate cards (with parent link), inline modifications, or a "notes/variants" field on existing cards
- Consider: does the meal plan reference the base recipe or the variation?
- Consider: how does this interact with cooking history and feedback?
- Start with the simplest approach that doesn't paint us into a corner
