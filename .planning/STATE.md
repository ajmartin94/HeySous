# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** v1.2 Onboarding and Feedback -- Phase 15 complete, ready for Phase 16

## Current Position

Phase: 15 of 18 (Users, Households, and Invites) -- COMPLETE
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-02-11 -- Completed 15-02 Bot Integration (access gate, /start, /invite)

Progress: [██░░░░░░░░] 14% (v1.2)

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
Stopped at: Completed 15-02-PLAN.md (Bot Integration -- access gate, /start, /invite)
Next action: Plan Phase 16 (chatId -> householdId data migration)
