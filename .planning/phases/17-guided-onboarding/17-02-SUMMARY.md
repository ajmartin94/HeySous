---
phase: 17-guided-onboarding
plan: 02
subsystem: onboarding
tags: [start-handler, pipeline, system-prompt, access-gate, onboarding-integration]

# Dependency graph
requires:
  - phase: 17-01
    provides: OnboardingState type, state machine, prompt builder, updateOnboardingState repository function
  - phase: 15-multi-user-foundation
    provides: access gate with addToCache, start handler with invite flow, users/repository
  - phase: 16-household-data-migration
    provides: householdId-based pipeline processor, system prompt with userName
provides:
  - End-to-end onboarding flow for new users via invite
  - Start handler assigns onboarding state based on household membership
  - Pipeline injects onboarding prompts, extracts markers, advances state
  - System prompt accepts onboarding context as final priority section
  - Access gate cache refresh after onboarding state changes
affects: [18-app-feedback (normal bot behavior after onboarding)]

# Tech tracking
tech-stack:
  added: []
  patterns: [onboarding-aware pipeline processing, marker extraction before message delivery, dual welcome path based on household membership]

key-files:
  created: []
  modified:
    - src/bot/handlers/start.ts
    - src/bot/middlewares/access-gate.ts
    - src/pipeline/processor.ts
    - src/ai/system-prompt.ts
    - src/main.ts

key-decisions:
  - "Start handler detects isJoiningExisting via getHouseholdMembers check before user creation"
  - "Welcome message saved to messages table so Claude has conversation context on next user message"
  - "refreshUserCache is semantic alias for addToCache, passed through main.ts to processor deps"
  - "Empty message after marker extraction handled gracefully (skip sending when Claude responds with only the marker)"

patterns-established:
  - "Pipeline marker extraction: extract markers before sendFormattedMessage and before saving to messages table"
  - "Dual welcome path: isJoiningExisting branches to warm vs minimal welcome with different onboarding states"

# Metrics
duration: 12min
completed: 2026-02-11
---

# Phase 17 Plan 02: Handler and Pipeline Integration Summary

**End-to-end onboarding wired into start handler (dual welcome path), pipeline processor (prompt injection + marker extraction + state advancement), and system prompt (onboarding context as final priority section)**

## Performance

- **Duration:** 12 min (including human verification)
- **Started:** 2026-02-11
- **Completed:** 2026-02-11
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- Start handler detects household membership and assigns "preferences" (independent invite) or "tour_only" (household join) onboarding state, with dual welcome messages
- Pipeline processor injects onboarding-specific system prompt when state != "complete", extracts hidden markers from Claude responses, advances state, refreshes access gate cache, and delivers clean text
- System prompt appends onboarding context at the very end for highest attention priority
- Welcome message saved to messages table so Claude has conversation history on the user's next message
- Human-verified end-to-end: independent invite onboarding, household join abbreviated flow, state transitions, skip functionality, persistence across restarts

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire onboarding into start handler, access gate, pipeline, and system prompt** - `79ffa28` (feat)
2. **Task 2: Verify onboarding flow end-to-end** - Human verification checkpoint (APPROVED)

Additional commits during verification:
- `d56bb2f` - fix(17-02): handle empty message after onboarding marker extraction
- `2c083b4` - docs: capture todo for start_cooking reminder prep time (pre-existing, not phase 17)

## Files Created/Modified
- `src/bot/handlers/start.ts` - Household membership detection, dual welcome messages, onboarding state assignment, welcome message persistence
- `src/bot/middlewares/access-gate.ts` - Added refreshUserCache function (semantic alias for addToCache)
- `src/pipeline/processor.ts` - Onboarding prompt injection, marker extraction, state advancement, cache refresh, clean text delivery
- `src/ai/system-prompt.ts` - Added onboardingContext parameter appended at end of system prompt
- `src/main.ts` - Wired refreshUserCache from access gate to processor deps

## Decisions Made
- Start handler uses getHouseholdMembers to detect isJoiningExisting before user creation, determining both welcome message and initial onboarding state
- Welcome message saved to messages table with direction "out" so Claude has conversation context when the user sends their first reply
- refreshUserCache is a semantic alias for addToCache (same implementation) to make the call site in processor.ts clearer
- Empty message after marker extraction is handled by skipping the send -- Claude sometimes responds with only the __ONBOARDING_PHASE_COMPLETE marker and no user-facing text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Handle empty message after onboarding marker extraction**
- **Found during:** Task 2 (human verification / UAT)
- **Issue:** When Claude responds with only the __ONBOARDING_PHASE_COMPLETE marker and no accompanying text, marker extraction produces an empty string. Sending an empty message to the user caused errors.
- **Fix:** Added a guard to skip sending and skip saving to messages table when cleanText is empty after marker extraction
- **Files modified:** src/pipeline/processor.ts
- **Verification:** Bot no longer errors when Claude sends marker-only responses; state still advances correctly
- **Committed in:** `d56bb2f`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 17 (Guided Onboarding) is fully complete -- both plans executed and verified
- Onboarding flow is live: new users get Claude-driven conversational setup, household joiners get abbreviated tour
- Ready for Phase 18 (App Feedback) which depends on Phase 15 (user identity), not Phase 17
- Pre-existing todo captured: start_cooking reminder should account for prep time (not blocking)

## Self-Check: PASSED

All 5 modified files verified on disk. All 3 commits (79ffa28, d56bb2f, 2c083b4) verified in git log.

---
*Phase: 17-guided-onboarding*
*Completed: 2026-02-11*
