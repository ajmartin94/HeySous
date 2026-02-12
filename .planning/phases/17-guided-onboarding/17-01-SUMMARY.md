---
phase: 17-guided-onboarding
plan: 01
subsystem: onboarding
tags: [state-machine, system-prompt, sqlite-migration, onboarding]

# Dependency graph
requires:
  - phase: 15-multi-user-foundation
    provides: users table with onboarding_state column, household/user repository
  - phase: 16-household-data-migration
    provides: householdId-based data layer
provides:
  - OnboardingState type and state machine (state.ts)
  - Onboarding system prompt builder (prompt.ts)
  - updateOnboardingState repository function
  - CHECK constraint migration for expanded enum
affects: [17-02 (handler/pipeline integration)]

# Tech tracking
tech-stack:
  added: []
  patterns: [hidden-marker state transitions, system-prompt augmentation for onboarding, SQLite table rebuild migration]

key-files:
  created:
    - src/onboarding/state.ts
    - src/onboarding/prompt.ts
  modified:
    - src/users/types.ts
    - src/users/init.ts
    - src/users/repository.ts
    - src/users/schema.ts

key-decisions:
  - "OnboardingState is 5-value enum (preferences, tour, recipes, tour_only, complete) -- transient states like registered/new_household/joining_household dropped"
  - "Default onboarding_state changed from 'registered' to 'complete' as safety fallback"
  - "Migration maps old 'registered' users to 'complete' via SQLite table rebuild"

patterns-established:
  - "Hidden marker pattern: Claude includes __ONBOARDING_PHASE_COMPLETE:phase__ in response, pipeline strips before delivery"
  - "System prompt augmentation: onboarding injects <onboarding> XML section into system prompt per state"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 17 Plan 01: Onboarding Module and Data Layer Summary

**Onboarding state machine with 5-state enum, hidden-marker extraction, per-state system prompt builder, and SQLite CHECK constraint migration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T18:49:12Z
- **Completed:** 2026-02-11T18:53:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `src/onboarding/state.ts` with OnboardingState type, ONBOARDING_STATES validation array, getNextOnboardingState transition function (handles full flow, abbreviated flow, and skip-from-any-state), and extractOnboardingMarker for stripping hidden markers from Claude responses
- Created `src/onboarding/prompt.ts` with buildOnboardingPrompt returning state-specific `<onboarding>` XML sections with natural conversation instructions, skip handling, and shared rules
- Expanded User.onboardingState from (registered, complete) to (preferences, tour, recipes, tour_only, complete) across types, Drizzle schema, and raw SQL DDL
- Added SQLite table rebuild migration in init.ts that detects old CHECK constraint and rebuilds atomically
- Added updateOnboardingState repository function that updates both state and updated_at timestamp

## Task Commits

Each task was committed atomically:

1. **Task 1: Create onboarding module (state machine and prompt builder)** - `6392f54` (feat)
2. **Task 2: Expand users data layer for onboarding states** - `a5bb223` (feat)

## Files Created/Modified
- `src/onboarding/state.ts` - OnboardingState type, state transitions, marker extraction
- `src/onboarding/prompt.ts` - System prompt sections per onboarding state
- `src/users/types.ts` - Expanded onboardingState union type
- `src/users/init.ts` - CHECK constraint migration for expanded enum
- `src/users/repository.ts` - updateOnboardingState function
- `src/users/schema.ts` - Drizzle schema enum expansion

## Decisions Made
- OnboardingState uses 5 persisted values only; transient states (registered, new_household, joining_household) dropped from research recommendations in favor of simpler design -- the start handler will set the initial state directly
- Default onboarding_state changed from 'registered' to 'complete' since the start handler sets state explicitly and the default is only a safety fallback
- Migration uses SQLite table rebuild pattern (CREATE new -> INSERT SELECT -> DROP old -> RENAME) since SQLite cannot ALTER CHECK constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated Drizzle schema.ts to match new enum**
- **Found during:** Task 2 (Expand users data layer)
- **Issue:** Plan did not mention updating src/users/schema.ts, but its onboarding_state enum still had ("registered", "complete") which would cause type confusion
- **Fix:** Updated Drizzle schema enum to match the new values and changed default from 'registered' to 'complete'
- **Files modified:** src/users/schema.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** a5bb223 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for consistency. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Onboarding module ready for Plan 02 to wire into start handler and pipeline processor
- All types, state transitions, prompt content, and repository functions in place
- TypeScript compiles cleanly with zero errors

## Self-Check: PASSED

All 6 key files verified on disk. Both task commits (6392f54, a5bb223) verified in git log.

---
*Phase: 17-guided-onboarding*
*Completed: 2026-02-11*
