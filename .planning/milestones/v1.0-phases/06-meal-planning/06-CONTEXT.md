# Phase 6: Meal Planning - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can generate and adjust weekly dinner plans through conversation, informed by their stored recipes and preferences. The bot proposes meals, the user reacts, and they iterate until the plan feels right. Grocery lists, reminders, and feedback are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Plan display & structure
- Monday–Sunday full week plan
- Recipe name only per day — clean and minimal ("Monday: Chicken Parm")
- Full plan presented all at once in a single message
- Primarily dinners, but the user has the option to fill out a full plan (breakfast, lunch, dinner) — likely path is dinners only most of the time
- Both conversational recall ("what's for dinner this week") AND a /plan command to view the active plan

### Recipe selection & planning approach
- Planning is a **conversation**, not an algorithm — the bot proposes, the user reacts, they iterate
- No rigid selection logic — bot suggests whatever feels best based on conversation context + preferences
- Bot can suggest both stored recipes and new recipe ideas freely
- Effort/complexity is NOT automatically factored in — only considered if the user mentions it ("something easy on Tuesday")
- No auto-optimization for variety or recency — user-driven choices

### Plan adjustment flow
- Changes applied immediately without confirmation — user says "swap Thursday to tacos", bot does it and shows the updated plan
- No explicit finalize step — plan is a living object that can always be adjusted
- Bot may suggest moving on once the conversation feels complete, but never locks the plan
- Multiple active plans supported (e.g., this week and next week)

### Cooking history
- Planned meals auto-marked as "cooked" after the day passes
- Unplanned meals also trackable — any meal the user mentions gets logged ("we had pizza tonight")
- History visible to user on request ("what did we eat last week")
- History available to Claude as context for suggestions, but no explicit recency/rotation logic — just context

### Claude's Discretion
- Plan message formatting and layout within the "recipe name only" constraint
- How to handle ambiguous day references ("this Thursday" vs "next Thursday")
- How to store and retrieve plans (schema design, knowledge items vs dedicated tables)
- Conversation flow for building plans — how much to suggest vs ask

</decisions>

<specifics>
## Specific Ideas

- Planning should feel like a conversation, not filling out a form — "the bot proposes, the user reacts, they iterate until it feels right"
- Keep it simple — there's not a method for planning, it's a conversation
- User emphasized repeatedly: conversational, not algorithmic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-meal-planning*
*Context gathered: 2026-02-06*
