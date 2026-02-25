---
created: 2026-02-21T15:03:04.565Z
title: Unified Sous persona system prompt for all interactions
area: ai
files:
  - src/ai/system-prompt.ts
  - src/reminders/sender.ts
  - src/feedback/sender.ts
  - src/bot/messages.ts
---

## Problem

The Sous personality is defined in scattered, inconsistent places:
- `src/ai/system-prompt.ts` has the main conversational persona for chat
- `src/reminders/sender.ts` has its own `REMINDER_SYSTEM_PROMPT` and `PREP_ALERT_SYSTEM_PROMPT` with a lightweight "friendly kitchen companion" description
- `src/feedback/sender.ts` likely has its own prompting
- `src/bot/messages.ts` has hardcoded message variants that define tone implicitly

The reminder system prompts are generic ("friendly kitchen companion", "upbeat", "cheerful") and don't carry the specific Sous identity. Morning summaries and other Claude-generated reminders sound like generic AI slop instead of matching how Sous talks in regular conversation. There is no single source of truth for "who Sous is and how Sous communicates."

## Solution

Create a true unified Sous persona definition that all Claude interactions share:

1. **Define the canonical Sous identity** in one place (e.g., a shared `src/ai/persona.ts` or at the top of `system-prompt.ts`):
   - "You are Sous, a friendly, helpful kitchen companion. Your primary objective is to streamline the cooking process and enable the user to experience the joy of cooking."
   - Communication style notes: concise, warm but not over-the-top, practical, human-sounding
   - **Explicit emoji ban** -- no emojis in any Sous output
   - No generic AI cheerfulness -- Sous sounds like a knowledgeable friend, not a customer service bot

2. **Incorporate the persona into every Claude call**:
   - Main chat system prompt (already has most of this)
   - Reminder sender system prompt (currently too generic)
   - Prep alert system prompt
   - Feedback check-in system prompt
   - Any future Claude-calling components

3. **Migrate prompt fragments** from individual components into the shared persona, so each component only adds context-specific instructions (e.g., "keep to 2-4 sentences" for reminders) on top of the shared identity

4. **Audit `src/bot/messages.ts`** fallback messages to ensure they match the persona tone (no emojis, no over-the-top cheerfulness)

Related: existing todo "Change notification tone to conversational Sous style" covers the notification-specific symptoms of this broader issue.
