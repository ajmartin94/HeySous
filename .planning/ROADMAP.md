# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [ ] **v1.1 Mini Apps** - Phases 11-14 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-10) - SHIPPED 2026-02-09</summary>

See .planning/milestones/v1.0-archive.md for full phase history.
30 plans completed across 10 phases. 8,263 LOC TypeScript.

</details>

### v1.1 Mini Apps (In Progress)

**Milestone Goal:** Add Telegram Mini App visual UIs for grocery lists, recipe browsing, and meal plans while keeping the bot as the primary conversational interface.

- [ ] **Phase 11: Mini App Foundation** - Auth, React scaffold, Express integration, iOS platform fixes
- [ ] **Phase 12: Grocery List** - Checkable shopping list with store tabs, sections, progress tracking
- [ ] **Phase 13: Recipe Browser** - Searchable recipe cards with full detail view
- [ ] **Phase 14: Meal Plan Viewer** - Weekly grid with recipe drill-down

## Phase Details

### Phase 11: Mini App Foundation
**Goal**: User can open a working Mini App from the bot that authenticates securely and renders correctly on iOS
**Depends on**: v1.0 (shipped)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. User taps an inline keyboard button in bot chat and a Mini App opens in Telegram WebView
  2. API requests without valid initData receive 401; requests with valid initData receive data
  3. Mini App renders at full viewport on iOS without closing when user swipes down at top of page
  4. Mini App colors match Telegram's current theme (light or dark) without manual configuration
  5. BotFather menu button opens the Mini App directly from the chat header
**Plans:** 3 plans

Plans:
- [ ] 11-01-PLAN.md -- Backend infrastructure: auth middleware, API router, Express static serving
- [ ] 11-02-PLAN.md -- Frontend SPA: Vite scaffold, SDK init, theme, hub page, routing
- [ ] 11-03-PLAN.md -- Bot integration: inline keyboard buttons, menu button, build pipeline

### Phase 12: Grocery List
**Goal**: User can shop from a visual grocery list that stays in sync with the bot
**Depends on**: Phase 11
**Requirements**: GROC-01, GROC-02, GROC-03, GROC-04, GROC-05, GROC-06, GROC-07, GROC-08, GROC-09, GROC-10
**Success Criteria** (what must be TRUE):
  1. User sees their grocery items organized by store (Kroger/Costco tabs) and by section (Produce, Dairy, etc.) within each tab, with quantities shown
  2. User taps an item to check it off with haptic feedback, sees it move to a collapsed "Done" section, and sees the progress count update (e.g., "12/28 items")
  3. User can uncheck a done item (swipe or tap) to restore it to the active list
  4. User taps "Done Shopping" (MainButton) to complete the trip, or BackButton to return to chat
  5. User adds a forgotten item via quick-add form without leaving the Mini App, and items added by the bot appear in the Mini App within seconds
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD
- [ ] 12-03: TBD

### Phase 13: Recipe Browser
**Goal**: User can browse, search, and read their full recipe collection visually
**Depends on**: Phase 11
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04, RECIPE-05, RECIPE-06, RECIPE-07
**Success Criteria** (what must be TRUE):
  1. User sees all stored recipes as scrollable cards showing title, summary snippet, tag pills, and last-cooked date
  2. User types in the search bar and results filter in real-time via FTS5 full-text search
  3. User taps a recipe card and sees full recipe detail (ingredients, instructions, notes), then taps BackButton to return to the list with scroll position preserved
  4. User taps a tag pill to filter the list to only recipes with that tag
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

### Phase 14: Meal Plan Viewer
**Goal**: User can see the week's meal plan at a glance and drill into any recipe
**Depends on**: Phase 11, Phase 13 (reuses RecipeDetail component)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. User sees a 7-day grid (Monday-Sunday) with recipe names, today's date highlighted, and meal type rows that adapt to content (single row for dinner-only, multiple rows for multi-meal days)
  2. User toggles between current week and next week to see both plans
  3. User taps a meal name to see the full recipe detail (reusing RecipeDetail from Phase 13)
  4. Meal types are visually distinguished by color or icon (breakfast/lunch/dinner)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

## Progress

**Execution Order:** 11 -> 12 -> 13 -> 14 (Phase 13 and 14 are sequential due to RecipeDetail dependency)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Mini App Foundation | v1.1 | 0/3 | Planned | - |
| 12. Grocery List | v1.1 | 0/TBD | Not started | - |
| 13. Recipe Browser | v1.1 | 0/TBD | Not started | - |
| 14. Meal Plan Viewer | v1.1 | 0/TBD | Not started | - |
