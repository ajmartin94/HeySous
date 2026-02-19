---
created: 2026-02-19T05:24:22.157Z
title: Knowledge updates are causing duplication
area: ai
files:
  - src/ai/tool-handler.ts:94-125
  - src/ai/tools.ts:54-65
  - src/knowledge/repository.ts:49-79
  - src/knowledge/schema.ts
---

## Problem

Two related issues discovered during v1.3 milestone UAT:

**1. save_knowledge creates duplicates:** No deduplication at any layer. The `save_knowledge` tool handler blindly calls `repository.create()` which does a pure INSERT. No search-before-save, no UNIQUE constraint on (householdId, title). During onboarding reruns, preferences were saved 4x. During a single conversation, recipes were saved twice within 30 seconds.

**2. update_knowledge no-op bug:** Claude can call `update_knowledge` with only `{id, change_description}` and no content field. The handler builds an empty `changes` object, calls `repository.update()` which only bumps `updatedAt`, then returns a success message. Claude believes the recipe was updated when nothing actually changed.

Both issues were diagnosed with root cause analysis in:
- .planning/debug/recipe-modification-not-persisted.md
- .planning/debug/save-knowledge-duplicates.md

A fix was attempted (22-03) but reverted because the auto-upsert approach for dedup was too aggressive — it would silently overwrite intentionally distinct items with the same title (e.g., two different "Chicken Stir Fry" recipes).

## Solution

Needs careful design. Key decisions:

**For save_knowledge dedup:**
- Option A: Return match to Claude ("Item 'X' already exists, ID: N. Use update_knowledge to modify, or choose a different title") — lets Claude decide
- Option B: Auto-upsert with fuzzy matching — risky, can overwrite wrong items
- Option C: UNIQUE constraint on (householdId, title) with ON CONFLICT — DB-level but inflexible
- Option A is likely the right approach — low risk, teaches Claude, user stays in control

**For update_knowledge no-op:**
- Add validation guard: reject calls with no substantive fields (title/summary/content/tags)
- Return error with guidance to retrieve content first, modify, then send back
- Strengthen tool description and system prompt to make content requirement explicit
- This fix is straightforward and low risk — can be done independently of dedup
