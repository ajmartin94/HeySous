# Project Milestones: HeySous

## v1.0 MVP (Shipped: 2026-02-09)

**Delivered:** A conversational AI meal planning assistant on Telegram powered by Claude, with recipe management, weekly planning, grocery lists, reminders, and a feedback loop.

**Phases completed:** 1-10 (30 plans total)

**Key accomplishments:**
- Agent-first architecture with Claude as reasoning engine over FTS5 knowledge store
- Full conversational recipe management with rich text storage and retrieval
- Weekly meal planning with cooking history tracking and preference-aware generation
- Smart grocery lists with ingredient aggregation, store splitting (Kroger/Costco), and inline Telegram buttons
- Proactive reminders (morning prep summaries, time-aware alerts) that survive restarts
- Post-meal feedback loop that annotates recipes and improves future planning

**Stats:**
- 184 files created/modified
- 8,263 lines of TypeScript
- 10 phases, 30 plans
- 5 days from start to ship (2026-02-05 to 2026-02-09)

**Git range:** `098afd0` (Initial commit) → `df2adce` (complete UAT)

**What's next:** v1.1 Mini Apps

---

## v1.1 Mini Apps (Shipped: 2026-02-10)

**Delivered:** Telegram Mini App visual UIs for grocery shopping, recipe browsing, and weekly meal plan viewing — hybrid model with bot as primary conversational interface and Mini Apps for visual interactions.

**Phases completed:** 11-14 (10 plans total)

**Key accomplishments:**
- Mini App infrastructure with initData HMAC-SHA256 auth, React+Vite SPA, and hub dashboard with live data cards
- Grocery shopping UI with store tabs, aisle-ordered sections, haptic check-off with animation, quick-add FAB, and 8s polling sync
- Recipe browser with FTS5 full-text search, tag filtering, sort options, parsed recipe detail, and scroll preservation
- Weekly meal plan viewer with 7-day grid, swipe week navigation, today highlighting, and recipe drill-down
- Bot integration with inline webApp buttons for deep-linking and BotFather menu button

**Stats:**
- 57 files created/modified
- 3,875 lines of Mini App code (12,726 total project LOC)
- 4 phases, 10 plans
- 1 day execution (2026-02-10), UAT: 20/20 tests passing

**Git range:** `0e5938a` (Phase 11 context) → `97ee0cc` (UAT checkpoint)

**What's next:** Planning next milestone.

---

## v1.2 Onboarding and Feedback (Shipped: 2026-02-11)

**Delivered:** Multi-user household support with invite-gated access, guided onboarding, app feedback system, and user help functionality.

**Phases completed:** 15-19 (10 plans total)

**Key accomplishments:**
- Invite-gated access system with deep link tokens and admin-only /invite command
- Multi-user support with per-user identity and household data sharing (recipes, plans, grocery lists)
- Guided onboarding flow (preference Q&A, feature tour, seed recipe collection) via state machine
- App feedback system with four channels (command, implicit AI detection, Mini App form, proactive prompt)
- User help functionality (/help command, Mini App help page with admin detection)

**Stats:**
- 10 phases, 10 plans
- 5 phases (15-19)
- 1 day execution (2026-02-11)

**Git range:** Phase 15 → Phase 19

**What's next:** v1.3 AI Polish & UX

---

## v1.3 AI Polish & UX (Shipped: 2026-02-19)

**Delivered:** Smarter implicit AI behaviors (recipe detection, preference capture, pantry response), recipe variation handling, grocery store awareness, Mini App recipe deletion, bug fixes, and directive onboarding recipe seeding.

**Phases completed:** 20-24 (9 plans total)

**Key accomplishments:**
- Timezone-aware date pipeline fixing intermittent meal plan date bugs and recipe-aware reminder timing
- Implicit AI behaviors: Sous proactively detects recipes, preferences, and pantry context in natural conversation
- Recipe variation handling with in-place modifications and inline substitution notes
- Grocery store preference pipeline wired into list generation; Done Shopping replaced with overflow menu
- Full-stack recipe deletion in Mini App with cascading cleanup and confirmation dialog
- Directive onboarding recipe prompting (3-5 go-to meals target with first meal plan offer)

**Stats:**
- 23 files modified
- 912 insertions, 91 deletions (~22,650 total LOC)
- 5 phases, 9 plans
- 1 day execution (2026-02-18), ~23 minutes total
- Execution time: ~23 min across 9 plans

**Git range:** `aa117ed` (feat(20-01)) → `c9d6780` (feat(22-03))

**What's next:** Planning next milestone

---


## v1.4 Backlog Sweep (Shipped: 2026-02-21)

**Delivered:** Recipe import capabilities (URL + photo), knowledge dedup, Sous-personality notification tone, update notifications, and a data migration framework — clearing the accumulated backlog.

**Phases completed:** 25-31 (7 plans total)

**Key accomplishments:**
- Data migration framework with PRAGMA user_version — forward-only runner integrated into database init
- Knowledge dedup with FTS5+BM25 duplicate detection, user-driven resolution (never auto-merges)
- Sous personality everywhere — centralized message module with randomized variants replaces all inline strings
- Recipe URL import via 3-strategy extraction pipeline (JSON-LD → Microdata → Claude fallback) with confirmation
- Recipe photo import via Claude vision through the message pipeline — snap a cookbook page and Sous extracts it
- Lazy-delivery "what's new" update notifications tracked per household

**Stats:**
- 36 files modified
- 2,752 insertions, 101 deletions (~13,177 total LOC)
- 7 phases, 7 plans
- 2 days execution (2026-02-19 → 2026-02-20), ~19 minutes total

**Git range:** `8d6cb49` (feat(25-01)) → `1473405` (fix(31-01))

**What's next:** Planning next milestone

---

