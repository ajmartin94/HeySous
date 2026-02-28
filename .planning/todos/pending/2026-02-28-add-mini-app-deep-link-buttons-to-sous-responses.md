---
created: 2026-02-28T17:00:05.959Z
title: Add mini app deep-link buttons to Sous responses
area: bot
files:
  - src/ai/system-prompt.ts
  - src/telegram/format.ts
  - mini-app/src/App.tsx
---

## Problem

When Sous mentions plans, recipes, or grocery lists in conversation, the user has to manually open the mini app and navigate to the relevant content. There's no direct way to jump from a bot response to the specific item in the mini app.

This adds friction to every interaction where Sous references content — users want to tap and see it immediately.

## Solution

Add inline buttons (Telegram InlineKeyboard) to Sous responses that deep-link into the mini app at the relevant content. When Sous mentions:
- A meal plan → button opens mini app to that plan view
- A recipe → button opens mini app to that recipe
- A grocery list → button opens mini app to the grocery list

May require:
- Updating the system prompt so Claude knows to signal when content is referenced
- A deep-link URL scheme for the mini app (e.g., query params or hash routes)
- Post-processing bot responses to attach appropriate inline keyboards
