# Phase 53: Onboarding Help Message & Next Steps - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure onboarding flow: drop the recipes phase, and end with a help-style message that explains what Sous can do and offers 2-3 actionable next steps. Also fix the bug where the tour step is being skipped.

</domain>

<decisions>
## Implementation Decisions

### Onboarding flow change
- Remove the "recipes" phase from the state machine entirely
- New flow: preferences -> tour -> complete (3 states, not 4)
- The `recipes` state and `buildRecipesPrompt()` can be deleted
- `getNextOnboardingState("tour", "tour")` should return "complete" directly

### Tour/help message content
- End with 2-3 actionable suggestions the user can try right now:
  - "Plan my dinners this week"
  - "Save this recipe: [link]"
  - "What should I make tonight?"
- Must mention /help command is available
- Must mention the Mini App and how to open it (menu button)
- Tone: "Just text me like you're texting a friend"
- NOT a manual — brief, enthusiastic, actionable

### Tour reliability
- Prod data shows Mike's state stuck at "recipes" — the tour marker was either never emitted or not processed
- Investigate: is the `__ONBOARDING_PHASE_COMPLETE:tour__` marker being reliably extracted?
- The tour prompt says "After sending the tour, include the marker" — Claude may not be doing this consistently
- Consider making the marker emission more robust (or auto-advancing after tour message)

### Claude's Discretion
- Exact wording of the help/tour message
- Whether to restructure prompt to make marker emission more reliable
- How to handle the `tour_only` state (existing household members) — same simplification applies

</decisions>

<specifics>
## Specific Ideas

- User's real-world experience: Mike went through preferences (loved it), then was pushed into planning without a tour
- The tour message should feel like a friend saying "here's what I can do" not a product walkthrough
- Explicitly point out /help and the Mini App menu button — users don't discover these on their own

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/onboarding/state.ts` — state machine with getNextOnboardingState() and extractOnboardingMarker()
- `src/onboarding/prompt.ts` — buildTourPrompt(), buildRecipesPrompt(), buildTourOnlyPrompt()
- `src/users/repository.ts` — updateOnboardingState()

### Established Patterns
- Hidden marker pattern: `__ONBOARDING_PHASE_COMPLETE:phase__` extracted by processor
- State transitions: preferences->tour->recipes->complete
- `tour_only` state for users joining existing households (skips preferences and recipes)

### Integration Points
- `processor.ts` calls `extractOnboardingMarker()` on Claude's response text
- `processor.ts` calls `updateOnboardingState()` to advance the state machine
- ONBOARDING_STATES array used for runtime validation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-onboarding-help-message-and-next-steps*
*Context gathered: 2026-03-06*
