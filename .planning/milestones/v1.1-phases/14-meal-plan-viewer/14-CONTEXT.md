# Phase 14: Meal Plan Viewer - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual weekly meal plan viewer in the Telegram Mini App. Users see a 7-day grid with their planned meals, toggle between current and next week, and tap any meal to see the full recipe detail (reusing RecipeDetail from Phase 13). Read-only view — creating or editing meal plans stays in the bot conversation.

</domain>

<decisions>
## Implementation Decisions

### Grid layout & density
- Vertical stack orientation — days stacked top-to-bottom, each day is a full-width row
- Recipe name only per meal cell — no tags, no summary, tap for details
- Day headers show full format: "Monday, Feb 10"
- Multiple meals within a day use labeled rows — each meal on its own line with meal type label

### Week navigation & today
- Swipe between weeks (horizontal swipe gesture) — current week and next week
- Week header shows "This Week" / "Next Week" label only (no date range — dates are on each day row)
- Auto-scroll to today when opened
- Today's day row gets a subtle accent background to stand out

### Empty & edge states
- When no meal plan exists for a week: show the empty 7-day grid structure (days visible, no meals)
- Days with no meals show a subtle gray "No meals planned" label
- Past days in the current week are visually dimmed (reduced opacity)
- Meals without a matching recipe in the knowledge base: show meal name + "no recipe" indicator, not tappable

### Meal type presentation
- Small icon (sun/noon/moon) + text label before recipe name — breakfast/lunch/dinner
- Only 3 standard meal types: breakfast, lunch, dinner
- Only show meal types that have recipes — skip empty meal type rows
- Always show the meal type label, even when a day has only one meal

### Claude's Discretion
- Exact swipe gesture implementation (library choice, animation)
- Icon design for meal types
- Accent color choice for today highlight
- Dimming opacity level for past days
- Loading state while fetching meal plan data

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. The general feel should be consistent with the existing grocery list and recipe browser pages.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-meal-plan-viewer*
*Context gathered: 2026-02-10*
