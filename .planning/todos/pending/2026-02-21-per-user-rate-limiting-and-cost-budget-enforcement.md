---
created: 2026-02-21T15:25:00.866Z
title: Per-user rate limiting and cost budget enforcement
area: pipeline
tags: [security, cost-control, audit-critical]
files:
  - src/pipeline/processor.ts
  - src/pipeline/message-queue.ts
---

## Problem

There are no per-user or per-household limits on message volume or API spend. The 1.5s debounce prevents rapid-fire bursts within a single chat, but a user sending 100 messages over a few minutes generates 100 separate Claude calls (each up to 10 tool iterations). There's no daily/hourly token budget, no circuit breaker, and no admin alerting at cost thresholds.

A single malicious or overly enthusiastic user could generate hundreds of dollars in API charges with no safeguard.

## Solution

Implement per-household rate limiting and cost budget enforcement:

1. **Message rate limit**: In-memory or DB counter for messages per hour per household (e.g., 100/hour). Return a friendly "slow down" message when exceeded.
2. **Token budget**: Track cumulative token spend per household per day (data already in `token_usage` table). Enforce a configurable daily cap (e.g., $10/household/day).
3. **Circuit breaker**: After N consecutive API errors, back off for that household.
4. **Admin alerting**: Log a warning when a household crosses cost thresholds (e.g., 50%, 80%, 100% of daily budget).
