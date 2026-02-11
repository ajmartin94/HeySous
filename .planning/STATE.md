# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** v1.2 Onboarding and Feedback -- Phase 16 in progress

## Current Position

Phase: 16 of 18 (Household Data Migration) -- COMPLETE
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-02-11 -- Completed 16-02 Handler and Pipeline Layer Migration

Progress: [████░░░░░░] 33% (v1.2)

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

### Key Research Findings (v1.2)

- Zero new npm dependencies needed for v1.2
- Core challenge: chatId -> householdId migration (339 occurrences, 47 files)
- Phase 15+16 tightly coupled -- half-migrated state is dangerous, execute in rapid succession
- FTS5 triggers survive ALTER TABLE ADD COLUMN but verify after migration
- grammY ctx.match provides deep link token natively
- Onboarding state stored in SQLite (not grammY sessions plugin)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 16-02-PLAN.md (Handler and Pipeline Layer Migration -- Phase 16 complete)
Next action: Plan Phase 17 (Onboarding Flow)
