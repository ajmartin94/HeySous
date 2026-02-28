---
created: 2026-02-28T17:00:05.959Z
title: Add quick recipe access button in chat
area: bot
files:
  - src/bot/handlers/
  - src/planning/context-builder.ts
  - src/reminders/
---

## Problem

When it's dinner time and a user has a planned meal, they currently have to: open mini app → navigate to the plan → find today → tap the recipe. That's 3-4 taps for something they need in the moment (e.g., while standing in the kitchen).

Users want a single-tap path from the chat to the recipe that's relevant right now.

## Solution

Add a contextual "quick access" button or command that surfaces the current/upcoming meal's recipe directly in the chat or as a one-tap mini app deep link. Could be:
- A persistent menu button that opens today's relevant recipe
- A smart `/recipe` command that infers the current meal time
- Integration with reminders — when a cooking reminder fires, include a button to open the recipe
- Time-aware: breakfast in the morning, lunch midday, dinner in the evening
