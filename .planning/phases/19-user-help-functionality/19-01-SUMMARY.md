---
phase: 19-user-help-functionality
plan: 01
subsystem: bot
tags: [grammy, help-command, system-prompt, mini-app, inline-keyboard]

# Dependency graph
requires:
  - phase: 18-app-feedback
    provides: bot handler factory pattern, system prompt structure, middleware chain
provides:
  - /help command handler with Mini App deep link
  - HELP_PROMPT system prompt block for confusion detection and help responses
affects: [user-experience, ai-behavior]

# Tech tracking
tech-stack:
  added: []
  patterns: [static-config-only handler (no DB deps), system prompt awareness block]

key-files:
  created:
    - src/bot/handlers/help.ts
  modified:
    - src/bot/index.ts
    - src/main.ts
    - src/ai/system-prompt.ts

key-decisions:
  - "Help handler has no DB dependencies -- uses only config.miniAppUrl for webApp button"
  - "HELP_PROMPT positioned after APP_FEEDBACK_PROMPT and before onboarding/appFeedback context injections"

patterns-established:
  - "Zero-dependency handler pattern: factory takes no args, reads config directly"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 19 Plan 01: Help Command and System Prompt Summary

**/help command handler with Mini App webApp button and HELP_PROMPT system prompt block for confusion detection and explicit help responses**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T21:47:01Z
- **Completed:** 2026-02-11T21:49:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created /help command handler following established factory pattern with InlineKeyboard webApp button
- Wired handler into bot middleware chain in correct position (after remindersHandler, before feedbackTextHandler)
- Added HELP_PROMPT system prompt block teaching Claude confusion detection and explicit help request handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /help command handler and wire into bot** - `a41eaa9` (feat)
2. **Task 2: Add HELP_PROMPT block to system prompt** - `fb560d7` (feat)

## Files Created/Modified
- `src/bot/handlers/help.ts` - /help command handler factory with InlineKeyboard webApp button
- `src/bot/index.ts` - Added helpHandler to CreateBotOptions interface and middleware chain
- `src/main.ts` - Import createHelpHandler, create instance, pass to createBot
- `src/ai/system-prompt.ts` - HELP_PROMPT constant with confusion detection and explicit help rules

## Decisions Made
- Help handler has no DB dependencies -- it only reads config.miniAppUrl for the webApp button, making it the simplest handler in the codebase
- HELP_PROMPT positioned after APP_FEEDBACK_PROMPT in the system prompt template, keeping it with the other static prompt blocks and before dynamic context injections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Help command and system prompt awareness complete
- Ready for any additional phase 19 plans or phase transition

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 19-user-help-functionality*
*Completed: 2026-02-11*
