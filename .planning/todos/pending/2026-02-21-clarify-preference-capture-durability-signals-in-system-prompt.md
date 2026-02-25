---
created: 2026-02-21T15:25:00.866Z
title: Clarify preference capture durability signals in system prompt
area: ai
tags: [prompt-quality, audit-medium]
files:
  - src/ai/system-prompt.ts:379-391
---

## Problem

The system prompt gives conflicting guidance on when to capture preferences:
- "Act on preference statements immediately. Do not wait for a separate 'remember this' command."
- "If you're unsure whether something is a real preference or just a one-time comment, err on the side of NOT saving it."

How should Claude distinguish "I'm not feeling chicken tonight" (transient) from "I don't eat pork anymore" (durable)? The guidance relies entirely on Claude's judgment without explicit signals.

## Solution

Add explicit durability signals to the system prompt:

**Save if:**
- Stated as a constraint/rule: "I don't/can't/won't eat X"
- Framed as habitual: "I always", "we usually", "we never"
- Mentioned more than once across conversations
- Allergy/intolerance: always save immediately

**Don't save if:**
- Mood-based: "not feeling", "not in the mood for"
- Time-bound: "this week", "tonight", "for now"
- Hypothetical: "maybe", "I might try"
