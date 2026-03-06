# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [x] **v1.2 Onboarding and Feedback** - Phases 15-19 (shipped 2026-02-11)
- [x] **v1.3 AI Polish & UX** - Phases 20-24 (shipped 2026-02-19)
- [x] **v1.4 Backlog Sweep** - Phases 25-31 (shipped 2026-02-21)
- [x] **v1.5 Agent Hardening & Polish** - Phases 32-41 (shipped 2026-02-25)
- [x] **v1.6 All-Day Meals & UX** - Phases 42-47 (shipped 2026-03-04)

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
- [x] **Phase 43: Agent Tools & Meal Time Config** - Claude understands and creates all-day meal plans with configurable times (completed 2026-03-04)
- [x] **Phase 44: Mini App Meal Plan View** - Visual display of all meal types per day with expandable sections (completed 2026-03-04)
- [x] **Phase 45: Grocery & Reminders** - Downstream systems aggregate and remind across all meal types (completed 2026-03-04)
- [x] **Phase 46: Deep-Link Navigation** - Inline buttons in Sous responses link directly to Mini App content (completed 2026-03-04)
- [x] **Phase 47: Mini App Polish & Prompt Cleanup** - Font, layout, and emoji ban for a cleaner experience (completed 2026-03-04)
- [x] **Phase 48: v1.6 UAT Fixes** - Fix 4 gaps from user acceptance testing (preference dedup, meal entry styling, deep-link buttons, dead CSS) (completed 2026-03-05)
- [ ] **Phase 50: Settings Page Organization** - Organize and polish the settings page before shipping
- [ ] **Phase 51: Message Streaming Fixes** - Fix funky behavior in message streaming
- [ ] **Phase 52: Onboarding Memory Integration** - Verify onboarding utilizes the memory function
- [ ] **Phase 53: Onboarding Help Message & Next Steps** - End onboarding with help message and prompt to start planning
- [ ] **Phase 54: Hide Release Notes for New Users** - Brand new users should not see release notes
- [ ] **Phase 55: Verify Reminder Settings Integration** - Verify reminders are controlled by settings page
- [ ] **Phase 56: Database Operation Test Coverage** - Test coverage for major DB operations and memory dedup

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
**Plans:** 2/2 plans complete
Plans:
- [x] 43-01-PLAN.md -- Add meal time columns to DB, extend tool definition/handler, enrich reminder context
- [x] 43-02-PLAN.md -- Update system prompt for multi-meal awareness, modify onboarding for meal times

### Phase 44: Mini App Meal Plan View
**Goal**: The Mini App displays the full day's meals in an organized, browsable format
**Depends on**: Phase 42
**Requirements**: PLAN-04
**Success Criteria** (what must be TRUE):
  1. Each day in the meal plan view shows sections for each meal type that has entries (not empty slots for unused types)
  2. Each meal section is expandable/collapsible to manage visual density
  3. Multi-recipe meal slots show all component recipes (e.g., main + side) within the meal section
  4. Tapping a recipe within any meal type navigates to the recipe detail view
**Plans:** 1/1 plans complete
Plans:
- [ ] 44-01-PLAN.md -- Extend meal type support, grouped section rendering, day-level expand/collapse

### Phase 45: Grocery & Reminders
**Goal**: Grocery lists and reminders work across all meal types, not just dinner
**Depends on**: Phase 43
**Requirements**: PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. Grocery list generation includes ingredients from breakfast, lunch, snack, and dessert recipes -- not just dinner
  2. Prep reminders fire for non-dinner meals at appropriate times based on configured meal times
  3. Start-cooking reminders adjust timing based on the specific meal type's target time (e.g., breakfast prep reminder in the evening before, lunch reminder in the morning)
**Plans:** 1/1 plans complete
Plans:
- [ ] 45-01-PLAN.md -- Extend start-cooking reminders to all meal types, verify grocery aggregation

