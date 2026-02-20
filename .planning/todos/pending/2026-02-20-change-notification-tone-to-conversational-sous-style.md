---
created: 2026-02-20T03:10:39.833Z
title: Change notification tone to conversational Sous style
area: ai
files:
  - src/ai/system-prompt.ts
  - src/reminders/
  - src/feedback/
---

## Problem

Notifications (reminders, feedback check-ins, etc.) currently use an emoji-heavy, generic AI tone that feels out of character. The bot's conversational personality as "Sous" -- a knowledgeable, chill kitchen companion -- doesn't carry through to scheduled/automated messages. They read like default AI slop instead of matching the natural, conversational style Sous uses in regular chat.

## Solution

- Audit all notification templates in reminders and feedback modules for emoji overuse and generic AI phrasing
- Review system prompt instructions for how Sous should communicate in proactive messages
- Rewrite notification copy to match conversational Sous voice: helpful, brief, human-sounding
- Minimize or eliminate emoji usage in automated messages
- Ensure consistency between chat responses and notification tone
