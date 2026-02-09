# Phase 4 Plan 2: Recipe Management System Prompt Summary

**One-liner:** Comprehensive recipe management instructions in system prompt covering creation flow with confirmation, structured content format, Telegram HTML display, auto-tagging taxonomy, partial updates, deletion, and cross-recipe reasoning.

---
phase: 04
plan: 02
subsystem: ai
tags: [system-prompt, recipe-management, prompt-engineering]

dependency-graph:
  requires: [02-01]
  provides: [recipe-management-instructions, tag-taxonomy, recipe-display-format]
  affects: [04-01, 04-03]

tech-stack:
  added: []
  patterns: [prompt-engineering-for-behavior, structured-text-content-format, namespaced-tag-taxonomy]

key-files:
  created: []
  modified: [src/ai/system-prompt.ts]

decisions:
  - id: "04-02-01"
    decision: "Recipe intelligence lives entirely in system prompt -- no code-level recipe parsing or templates"
    rationale: "Claude understands recipes naturally; prompt engineering drives all recipe behavior"
  - id: "04-02-02"
    decision: "Namespaced tag taxonomy (cuisine:italian, protein:chicken, etc.) auto-assigned by Claude"
    rationale: "Users should never have to think about tags; consistent namespace enables filtered queries"
  - id: "04-02-03"
    decision: "Recipe content stored as structured plain text, not JSON or HTML"
    rationale: "FTS5-searchable, Claude-readable, human-readable; fits knowledge-as-rich-context philosophy"
  - id: "04-02-04"
    decision: "Confirmation required before save; partial updates skip re-confirmation"
    rationale: "Save is a significant action warranting approval; minor edits should feel frictionless"

metrics:
  duration: "1 min"
  completed: "2026-02-06"
---

## Task Commits

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add recipe management section to system prompt | e1d58f9 | Added write tool bullets to tools section; added full recipe_management section (90 lines) |

## What Was Done

### Task 1: Add recipe management section to system prompt

Updated `buildSystemPrompt()` in `src/ai/system-prompt.ts` with two additions:

1. **Tools section update** -- Added 3 bullet points referencing write tools (save_knowledge, update_knowledge, delete_knowledge) and natural confirmation phrasing guidance.

2. **New `<recipe_management>` section** -- 90-line comprehensive recipe management instructions covering:
   - **Recipe detection** -- Proactive offer to save when recipe details are shared
   - **Creation flow** -- 6-step flow: collect details, check completeness, show summary, get confirmation, save
   - **Content format** -- Structured plain text (ingredients, steps, times, servings, notes) for the content field
   - **Display format** -- Telegram HTML using only supported tags (b, i, blockquote), no markdown
   - **Tag taxonomy** -- Auto-assigned namespaced tags: recipe, cuisine:*, meal:*, protein:*, difficulty:*, plus contextual (quick, make-ahead, one-pot, kid-friendly, etc.)
   - **Updates** -- get_knowledge_item first, modify, send complete content back; no re-confirmation for minor changes
   - **Deletion** -- Explicit confirmation required before delete_knowledge call
   - **Cross-recipe reasoning** -- Use search_knowledge for comparisons, show brief listings, let user pick for details

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 04-02-01 | Recipe intelligence in system prompt, not code | Claude understands recipes naturally; no parsing needed |
| 04-02-02 | Namespaced auto-tag taxonomy | Zero user effort; enables structured queries |
| 04-02-03 | Structured plain text content format | FTS5-searchable, Claude-readable, human-readable |
| 04-02-04 | Confirmation before save, skip for partial updates | Save needs approval; minor edits should be frictionless |

## Verification Results

- TypeScript compilation: PASSED (zero errors)
- `<recipe_management>` tags: FOUND (lines 47 and 137)
- save_knowledge reference: FOUND (3 occurrences)
- update_knowledge reference: FOUND
- delete_knowledge reference: FOUND
- TAG TAXONOMY section: FOUND
- DELETION section: FOUND
- CROSS-RECIPE REASONING section: FOUND
- RECIPE CREATION FLOW with 6-step list: FOUND
- UPDATES AND CORRECTIONS with get_knowledge_item-first: FOUND
- No deferred features mentioned (no photo import, URL scraping, Mini Apps): CONFIRMED
- Only Telegram-supported HTML tags referenced: CONFIRMED

## Next Phase Readiness

Plan 04-02 delivers the recipe management instructions that Claude will follow. Plans 04-01 (write tools) and 04-03 (changelog + wiring) are the infrastructure that enables these instructions to function. The system prompt now references save_knowledge, update_knowledge, and delete_knowledge -- these tools must be defined in 04-01.

## Self-Check: PASSED
