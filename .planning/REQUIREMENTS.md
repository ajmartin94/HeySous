# Requirements: HeySous v1.1 Mini Apps

## Infrastructure

- [ ] **INFRA-01**: User can open Mini Apps from the bot via inline keyboard buttons that launch Telegram WebView
- [ ] **INFRA-02**: Server validates every Mini App API request using initData HMAC-SHA256 with 1-hour expiration, rejecting unauthorized requests with 401
- [ ] **INFRA-03**: Mini App frontend is a React+Vite SPA served as static files from the existing Express server at /app/*
- [ ] **INFRA-04**: REST API routes at /api/* reuse existing repository functions (groceryRepository, planRepository, knowledgeRepository) via the same DI pattern
- [ ] **INFRA-05**: Mini App SDK initializes correctly on iOS: disableVerticalSwipes, expand to full viewport, safe area insets handled via contentSafeAreaInset
- [ ] **INFRA-06**: Mini App theme matches Telegram's light/dark mode via CSS variables (--tg-theme-*) and @telegram-apps/telegram-ui components
- [ ] **INFRA-07**: BotFather menu button is configured to open the primary Mini App URL

## Grocery List Mini App

- [ ] **GROC-01**: User can view their active grocery list with items grouped by store (Kroger/Costco) via tab navigation
- [ ] **GROC-02**: User can see items grouped by section (Produce, Dairy, etc.) within each store tab
- [ ] **GROC-03**: User can tap an item to check/uncheck it with haptic feedback and optimistic UI update
- [ ] **GROC-04**: User can see checked items in a collapsed "Done" section at the bottom of each store tab
- [ ] **GROC-05**: User can see shopping progress as a count indicator (e.g., "12/28 items") per store and overall
- [ ] **GROC-06**: User can see item quantities displayed alongside names (e.g., "2 lbs chicken thighs")
- [ ] **GROC-07**: User can tap Telegram's MainButton ("Done Shopping") to mark the shopping trip complete
- [ ] **GROC-08**: User can tap Telegram's BackButton to return to the chat from the grocery list
- [ ] **GROC-09**: User can swipe an item to uncheck it from the Done section
- [ ] **GROC-10**: User can add a forgotten item to the grocery list without returning to chat via a quick-add form

## Recipe Browser Mini App

- [ ] **RECIPE-01**: User can browse all stored recipes as a scrollable card list showing title, summary snippet, and tags
- [ ] **RECIPE-02**: User can search recipes by typing in a search bar with debounced FTS5 full-text search
- [ ] **RECIPE-03**: User can tap a recipe card to view the full recipe detail (ingredients, instructions, notes)
- [ ] **RECIPE-04**: User can see tag pills on each recipe card for quick visual scanning
- [ ] **RECIPE-05**: User can navigate back from recipe detail to the card list using Telegram's BackButton, with scroll position preserved
- [ ] **RECIPE-06**: User can tap a tag to filter the recipe list to only recipes with that tag
- [ ] **RECIPE-07**: User can see the "last cooked" date on each recipe card showing when the dish was last made

## Meal Plan Mini App

- [ ] **PLAN-01**: User can view the current week's meal plan as a 7-day grid (Monday-Sunday) with recipe names in each cell
- [ ] **PLAN-02**: User can see meal type rows that adapt to content (dinner-only shows single row, multi-meal shows breakfast/lunch/dinner rows)
- [ ] **PLAN-03**: User can see today's date highlighted in the grid for quick orientation
- [ ] **PLAN-04**: User can toggle between current week and next week plans
- [ ] **PLAN-05**: User can tap a meal name to see the linked recipe detail (reusing RecipeDetail component)
- [ ] **PLAN-06**: User can see visual meal type indicators (color-coded or icon-based) for breakfast/lunch/dinner

## Future Requirements (Deferred)

- [ ] Recipe: "Add to plan" button from browser (complex day/meal-type picker UI) -- v2+
- [ ] Grocery: item reordering within section (drag-drop unreliable in WebView) -- v2+
- [ ] Shared Mini App shell with bottom tab navigation -- v2+
- [ ] Recipe editing in Mini App (conversational edit is faster) -- v2+
- [ ] Real-time collaborative editing (single-user product) -- v2+

## Out of Scope

- Nutritional info on recipe cards -- explicitly an anti-feature (unreliable AI estimates erode trust)
- Offline grocery list -- Telegram WebView has no offline guarantee; optimistic UI + server-first is sufficient
- Drag-and-drop meal rearrangement -- unreliable in WebView, conversational swap via bot is better
- Push notifications from Mini App -- bot handles all notifications; Mini Apps are view+interact only
- Image/photo display for recipes -- no images in data model; text-only cards are sufficient for v1.1

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 11 | Pending |
| INFRA-02 | Phase 11 | Pending |
| INFRA-03 | Phase 11 | Pending |
| INFRA-04 | Phase 11 | Pending |
| INFRA-05 | Phase 11 | Pending |
| INFRA-06 | Phase 11 | Pending |
| INFRA-07 | Phase 11 | Pending |
| GROC-01 | Phase 12 | Pending |
| GROC-02 | Phase 12 | Pending |
| GROC-03 | Phase 12 | Pending |
| GROC-04 | Phase 12 | Pending |
| GROC-05 | Phase 12 | Pending |
| GROC-06 | Phase 12 | Pending |
| GROC-07 | Phase 12 | Pending |
| GROC-08 | Phase 12 | Pending |
| GROC-09 | Phase 12 | Pending |
| GROC-10 | Phase 12 | Pending |
| RECIPE-01 | Phase 13 | Pending |
| RECIPE-02 | Phase 13 | Pending |
| RECIPE-03 | Phase 13 | Pending |
| RECIPE-04 | Phase 13 | Pending |
| RECIPE-05 | Phase 13 | Pending |
| RECIPE-06 | Phase 13 | Pending |
| RECIPE-07 | Phase 13 | Pending |
| PLAN-01 | Phase 14 | Pending |
| PLAN-02 | Phase 14 | Pending |
| PLAN-03 | Phase 14 | Pending |
| PLAN-04 | Phase 14 | Pending |
| PLAN-05 | Phase 14 | Pending |
| PLAN-06 | Phase 14 | Pending |
