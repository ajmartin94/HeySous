---
phase: 16-household-data-migration
plan: 02
subsystem: api
tags: [grammy, telegram, household, migration, fan-out, system-prompt]

# Dependency graph
requires:
  - phase: 16-household-data-migration
    provides: Drizzle schemas, types, repositories, context builders all use householdId
provides:
  - All handlers, pipeline, tool-handler use householdId for data operations
  - Reminder and feedback senders deliver to ALL household members via fan-out
  - System prompt includes user's first name naturally
  - Mini-app auth resolves householdId from user record
  - Application compiles with zero TypeScript errors
affects: [17-onboarding-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [fan-out delivery to household members, factory auth middleware with user lookup, two-ID model enforcement across all layers]

key-files:
  created: []
  modified:
    - src/bot/handlers/grocery.ts
    - src/bot/handlers/plan.ts
    - src/bot/handlers/reminders.ts
    - src/bot/handlers/preferences.ts
    - src/bot/handlers/debug.ts
    - src/bot/handlers/feedback.ts
    - src/pipeline/processor.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
    - src/reminders/sender.ts
    - src/reminders/generator.ts
    - src/reminders/poller.ts
    - src/feedback/sender.ts
    - src/feedback/generator.ts
    - src/feedback/handler.ts
    - src/mini-app/auth-middleware.ts
    - src/mini-app/router.ts
    - src/mini-app/routes/grocery.ts
    - src/mini-app/routes/meal-plan.ts
    - src/mini-app/routes/recipes.ts
    - src/mini-app/routes/summary.ts
    - src/main.ts

key-decisions:
  - "System prompt injects userName naturally in personality section, no household references"
  - "Fan-out senders iterate getHouseholdMembers and send to each member's telegramId"
  - "Mini-app auth middleware converted to factory (createInitDataValidator) taking sqlite param"
  - "Debug handler keeps chatId for Telegram context but uses householdId for all data queries"
  - "Message queue debounce key remains per-Telegram-chat (chatId) not per-household"

patterns-established:
  - "Two-ID model fully enforced: householdId for data, chatId for Telegram delivery"
  - "Fan-out pattern: resolve householdId -> getHouseholdMembers -> iterate sendMessage per member"
  - "Factory auth middleware pattern: createInitDataValidator(sqlite) returns Express middleware"

# Metrics
duration: 8min
completed: 2026-02-11
---

# Phase 16 Plan 02: Handler and Pipeline Layer Migration Summary

**Complete chatId-to-householdId migration across all handlers, pipeline processor, tool handler, senders (with household fan-out), generators, mini-app auth/routes, and system prompt with user name injection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-11T17:46:08Z
- **Completed:** 2026-02-11T17:54:39Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- All 7 bot handlers (grocery, plan, reminders, preferences, debug, feedback, costs) now use ctx.householdId for data operations
- Pipeline processor correctly splits householdId (data layer) from chatId (conversation/Telegram delivery)
- Tool handler passes householdId to every repository, retrieval, and changelog call
- Reminder and feedback senders deliver to ALL household members via getHouseholdMembers fan-out
- System prompt includes user's first name per locked decision (natural, no household references)
- Mini-app auth middleware resolves householdId from user record via getUserByTelegramId
- All 4 mini-app routes (grocery, meal-plan, recipes, summary) use householdId with updated SQL
- Application compiles with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Update handlers, pipeline, tool-handler, and main.ts** - `f59b06d` (feat)
2. **Task 2: Update senders, mini-app, system prompt, and generators** - `167c157` (feat)

## Files Created/Modified
- `src/bot/handlers/grocery.ts` - ctx.householdId for grocery repository calls
- `src/bot/handlers/plan.ts` - ctx.householdId + SQL uses household_id column
- `src/bot/handlers/reminders.ts` - ctx.householdId for reminder settings
- `src/bot/handlers/preferences.ts` - ctx.householdId for preference queries
- `src/bot/handlers/debug.ts` - householdId for data, chatId kept for display context
- `src/bot/handlers/feedback.ts` - householdId for feedback/knowledge repo calls
- `src/pipeline/processor.ts` - Split ID model: householdId for data, chatId for messages/Telegram
- `src/ai/tool-handler.ts` - householdId for all 20+ repository/retrieval/changelog calls
- `src/ai/system-prompt.ts` - userName parameter, natural name injection in personality section
- `src/reminders/sender.ts` - Fan-out delivery to all household members, sqlite dep added
- `src/reminders/generator.ts` - householdId parameter, all createReminder calls updated
- `src/reminders/poller.ts` - Log fields use reminder.householdId
- `src/feedback/sender.ts` - Fan-out delivery to all household members, sqlite dep added
- `src/feedback/generator.ts` - householdId parameter, all createReminder/createCheckin calls
- `src/feedback/handler.ts` - householdId for knowledge repo/changelog calls
- `src/mini-app/auth-middleware.ts` - Factory pattern, user lookup, householdId resolution
- `src/mini-app/router.ts` - Uses createInitDataValidator(sqlite) factory
- `src/mini-app/routes/grocery.ts` - res.locals.householdId for all repo calls
- `src/mini-app/routes/meal-plan.ts` - res.locals.householdId + SQL household_id
- `src/mini-app/routes/recipes.ts` - res.locals.householdId + SQL household_id in all queries
- `src/mini-app/routes/summary.ts` - res.locals.householdId + SQL household_id in all counts
- `src/main.ts` - regenerateReminders takes householdId, sender factories get sqlite

## Decisions Made
- System prompt injects userName in personality section only, no household references or "we" framing
- Fan-out pattern sends to all household members individually (graceful 403 handling per member)
- Mini-app auth converted from standalone function to factory that takes sqlite for user lookup
- Debug handler retains chatId for Telegram display context but uses householdId for data
- Message queue debounce key stays per-Telegram-chat (not per-household) for correct multi-user behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed poller reminder.chatId references**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** src/reminders/poller.ts referenced reminder.chatId which no longer exists on Reminder type
- **Fix:** Changed to reminder.householdId in all log fields
- **Files modified:** src/reminders/poller.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 167c157 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed feedback handler checkin.chatId and changelog chatId**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** src/feedback/handler.ts referenced checkin.chatId (renamed to householdId in Plan 01) and used chatId for changelog insert
- **Fix:** Changed to ctx.householdId/checkin.householdId and householdId for changelog
- **Files modified:** src/feedback/handler.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 167c157 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. The poller and feedback handler were not explicitly listed in the plan's file list but had references to the renamed chatId field. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full chatId-to-householdId migration complete across all application layers
- Application compiles cleanly with zero TypeScript errors
- Two-ID model enforced: householdId for all data ops, chatId only for Telegram delivery + message history
- Ready for Phase 17: Onboarding Flow

## Self-Check: PASSED

All 22 modified files verified on disk. Both commit hashes (f59b06d, 167c157) found in git log. Zero TypeScript errors confirmed.

---
*Phase: 16-household-data-migration*
*Completed: 2026-02-11*
