# Phase 18: App Feedback - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can share feedback about the bot experience through multiple channels. Feedback is collected and stored for later analysis. This phase covers collection only — admin dashboards, sentiment analysis, and categorization are deferred.

</domain>

<decisions>
## Implementation Decisions

### Feedback channels
- `/feedback <text>` command — user submits explicit feedback inline
- Implicit detection — Claude silently logs app-related sentiment from regular conversation (fully silent, user never knows feedback was captured)
- Mini App "Give Feedback" button — simple text box and submit, no category picker or emoji rating
- Proactive prompt — bot asks "how am I doing?" triggered by message count (not calendar-based)
- All four channels store to the same feedback table with a `source` column (command, implicit, mini-app, proactive)

### Command acknowledgment
- Simple, short, warm reply: "Thanks for the feedback!" — no echo-back of what was captured

### Data model
- Minimal: feedback text, source (command/implicit/mini-app/proactive), user ID, timestamp
- No categories, no sentiment scoring at save time — analysis happens after the fact on raw data

### Proactive prompt behavior
- Triggered after Nth message since last prompt (approximates 2 weeks of natural use)
- Only ask at natural conversation breaks — if user is mid-conversation, don't interrupt
- If user ignores the prompt, drop it silently — no follow-up, no nagging, wait for next cycle
- No opt-out mechanism needed — infrequent enough that it's not annoying

### Admin review
- No admin review interface this phase — no Mini App dashboard, no bot command
- Feedback is collected and stored in SQLite; admin queries the database directly if needed
- Proper admin dashboard deferred to a future phase

### Claude's Discretion
- Exact wording of proactive "how am I doing?" prompt
- How to detect implicit app-related sentiment vs regular conversation frustration
- Message count threshold for proactive prompt trigger
- Mini App feedback form styling and placement in hub

</decisions>

<specifics>
## Specific Ideas

- Proactive prompt should feel natural — delivered as a new message only when conversation has reached a break, never mid-flow
- Implicit detection should be truly invisible — no "I'll work on it" or any acknowledgment that feedback was logged

</specifics>

<deferred>
## Deferred Ideas

- Admin feedback dashboard (Mini App or bot command) — future phase
- Sentiment scoring and categorization — post-hoc analysis, not real-time
- Feedback analytics and trending — future phase

</deferred>

---

*Phase: 18-app-feedback*
*Context gathered: 2026-02-11*
