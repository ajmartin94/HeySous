---
created: 2026-02-21T15:25:00.866Z
title: Add context window overflow detection
area: ai
tags: [resilience, audit-high]
files:
  - src/ai/claude-client.ts
---

## Problem

Large system prompt (~7,500 tokens) + conversation history + tool results could approach the model's context window limit. There's no validation of estimated input size before sending, and no detection of overflow in the API response. If the context is silently truncated by the API, Claude may lose important instructions or conversation history without any indication.

## Solution

1. Estimate total input tokens before each API call (system prompt + messages + tool results).
2. If estimated input approaches model limit (e.g., >80% of context window), log a warning and consider trimming conversation history more aggressively.
3. Check the API response for any truncation indicators.
4. Consider adding the model's context window size to the config so it can be adjusted when switching models.
