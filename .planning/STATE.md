# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** Phase 4 in progress -- Recipe Knowledge.

## Current Position

Phase: 4 of 9 (Recipe Knowledge)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-06 -- Completed 04-02-PLAN.md

Progress: [██████████░░░░░░░░░░░░░░░░] 10/26 (38%)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 3.1 min
- Total execution time: 31 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Bot Foundation | 3/3 | 10 min | 3.3 min |
| 2. Async Pipeline | 3/3 | 8 min | 2.7 min |
| 3. Knowledge System | 3/3 | 12 min | 4.0 min |
| 4. Recipe Knowledge | 1/3 | 1 min | 1.0 min |

**Recent Trend:**
- Last 5 plans: 03-01 (6 min), 03-02 (2 min), 03-03 (4 min), 04-02 (1 min)
- Trend: Prompt-only plans are fast (~1 min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Agent-first architecture -- knowledge system is foundational infrastructure (Phase 3), not a feature layer
- [Roadmap]: HTML parse mode over MarkdownV2 for Telegram formatting
- [Roadmap]: Async webhook processing from day one to prevent Telegram timeouts
- [Roadmap]: Database-backed reminders (not in-memory) to survive restarts
- [01-01]: Factory function createDatabase() instead of singleton -- callers control lifecycle
- [01-01]: Chat/user IDs stored as text (string) for BigInt safety
- [01-01]: WAL mode enabled on SQLite for concurrent read/write performance
- [01-01]: ESM with NodeNext module resolution -- .js extensions on all local imports
- [01-02]: Downgraded @grammyjs/parse-mode from v2.2.0 to v1.11.1 -- v2.x is a different library
- [01-02]: AutoChatActionFlavor used as plain type intersection, not generic wrapper
- [01-02]: Bot token in webhook URL path as shared secret for security
- [01-03]: Ampersand escaped first in escapeHtml to prevent double-encoding
- [01-03]: 30% minimum split position to prevent degenerate tiny first chunks
- [01-03]: 300ms chunk delay between split messages for Telegram rate limits
- [02-01]: maxRetries: 0 on Anthropic client -- we handle retries ourselves for user-facing messaging
- [02-01]: cache_control ephemeral on system prompt -- costs nothing below 4096 token minimum, ready for Phase 3+
- [02-01]: Factory pattern createClaudeClient() matches existing codebase conventions
- [02-01]: System prompt as function buildSystemPrompt() for future context injection
- [02-02]: 1500ms default debounce window for message batching
- [02-02]: Delete-before-process pattern prevents double-processing race condition
- [02-02]: processFn errors caught silently -- queue never crashes on processor errors
- [02-03]: Factory pattern for all handlers (createMessageHandler, createCostsHandler, createProcessor)
- [02-03]: Database injected into BotContext via middleware, not global singleton
- [02-03]: Costs handler registered before message handler for command priority
- [02-03]: Processor never throws -- outer try/catch with in-character error for fire-and-forget safety
- [02-03]: One silent retry before user-facing error (two attempts total)
- [02-03]: Admin-only /costs: non-admin users see nothing (silent return)
- [03-01]: initializeFts creates base tables via raw SQL since FTS5 external content requires content table to exist
- [03-01]: Foreign keys pragma enabled in createDatabase for CASCADE delete support
- [03-01]: BM25 weights title 10x, summary 5x, content 1x for search relevance
- [03-01]: FTS5 query escaping wraps terms in double quotes, LIKE fallback on parse error
- [03-01]: Repository uses Drizzle .returning().get() for synchronous insert-and-return
- [03-02]: Token budget enforcement trims from end (least relevant) when over 4K soft limit
- [03-02]: Search results secondary-sorted by recency among equal-relevance items
- [03-02]: Tool handler is synchronous -- all underlying ops are sync via better-sqlite3
- [03-02]: Tool results returned as JSON strings per Anthropic tool_result API convention
- [03-03]: Tool use loop max 3 iterations with forced text response as safety valve
- [03-03]: 4-hour session gap boundary for conversation context
- [03-03]: 2000 token budget for conversation history (matching token-budget config)
- [03-03]: Messages saved synchronously with .run() before/after Claude call
- [03-03]: Aggregate token usage across all tool use iterations for cost tracking
- [03-03]: /debug command has no admin restriction (power user feature)
- [04-02]: Recipe intelligence lives entirely in system prompt -- no code-level recipe parsing or templates
- [04-02]: Namespaced tag taxonomy (cuisine:italian, protein:chicken, etc.) auto-assigned by Claude
- [04-02]: Recipe content stored as structured plain text, not JSON or HTML
- [04-02]: Confirmation required before save; partial updates skip re-confirmation

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: Zod 4 compatibility with @anthropic-ai/sdk's betaZodTool -- verify at project start, pin Zod 3.24.x if incompatible

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 04-02-PLAN.md
Resume file: None
