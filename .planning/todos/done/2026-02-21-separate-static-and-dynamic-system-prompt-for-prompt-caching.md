---
created: 2026-02-21T15:25:00.866Z
title: Separate static and dynamic system prompt for prompt caching
area: ai
tags: [performance, cost-control, audit-high]
files:
  - src/ai/system-prompt.ts
  - src/ai/claude-client.ts:59-64
---

## Problem

The system prompt is ~666 lines (~7,500 tokens) and changes on every request because dynamic context (preferences, plans, grocery lists, reminders) is concatenated into it. This means the prompt cache key changes every time, so ephemeral caching provides minimal benefit. The full system prompt is re-processed on every API call.

Note: The existing "Unified Sous persona" todo covers restructuring persona/prompts but does NOT address the static vs. dynamic separation needed for effective prompt caching.

## Solution

Split the system prompt into two blocks in the Anthropic API call:
1. **Static block** (personality, tool instructions, behavioral rules) -- cacheable, ~600 lines, changes only on deploy. Apply `cache_control: { type: "ephemeral" }` to this block.
2. **Dynamic block** (preferences, current plan, grocery list, reminders, feedback context) -- changes per request, appended as a second system block or user message prefix.

This should give cache hits on the static block across all messages for all users, significantly reducing input token costs. Coordinate with the "Unified Sous persona" todo to avoid duplicate restructuring work.
