# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [x] **v1.2 Onboarding and Feedback** - Phases 15-19 (shipped 2026-02-11)
- [x] **v1.3 AI Polish & UX** - Phases 20-24 (shipped 2026-02-19)
- [ ] **v1.4 Backlog Sweep** - Phases 25-30 (in progress)

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

### v1.4 Backlog Sweep (In Progress)

**Milestone Goal:** Clear the accumulated todo backlog -- fix knowledge duplication bugs, add recipe import (URL + photo), improve notification personality, add update notifications, and establish a data migration framework.

- [x] **Phase 25: Data Migration Framework** - Lightweight migration runner using PRAGMA user_version, integrated into database init (completed 2026-02-20)
- [x] **Phase 26: Knowledge Dedup** - save_knowledge checks for duplicates and lets Claude + user decide; update_knowledge validates inputs (completed 2026-02-20)
- [x] **Phase 27: Notification Tone Overhaul** - Centralized message module with Sous personality and randomized variation across all bot-initiated messages (completed 2026-02-20)
- [ ] **Phase 28: Recipe URL Import** - Extract recipes from URLs via JSON-LD/Microdata/Claude fallback, with confirmation and edge case handling
- [ ] **Phase 29: Recipe Photo Import** - Extract recipes from photos via Claude vision through the message pipeline
- [ ] **Phase 30: Update Notifications** - Lazy-delivery "what's new" notifications tracked per household

## Phase Details

### Phase 25: Data Migration Framework
**Goal**: Database schema changes are safe, tracked, and automated -- no more ad-hoc migration functions
**Depends on**: Nothing (foundation phase)
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04
**Success Criteria** (what must be TRUE):
  1. A new migration file added to `src/db/migrations/` runs automatically on next server start without manual intervention
  2. Running the server twice with the same migrations does not error or re-apply changes (idempotent)
  3. The existing database with household migration already applied works without issues after the framework is added
  4. PRAGMA user_version reflects which migrations have run and can be inspected via SQLite CLI
**Plans**: 1 plan

Plans:
- [ ] 25-01-PLAN.md -- Migration runner with PRAGMA user_version, tests, and createDatabase integration

### Phase 26: Knowledge Dedup
**Goal**: Users never accidentally create duplicate recipes -- Sous finds existing matches and asks what to do
**Depends on**: Phase 25
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04
**Success Criteria** (what must be TRUE):
  1. When a user tells Sous about a recipe that already exists, Sous says "I already have something similar" and asks whether to update or create new
  2. Sous never auto-merges or silently overwrites an existing recipe -- the user always decides
  3. Calling update_knowledge with no actual content changes returns an error message to Claude instead of silently succeeding
  4. Dedup detection works for both recipes and preferences (e.g., duplicate "no cilantro" preferences are caught too)
**Plans**: 1 plan

Plans:
- [x] 26-01-PLAN.md -- Dedup check in save_knowledge, update_knowledge validation, system prompt instructions, tests

### Phase 27: Notification Tone Overhaul
**Goal**: Every bot-initiated message sounds like Sous the cooking partner, not a generic system notification
**Depends on**: Nothing (independent)
**Requirements**: TONE-01, TONE-02, TONE-03
**Success Criteria** (what must be TRUE):
  1. Error messages, timeout messages, and access gate messages read as conversational Sous personality (no "Error:", no "Access denied")
  2. Receiving the same type of notification multiple times produces varied phrasing (not identical text each time)
  3. All bot-initiated messages import from a single centralized message module rather than having inline string literals scattered across handlers
**Plans**: 1 plan

Plans:
- [x] 27-01-PLAN.md -- Centralized message module with Sous-personality variants, migrate all handlers

### Phase 28: Recipe URL Import
**Goal**: Users can share a recipe link and Sous extracts, presents, and saves it -- the most-requested missing capability
**Depends on**: Phase 26
**Requirements**: IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06
**Success Criteria** (what must be TRUE):
  1. User sends a recipe URL (e.g., AllRecipes, Serious Eats) and Sous extracts the recipe title, ingredients, and instructions within 15 seconds
  2. Sous shows the extracted recipe to the user and waits for confirmation before saving to knowledge
  3. When a URL is shared mid-conversation (not as a standalone message), Sous detects it and offers to import
  4. Saved imported recipes retain their source URL on the knowledge item for future reference
  5. Paywalled sites, non-recipe URLs, unreachable sites, and other failures produce helpful messages suggesting alternatives (paste the text, send a photo)
**Plans**: TBD

Plans:
- [ ] 28-01: TBD

### Phase 29: Recipe Photo Import
**Goal**: Users can snap a photo of a cookbook page or handwritten recipe and Sous extracts it
**Depends on**: Phase 28
**Requirements**: IMPORT-02
**Success Criteria** (what must be TRUE):
  1. User sends a photo of a printed or handwritten recipe and Sous extracts the recipe content (title, ingredients, instructions)
  2. Sous shows the extracted recipe for confirmation before saving (reuses the confirmation flow from Phase 28)
  3. Blurry or unreadable photos produce a helpful message asking for a clearer photo rather than saving garbage data
  4. Sending a non-recipe photo (e.g., a sunset) does not trigger recipe extraction -- Sous responds normally
**Plans**: TBD

Plans:
- [ ] 29-01: TBD

### Phase 30: Update Notifications
**Goal**: Users learn about new bot capabilities naturally through conversational "what's new" messages on their next interaction
**Depends on**: Phase 25, Phase 27
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. After an update is deployed, the next time a user sends a message they see a "what's new" notification before Sous responds to their message
  2. Each household sees the notification exactly once -- subsequent messages do not re-trigger it
  3. The notification reads as conversational Sous voice (e.g., "Hey! I learned a new trick...") not a generic changelog
**Plans**: TBD

Plans:
- [ ] 30-01: TBD

## Progress

**Execution Order:** 1 -> 10 (v1.0) -> 11 -> 14 (v1.1) -> 15 -> 19 (v1.2) -> 20 -> 24 (v1.3) -> 25 -> 30 (v1.4)

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
| 22. Recipe Variations & Grocery Intelligence | v1.3 | 3/3 | Complete | 2026-02-19 |
| 23. Mini App Enhancements | v1.3 | 1/1 | Complete | 2026-02-19 |
| 24. Onboarding Refinement | v1.3 | 1/1 | Complete | 2026-02-19 |
| 25. Data Migration Framework | 1/1 | Complete    | 2026-02-20 | - |
| 26. Knowledge Dedup | v1.4 | 1/1 | Complete | 2026-02-20 |
| 27. Notification Tone Overhaul | v1.4 | 1/1 | Complete | 2026-02-20 |
| 28. Recipe URL Import | v1.4 | 0/? | Not started | - |
| 29. Recipe Photo Import | v1.4 | 0/? | Not started | - |
| 30. Update Notifications | v1.4 | 0/? | Not started | - |
