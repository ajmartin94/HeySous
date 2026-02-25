---
phase: 32-prompt-quality-persona
plan: 02
subsystem: ai
tags: [prompt-caching, system-prompt, anthropic-api, performance]

requires: ["01"]
provides:
  - "buildStaticPrompt() -- stable instruction prefix for caching (~7,400 tokens)"
  - "buildDynamicContext() -- per-request context builder (preferences, plans, etc.)"
  - "DynamicContextParams interface -- typed options object for dynamic context"
  - "SystemPromptInput type -- string | { static, dynamic } for two-block system parameter"
  - "Two-block system parameter with cache_control on static block only"
affects: [input-validation, observability, resilience]

tech-stack:
  added: []
  patterns:
    - "Two-block system parameter: static (cached) + dynamic (fresh) blocks for Anthropic API prompt caching"
    - "Union type SystemPromptInput for backward-compatible API evolution"

key-files:
  created: []
  modified:
    - src/ai/system-prompt.ts
    - src/ai/claude-client.ts
    - src/pipeline/processor.ts

key-decisions:
  - "Static prompt contains all instruction constants; dynamic contains all per-request context (preferences, plans, grocery, reminders, feedback, date, user name, onboarding, app feedback)"
  - "buildSystemPrompt() preserved as backward-compatible wrapper calling buildStaticPrompt + buildDynamicContext"
  - "SystemPromptInput union type allows both old (string) and new (object) callers without breaking changes"
  - "buildSystemBlocks() helper centralizes system block construction logic in claude-client.ts"
  - "TOOLS_PROMPT and RECIPE_MANAGEMENT_PROMPT extracted as named constants from inline template literal for reuse in buildStaticPrompt"
  - "miniAppUrl is config-stable (not per-request) so it goes in the static prompt via parameter"

patterns-established:
  - "Two-block caching pattern: all callers can pass { static, dynamic } to get Anthropic API prompt caching"

requirements-completed: [PERF-02]

duration: 8min
completed: 2026-02-21
---

# Plan 32-02: Prompt Caching Restructure Summary

**Separated static instructions from dynamic context for Anthropic API prompt caching, reducing system prompt cost by ~82% on cache-hit requests**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created buildStaticPrompt() function returning all stable instruction content (~7,400 tokens)
- Created DynamicContextParams interface and buildDynamicContext() for per-request content
- Preserved buildSystemPrompt() as backward-compatible wrapper
- Extracted TOOLS_PROMPT and RECIPE_MANAGEMENT_PROMPT as named constants
- Added SystemPromptInput union type (string | { static, dynamic }) to Claude client
- Added buildSystemBlocks() helper to construct one or two system blocks based on input type
- Updated processor to pass static and dynamic prompt separately as two-block system parameter
- Static block gets cache_control: { type: "ephemeral" }; dynamic block does not

## Task Commits

1. **Task 1: Split system prompt into static and dynamic builders** - `3a9f77e` (feat)
2. **Task 2: Update Claude client and processor for two-block caching** - `b68b1c7` (feat)

## Files Created/Modified
- `src/ai/system-prompt.ts` - Added buildStaticPrompt(), DynamicContextParams, buildDynamicContext(), extracted TOOLS_PROMPT and RECIPE_MANAGEMENT_PROMPT constants
- `src/ai/claude-client.ts` - Added SystemPromptInput type, buildSystemBlocks() helper, updated sendMessage and sendMessageWithTools signatures
- `src/pipeline/processor.ts` - Imports buildStaticPrompt + buildDynamicContext, passes { static, dynamic } to Claude client

## Decisions Made
- The static prompt contains SOUS_PERSONA + all instruction sections (tools, recipe_management, preference_management, meal_planning, grocery_list, reminder, feedback, recipe_variations, app_feedback, help, pantry_response). These are identical for every request in a deployment.
- The dynamic context contains userName, dateContext, preferenceContext, planContext, groceryContext, reminderContext, feedbackContext, onboardingContext, appFeedbackContext. These change per request.
- miniAppUrl comes from config and is stable per deployment, so buildPantryResponsePrompt(miniAppUrl) goes in the static prompt.
- buildSystemBlocks() in claude-client.ts handles the SystemPromptInput union: string -> single cached block, object -> static cached + dynamic uncached.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Static/dynamic prompt split is in place for Phase 33+ to build on
- Input validation (Phase 33) can protect the static prompt structure
- Observability (Phase 34) can log cache hit/miss rates from token usage

---
*Phase: 32-prompt-quality-persona*
*Completed: 2026-02-21*
