# Roadmap: HeySous

## Milestones

- [x] **v1.0 MVP** - Phases 1-10 (shipped 2026-02-09)
- [x] **v1.1 Mini Apps** - Phases 11-14 (shipped 2026-02-10)
- [ ] **v1.2 Onboarding and Feedback** - Phases 15-18 (in progress)

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

### v1.2 Onboarding and Feedback

**Milestone Goal:** Enable multi-user access with gated invitations, guided onboarding for new users, full household sharing, and an app feedback system.

- [x] **Phase 15: Users, Households, and Invites** - Multi-user identity with invite-gated access (completed 2026-02-11)
- [ ] **Phase 16: Household Data Migration** - Migrate all data paths from chatId to householdId for shared data
- [ ] **Phase 17: Guided Onboarding** - Claude-driven first-run experience for new users
- [ ] **Phase 18: App Feedback** - Feedback collection, sentiment scoring, and admin dashboard

## Phase Details

### Phase 15: Users, Households, and Invites
**Goal**: New users can join the bot only via invite link, and every user has a persistent identity within a household
**Depends on**: Phase 14 (v1.1 complete)
**Requirements**: INVITE-01, INVITE-02, INVITE-03, INVITE-04, INVITE-05, INVITE-06, USER-01, USER-02, USER-03
**Success Criteria** (what must be TRUE):
  1. Admin can run `/invite` to generate a single-use deep link URL, choosing household or independent type
  2. A new user clicking an invite link is registered with their Telegram identity, assigned to the correct household, and greeted
  3. A new user clicking an expired or already-used invite link sees a friendly rejection and cannot use the bot
  4. A non-invited user sending any message is blocked from all bot features and told to get an invite
  5. The existing single user is seeded into the users table as admin with a household-of-one, and all current functionality continues to work
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md -- Data foundation: users, households, invites modules with types, schemas, init, and repositories
- [x] 15-02-PLAN.md -- Bot integration: access gate, /start deep link handling, /invite command, wiring

### Phase 16: Household Data Migration
**Goal**: All household members share the same recipes, meal plans, grocery lists, and cooking history -- and Claude knows who it is talking to
**Depends on**: Phase 15
**Requirements**: HOUSE-01, HOUSE-02, HOUSE-03, HOUSE-04, HOUSE-05, HOUSE-06, USER-04
**Success Criteria** (what must be TRUE):
  1. A second household member can search and view all recipes added by the first member, and add new recipes visible to both
  2. Any household member can create or modify the weekly meal plan, and all members see the same plan
  3. Any household member can view and check off grocery list items, and changes are visible to all members
  4. Claude's system prompt includes the current user's name and household context, referencing shared cooking history as "we"
  5. Existing single-user data is fully preserved -- zero recipes, plans, or grocery items lost after migration
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD
- [ ] 16-03: TBD

### Phase 17: Guided Onboarding
**Goal**: New users are guided through a conversational first-run experience that captures preferences, demonstrates capabilities, and seeds initial recipes
**Depends on**: Phase 16
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07, ONBD-08, ONBD-09
**Success Criteria** (what must be TRUE):
  1. A new user who redeems an invite immediately receives a warm welcome and enters a conversational preference Q&A covering dietary restrictions, dinner time, stores, and comfort level
  2. After preferences, the user sees a capability tour showing what the bot can do, then is prompted to teach it 3-5 recipes
  3. A user can type "skip" at any point during onboarding and immediately use the bot with default settings
  4. A user joining an existing household gets abbreviated onboarding (personal preferences only) and immediately sees the household's existing recipes and plans
  5. Onboarding state survives bot restarts, and the bot progressively learns remaining preferences from regular conversation after initial setup
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD
- [ ] 17-03: TBD

### Phase 18: App Feedback
**Goal**: Users can share feedback about the bot experience, and the admin can review all collected feedback with categorization and sentiment
**Depends on**: Phase 15 (needs user identity; does not depend on Phase 16/17)
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08
**Success Criteria** (what must be TRUE):
  1. A user can run `/feedback great grocery list but meal plans need more variety` and receive a warm acknowledgment that their feedback was saved
  2. Claude silently detects app-related sentiment during regular conversation and logs it as implicit feedback without interrupting the user
  3. The Mini App hub includes a "Give Feedback" button that opens a text input, and submitted feedback is saved
  4. The bot proactively asks "how am I doing?" every 2 weeks, and the user's response is captured as feedback
  5. Admin can view all feedback filtered by category and sentiment via command or Mini App dashboard
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD

## Progress

**Execution Order:** 1 -> 10 (v1.0) -> 11 -> 14 (v1.1) -> 15 -> 18 (v1.2)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. MVP Phases | v1.0 | 30/30 | Complete | 2026-02-09 |
| 11. Mini App Foundation | v1.1 | 3/3 | Complete | 2026-02-10 |
| 12. Grocery List | v1.1 | 3/3 | Complete | 2026-02-10 |
| 13. Recipe Browser | v1.1 | 2/2 | Complete | 2026-02-10 |
| 14. Meal Plan Viewer | v1.1 | 2/2 | Complete | 2026-02-10 |
| 15. Users, Households, and Invites | v1.2 | 2/2 | Complete | 2026-02-11 |
| 16. Household Data Migration | v1.2 | 0/TBD | Not started | - |
| 17. Guided Onboarding | v1.2 | 0/TBD | Not started | - |
| 18. App Feedback | v1.2 | 0/TBD | Not started | - |
