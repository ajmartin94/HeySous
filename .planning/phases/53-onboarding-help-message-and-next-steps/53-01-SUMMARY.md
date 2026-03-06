---
phase: 53-onboarding-help-message-and-next-steps
plan: 01
subsystem: onboarding
tags: [onboarding, state-machine, help-message]
dependency_graph:
  requires: []
  provides: [simplified-onboarding-state-machine, help-next-steps-tour-prompt]
  affects: [src/onboarding/state.ts, src/onboarding/prompt.ts, src/users/types.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, emphatic-marker-instruction]
key_files:
  created:
    - tests/onboarding/state.test.ts
  modified:
    - src/onboarding/state.ts
    - src/onboarding/prompt.ts
    - src/users/types.ts
decisions:
  - "Removed 'recipes' from TypeScript types but kept in SQLite CHECK constraint for backward compat with existing DB rows"
  - "Updated User/CreateUserParams types (Rule 3 - blocking type errors in processor.ts)"
metrics:
  duration: 4min
  completed: "2026-03-06"
requirements_completed: [ONBOARD-HELP]
---

# Phase 53 Plan 01: Onboarding Help Message & Next Steps Summary

Removed "recipes" onboarding state, simplified state machine to 4 states (preferences/tour/tour_only/complete), and rewrote tour prompts as actionable help/next-steps messages with /help command mention, Mini App mention, and try-it-now suggestions.

## Tasks Completed

### Task 1: Remove recipes state and fix tour->complete transition (TDD)

| Step | Commit | Description |
|------|--------|-------------|
| RED | 1848005 | Failing tests for state machine transitions |
| GREEN | 9e986d4 | Remove recipes state, fix tour->complete transition |

- Removed "recipes" from OnboardingState type union and ONBOARDING_STATES array
- Changed tour completion to always return "complete" (was "recipes" for full-flow users)
- Removed case "recipes" from getNextOnboardingState
- Updated User/CreateUserParams types to exclude "recipes" (Rule 3 auto-fix for blocking type errors)
- 12 tests covering all transitions and marker extraction

### Task 2: Rewrite tour prompt as help/next-steps message

| Commit | Description |
|--------|-------------|
| 262cfb3 | Rewrite tour prompt, delete recipes prompt |

- Deleted buildRecipesPrompt() function entirely
- Removed case "recipes" from buildOnboardingPrompt switch
- Rewrote buildTourPrompt with: capability overview, /help command, Mini App menu button, 2-3 actionable suggestions
- Rewrote buildTourOnlyPrompt with same help content (context note for household joiners)
- Emphatic marker instruction: "You MUST end your message with..."
- Updated preferences prompt transition text to "wrap up and let them know you're ready"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated User/CreateUserParams types in src/users/types.ts**
- **Found during:** Task 1
- **Issue:** Removing "recipes" from OnboardingState caused type errors in processor.ts where user.onboardingState was passed to functions expecting OnboardingState
- **Fix:** Removed "recipes" from the type unions in User and CreateUserParams interfaces
- **Files modified:** src/users/types.ts
- **Commit:** 9e986d4

## Verification

- typecheck: PASSED (0 errors)
- tests: All onboarding tests pass (23/23)
- grep buildRecipesPrompt: no matches in src/
- grep recipes in state.ts: only in JSDoc comment (documents backward-compat marker handling)
