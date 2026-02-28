---
created: 2026-02-21T15:25:00.866Z
title: Fix conflicting import_from_url tool instructions
area: ai
tags: [prompt-quality, bug, audit-critical]
files:
  - src/ai/tools.ts:108-113
  - src/ai/system-prompt.ts:605-620
---

## Problem

The `import_from_url` tool description (tools.ts:111-113) says "wait for confirmation before saving" while the system prompt (system-prompt.ts:612) says "import and save in the SAME turn, do NOT wait for user confirmation between these steps."

Claude receives contradictory guidance on every call. The system prompt takes precedence in practice, but the contradiction wastes instruction-following capacity and could cause inconsistent behavior.

## Solution

Update the tool description in `tools.ts` to match the system prompt instruction. Remove the "wait for confirmation" language from the tool definition. The intended behavior is import-then-save in one turn.

This is a one-line fix -- trivial effort.
