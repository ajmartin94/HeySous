# Phase 42: Meal Plan Schema & Migration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Database foundation for multi-meal-type, multi-recipe meal plans. Expand the meal type enum, enable multiple recipes per meal slot, update Drizzle schema + TypeScript types + Claude tool definitions + API endpoint. Existing dinner-only plans continue to work unchanged.

</domain>

<decisions>
## Implementation Decisions

### Multi-recipe slot modeling
- Allow multiple `meal_plan_entries` rows with the same `day_of_week` + `meal_type` — no new tables or composition layer
- Ordering within a slot uses insertion order (autoincrement ID) — no `sort_order` column
- No hard limit on recipes per slot — trust the agent to be reasonable
- `save_meal_plan` tool keeps full-replace behavior — Claude sends the complete week, all entries replaced

### Meal type expansion
- Fixed enum with 6 values: `breakfast`, `lunch`, `snack`, `dinner`, `dessert`, `other`
- No `meal_label` column for 'other' — it simply shows as "Other"
- Both `meal_plan_entries` and `cooking_history` get the expanded enum
- Display/sort order is chronological: breakfast(1) → lunch(2) → snack(3) → dinner(4) → dessert(5) → other(6)

### API response shape
- Flat list of entries (current pattern) — no pre-grouping by day or meal type
- API includes all 6 meal types immediately — no filtering to old types
- Sort order updated: `day_of_week ASC`, then chronological meal type CASE, then `id ASC` (insertion order within slot)
- No new fields — multiple entries with same day+meal_type implicitly form a slot, Mini App groups client-side

### Migration safety
- Schema-only change — no data migration needed (SQLite doesn't enforce text enums, existing entries already default to 'dinner')
- Trust existing migration pattern (version 7, ALTER TABLE style) — no special rollback or backup step
- Manual verification of backward compatibility is sufficient — no dedicated migration test
- Full stack update in this phase: Drizzle schema, TypeScript types (MealType, PlanEntry), tool definitions (save_meal_plan, log_meal), and API endpoint

### Claude's Discretion
- Exact migration implementation details (whether version 7 needs any SQL at all, or is purely app-level)
- How to structure the CASE statement in the API query for the 6-type sort
- Whether to add any system prompt guidance about multi-recipe slots (Phase 43 territory but may need a note)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is backward compatibility: existing dinner-only plans must continue to display correctly without any data transformation.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/planning/schema.ts`: Drizzle schema for `mealPlans`, `mealPlanEntries`, `cookingHistory` — all need enum expansion
- `src/planning/repository.ts`: `createPlanRepository()` with `savePlan()`, `getPlan()`, `getActivePlans()` — savePlan already handles full-replace, just needs expanded MealType
- `src/db/migrations.ts`: Migration runner with 6 existing migrations, sequential versioning via `user_version` pragma
- `src/ai/tools.ts`: `PLAN_TOOLS` array with `save_meal_plan` and `log_meal` — both have `enum: ["breakfast", "lunch", "dinner"]` to expand

### Established Patterns
- Migrations use `sqlite.exec()` for DDL, `sqlite.prepare()` for DML, wrapped in transactions
- Drizzle schema enums are defined inline: `text("meal_type", { enum: [...] })`
- Repository functions use Drizzle ORM; API routes use raw better-sqlite3 SQL
- TypeScript type `MealType` is defined in repository.ts as a union type

### Integration Points
- `src/mini-app/routes/meal-plan.ts`: Raw SQL query with CASE-based meal_type sort — needs updated CASE for 6 types
- `src/ai/tool-handler.ts`: Handles `save_meal_plan` and `log_meal` tool calls — needs to accept expanded enum
- `src/pipeline/processor.ts`: References `allTools` — no change needed (tools auto-included)
- `src/reminders/generator.ts`: Uses meal_type for reminder scheduling — may need awareness of new types (Phase 45)
- `src/feedback/generator.ts`: Uses meal plans for feedback check-ins — should handle new types gracefully

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-meal-plan-schema-migration*
*Context gathered: 2026-03-02*
