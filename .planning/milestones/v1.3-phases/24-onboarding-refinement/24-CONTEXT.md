# Phase 24: Onboarding Refinement - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Refine the existing onboarding flow so new users are encouraged to share their regular go-to meals early, ensuring their first meal plan draws from real recipes they already cook. The onboarding state machine (`preferences -> tour -> recipes -> complete`) already exists -- this phase modifies the `recipes` prompt to be more directive and specific.

</domain>

<decisions>
## Implementation Decisions

### Recipe prompting approach
- The `recipes` state prompt should be rewritten to be more directive and specific
- Instead of generic "tell me about meals you make", use concrete prompts: "What did you cook last week?" or "What are your household's 3-5 regular rotation meals?"
- Frame it as building their personal recipe brain -- the more recipes they share, the better their first meal plan will be
- Still conversational, not a form -- but clearly state a target of 3-5 recipes
- After each recipe is saved, acknowledge it and ask "What else is in your regular rotation?" to encourage more
- The prompt should mention that these recipes will be used for their first meal plan

### Flow ordering
- Keep the existing flow order: `preferences -> tour -> recipes -> complete`
- The tour mentions meal planning, which motivates recipe sharing -- tour stays before recipes
- No state machine changes needed, only prompt content changes

### Minimum recipe threshold
- Soft target of 3-5 recipes, NOT a hard gate
- The prompt should mention "3-5 of your regular go-to meals" as a goal
- If user shares fewer than 3, gently encourage more: "Even one or two more would make your first meal plan better"
- If user insists on stopping at 0-2, respect that -- same as current behavior (do not gate progress on count)
- The key change is being more upfront about WHY sharing recipes matters (first meal plan quality)

### First meal plan connection
- After the recipes phase completes, the wrap-up message should offer to create their first meal plan
- Something like: "Now that I know your go-to meals, want me to put together a dinner plan for this week?"
- This bridges onboarding into first real usage naturally
- If user declines, complete onboarding normally -- don't force it

### Claude's Discretion
- Exact wording of the recipe prompting questions
- How to handle users who share very detailed vs very brief recipe descriptions
- Transition phrasing between tour and recipes states
- Whether to count recipes aloud ("That's 3 so far!") or keep it implicit

</decisions>

<specifics>
## Specific Ideas

- The prompt change is entirely in `src/onboarding/prompt.ts` in `buildRecipesPrompt()`
- Success criteria explicitly says: not "tell me some recipes" but "what did you cook last week?" or "what are your household's regular rotation meals?"
- Phase 21's implicit recipe detection means Claude already knows how to recognize and save recipes from natural conversation -- the onboarding prompt just needs to be more directive about asking for them
- The existing `SHARED_RULES` and `SKIP_HANDLING` sections remain unchanged

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 24-onboarding-refinement*
*Context gathered: 2026-02-19*
