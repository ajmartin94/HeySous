# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [x] **v1.2 Onboarding and Feedback** - Phases 15-19 (shipped 2026-02-11)
- [ ] **v1.3 AI Polish & UX** - Phases 20-24 (in progress)

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

### Phase 15: Users, Households, and Invites
**Goal**: New users can join the bot only via invite link, and every user has a persistent identity within a household
**Depends on**: Phase 14 (v1.1 complete)
**Requirements**: INVITE-01, INVITE-02, INVITE-03, INVITE-04, INVITE-05, INVITE-06, USER-01, USER-02, USER-03
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md -- Data foundation: users, households, invites modules with types, schemas, init, and repositories
- [x] 15-02-PLAN.md -- Bot integration: access gate, /start deep link handling, /invite command, wiring

### Phase 16: Household Data Migration
**Goal**: All household members share the same recipes, meal plans, grocery lists, and cooking history -- and Claude knows who it is talking to
**Depends on**: Phase 15
**Requirements**: HOUSE-01, HOUSE-02, HOUSE-03, HOUSE-04, HOUSE-05, HOUSE-06, USER-04
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md -- Database migration + data layer rename (schema, types, repositories, context builders)
- [x] 16-02-PLAN.md -- Handler + pipeline + delivery + mini-app migration (handlers, senders, system prompt, mini-app)

### Phase 17: Guided Onboarding
**Goal**: New users are guided through a conversational first-run experience that captures preferences, demonstrates capabilities, and seeds initial recipes
**Depends on**: Phase 16
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07, ONBD-08, ONBD-09
**Plans**: 2 plans

Plans:
- [x] 17-01-PLAN.md -- Onboarding module (state machine, prompt builder) and users data layer expansion
- [x] 17-02-PLAN.md -- Start handler, pipeline, and system prompt integration with human verification

### Phase 18: App Feedback
**Goal**: Users can share feedback about the bot experience through four channels (command, implicit AI detection, Mini App form, proactive prompting), all stored in a unified feedback table for later analysis
**Depends on**: Phase 15
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md -- App feedback data layer, /feedback command, Claude tool for implicit detection, proactive prompt mechanism
- [x] 18-02-PLAN.md -- Mini App feedback form page and Hub card with server-side API endpoint

### Phase 19: User Help Functionality
**Goal:** Users can discover all bot features and commands through a /help command, Mini App help page, and Hub card, with Claude proactively suggesting help when it detects confusion
**Depends on:** Phase 18
**Requirements**: HELP-01, HELP-02, HELP-03, HELP-04, HELP-05
**Plans:** 2 plans

Plans:
- [x] 19-01-PLAN.md -- /help command handler, system prompt HELP block, bot wiring
- [x] 19-02-PLAN.md -- Mini App help page with admin detection, Hub card, /api/me endpoint

</details>

### v1.3 AI Polish & UX

**Milestone Goal:** Make Sous smarter and more natural through implicit behavior detection, fix UX rough edges from real usage, and improve the onboarding recipe seeding flow.

- [x] **Phase 20: Bug Fixes** - Investigate and fix date bugs in meal plans and prep time in cooking reminders (completed 2026-02-19)
- [x] **Phase 21: Implicit AI Behaviors** - Sous proactively recognizes recipes, preferences, and pantry context without explicit commands (completed 2026-02-19)
- [x] **Phase 22: Recipe Variations & Grocery Intelligence** - Handle recipe modifications gracefully and factor store preferences into grocery lists (completed 2026-02-19)
- [ ] **Phase 23: Mini App Enhancements** - Delete recipe cards and filter by tag in the Mini App
- [ ] **Phase 24: Onboarding Refinement** - Push new users to add their existing go-to meals before first meal plan

## Phase Details

### Phase 20: Bug Fixes
**Goal**: Known date and timing bugs in meal plans and cooking reminders are resolved so users get correct dates and properly timed reminders
**Depends on**: Phase 19 (v1.2 complete)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Meal plans consistently show correct dates and day-of-week mappings regardless of timezone or time of day when generated
  2. Start cooking reminders fire early enough to account for prep time (e.g., a recipe with 30min prep and 60min cook triggers 90min before dinner, not 60min)
  3. Date context in Claude's system prompt accurately reflects the current date in the user's timezone
**Plans**: 2 plans

Plans:
- [x] 20-01-PLAN.md -- Add current date context to system prompt, make date utilities and week boundaries timezone-aware
- [x] 20-02-PLAN.md -- Parse recipe prep/cook times and adjust start_cooking reminder timing to fire early enough

