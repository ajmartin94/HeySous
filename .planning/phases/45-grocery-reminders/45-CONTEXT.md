# Phase 45: Grocery & Reminders - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Grocery lists and reminders work across all meal types, not just dinner. Start-cooking reminders fire for every planned meal type at appropriate times. Grocery generation considers all meal types. Morning summaries are validated to include all meals.

</domain>

<decisions>
## Implementation Decisions

### Start-cooking reminder scope
- All planned meals get start-cooking reminders, regardless of meal type (breakfast, lunch, snack, dinner, dessert, other)
- No-recipe entries still get reminders using the 45-min default offset
- No floor on reminder time — if the math says 5am for a 2-hour breakfast recipe at 7am, fire at 5am

### Reminder timing formula
- Same formula for all meal types: `mealTypeTime - recipeTotalTime` (or 45-min default)
- Look up the correct time field per meal type from ReminderSettings (breakfastTime, lunchTime, snackTime, dinnerTime, dessertTime)
- Remove the `meal.mealType === "dinner"` filter in generator.ts — apply to all meal types

### Reminder message tone
- Claude adapts the message to incorporate the meal type naturally (e.g., "time to prep your afternoon snack" vs "time to start dinner")
- mealType is already passed in reminder context — sender.ts already handles it

### Grocery generation
- No changes needed to grocery tools or system prompt
- Claude already sees all meal types in plan context and generates combined, deduplicated grocery lists
- No meal type annotations on grocery items — just a unified list by store/section

### Morning summary
- Keep current format (simple meal type + recipe name list)
- Validate that the generator correctly aggregates all meal types for each day, not just dinner

### Claude's Discretion
- Exact wording variations for different meal type reminders
- How to phrase the morning summary when many meal types are present

</decisions>

<specifics>
## Specific Ideas

No specific requirements — straightforward extension of existing patterns to all meal types.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReminderSettings` (types.ts): Already has breakfastTime, lunchTime, snackTime, dinnerTime, dessertTime fields from Phase 43
- `buildReminderPrompt` (sender.ts): Already accepts mealType in context for start_cooking and prep_alert types
- `generateReminders` (generator.ts): Already iterates all meal types for morning summaries — start_cooking section needs the dinner-only filter removed

### Established Patterns
- Reminder generation: delete-all-and-regenerate pattern per household
- Time calculation: `localTimeToUtc(date, timeString, timezone)` for converting meal times to UTC due dates
- Recipe time parsing: structured metadata columns first, then content parsing fallback, then 45-min default
- Duplicate prevention: `hasPendingReminder` window check before creating

### Integration Points
- `generator.ts:247` — The `if (meal.mealType === "dinner")` filter is the primary change point
- `settings.dinnerTime` lookup (generator.ts:310) needs to become a per-meal-type lookup
- Morning summary context building (generator.ts:196-218) — verify it handles all types correctly

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 45-grocery-reminders*
*Context gathered: 2026-03-04*
