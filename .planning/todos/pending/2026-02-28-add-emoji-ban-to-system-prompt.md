---
created: 2026-02-28T17:00:05.959Z
title: Add emoji ban to system prompt
area: ai
files:
  - src/ai/system-prompt.ts
---

## Problem

Sous (Claude) still uses emojis in its responses despite the desired tone being a chill, conversational kitchen companion — not a generic AI assistant. Emoji usage makes responses feel like AI slop. A previous persona todo included this but the emoji problem persists, so it needs a direct, explicit fix in the system prompt.

## Solution

Add a clear, explicit instruction to `src/ai/system-prompt.ts` banning emoji usage. Something like:

> Never use emojis in your responses. No emoji characters at all — use words instead.

Place it prominently in the system prompt (not buried in a long list) so it's reliably followed. May also need to audit hardcoded bot message templates in `src/bot/messages.ts` and notification templates for any emoji literals.
