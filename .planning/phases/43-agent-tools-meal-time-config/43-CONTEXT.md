# Phase 43: Agent Tools & Meal Time Config - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude can plan, query, and modify meals for any meal type throughout the day, and users can set preferred times per meal type. This phase updates system prompt behavior, extends tool definitions for meal time preferences, modifies onboarding to collect times, and injects meal time context into the dynamic prompt.

</domain>

<decisions>
## Implementation Decisions

### Default meal type behavior
- No special default-meal-type logic — trust the existing system prompt to handle ambiguity naturally
- When user mentions a meal without specifying type, Sous infers from context (time of day + food type); only asks if genuinely ambiguous
- When inference fails, default to dinner (backward compatible)
- "Plan my breakfasts" follows the same pattern as "plan my dinners" — no special per-type logic

### Meal time storage
- Extend `reminder_settings` table with new columns: `breakfast_time`, `lunch_time`, `snack_time`, `dessert_time`
- Keep existing `dinner_time` column as-is (no rename)
- Standard defaults: breakfast 07:00, lunch 12:00, snack 15:00, dinner 17:30 (existing), dessert 20:00
- Extend `update_reminder_settings` tool with new params for each meal time — single tool handles all time config

### Conversational flow for setting times
- Modify onboarding to ask "what time do you typically eat breakfast, lunch, and dinner?"
- If user skips or gives a vague answer, use standard defaults silently — don't block onboarding
- Users can update meal times anytime through natural language ("I eat breakfast at 9 now") — no confirmation needed, just save
- Users can ask "what are my meal times?" and Sous reads from `get_reminder_settings` and tells them — no new tool needed

### System prompt guidance
- Do NOT proactively suggest non-dinner meal planning — wait for user to ask
- Explicitly list all 6 meal types (breakfast, lunch, snack, dinner, dessert, other) in the system prompt
- Inject user's configured meal times into the dynamic prompt context (alongside preferences) so Claude can infer meal types from time-of-day
- Remove explicit plan formatting instructions from chat — Sous should focus on using the `save_meal_plan` tool and let the Mini App handle presentation

### Claude's Discretion
- Exact wording of system prompt additions for multi-meal awareness
- How to phrase the onboarding question naturally within the existing flow
- Whether to acknowledge time updates conversationally ("Got it, breakfast at 9am!")

</decisions>

<specifics>
## Specific Ideas

- Onboarding question: "what time do you typically eat breakfast, lunch, and dinner?" — casual, not exhaustive (skip snack/dessert in onboarding, those use defaults)
- Remove explicit plan formatting from chat prompt — this is a cleanup opportunity, not just an addition
- Meal time injection in dynamic context should be compact (e.g., "Meal times: breakfast 7am, lunch 12pm, dinner 5:30pm")

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reminder_settings` table and `createReminderRepository`: already has `upsertSettings` with COALESCE pattern for partial updates — extend with new columns
- `update_reminder_settings` tool: existing param structure supports optional fields, easy to add more
- `SOUS_PERSONA` + `buildSystemPrompt` in `src/ai/system-prompt.ts`: dynamic prompt injection already exists for preferences
- Onboarding state machine in `src/onboarding/`: handles multi-step conversational flow

### Established Patterns
- `reminder_settings` uses COALESCE for partial updates — new columns follow the same pattern
- Tool definitions use optional params with no `required` constraint — meal time params fit naturally
- Dynamic prompt context is built from preferences and injected into system prompt via `buildSystemPrompt`

### Integration Points
- `src/reminders/repository.ts`: add new columns to `ReminderSettingsRow`, `mapSettings`, `upsertSettings`
- `src/ai/tools.ts`: extend `REMINDER_TOOLS` `update_reminder_settings` input schema
- `src/ai/tool-handler.ts`: handle new params in update_reminder_settings handler
- `src/ai/system-prompt.ts`: add meal type list to static prompt, inject meal times into dynamic context, remove explicit plan formatting
- `src/onboarding/`: add meal times question to the flow
- `src/db/`: migration to add new columns to `reminder_settings`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-agent-tools-meal-time-config*
*Context gathered: 2026-03-03*
