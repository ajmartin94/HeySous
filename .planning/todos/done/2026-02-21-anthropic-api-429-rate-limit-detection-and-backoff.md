---
created: 2026-02-21T15:25:00.866Z
title: Anthropic API 429 rate limit detection and backoff
area: ai
tags: [resilience, api, audit-critical]
files:
  - src/ai/claude-client.ts
---

## Problem

API errors are caught and retried once in `processor.ts`, but there's no detection of HTTP 429 specifically. No exponential backoff, no deferred retry queue. A burst of concurrent household requests could trigger Anthropic rate limits that cascade into failures for all users.

The current retry is blind -- it retries identically after any error, which is counterproductive for 429s where you need to wait longer.

## Solution

1. Detect 429 errors specifically from the Anthropic SDK (check error type/status code).
2. Implement exponential backoff with jitter for 429s (e.g., 1s → 2s → 4s → 8s).
3. Consider a global request queue with concurrency limits to stay under Anthropic's rate limits proactively.
4. Log rate limit events distinctly from other API errors for monitoring.
