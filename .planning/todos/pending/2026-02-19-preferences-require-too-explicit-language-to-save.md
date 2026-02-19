---
created: 2026-02-19T02:03:54.431Z
title: Preferences require too explicit language to save
area: ai
files:
  - src/ai/system-prompt.ts
  - src/ai/tools.ts
  - src/knowledge/preferences.ts
---

## Problem

Similar to recipe cards, users need to be very explicit to get Sous to save dietary preferences, restrictions, or taste preferences. Sous should pick up on implicit signals like "I don't eat pork" or "we love spicy food" and proactively save them as preferences.

## Solution

- Refine system prompt to detect implicit preference statements
- Add pattern matching guidance: dietary restrictions, cuisine preferences, ingredient likes/dislikes, household constraints
- Consider confirmation: "I'll remember that you don't eat pork!" rather than requiring explicit save commands
- Review existing preference storage to ensure it can handle the variety of implicit preferences
