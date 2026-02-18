# Phase 8: Reminders - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Proactive daily prep summaries and time-aware reminders that survive restarts and respect the user's schedule. The bot reaches out to users — morning summaries, prep timing alerts, and start-cooking nudges. Users can control reminders through conversation or a dedicated command. Feedback loop and post-meal check-ins are Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Morning summary
- Fixed time delivery — user sets their preferred morning time (e.g., 8am), same every day
- Full day overview — includes all planned meals (breakfast/lunch/dinner), not just dinner
- Quick glance format — 2-3 lines max, like a sticky note (meal names + any heads-up)
- On days with no meal plan, send a brief nudge ("No dinner planned for tonight") rather than staying silent

### Prep timing alerts
- Claude analyzes recipes to determine what needs advance prep and when (not limited to explicit notes)
- Lead time up to the day before — can remind the night before for overnight thawing or long marinating
- Heads-up only — no instructions in the reminder ("Defrost the chicken for tonight's stir fry"), user knows what to do
- For meals with no advance prep, still send a start-cooking nudge at dinner time ("Time to start cooking! Tonight: [meal]")

### Reminder tone & frequency
- Casual sous chef personality — same warm Sous persona as conversations, brief and friendly
- No hard frequency cap — send as many reminders as the meal requires, trust Claude to be reasonable
- Fire and forget — if user doesn't respond to a reminder, no follow-up or re-reminder
- Varied wording — Claude writes each reminder fresh, not from templates. Natural, not robotic.

### User controls
- Both conversational and /reminders command — "mute reminders until Monday" works, and /reminders shows settings
- Control by type — morning summary and prep alerts can be toggled independently
- On by default — reminders activate as soon as a meal plan exists. User mutes if they don't want them.
- No snooze — fire and forget is sufficient, user can scroll back in chat history

### Claude's Discretion
- Exact default morning summary time (suggest something reasonable)
- How to detect dinner time for start-cooking nudges (user preference or recipe-based)
- Reminder scheduling implementation (poller interval, job queue, etc.)
- How to persist reminder state across restarts

</decisions>

<specifics>
## Specific Ideas

- Morning summary should feel like glancing at a sticky note on the fridge — minimal, scannable
- Prep reminders should feel like a kitchen buddy tapping you on the shoulder, not a calendar alarm
- The /reminders command should show current settings and let you toggle types on/off

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-reminders*
*Context gathered: 2026-02-08*
