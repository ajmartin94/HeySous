---
created: 2026-02-19T02:03:54.431Z
title: Data migration framework for schema and behavior fixes
area: database
files:
  - src/db/
---

## Problem

When shipping fixes that change AI behavior or data semantics (e.g., recipe-plan linking fix), there's no framework for deciding whether/how to backfill existing data. Currently handled case-by-case. Need a principled approach for when data migrations make sense vs letting fixes self-heal through normal usage.

## Solution

- Design a lightweight migration runner (numbered scripts, idempotent, tracks which have run)
- Establish decision criteria: migrate when data can't self-heal, has long-lived impact, or changes semantics
- Skip migration when data is ephemeral (weekly plans), fix is self-healing, or matching is fuzzy/risky
- Could pair with the update notification system to inform users when a migration runs