### Phase 21: Implicit AI Behaviors
**Goal**: Sous proactively recognizes recipe content, preference statements, and pantry mentions in natural conversation and acts on them without requiring explicit commands
**Depends on**: Phase 20
**Requirements**: AIBH-01, AIBH-02, AIBH-03
**Success Criteria** (what must be TRUE):
  1. When a user shares a recipe (ingredients + steps) in conversation, Sous offers to save it as a recipe card without the user saying "save this recipe"
  2. When a user mentions a dietary preference or food opinion ("I don't eat pork", "we love Thai food"), Sous saves it and confirms briefly without derailing conversation
  3. When a user mentions pantry/ingredients, Sous responds with actionable next steps including a Mini App grocery list link, not a dead-end acknowledgment
  4. Existing explicit recipe save and preference commands continue to work unchanged
**Plans**: 2 plans

Plans:
- [x] 21-01-PLAN.md -- System prompt updates for implicit recipe detection and preference capture
- [x] 21-02-PLAN.md -- Pantry check response enhancement with Mini App grocery list deep link

### Phase 22: Recipe Variations & Grocery Intelligence
**Goal**: Sous handles recipe modification requests gracefully and generates grocery lists that reflect the user's store preferences
**Depends on**: Phase 21
**Requirements**: AIBH-04, GROC-01, GROC-02
**Success Criteria** (what must be TRUE):
  1. When a user asks to modify a recipe ("make it spicier", "swap chicken for tofu"), Sous either updates the existing card or creates a linked variation, confirming which action it took
  2. User's grocery store preferences (primary store, bulk store) are saved and used to group or annotate grocery list items
  3. Grocery list messages no longer display a "Done shopping" button
  4. Recipe variation cards reference their parent recipe so the user can see the relationship
**Plans**: 2 plans

Plans:
- [x] 22-01-PLAN.md -- Recipe variation handling: system prompt instructions for in-place modification and inline substitution notes
- [x] 22-02-PLAN.md -- Grocery store preference pipeline wiring, Mini App Done Shopping button moved to overflow menu with confirmation

### Phase 23: Mini App Enhancements
**Goal**: Users can manage recipe cards and discover recipes more easily through delete functionality and tag-based filtering in the Mini App
**Depends on**: Phase 20 (no dependency on Phase 21/22 -- can be parallelized)
**Requirements**: MINI-01, MINI-02
**Success Criteria** (what must be TRUE):
  1. User can tap a delete button on a recipe card detail view, confirm via dialog, and the recipe is permanently removed
  2. User can tap any tag on a recipe card to filter the recipe list to only recipes with that tag
  3. Tag filter is clearable -- user can return to the full recipe list after filtering
  4. Deleted recipes no longer appear in search results, meal plan suggestions, or the recipe browser
**Plans**: TBD

Plans:
- [ ] 23-01: Recipe deletion API endpoint and Mini App detail view delete button with confirmation
- [ ] 23-02: Tag click filtering in recipe browser with clear filter capability

### Phase 24: Onboarding Refinement
**Goal**: New users are directed to add their existing go-to meals early in onboarding so their first meal plan is built from real recipes they already cook
**Depends on**: Phase 21 (benefits from implicit recipe detection)
**Requirements**: ONBR-01
**Success Criteria** (what must be TRUE):
  1. Onboarding flow explicitly prompts the user to share 3-5 of their regular go-to meals before moving to meal plan generation
  2. The prompt is encouraging and specific (not just "tell me some recipes" but "what did you cook last week?" or "what are your household's regular rotation meals?")
  3. Users who add recipes during onboarding get a first meal plan that includes those recipes
**Plans**: TBD

Plans:
- [ ] 24-01: Onboarding flow updates to prioritize existing recipe seeding

## Progress

**Execution Order:** 1 -> 10 (v1.0) -> 11 -> 14 (v1.1) -> 15 -> 19 (v1.2) -> 20 -> 24 (v1.3)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. MVP Phases | v1.0 | 30/30 | Complete | 2026-02-09 |
| 11. Mini App Foundation | v1.1 | 3/3 | Complete | 2026-02-10 |
| 12. Grocery List | v1.1 | 3/3 | Complete | 2026-02-10 |
| 13. Recipe Browser | v1.1 | 2/2 | Complete | 2026-02-10 |
| 14. Meal Plan Viewer | v1.1 | 2/2 | Complete | 2026-02-10 |
| 15. Users, Households, and Invites | v1.2 | 2/2 | Complete | 2026-02-11 |
| 16. Household Data Migration | v1.2 | 2/2 | Complete | 2026-02-11 |
| 17. Guided Onboarding | v1.2 | 2/2 | Complete | 2026-02-11 |
| 18. App Feedback | v1.2 | 2/2 | Complete | 2026-02-11 |
| 19. User Help Functionality | v1.2 | 2/2 | Complete | 2026-02-11 |
| 20. Bug Fixes | v1.3 | 2/2 | Complete | 2026-02-18 |
| 21. Implicit AI Behaviors | v1.3 | 2/2 | Complete | 2026-02-19 |
| 22. Recipe Variations & Grocery Intelligence | v1.3 | 2/2 | Complete | 2026-02-19 |
| 23. Mini App Enhancements | v1.3 | 0/2 | Not started | - |
| 24. Onboarding Refinement | v1.3 | 0/1 | Not started | - |
