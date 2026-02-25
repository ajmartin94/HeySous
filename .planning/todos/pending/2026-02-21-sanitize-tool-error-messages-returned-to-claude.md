---
created: 2026-02-21T15:25:00.866Z
title: Sanitize tool error messages returned to Claude
area: ai
tags: [security, observability, audit-medium]
files:
  - src/ai/claude-client.ts:210-219
  - src/ai/tool-handler.ts
---

## Problem

Two related issues with tool error handling:

1. **Error message leakage** (claude-client.ts:210-219): Exception messages (e.g., "SQLite: UNIQUE constraint failed on knowledge_items.id") are passed to Claude as tool results and could surface to users in responses.

2. **Missing is_error flag** (tool-handler.ts): Tool handlers catch exceptions internally and return `{ error: "..." }` as regular JSON results. The `is_error` mechanism exists in claude-client.ts but tool handlers never throw -- they catch everything. Claude can't distinguish validation failures from system errors.

Note: The existing "Add tool call logging" todo covers the logging/observability side but NOT the sanitization of error content or proper use of `is_error`.

## Solution

1. **Sanitize errors in claude-client.ts**: Replace long/technical error messages with generic fallback before returning to Claude. Log full errors server-side.
2. **Use is_error properly**: For unhandled/system exceptions in tool handlers, throw instead of catching and JSON-encoding. Let claude-client catch them and set `is_error: true`. Reserve JSON `{ error: "..." }` for validation/business logic errors that Claude should adapt to.
