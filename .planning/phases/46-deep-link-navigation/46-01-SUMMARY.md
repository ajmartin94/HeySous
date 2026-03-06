---
phase: 46-deep-link-navigation
plan: 01
subsystem: navigation
tags: [deep-links, inline-keyboard, grammy, react-router, mini-app]

# Dependency graph
requires:
  - phase: 44-mini-app-meal-plan-view
    provides: "Mini App pages and useRecipes hook"
provides:
  - "Deep-link builder module (buildDeepLinkKeyboard, buildDeepLinksFromToolCalls)"
  - "attach_deep_link Claude tool for on-demand navigation buttons"
  - "Mini App ?id query param handling for recipe deep-links"
affects: [46-02-PLAN, pipeline-processor, reminders]

# Tech tracking
tech-stack:
  added: []
  patterns: [deep-link-builder, webApp-inline-keyboard, tool-marker-json]

key-files:
  created:
    - src/deep-links/builder.ts
  modified:
    - src/ai/tools.ts
    - src/ai/tool-handler.ts
    - src/ai/system-prompt.ts
    - src/pipeline/processor.ts
    - mini-app/src/pages/Recipes.tsx
    - mini-app/src/hooks/useRecipes.ts

key-decisions:
  - "Deep-link builder returns null when miniAppUrl not configured, graceful no-op"
  - "attach_deep_link returns marker JSON for processor to pick up, not direct button sending"
  - "Button density: single recipe -> specific link, multiple recipes -> generic /recipes"
  - "System prompt deep_links section only injected when miniAppUrl is configured"

patterns-established:
  - "DeepLinkTarget union type for type-safe Mini App navigation targets"
  - "Tool marker JSON pattern: tool returns { deep_link: true, target, recipe_id } for processor consumption"

requirements-completed: [NAV-01, NAV-03]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 46 Plan 01: Deep-Link Builder and Tool Summary

**Deep-link builder module with InlineKeyboard construction, attach_deep_link Claude tool for on-demand navigation, and Mini App ?id recipe deep-link handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T13:40:32Z
- **Completed:** 2026-03-04T13:44:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created deep-link builder module with buildDeepLinkKeyboard (targets to InlineKeyboard) and buildDeepLinksFromToolCalls (auto-detect navigation from tool usage)
- Registered attach_deep_link Claude tool for on-demand navigation when no data-changing tool fires
- Updated system prompt to remove plain grocery URL instruction, added deep_links section for button-based navigation
- Mini App Recipes page reads ?id query param and auto-opens recipe detail view

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deep-link builder module and on-demand tool** - `9addab3` (feat)
2. **Task 2: Mini App recipe deep-link handling** - `566300a` (feat)

## Files Created/Modified
- `src/deep-links/builder.ts` - Deep-link builder with buildDeepLinkKeyboard and buildDeepLinksFromToolCalls
- `src/ai/tools.ts` - Added DEEP_LINK_TOOLS with attach_deep_link tool definition
- `src/ai/tool-handler.ts` - Added attach_deep_link handler returning marker JSON
- `src/ai/system-prompt.ts` - Removed plain grocery URL instruction, added deep_links prompt section
- `src/pipeline/processor.ts` - Wired DEEP_LINK_TOOLS into allTools array
- `mini-app/src/hooks/useRecipes.ts` - Added initialRecipeId parameter and auto-open effect
- `mini-app/src/pages/Recipes.tsx` - Read ?id search param and pass to useRecipes hook

## Decisions Made
- Deep-link builder returns null when miniAppUrl is not configured -- graceful no-op for dev environments without Mini App
- attach_deep_link tool returns a marker JSON ({ deep_link: true, target, recipe_id }) rather than directly sending buttons -- the processor will interpret this marker to attach the InlineKeyboard (Plan 02 handles this)
- Button density rules: single recipe tool call produces a specific recipe link, multiple recipe tool calls collapse to a generic /recipes link, plan and grocery always get one button each
- System prompt deep_links section is only injected when miniAppUrl is configured, keeping the prompt lean for dev

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deep-link builder and tool are ready for Plan 02 to implement automatic post-response button injection in the processor
- The processor will need to collect tool call records, run buildDeepLinksFromToolCalls, and attach the resulting keyboard to outgoing messages
- Reminder sender can also use buildDeepLinkKeyboard to attach plan buttons to reminder messages

---
*Phase: 46-deep-link-navigation*
*Completed: 2026-03-04*
