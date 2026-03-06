---
phase: 43-agent-tools-meal-time-config
plan: 02
subsystem: ai
tags: [system-prompt, onboarding, meal-types, claude-instructions]

# Dependency graph
requires:
  - phase: 43-agent-tools-meal-time-config
    plan: 01
    provides: Meal time columns in reminder_settings, update_reminder_settings tool params, buildReminderContext with meal times
provides:
  - System prompt MEAL TYPE AWARENESS section with 6 meal types and inference rules
  - Updated PLAN DISPLAY FORMAT for single and multi-meal-type plans
  - MEAL TIME SYNC in both reminder and preference prompt sections
  - Onboarding collects breakfast, lunch, and dinner times
  - Tour messages reflect all-day meal planning capability
affects: [44-mini-app-meal-type-ui, 45-reminders, onboarding-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [Multi-meal-type inference from context (time of day + food type)]

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts
    - src/onboarding/prompt.ts

key-decisions:
  - "Claude infers meal type from context (time + food) rather than always asking the user"
  - "Backward-compatible default to dinner when meal type is genuinely ambiguous"
  - "Onboarding asks breakfast/lunch/dinner times casually; snack and dessert use defaults silently"

patterns-established:
  - "Meal type inference: time-of-day from reminder_context + food-type heuristics, default to dinner"
  - "No proactive non-dinner suggestions: Claude waits for user to ask about other meal types"

requirements-completed: [PLAN-03, PLAN-07]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 43 Plan 02: System Prompt & Onboarding Summary

**Multi-meal awareness in system prompt with 6 meal types, context-based inference, and onboarding meal time collection for breakfast/lunch/dinner**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T02:00:36Z
- **Completed:** 2026-03-04T02:05:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added MEAL TYPE AWARENESS section listing all 6 meal types with inference rules (time of day + food type)
- Updated PLAN DISPLAY FORMAT for both single-meal and multi-meal plan layouts
- Renamed DINNER TIME SYNC to MEAL TIME SYNC in both reminder and preference management prompts
- Updated onboarding to ask about breakfast, lunch, and dinner times casually
- Updated tour messages to mention all-day meal planning (not just dinners)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update system prompt for multi-meal awareness** - `c69f398` (feat)
2. **Task 2: Update onboarding to collect meal time preferences** - `8b6e0da` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Added MEAL TYPE AWARENESS section, updated PLAN DISPLAY FORMAT, MEAL TIME SYNC in reminder and preference prompts, meal time examples in UPDATING SETTINGS
- `src/onboarding/prompt.ts` - Updated preferences phase to ask about 3 meal times, added MEAL TIMES guidance, updated tour messages for all-day meals

## Decisions Made
- Claude infers meal type from context (time of day via reminder_context + food type heuristics) rather than always asking the user
- Backward-compatible default to dinner when meal type is genuinely ambiguous
- Onboarding asks about breakfast, lunch, and dinner times casually in a single bundled question; snack and dessert times use defaults silently
- No proactive non-dinner suggestions -- Claude waits for the user to initiate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- System prompt fully teaches Claude about multi-meal-type planning and inference
- Onboarding collects the three primary meal times for new users
- Ready for Phase 44+ (Mini App UI for meal type selection, reminder enhancements)
- Pre-existing test failures in `tests/notifications/update-notifier.test.ts` (3 tests) are unrelated to this work -- they concern release notes content matching

---
*Phase: 43-agent-tools-meal-time-config*
*Completed: 2026-03-04*
