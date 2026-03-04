# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [x] **v1.2 Onboarding and Feedback** - Phases 15-19 (shipped 2026-02-11)
- [x] **v1.3 AI Polish & UX** - Phases 20-24 (shipped 2026-02-19)
- [x] **v1.4 Backlog Sweep** - Phases 25-31 (shipped 2026-02-21)
- [x] **v1.5 Agent Hardening & Polish** - Phases 32-41 (shipped 2026-02-25)
- [ ] **v1.6 All-Day Meals & UX** - Phases 42-47 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-10) - SHIPPED 2026-02-09</summary>

See .planning/milestones/v1.0-ROADMAP.md for full phase history.
30 plans completed across 10 phases. 8,263 LOC TypeScript.

</details>

<details>
<summary>v1.1 Mini Apps (Phases 11-14) - SHIPPED 2026-02-10</summary>

See .planning/milestones/v1.1-ROADMAP.md for full phase history.
10 plans completed across 4 phases. 3,875 LOC Mini App code (12,726 total).

</details>

<details>
<summary>v1.2 Onboarding and Feedback (Phases 15-19) - SHIPPED 2026-02-11</summary>

See .planning/milestones/v1.2-ROADMAP.md for full phase history.
10 plans completed across 5 phases. Multi-user households, onboarding, feedback, help.

</details>

<details>
<summary>v1.3 AI Polish & UX (Phases 20-24) - SHIPPED 2026-02-19</summary>

See .planning/milestones/v1.3-ROADMAP.md for full phase history.
9 plans completed across 5 phases. Implicit AI behaviors, recipe variations, grocery intelligence, Mini App deletion, onboarding refinement.

</details>

<details>
<summary>v1.4 Backlog Sweep (Phases 25-31) - SHIPPED 2026-02-21</summary>

See .planning/milestones/v1.4-ROADMAP.md for full phase history.
7 plans completed across 7 phases. Recipe import (URL + photo), knowledge dedup, Sous personality, update notifications, migration framework.

</details>

<details>
<summary>v1.5 Agent Hardening & Polish (Phases 32-41) - SHIPPED 2026-02-25</summary>

See .planning/milestones/v1.5-ROADMAP.md for full phase history.
23 plans completed across 10 phases. Streaming, security, resilience, observability, admin dashboard, theming, prompt quality, reminder fixes.

</details>

### v1.6 All-Day Meals & UX (In Progress)

**Milestone Goal:** Expand from dinner-only to full-day meal planning (breakfast, lunch, dinner, snack, dessert) with multi-recipe slots, add deep-link navigation from chat to Mini App, and polish the Mini App experience.

- [x] **Phase 42: Meal Plan Schema & Migration** - Database foundation for multi-meal-type, multi-recipe meal plans (completed 2026-03-02)
- [ ] **Phase 43: Agent Tools & Meal Time Config** - Claude understands and creates all-day meal plans with configurable times
- [ ] **Phase 44: Mini App Meal Plan View** - Visual display of all meal types per day with expandable sections
- [ ] **Phase 45: Grocery & Reminders** - Downstream systems aggregate and remind across all meal types
- [ ] **Phase 46: Deep-Link Navigation** - Inline buttons in Sous responses link directly to Mini App content
- [ ] **Phase 47: Mini App Polish & Prompt Cleanup** - Font, layout, and emoji ban for a cleaner experience

## Phase Details

### Phase 42: Meal Plan Schema & Migration
**Goal**: The database supports storing meal plans with multiple meal types per day and multiple recipes per meal slot
**Depends on**: Nothing (foundation for all v1.6 PLAN work)
**Requirements**: PLAN-01, PLAN-02
**Success Criteria** (what must be TRUE):
  1. A meal plan entry can specify a meal type (breakfast, lunch, dinner, snack, dessert) in addition to the day
  2. A single meal slot (e.g., Tuesday dinner) can hold more than one recipe (main + sides/components)
  3. Existing dinner-only meal plans are migrated to the new schema with meal_type = "dinner" and continue to display correctly
  4. The meal plan API endpoints return meal type and multi-recipe data for Mini App consumption
**Plans:** 2/2 plans complete
Plans:
- [ ] 42-01-PLAN.md -- Expand Drizzle schema enums, TypeScript MealType, and add migration v7
- [ ] 42-02-PLAN.md -- Update Claude tool definitions and Mini App API sort order

