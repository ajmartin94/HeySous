---
phase: 21-implicit-ai-behaviors
plan: 01
subsystem: ai
tags: [system-prompt, claude, implicit-behavior, recipe-detection, preference-capture]

# Dependency graph
requires:
  - phase: 10-recipe-knowledge
    provides: recipe_management system prompt section and save_knowledge tool
  - phase: 11-user-preferences
    provides: preference_management system prompt section and preference detection
provides:
  - Enhanced system prompt with implicit recipe detection instructions
  - Enhanced system prompt with implicit preference capture instructions
affects: [22-conversational-nudges, ai-behavior]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Implicit detection subsections within existing system prompt blocks"
    - "Proactive save behavior (preferences) vs confirmation-first (recipes)"

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts

key-decisions:
  - "Recipes require user confirmation before saving (proactive offer, not auto-save)"
  - "Preferences are saved immediately without confirmation (safety-critical for allergies)"
  - "One-time comments excluded from preference capture to avoid noise"

patterns-established:
  - "Implicit behavior sections complement but do not replace explicit command flows"
  - "Signal phrase lists guide detection without being overly aggressive"

requirements-completed: [AIBH-01, AIBH-02]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 21 Plan 01: Implicit AI Behaviors Summary

**System prompt enhanced with implicit recipe detection and preference capture so Claude proactively saves recipe content and dietary preferences mentioned in natural conversation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T02:46:18Z
- **Completed:** 2026-02-19T02:48:06Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added IMPLICIT RECIPE DETECTION subsection to recipe_management prompt block with signal phrases, guardrails, and confirmation-first flow
- Added IMPLICIT PREFERENCE CAPTURE subsection to preference_management prompt block with mid-conversation capture, allergy safety, and no-confirmation pattern
- Strengthened existing DETECTING RECIPES and DETECTING PREFERENCES bullets with proactive emphasis

## Task Commits

Each task was committed atomically:

1. **Task 1: Strengthen implicit recipe detection in system prompt** - `b23af3f` (feat)
2. **Task 2: Strengthen implicit preference capture in system prompt** - `e6c6f59` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Added IMPLICIT RECIPE DETECTION and IMPLICIT PREFERENCE CAPTURE subsections with behavioral instructions for Claude

## Decisions Made
- Recipes use confirmation-first implicit detection (offer to save, wait for approval) to avoid unwanted saves from casual food discussion
- Preferences use immediate-save implicit capture (no confirmation needed) because dietary restrictions and allergies are safety-critical
- One-time comments ("not feeling chicken tonight") explicitly excluded from preference capture to reduce noise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- System prompt now has clear implicit behavior instructions for both recipes and preferences
- Ready for Phase 21 Plan 02 (remaining implicit AI behavior work)
- No blockers or concerns

## Self-Check: PASSED

- FOUND: src/ai/system-prompt.ts
- FOUND: 21-01-SUMMARY.md
- FOUND: b23af3f (Task 1 commit)
- FOUND: e6c6f59 (Task 2 commit)

---
*Phase: 21-implicit-ai-behaviors*
*Completed: 2026-02-19*
