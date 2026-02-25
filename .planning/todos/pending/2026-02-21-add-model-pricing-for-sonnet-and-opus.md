---
created: 2026-02-21T15:25:00.866Z
title: Add model pricing for Sonnet and Opus
area: ai
tags: [observability, cost-control, audit-low]
files:
  - src/ai/types.ts
---

## Problem

`MODEL_PRICING` in `types.ts` only defines pricing for Haiku 4.5. If the model is changed to Sonnet or Opus (or a new model version), cost tracking in `processor.ts` would calculate incorrect costs.

## Solution

Add pricing entries for all Claude models the project might use:
- Claude Haiku 4.5 (existing)
- Claude Sonnet 4.5/4.6
- Claude Opus 4.5/4.6

Include a fallback/default for unknown model IDs that logs a warning and uses a conservative estimate.