### Phase 46: Deep-Link Navigation
**Goal**: Users can jump directly from Sous chat messages and reminders into the relevant Mini App view
**Depends on**: Phase 44
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. When Sous mentions a recipe in chat, the response includes an inline button that opens that recipe in the Mini App
  2. When Sous discusses the meal plan, the response includes an inline button to open the meal plan view
  3. When Sous generates or updates a grocery list, the response includes an inline button to open the grocery list
  4. Cooking reminders include a button that opens the specific recipe being cooked
**Plans:** 2/2 plans complete
Plans:
- [ ] 46-01-PLAN.md -- Deep-link builder module, on-demand tool, system prompt update, Mini App ?id handling
- [ ] 46-02-PLAN.md -- Pipeline post-response button injection, reminder sender buttons

### Phase 47: Mini App Polish & Prompt Cleanup
**Goal**: The Mini App is more readable and better laid out, and Sous never uses emojis
**Depends on**: Nothing (independent of PLAN/NAV work)
**Requirements**: UI-01, UI-02, PROMPT-01
**Success Criteria** (what must be TRUE):
  1. The Mini App uses a new, more readable font family throughout all views
  2. On large screens (iPad, desktop), the Mini App content is constrained to a reasonable max-width and centered -- not stretched edge-to-edge
  3. Sous responses in chat never contain emoji characters
  4. Hardcoded bot messages (reminders, notifications, onboarding) do not contain emoji characters
**Plans:** 1/1 plans complete
Plans:
- [x] 47-01-PLAN.md -- System-ui font family, responsive layout padding, emoji ban in system prompt

### Phase 48: v1.6 UAT Fixes
**Goal**: All 4 gaps identified in v1.6 user acceptance testing are resolved
**Depends on**: Phases 42-47 (fixes issues found in completed phases)
**Requirements**: UAT-1, UAT-2, UAT-3, UAT-4
**Success Criteria** (what must be TRUE):
  1. Preference dedup catches near-identical preferences (e.g., "Breakfast Time: 7am" vs "Breakfast Time: 8am")
  2. Recipe names are visually indented under meal type headers with clear hierarchy
  3. Deep-link buttons are attached to the Sous response message, not sent as a separate message
  4. Layout CSS has no dead media queries; uses fixed padding for Telegram's ~400px viewport
**Plans:** 2/2 plans complete
Plans:
- [x] 48-01-PLAN.md -- Fix preference dedup threshold and attach deep-link buttons to response message
- [x] 48-02-PLAN.md -- Indent meal entries and remove dead Layout.css media queries

## Progress

**Execution Order:**
Phases execute in numeric order: 42 -> 43 -> 44 -> 45 -> 46 -> 47
Note: Phase 47 has no dependencies and can execute in parallel with earlier phases if desired.
Phase 48 is a UAT fix phase -- both plans run in Wave 1 (parallel).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. MVP Phases | v1.0 | 30/30 | Complete | 2026-02-09 |
| 11-14. Mini App Phases | v1.1 | 10/10 | Complete | 2026-02-10 |
| 15-19. Onboarding Phases | v1.2 | 10/10 | Complete | 2026-02-11 |
| 20-24. AI Polish Phases | v1.3 | 9/9 | Complete | 2026-02-19 |
| 25-31. Backlog Sweep Phases | v1.4 | 7/7 | Complete | 2026-02-21 |
| 32-41. Agent Hardening Phases | v1.5 | 23/23 | Complete | 2026-02-25 |
| 42. Meal Plan Schema & Migration | 2/2 | Complete    | 2026-03-02 | - |
| 43. Agent Tools & Meal Time Config | 2/2 | Complete    | 2026-03-04 | - |
| 44. Mini App Meal Plan View | 1/1 | Complete    | 2026-03-04 | - |
| 45. Grocery & Reminders | 1/1 | Complete    | 2026-03-04 | - |
| 46. Deep-Link Navigation | 2/2 | Complete    | 2026-03-04 | - |
| 47. Mini App Polish & Prompt Cleanup | v1.6 | Complete    | 2026-03-04 | 2026-03-04 |
| 48. v1.6 UAT Fixes | 2/2 | Complete    | 2026-03-05 | - |

