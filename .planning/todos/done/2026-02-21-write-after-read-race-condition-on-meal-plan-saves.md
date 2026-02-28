---
created: 2026-02-21T15:25:00.866Z
title: Write-after-read race condition on meal plan saves
area: ai
tags: [resilience, data-integrity, audit-high]
files:
  - src/ai/tool-handler.ts
---

## Problem

`save_meal_plan` replaces ALL entries for a week. If two concurrent messages from the same household both modify the same plan, the second write silently overwrites the first:

1. User msg 1: "Swap Monday to tacos" -- Claude loads plan, modifies Monday, saves (replaces all)
2. User msg 2: "Make Thursday pizza" -- Claude loads plan (pre-msg-1 version), modifies Thursday, saves (replaces all, losing Monday change)

The 1.5s debounce reduces likelihood but doesn't eliminate it, especially in multi-user households.

## Solution

Options:
1. **Optimistic locking**: Add a `version` column to meal plans. Check version on save, reject if stale.
2. **Row-level updates**: Instead of replacing all entries for a week, update individual day/meal entries.
3. **Mutex per household**: Serialize plan modifications per household (simplest but limits concurrency).
