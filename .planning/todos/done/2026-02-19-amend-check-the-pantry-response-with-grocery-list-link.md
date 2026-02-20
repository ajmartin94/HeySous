---
created: 2026-02-19T02:03:54.431Z
title: Amend check the pantry response with grocery list link
area: ai
files:
  - src/ai/system-prompt.ts
  - src/grocery/
---

## Problem

When Sous tells users to "check the pantry" for ingredients, it's a dead end. The response should either point users to the grocery list in the Mini App (where they can see what they need to buy) OR offer to walk through the pantry check conversationally.

## Solution

- Update system prompt / grocery-related tool responses to include Mini App grocery list link
- Offer two paths: "Check your grocery list in the app [link]" or "Want me to walk through what you'll need?"
- The conversational path could go ingredient-by-ingredient: "Do you have X? Y? Z?" and add missing items to grocery list
- Ensure the Mini App webApp button/link is accessible from the response