### Phase 43: Agent Tools & Meal Time Config
**Goal**: Claude can plan, query, and modify meals for any meal type throughout the day, and users can set preferred times per meal type
**Depends on**: Phase 42
**Requirements**: PLAN-03, PLAN-07
**Success Criteria** (what must be TRUE):
  1. User can tell Sous "plan my breakfasts for this week" and get a breakfast plan saved with correct meal type
  2. User can say "I had a salad for lunch today" and Sous records it as a lunch entry
  3. User can configure preferred meal times (e.g., "I eat breakfast at 8am") and Sous persists those preferences
  4. Sensible defaults exist for meal times if user has not configured them (breakfast 7am, lunch 12pm, dinner 6pm)
**Plans:** 1/2 plans executed
Plans:
- [ ] 43-01-PLAN.md -- Add meal time columns to DB, extend tool definition/handler, enrich reminder context
- [ ] 43-02-PLAN.md -- Update system prompt for multi-meal awareness, modify onboarding for meal times

### Phase 44: Mini App Meal Plan View
**Goal**: The Mini App displays the full day's meals in an organized, browsable format
**Depends on**: Phase 42
**Requirements**: PLAN-04
**Success Criteria** (what must be TRUE):
  1. Each day in the meal plan view shows sections for each meal type that has entries (not empty slots for unused types)
  2. Each meal section is expandable/collapsible to manage visual density
  3. Multi-recipe meal slots show all component recipes (e.g., main + side) within the meal section
  4. Tapping a recipe within any meal type navigates to the recipe detail view
**Plans**: TBD

### Phase 45: Grocery & Reminders
**Goal**: Grocery lists and reminders work across all meal types, not just dinner
**Depends on**: Phase 43
**Requirements**: PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. Grocery list generation includes ingredients from breakfast, lunch, snack, and dessert recipes -- not just dinner
  2. Prep reminders fire for non-dinner meals at appropriate times based on configured meal times
  3. Start-cooking reminders adjust timing based on the specific meal type's target time (e.g., breakfast prep reminder in the evening before, lunch reminder in the morning)
**Plans**: TBD

### Phase 46: Deep-Link Navigation
**Goal**: Users can jump directly from Sous chat messages and reminders into the relevant Mini App view
**Depends on**: Phase 44
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. When Sous mentions a recipe in chat, the response includes an inline button that opens that recipe in the Mini App
  2. When Sous discusses the meal plan, the response includes an inline button to open the meal plan view
  3. When Sous generates or updates a grocery list, the response includes an inline button to open the grocery list
  4. Cooking reminders include a button that opens the specific recipe being cooked
**Plans**: TBD

### Phase 47: Mini App Polish & Prompt Cleanup
**Goal**: The Mini App is more readable and better laid out, and Sous never uses emojis
**Depends on**: Nothing (independent of PLAN/NAV work)
**Requirements**: UI-01, UI-02, PROMPT-01
**Success Criteria** (what must be TRUE):
  1. The Mini App uses a new, more readable font family throughout all views
  2. On large screens (iPad, desktop), the Mini App content is constrained to a reasonable max-width and centered -- not stretched edge-to-edge
  3. Sous responses in chat never contain emoji characters
  4. Hardcoded bot messages (reminders, notifications, onboarding) do not contain emoji characters
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 42 -> 43 -> 44 -> 45 -> 46 -> 47
Note: Phase 47 has no dependencies and can execute in parallel with earlier phases if desired.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. MVP Phases | v1.0 | 30/30 | Complete | 2026-02-09 |
| 11-14. Mini App Phases | v1.1 | 10/10 | Complete | 2026-02-10 |
| 15-19. Onboarding Phases | v1.2 | 10/10 | Complete | 2026-02-11 |
| 20-24. AI Polish Phases | v1.3 | 9/9 | Complete | 2026-02-19 |
| 25-31. Backlog Sweep Phases | v1.4 | 7/7 | Complete | 2026-02-21 |
| 32-41. Agent Hardening Phases | v1.5 | 23/23 | Complete | 2026-02-25 |
| 42. Meal Plan Schema & Migration | 2/2 | Complete    | 2026-03-02 | - |
| 43. Agent Tools & Meal Time Config | 1/2 | In Progress|  | - |
| 44. Mini App Meal Plan View | v1.6 | 0/? | Not started | - |
| 45. Grocery & Reminders | v1.6 | 0/? | Not started | - |
| 46. Deep-Link Navigation | v1.6 | 0/? | Not started | - |
| 47. Mini App Polish & Prompt Cleanup | v1.6 | 0/? | Not started | - |

**Total: 41 phases complete (89 plans) across 6 milestones + 6 phases planned for v1.6**
