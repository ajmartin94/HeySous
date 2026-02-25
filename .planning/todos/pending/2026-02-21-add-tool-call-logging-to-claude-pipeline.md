---
created: 2026-02-21T04:12:25.791Z
title: Add tool call logging to Claude pipeline
area: ai
files:
  - src/ai/claude-client.ts:197-220
  - src/ai/tool-handler.ts
  - src/pipeline/processor.ts:291-300
---

## Problem

The tool use loop in `claude-client.ts` (lines 197-220) silently catches tool execution errors and returns `is_error: true` to Claude with no logging. The tool handler (`tool-handler.ts`) has zero logger usage. This creates a blind spot where:

1. We cannot tell which tools Claude called during a conversation
2. We cannot tell if a tool call succeeded or failed
3. Silent error catching means tool failures are invisible to operators

Real-world impact: Bekah submitted app design feedback ("green tags are hard to read"), Claude responded "I'll send that to the team" but `app_feedback` table has 0 rows. We cannot determine whether Claude never called `save_app_feedback` or called it and it threw silently.

## Solution

Add structured pino logging at two levels:

1. **claude-client.ts tool loop** (lines 197-220): Log each tool call name + duration, and log errors with full context before returning `is_error`
2. **tool-handler.ts**: Import logger, add debug-level logging for each tool dispatch with input summary and result

Log format should include: tool name, household_id, duration_ms, success/error status, and truncated input for debugging. Keep log volume reasonable (info level for calls, warn for errors, debug for inputs/outputs).
