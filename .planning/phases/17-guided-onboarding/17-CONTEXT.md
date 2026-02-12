# Phase 17: Guided Onboarding - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

New users are guided through a conversational first-run experience that captures household preferences, demonstrates capabilities, and seeds initial recipes. Users joining an existing household get an abbreviated flow. Users can skip at any point. Onboarding state survives bot restarts.

</domain>

<decisions>
## Implementation Decisions

### Conversation style
- Natural chat — feels like texting a friend, not a wizard or form
- No visual distinction from normal bot messages (no step indicators, no emoji headers)
- Off-topic messages during onboarding: roll with it naturally, answer the request, then gently steer back
- "Skip" triggers a quick summary of capabilities before dropping into normal mode, not an instant exit

### Preference gathering
- Ask about dietary restrictions AND taste preferences (allergies, likes/dislikes, cooking comfort)
- Also ask dinner time, preferred stores, and cooking comfort level — all in one conversational flow
- Freeform text input — user describes naturally, Claude extracts structured data
- All preferences stored at the household level (not per-user)

### Capability tour
- Quick single message listing key capabilities
- Must mention both chat interaction with Sous and the mini-app for quick reference
- Tour happens BEFORE recipe seeding — user understands context before teaching recipes

### Recipe seeding
- Open-ended prompt: "Tell me about meals you make regularly" — user describes freely, Claude extracts
- No minimum recipe count — just encouragement, no gate
- User can teach 0 recipes and move on without friction

### Household join experience
- Minimal welcome message only — no stats, no household details
- No preference questions — preferences are household-level and already set
- Capability tour only — skip recipe seeding since household already has recipes
- No join notification sent (no household admin concept)

### Claude's Discretion
- Exact wording of onboarding messages
- How to extract structured preferences from freeform text
- How to handle edge cases (user teaches 0 recipes, gives contradictory preferences)
- Progressive learning strategy after initial setup

</decisions>

<specifics>
## Specific Ideas

- Capability tour message should specifically mention chatting with Sous for meal planning help AND using the mini-app for quick reference (grocery lists, recipes, meal plans)
- The overall tone should feel like the bot is getting to know you, not onboarding you

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-guided-onboarding*
*Context gathered: 2026-02-11*
