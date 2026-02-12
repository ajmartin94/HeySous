# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** v1.2 Onboarding and Feedback -- Phase 19 complete

## Current Position

Phase: 19 of 19 (User Help Functionality)
Plan: 2 of 2 complete
Status: Phase Complete
Last activity: 2026-02-11 -- Completed 19-02 Mini App Help Page

Progress: [██████████] 100%

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 30
- Average duration: 2.8 min
- Total execution time: 83 min

**v1.1 Velocity:**
- Total plans completed: 10
- Average duration: 6 min
- Total execution time: 55 min

**v1.2 Velocity:**
- 15-01: 4 min (2 tasks, 12 files)
- 15-02: 3 min (3 tasks, 6 files)
- 16-01: 10 min (2 tasks, 25 files)
- 16-02: 8 min (2 tasks, 22 files)
- 17-01: 4 min (2 tasks, 6 files)
- 17-02: 12 min (2 tasks, 5 files)
- 18-01: 4 min (2 tasks, 11 files)
- 18-02: 3 min (2 tasks, 5 files)
- 19-01: 2 min (2 tasks, 4 files)
- 19-02: 3 min (2 tasks, 6 files)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v1.0 and v1.1 decisions documented with outcomes.

**Phase 15-01:**
- Admin household_id = admin telegram_id (Phase 16 chatId migration compatibility)
- Repository uses standalone function exports (not factory), takes sqlite as first param
- Invite tokens: crypto.randomBytes(24).toString('base64url') -- 32-char, zero new deps

**Phase 15-02:**
- Access gate returns { middleware, addToCache } for shared cache with /start handler
- Used grammy Api class for botUsername fetch before createBot (avoids chicken-and-egg)
- /invite admin check uses ctx.user.role from access gate, not config.adminUserIds

**Phase 16-01:**
- Messages table keeps chat_id -- conversation history is per-Telegram-chat, not per-household
- Migration idempotency via PRAGMA table_info check (zero-cost on migrated DBs)
- All 9 column renames in single SQLite transaction for atomicity
- listByChatId renamed to listByHouseholdId for semantic clarity

**Phase 16-02:**
- System prompt injects userName naturally, no household references
- Fan-out senders deliver to all household members via getHouseholdMembers
- Mini-app auth converted to factory pattern with user lookup for householdId
- Message queue debounce key stays per-Telegram-chat (correct multi-user behavior)

**Phase 17-01:**
- OnboardingState is 5-value enum (preferences, tour, recipes, tour_only, complete) -- transient states dropped
- Default onboarding_state changed from 'registered' to 'complete' as safety fallback
- Migration maps old 'registered' users to 'complete' via SQLite table rebuild

**Phase 17-02:**
- Start handler detects isJoiningExisting via getHouseholdMembers before user creation
- Welcome message saved to messages table for Claude conversation context
- refreshUserCache semantic alias for addToCache, wired through main.ts to processor
- Empty marker-only responses handled gracefully (skip sending empty message)

**Phase 18-01:**
- Proactive feedback threshold set to 50 inbound messages (~2 weeks moderate use)
- Implicit detection uses householdId as userId (conversation-level, not per-user)
- APP_FEEDBACK_PROMPT positioned after FEEDBACK_PROMPT to keep meal/app feedback separate

**Phase 18-02:**
- Plain HTML textarea for multi-line feedback (not telegram-ui Input)
- No category picker, emoji rating, or sentiment scoring (all deferred per user decision)

**Phase 19-01:**
- Help handler has no DB dependencies -- uses only config.miniAppUrl for webApp button
- HELP_PROMPT positioned after APP_FEEDBACK_PROMPT and before onboarding/appFeedback context injections

**Phase 19-02:**
- Admin section at bottom of Help page to avoid layout shift during role fetch
- Default to non-admin on /api/me error for safe degradation
- /api/me uses chatId from auth middleware, returns { role: "admin" | "member" }

### Key Research Findings (v1.2)

- Zero new npm dependencies needed for v1.2
- Core challenge: chatId -> householdId migration (339 occurrences, 47 files)
- Phase 15+16 tightly coupled -- half-migrated state is dangerous, execute in rapid succession
- FTS5 triggers survive ALTER TABLE ADD COLUMN but verify after migration
- grammY ctx.match provides deep link token natively
- Onboarding state stored in SQLite (not grammY sessions plugin)

### Pending Todos

1. Fix start_cooking reminder to account for prep time (reminders) — `.planning/todos/pending/2026-02-11-fix-start-cooking-reminder-to-account-for-prep-time.md`

### Roadmap Evolution

- Phase 19 added: user help functionality

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 19-02-PLAN.md (Mini App Help Page)
Next action: Phase 19 complete -- all v1.2 phases done, ready for milestone transition
