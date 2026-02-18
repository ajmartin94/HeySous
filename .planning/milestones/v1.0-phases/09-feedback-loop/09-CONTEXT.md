# Phase 9: Feedback Loop - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-meal check-ins that annotate recipes with real-world feedback and improve future planning. The bot proactively asks "How was dinner?" after planned meals, captures sentiment and notes, and uses that feedback to influence recipe suggestions and propose recipe updates. This phase uses the existing reminder infrastructure for scheduling check-ins.

</domain>

<decisions>
## Implementation Decisions

### Check-in timing & triggers
- Check in after every planned meal, not a subset
- Send check-in same evening, 8-9pm window (using user's timezone from reminder settings)
- Always send regardless of whether user interacted with bot that day
- If user doesn't respond, silent drop — no follow-up, no nagging
- Check-in expires silently; no guilt, no tracking of non-responses

### Interaction style
- Open with a direct question naming the recipe: "How was the chicken parmesan tonight?"
- Offer three inline buttons: 👍 Loved it / 😐 It was okay / 👎 Didn't work
- Also include a "Skipped" button for meals not cooked (explicit plan adherence tracking)
- Always accept free-text responses as an alternative to buttons
- No follow-up questions after the user responds — one response captured and done
- Claude extracts structured feedback (sentiment + notes) from whatever the user says

### What gets captured
- Overall sentiment (positive / neutral / negative / skipped) — first-class signal for planning
- Freeform notes — equally important as sentiment. Notes are broad: timing, ingredients, oven settings, substitutions, anything
- No structured time-tracking field; if user mentions time, Claude captures it in notes
- "Didn't make it" / "Skipped" tracked explicitly via button
- Feedback stored as annotations on the recipe's knowledge item, not a separate table
- Each annotation includes: date, sentiment, notes text

### Feedback visibility
- When suggesting a recipe for a future plan, explicitly reference past feedback: "Suggesting chicken parm — you loved it last time but said to use less salt"
- Negative feedback deprioritizes recipes in auto-suggestions but doesn't ban them — user can still request
- Feedback history shown inline when displaying a recipe (e.g., "Last 3 times: 👍👍😐")
- Aggressive recipe update suggestions: even a single mention of a concrete change triggers a proposal
  - Example: user says "less salt" → bot suggests "Cut salt in half for next time?" and updates recipe if approved
  - Adds a note to the recipe that the change was made based on feedback
  - User must approve before recipe is modified

### Claude's Discretion
- Exact wording of check-in messages (within the "direct question naming the recipe" pattern)
- How to handle edge cases like multiple meals in one day
- How to format feedback annotations within recipe knowledge items
- Threshold for deprioritization (how many negative reviews before significant ranking drop)

</decisions>

<specifics>
## Specific Ideas

- "Less salt" even once should trigger a recipe update suggestion — don't wait for patterns
- Bot should propose the specific change (e.g., "cut salt in half") not just note the feedback
- Skipped meals are valuable data — helps understand which recipes actually get cooked vs just planned
- Feedback should feel like a quick debrief, not a survey

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-feedback-loop*
*Context gathered: 2026-02-09*
