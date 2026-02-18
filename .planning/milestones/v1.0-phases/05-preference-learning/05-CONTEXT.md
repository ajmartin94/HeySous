# Phase 5: Preference Learning - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

System remembers user preferences across conversations and actively applies them as constraints. Users can state preferences (dietary, scheduling, cooking style, household info, equipment, budget — anything), and those preferences influence agent behavior going forward. Preferences are stored as free-text knowledge items using the existing knowledge system. Meal plan generation, grocery lists, and reminders are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Preference categories
- Open-ended — no rigid taxonomy of preference types
- Any kind of preference the user states gets stored: dietary, scheduling, cooking style, household members, equipment, budget, serving sizes, etc.
- Household-aware: users can state preferences about other household members ("my kid is allergic to peanuts", "my wife doesn't eat pork") and those apply when planning for the family
- Stored as free-text knowledge items (same as recipes) — Claude interprets meaning and severity from the wording each time

### Constraint behavior
- No explicit hard/soft distinction in storage — Claude interprets severity from context ("allergy" = hard constraint, "we prefer" = soft influence)
- Override behavior: warn and comply — if user explicitly asks for something that conflicts with a stored preference, flag it ("Just a heads up — you mentioned a shellfish allergy. Want me to go ahead anyway?") then proceed if confirmed
- Preferences retrieved contextually by relevance (like other knowledge), not all loaded every time — meal planning pulls schedule prefs, recipe requests pull dietary prefs
- When preferences conflict with each other ("we love rich food" + "low-calorie meals"), Claude flags the tension and asks which to prioritize

### Capture & confirmation
- Both explicit and inferred capture — "remember I don't eat pork" (explicit) and patterns like repeated quick-meal requests on Tuesdays (inferred)
- Acknowledge, don't ask — bot says "Noted — I'll remember no shellfish" without waiting for confirmation; user can correct if wrong
- Uses existing knowledge write tools (save_knowledge / update_knowledge) with preference-appropriate tagging
- Brief acknowledgment then continue conversation seamlessly — "Noted: no cilantro. Now for that Thai recipe..."

### Preference visibility
- Conversational queries work naturally — "what are my preferences?" / "what do you know about me?"
- Dedicated /preferences command for quick formatted list
- Both show everything including household member preferences ("Your preferences" + "Household")
- Claude organizes the display naturally when presenting (dietary together, schedule together) — no rigid categories in storage
- Removal is conversational with same brief style — "Noted, you aren't looking for gluten free anymore" then continues the conversation

### Claude's Discretion
- How inferred preferences are detected (conversation pattern analysis approach)
- Preference tagging strategy within the knowledge system
- Exact formatting of /preferences command output
- How preferences are ranked/selected for context injection when token budget is limited

</decisions>

<specifics>
## Specific Ideas

- Acknowledgment style should be brief and natural: "Noted: [preference]" then continue — not a separate confirmation step
- Removal acknowledgment mirrors save style: "Noted, [update]" — same conversational flow
- Household preferences are first-class — "my kid is allergic to peanuts" should be as strongly enforced as "I'm allergic to peanuts"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-preference-learning*
*Context gathered: 2026-02-06*
