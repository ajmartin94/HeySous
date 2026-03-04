---
phase: 46-deep-link-navigation
plan: 02
subsystem: navigation
tags: [deep-links, inline-keyboard, pipeline, reminders, grammy]

# Dependency graph
requires:
  - phase: 46-deep-link-navigation
    plan: 01
    provides: "Deep-link builder module (buildDeepLinkKeyboard, buildDeepLinksFromToolCalls)"
provides:
  - "Automatic post-response deep-link buttons after Claude tool calls"
  - "Recipe deep-link buttons on cooking and prep reminders"
affects: [pipeline-processor, reminders, user-experience]

# Tech tracking
tech-stack:
  added: []
  patterns: [tool-call-tracking, post-response-button-injection, reminder-reply-markup]

key-files:
  created: []
  modified:
    - src/pipeline/processor.ts
    - src/reminders/sender.ts

key-decisions:
  - "Used 'Open in app:' text for button follow-up message since Telegram requires non-empty text with inline keyboards"
  - "Explicit attach_deep_link targets take priority over auto-detected targets during deduplication"
  - "Only single-recipe reminders (start_cooking, prep_alert) get deep-link buttons; morning_summary skipped due to multi-recipe complexity"

patterns-established:
  - "Tool call tracking wrapper: trackingHandler wraps instrumentedHandler to collect call records for post-processing"
  - "Post-response button injection: separate message after finalization, wrapped in try/catch for NEVER THROW contract"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 46 Plan 02: Pipeline Buttons and Reminder Deep-Links Summary

**Automatic Mini App navigation buttons after Claude tool calls in pipeline processor, plus recipe deep-link buttons on cooking/prep reminders**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T13:47:16Z
- **Completed:** 2026-03-04T13:49:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Pipeline processor now tracks all tool calls and sends InlineKeyboard buttons as a follow-up message after response finalization
- Both explicit (attach_deep_link) and automatic (save_meal_plan, save_grocery_list, save_knowledge) tool calls produce navigation buttons
- Reminder sender attaches "View Recipe" buttons to start_cooking and prep_alert reminders when knowledgeItemId is available
- All deep-link logic is wrapped in try/catch to maintain the processor's NEVER THROW contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Post-response button injection in pipeline processor** - `da731e4` (feat)
2. **Task 2: Reminder deep-link buttons** - `577d482` (feat)

## Files Created/Modified
- `src/pipeline/processor.ts` - Added tool call tracking, deep-link builder imports, post-response button injection after l2 grocery edit section
- `src/reminders/sender.ts` - Added buildDeepLinkKeyboard import, reply_markup to BotApi interface, recipe keyboard for knowledgeItemId-linked reminders

## Decisions Made
- Used "Open in app:" as the follow-up message text for deep-link buttons -- Telegram requires non-empty text with inline keyboards, and zero-width space felt too hacky
- Explicit attach_deep_link targets take deduplication priority over auto-detected targets -- prevents duplicate buttons when Claude both uses a data tool and explicitly requests a link
- Morning summary reminders do not get deep-link buttons despite containing recipe references -- the multi-recipe array would need multiple buttons per meal, adding complexity beyond the current scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `tests/notifications/update-notifier.test.ts` (3 tests) -- unrelated to this plan's changes, same failures exist on base branch

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All NAV requirements (NAV-01 through NAV-04) are now complete
- Deep-link navigation is fully wired: builder module -> pipeline processor -> reminder sender
- Phase 46 is complete and ready for phase 47

---
*Phase: 46-deep-link-navigation*
*Completed: 2026-03-04*
