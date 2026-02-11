---
phase: 18-app-feedback
plan: 01
subsystem: feedback
tags: [sqlite, grammy, anthropic, system-prompt, tool-use]

# Dependency graph
requires:
  - phase: 16-household-migration
    provides: householdId-based message counting and pipeline processor deps pattern
  - phase: 17-guided-onboarding
    provides: onboardingContext pattern in buildSystemPrompt and processor
provides:
  - app_feedback SQLite table for all feedback channels
  - app_feedback_prompt_tracking table for proactive prompt cadence
  - /feedback bot command handler
  - save_app_feedback Claude tool for implicit detection
  - Proactive prompt injection system (request_feedback tag)
  - APP_FEEDBACK_PROMPT system prompt block
affects: [18-02-mini-app-feedback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proactive prompt injection via message count threshold and system prompt tag"
    - "Silent AI tool (save_app_feedback) that never acknowledges to user"

key-files:
  created:
    - src/app-feedback/types.ts
    - src/app-feedback/init.ts
    - src/app-feedback/repository.ts
    - src/bot/handlers/app-feedback.ts
  modified:
    - src/db/index.ts
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
    - src/pipeline/processor.ts
    - src/bot/index.ts
    - src/main.ts

key-decisions:
  - "Proactive feedback threshold set to 50 inbound messages (~2 weeks moderate use)"
  - "Implicit detection uses householdId as userId since detection happens at conversation level"
  - "APP_FEEDBACK_PROMPT placed after FEEDBACK_PROMPT to keep meal feedback separate from app feedback"

patterns-established:
  - "Silent tool pattern: tool returns { saved: true } but prompt instructs Claude to never acknowledge"
  - "Proactive prompt injection: counter-based tag injection into system prompt with immediate reset"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 18 Plan 01: App Feedback Data Layer and Bot Integration Summary

**App feedback collection via /feedback command, Claude save_app_feedback silent tool, and proactive prompt injection after 50 inbound messages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T20:51:16Z
- **Completed:** 2026-02-11T20:55:47Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created app-feedback module with types, table initialization, and repository (saveFeedback, getMessageCountSinceLastPrompt, recordProactivePromptShown)
- Built /feedback command handler that saves to app_feedback table with source "command" and replies "Thanks for the feedback!"
- Added save_app_feedback Claude tool for implicit sentiment detection with explicit "never acknowledge" instructions
- Implemented proactive prompt injection system that inserts request_feedback tag after 50 inbound messages and resets counter
- Full wiring through main.ts, processor.ts, bot/index.ts with correct middleware ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: App feedback module and /feedback command handler** - `628a548` (feat)
2. **Task 2: Claude AI integration, proactive prompting, and full wiring** - `34512fa` (feat)

## Files Created/Modified
- `src/app-feedback/types.ts` - AppFeedbackSource, AppFeedback, SaveFeedbackParams types
- `src/app-feedback/init.ts` - app_feedback and app_feedback_prompt_tracking table creation
- `src/app-feedback/repository.ts` - saveFeedback, getMessageCountSinceLastPrompt, recordProactivePromptShown
- `src/bot/handlers/app-feedback.ts` - /feedback command handler with factory pattern
- `src/db/index.ts` - Added initializeAppFeedback call
- `src/ai/tools.ts` - APP_FEEDBACK_TOOLS with save_app_feedback tool definition
- `src/ai/tool-handler.ts` - save_app_feedback case with implicit source
- `src/ai/system-prompt.ts` - APP_FEEDBACK_PROMPT and appFeedbackContext parameter
- `src/pipeline/processor.ts` - Proactive prompt logic (threshold 50), appFeedbackRepository wiring
- `src/bot/index.ts` - appFeedbackHandler in middleware chain (position 14)
- `src/main.ts` - appFeedbackRepository and appFeedbackHandler creation and wiring

## Decisions Made
- Proactive feedback threshold set to 50 inbound messages (approximates ~2 weeks of moderate use per research)
- Implicit detection uses householdId as userId since it happens at conversation level, not per-user
- APP_FEEDBACK_PROMPT positioned after FEEDBACK_PROMPT to keep meal feedback and app feedback instructions separate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- App feedback data layer complete, ready for Plan 02 (Mini App feedback channel)
- app_feedback table supports all four source channels (command, implicit, mini-app, proactive)
- Repository pattern ready for Mini App API integration

## Self-Check: PASSED

---
*Phase: 18-app-feedback*
*Completed: 2026-02-11*