**Total: 47 phases complete (98 plans) across 6 milestones + v1.6 in progress**

### Phase 49: Sous Memory System — atomic facts, settings table, and preference migration

**Goal:** Replace the preference-as-knowledge-item system with a dedicated memories table for atomic facts, rename reminder_settings to application_settings, add Claude tools for memory CRUD with dedup, migrate existing preferences, and add memory/settings views to the Mini App
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07, SET-01, SET-02, SET-03
**Depends on:** Phase 48
**Success Criteria** (what must be TRUE):
  1. Atomic facts are stored in a dedicated `memories` table with FTS5 search
  2. Existing preferences are migrated from `knowledge_items` to `memories`
  3. Claude can save, delete, and search memories via new tools with dedup pipeline
  4. The `reminder_settings` table is renamed to `application_settings`
  5. The /memory command displays memories grouped by category
  6. The Mini App settings page shows memory list with delete and settings form with meal times/toggles
  7. System prompt injects memories instead of preferences, with proactive saving instructions
**Plans:** 3/3 plans complete

Plans:
- [ ] 49-01-PLAN.md -- Database foundation: memories table, FTS5 index, repository, migrations, settings rename
- [ ] 49-02-PLAN.md -- Claude tools: save_memory/delete_memory/search_memories with dedup, settings rename, system prompt
- [ ] 49-03-PLAN.md -- Bot /memory command, Mini App memory list and settings form, API routes

### Phase 50: Settings Page Organization
**Goal:** Reorganize the Mini App settings page into a side-tabbed layout with App, Schedule, and Memory tabs
**Depends on:** Phase 49
**Requirements**: SETTINGS-ORG
**Plans:** 1 plan

Plans:
- [ ] 50-01-PLAN.md -- Refactor Settings.tsx into side-tabbed layout with App/Schedule/Memory tabs

### Phase 51: Message Streaming Fixes
**Goal:** Fix multi-turn text overwrite, intermediate text loss, and transient tool status labels in streaming
**Depends on:** Nothing
**Requirements**: STREAM-FIX
**Plans:** 1 plan

Plans:
- [ ] 51-01-PLAN.md -- Fix stream-sender accumulation and processor finalize override
### Phase 52: Onboarding Memory Integration
**Goal:** Verify and ensure the onboarding process utilizes the memory function to store user preferences
**Depends on:** Phase 49
**Plans:** Not planned yet

### Phase 53: Onboarding Help Message & Next Steps
**Goal:** End onboarding with a help-style message explaining what Sous can do, then prompt user to start planning or adding meals
**Depends on:** Nothing
**Plans:** 1 plan

Plans:
- [ ] 53-01-PLAN.md -- Remove recipes state, rewrite tour as help/next-steps message

### Phase 54: Hide Release Notes for New Users
**Goal:** Brand new users should not see release notes on first interaction
**Depends on:** Nothing
**Requirements**: NOTIF-HIDE
**Plans:** 1 plan
Plans:
- [ ] 54-01-PLAN.md -- Filter checkPendingNotification by user creation time with TDD





### Phase 55: Verify Reminder Settings Integration
**Goal:** Verify the reminder system is actually controlled by the settings page toggles
**Depends on:** Phase 49
**Plans:** 1 plan

Plans:
- [ ] 55-01-PLAN.md -- Fix settings-to-reminder wiring gaps and add integration tests

### Phase 56: Database Operation Test Coverage
**Goal:** Review and improve test coverage of major database operations, including deduplication of memory items
**Depends on:** Phase 49
**Plans:** Not planned yet
