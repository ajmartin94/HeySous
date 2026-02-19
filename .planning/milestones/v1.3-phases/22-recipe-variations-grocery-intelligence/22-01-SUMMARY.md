---
phase: 22-recipe-variations-grocery-intelligence
plan: 01
subsystem: ai
tags: [system-prompt, recipe-variations, substitutions]

requires:
  - phase: 21-implicit-ai-behaviors
    provides: implicit recipe detection and preference capture in system prompt
provides:
  - Recipe variation handling instructions in system prompt (in-place modification + inline substitution notes)
  - Updated recipe content format with Variations section
  - Updated recipe display format with Variations rendering
affects: [meal-planning, recipe-management]

tech-stack:
  added: []
  patterns:
    - "Recipe variations as inline content section (Variations:) rather than separate cards"
    - "In-place recipe modification via update_knowledge for tweaks"

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts

key-decisions:
  - "Recipe tweaks (spicier, less salt) are in-place updates, not new cards"
  - "Interchangeable ingredients stored as Variations section in recipe content"
  - "Variations section placed after Notes, before Feedback annotations"
  - "Meal plans pick default variant and mention alternatives"

patterns-established:
  - "Variations section format: Category: default (default), alt1, alt2"
  - "User-driven substitution notes only -- no proactive suggestions"

requirements-completed: [AIBH-04]

duration: 2min
completed: 2026-02-19
---

# Phase 22-01: Recipe Variation Handling Summary

**System prompt instructions for in-place recipe modification and inline substitution notes with meal plan integration**

## Performance

- **Duration:** 2 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added RECIPE_VARIATIONS_PROMPT section to system prompt covering in-place modifications, inline substitution notes, meal plan integration, and anti-patterns
- Updated recipe content format to include optional Variations section after Notes
- Updated recipe display format to show Variations with bold header in Telegram messages

## Task Commits

1. **Task 1 + Task 2: Add recipe variation handling and update content format** - `29b559a` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Added RECIPE_VARIATIONS_PROMPT constant, updated recipe content format and display format documentation

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- System prompt now instructs Sous on recipe variation behavior
- Plan 22-02 can build on this with store preference pipeline updates

---
*Phase: 22-recipe-variations-grocery-intelligence*
*Completed: 2026-02-19*
