---
phase: 32-prompt-quality-persona
plan: 01
subsystem: ai
tags: [system-prompt, persona, claude, prompt-engineering]

requires: []
provides:
  - "SOUS_PERSONA constant -- single source of truth for Sous voice"
  - "Fixed import_from_url tool description (auto-save, no confirmation wait)"
  - "Preference durability signals (save vs. skip decision framework)"
  - "Recipe ID format [recipe #ID] documentation for plan modifications"
  - "Dinner time cross-reference in reminder management section"
  - "Unified persona wired into reminder and prep alert senders"
affects: [prompt-caching, input-validation]

tech-stack:
  added: []
  patterns:
    - "Shared persona constant: export SOUS_PERSONA from system-prompt.ts, import in auxiliary prompt builders"

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts
    - src/ai/tools.ts
    - src/reminders/sender.ts
    - src/feedback/extractor.ts

key-decisions:
  - "SOUS_PERSONA includes identity, personality, boundaries, and communication -- NOT tool/feature instructions"
  - "import_from_url standardized to auto-save (system prompt behavior was correct, tool description was outdated)"
  - "Feedback extractor intentionally excluded from persona unification (pure JSON extraction task)"
  - "HTML/markdown formatting rules in SOUS_PERSONA communication block, so auxiliary prompts inherit them automatically"

patterns-established:
  - "Persona constant pattern: SOUS_PERSONA is imported wherever Sous voice is needed, preventing persona drift"

requirements-completed: [PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05]

duration: 5min
completed: 2026-02-21
---

# Plan 32-01: Persona Unification & Instruction Gap Fixes Summary

**Unified Sous persona into single exported constant, fixed import_from_url conflict, and filled three instruction gaps (recipe ID format, preference durability signals, dinner time cross-reference)**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extracted SOUS_PERSONA constant as single source of truth for Sous's voice across all Claude interaction points
- Fixed import_from_url tool description to match system prompt auto-save behavior (was conflicting)
- Added DURABILITY SIGNALS section to help Claude distinguish enduring preferences from situational statements
- Documented recipe ID format [recipe #ID] explicitly in meal planning section for plan modifications
- Added dinner time cross-reference in reminder management section linking to preference sync
- Wired SOUS_PERSONA into reminder sender and prep alert sender, eliminating duplicate persona definitions

## Task Commits

1. **Task 1: Unify Sous persona and fix instruction conflicts** - `9b2a5e6` (feat)
2. **Task 2: Wire unified persona into reminder and feedback senders** - `f03c03a` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Extracted SOUS_PERSONA constant, added durability signals, recipe ID format, dinner time cross-ref
- `src/ai/tools.ts` - Fixed import_from_url description to match system prompt
- `src/reminders/sender.ts` - Imported SOUS_PERSONA, refactored reminder and prep alert prompts
- `src/feedback/extractor.ts` - Added clarifying comment about intentional persona exclusion

## Decisions Made
- SOUS_PERSONA contains identity + personality + boundaries + communication, but NOT the full tool/recipe/planning instructions. This makes it suitable for auxiliary prompts (reminders, prep alerts) that need the voice but not the feature instructions.
- Standardized import_from_url to auto-save behavior (the system prompt was correct, the tool description was outdated from pre-v1.4 when the auto-save fix was added)
- userNameLine moved from inside personality block to after SOUS_PERSONA in buildSystemPrompt, since the constant must be static

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SOUS_PERSONA constant is ready for Plan 02 to restructure into static/dynamic prompt split
- All instruction content is in its final form, ready for caching restructure

---
*Phase: 32-prompt-quality-persona*
*Completed: 2026-02-21*
