---
created: 2026-02-21T15:25:00.866Z
title: Implement streaming responses for lower perceived latency
area: ai
tags: [performance, ux, audit-medium]
files:
  - src/ai/claude-client.ts
---

## Problem

Both `sendMessage()` and `sendMessageWithTools()` use blocking API calls. The user sees nothing in Telegram until the full Claude response completes. For verbose responses or multi-tool workflows, this can mean 5-15 seconds of silence.

## Solution

Implement streaming via the Anthropic SDK's `stream()` method. As text chunks arrive:
1. Send a Telegram "typing" action to show activity.
2. Accumulate text and send progressive updates (edit existing message with new content) or batch-send after pauses.
3. For tool use responses, accumulate the full tool_use block before executing (can't stream tool calls).

Consider the Telegram API's rate limits on message editing (~30 edits/second per chat) when designing the progressive update strategy.
