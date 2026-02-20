---
created: 2026-02-19T02:06:36.757Z
title: Grocery store preferences not saved or used in list generation
area: grocery
files:
  - src/grocery/
  - src/ai/system-prompt.ts
  - src/knowledge/preferences.ts
---

## Problem

Users may express grocery store preferences (e.g., "I shop at Costco", "we go to Trader Joe's", preferred store layout/sections) but these aren't being saved as preferences or used when generating grocery lists. The grocery list generation doesn't account for store-specific organization, availability, or bulk sizing.

## Solution

- Ensure store preferences are captured via the preference system (may relate to the "preferences require explicit language" todo)
- Update grocery list generation to factor in store preferences when available
- Consider: store-specific grouping/sections in the grocery list output
- Consider: store-specific product names or sizes (e.g., Costco bulk quantities)
- May be primarily a system prompt refinement to make Sous aware of stored grocery preferences
