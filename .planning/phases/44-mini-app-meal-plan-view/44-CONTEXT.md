# Phase 44: Mini App Meal Plan View - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The Mini App displays the full day's meals in an organized, browsable format. Each day shows grouped meal type sections that are expandable/collapsible. Multi-recipe meal slots show all component recipes. Tapping any recipe navigates to recipe detail.

</domain>

<decisions>
## Implementation Decisions

### Section Layout
- Grouped with header bars: each meal type gets a header row (icon + label), recipes listed below
- Only meal types with entries appear — no empty slots for unused types
- Always show meal type headers, even when a day has only one meal type (consistency)
- Days with no meals still show the day header with a subtle "No meals planned" message (keeps weekly rhythm)

### Expand/Collapse Behavior
- Expand/collapse operates at the day level — tap day header to show/hide all meal sections for that day
- Default state on load: all days expanded
- Collapsed state shows: day header + meal count (e.g., "Thursday — 2 meals")
- Single level of nesting only (no independent meal-type-level collapse)

### Multi-Recipe Display
- All recipes in a meal slot listed equally under the meal type header — no primary/secondary hierarchy
- Each recipe is individually tappable to navigate to recipe detail
- No visual distinction between "main" and "side" recipes

### Claude's Discretion
- Meal type header visual treatment (minimal text vs subtle colored background)
- Expand/collapse animation style and timing
- Exact spacing, typography, and visual weight of section headers
- Error state handling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DayRow` component (`mini-app/src/components/meal-plan/DayRow.tsx`): Currently renders flat entry list per day — needs refactoring to group by meal type and add expand/collapse
- `MealEntry` component (`mini-app/src/components/meal-plan/MealEntry.tsx`): Renders individual recipe row with icon, label, name — can be reused as-is within grouped sections
- `WeekHeader` component: Week navigation with swipe + dot indicators — no changes needed
- `useMealPlan` hook: Fetches both weeks, handles recipe detail drill-down — data layer is ready
- `meal-plan.css`: Existing styles for day rows, meal entries, today highlight, past dimming
- lucide-react icons: Already used for Sunrise/Sun/Moon — extend for snack/dessert/other

### Established Patterns
- CSS uses Telegram theme variables (`--tg-theme-*`) and HeySous design tokens (`--hs-*`)
- Meal type icon colors: breakfast=#e5a03a (gold), lunch=#e58c3a (orange), dinner=#7a6fbf (purple)
- Today highlight: `--hs-accent-subtle` background with border radius
- Past days: 0.5 opacity
- Tappable entries: cursor pointer + active state background

### Integration Points
- `MealPlanEntry` interface in `useMealPlan.ts`: has `mealType` field typed as `"breakfast" | "lunch" | "dinner"` — needs expanding to include `"snack" | "dessert" | "other"`
- API endpoint (`src/mini-app/routes/meal-plan.ts`): Already returns all 6 meal types sorted correctly (breakfast, lunch, snack, dinner, dessert, other)
- `MEAL_ICONS` and `MEAL_LABELS` in `MealEntry.tsx`: Only has 3 entries — needs snack, dessert, other added
- Recipe detail navigation via `openDetail(knowledgeItemId)` — works for any meal type, no changes needed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-mini-app-meal-plan-view*
*Context gathered: 2026-03-03*
