# Requirements: HeySous v1.3 AI Polish & UX

**Defined:** 2026-02-19
**Core Value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

## v1.3 Requirements

Requirements for making Sous smarter, fixing UX rough edges, and refining the onboarding flow based on real usage feedback.

### AI Behavior

- [ ] **AIBH-01**: Sous recognizes recipe-like content (ingredients + steps) and offers to save it as a recipe card without requiring explicit "save this recipe" language
- [ ] **AIBH-02**: Sous detects preference statements in natural conversation ("I don't eat pork", "we love spicy food") and saves them with a brief confirmation
- [ ] **AIBH-03**: When mentioning pantry/ingredients, Sous includes Mini App grocery list link and/or offers conversational pantry walk-through instead of dead-end response
- [ ] **AIBH-04**: Sous handles recipe variation requests ("make it spicier", "swap chicken for tofu") gracefully — modify existing card or create linked variation

### Grocery

- [ ] **GROC-01**: Sous saves grocery store preferences and factors them into list generation (store-specific grouping, availability awareness)
- [ ] **GROC-02**: "Done shopping" button removed from grocery list messages entirely

### Mini App

- [ ] **MINI-01**: User can delete a recipe card from the Mini App detail view with confirmation dialog and API endpoint
- [ ] **MINI-02**: User can tap a tag on a recipe card to filter the recipe list by that tag

### Fixes

- [ ] **FIX-01**: Intermittent date bugs in meal plans investigated and resolved (timezone, day-of-week mapping, or system prompt date context)
- [ ] **FIX-02**: Start cooking reminder accounts for prep time, not just cook time

### Onboarding

- [ ] **ONBR-01**: Onboarding flow actively pushes users to add their existing go-to meals first, making the first meal plan recipe-driven rather than open-ended

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: Bot proactively messages users with friendly update announcements after meaningful deploys

### Infrastructure

- **INFR-01**: Lightweight data migration framework (numbered scripts, idempotent, tracks which have run)

### New Capabilities

- **CAPS-01**: Web search tool for fetching and parsing recipes from URLs
- **CAPS-02**: Image analysis for extracting recipes from photos (cookbook pages, screenshots)

## Out of Scope

| Feature | Reason |
|---------|--------|
| URL recipe import (automated) | Deferred to future milestone as CAPS-01 |
| Photo recipe capture | Deferred to future milestone as CAPS-02 |
| Bot update notifications | Deferred to future milestone as NOTF-01 |
| Data migration framework | Deferred to future milestone as INFR-01 |
| Voice interaction / cooking mode | Future capability |
| Monetization / paid features | Personal dogfooding first |
| Nutritional tracking | Changes product from cooking partner to diet app |
| Recipe catalog / discovery | This is YOUR recipes, not a browsable catalog |
| Grocery delivery integration | User shops in-person |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIBH-01 | — | Pending |
| AIBH-02 | — | Pending |
| AIBH-03 | — | Pending |
| AIBH-04 | — | Pending |
| GROC-01 | — | Pending |
| GROC-02 | — | Pending |
| MINI-01 | — | Pending |
| MINI-02 | — | Pending |
| FIX-01 | — | Pending |
| FIX-02 | — | Pending |
| ONBR-01 | — | Pending |

**Coverage:**
- v1.3 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after initial definition*
