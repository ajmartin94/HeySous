# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** All phases complete including milestone fixes. Full UAT gaps closed.

## Current Position

Phase: 10 of 10 (Milestone Fixes)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-09 -- Completed 10-02-PLAN.md

Progress: [██████████████████████████████] 30/30 (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 30
- Average duration: 2.8 min
- Total execution time: 83 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Bot Foundation | 3/3 | 10 min | 3.3 min |
| 2. Async Pipeline | 3/3 | 8 min | 2.7 min |
| 3. Knowledge System | 3/3 | 12 min | 4.0 min |
| 4. Recipe Knowledge | 3/3 | 5 min | 1.7 min |
| 5. Preference Learning | 2/2 | 7 min | 3.5 min |
| 6. Meal Planning | 3/3 | 7 min | 2.3 min |
| 7. Grocery Lists | 4/4 | 9 min | 2.3 min |
| 8. Reminders | 4/4 | 11 min | 2.8 min |
| 9. Feedback Loop | 2/2 | 10 min | 5.0 min |
| 10. Milestone Fixes | 2/2 | 4 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 09-01 (3 min), 09-02 (7 min), 10-01 (2 min), 10-02 (2 min)
- Trend: Targeted bugfix plans are fast -- focused scope with clear changes

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
- [04-01]: No foreign key on knowledgeChangelog.knowledgeItemId -- logs persist after item deletion for data mining
- [04-01]: Write tools capture previous content snapshots in changelog before mutation
- [04-01]: Tool handler signature extended with knowledgeRepository and db deps for write operations
- [04-02]: Recipe intelligence lives entirely in system prompt -- no code-level recipe parsing or templates
- [04-02]: Namespaced tag taxonomy (cuisine:italian, protein:chicken, etc.) auto-assigned by Claude
- [04-02]: Recipe content stored as structured plain text, not JSON or HTML
- [04-02]: Confirmation required before save; partial updates skip re-confirmation
- [04-03]: knowledgeRepository injected as dependency rather than created inline in processor -- follows DI pattern
- [04-03]: Tool iteration limit increased from 3 to 5 for multi-step recipe creation flows
- [05-01]: Preferences retrieved via raw SQLite JOIN (same pattern as fts.ts) -- not Drizzle
- [05-01]: System prompt always includes preference_management instructions even when no preferences exist
- [05-01]: Preference context injected after recipe_management section, preserving existing prompt structure
- [05-01]: Claude client systemPrompt parameter is optional with fallback to buildSystemPrompt() for backward compatibility
- [05-01]: Preference markers: [ALLERGY] for severity:allergy, [RESTRICTION] for severity:restriction, [inferred] for inferred
- [05-02]: Preference grouping priority: household > dietary > schedule > cooking > other
- [05-02]: No admin restriction on /preferences -- any user can view their own (matches /debug pattern)
- [06-01]: MealType enum constrained to "breakfast" | "lunch" | "dinner" for Drizzle type safety
- [06-01]: Auto-mark uses SQLite date() arithmetic for cooked_date computation
- [06-01]: Week start always Monday via ISO week rules
- [06-01]: History defaults to 21-day lookback when no date range specified
- [06-01]: initializePlanning in history.ts (matches initializeFts in fts.ts pattern)
- [06-02]: PLAN_TOOLS is a separate export from KNOWLEDGE_TOOLS for selective tool set inclusion
- [06-02]: Plan tool deps (planRepository, sqlite) are optional in createToolHandler for backward compat
- [06-02]: Plan context injected after preference management, before meal planning instructions
- [06-02]: MEAL_PLANNING_PROMPT always included regardless of plan context existence
- [06-03]: Raw SQLite JOIN for /plan display (same pattern as preferences handler)
- [06-03]: Dinner-only detection for simplified display format
- [06-03]: autoMarkCookedMeals runs before Claude call, ensuring history is current
- [07-01]: store and section are freeform text, not enums -- user-configurable per CONTEXT.md
- [07-01]: planId has no foreign key -- soft link since plans can change independently
- [07-01]: Only one active list per chat -- createList deactivates existing active list automatically
- [07-01]: Items ordered by store, section, name for consistent grouped display
- [07-01]: Batch insert uses SQLite transaction for atomicity
- [07-02]: update_grocery_list response includes messageId for post-loop Telegram message editing
- [07-02]: Grocery context is lightweight summary (item count, store count, checked) to keep system prompt tokens low
- [07-02]: GROCERY_LIST_PROMPT always included regardless of grocery context existence
- [07-02]: groceryContext injected after planContext; GROCERY_LIST_PROMPT after MEAL_PLANNING_PROMPT
- [07-02]: buildSystemPrompt groceryContext parameter is optional for backward compatibility
- [07-03]: Callback data format g:t:{id} -- 13 bytes max, well under 64-byte Telegram limit
- [07-03]: 80-item safety valve on buttons -- skip keyboard entirely for very large lists
- [07-03]: 2 buttons per row for mobile readability, labels truncated at 30 chars
- [07-03]: Unchecked items sorted before checked within each section for visibility
- [07-04]: groceryCallbackHandler registered before all command handlers (callback queries need early routing)
- [07-04]: Tool iteration limit increased from 5 to 10 for grocery list generation flow
- [07-04]: Post-tool-loop grocery message edit is best-effort (debug-level logging on failure)
- [07-04]: Callback handler uses on("callback_query:data") with next() passthrough for non-grocery callbacks
- [08-01]: Named parameters (@param) for upsert to avoid positional parameter complexity with 14+ binds
- [08-01]: COALESCE pattern for partial settings updates -- null means "keep existing"
- [08-01]: mutedUntil sentinel flag pattern since null is a valid value (unmute)
- [08-01]: CHECK constraints on type and status columns in raw SQL for data integrity
- [08-01]: UNIQUE on chat_id in reminder_settings for one-settings-per-chat upsert
- [08-02]: localTimeToUtc uses Intl.DateTimeFormat for IANA timezone UTC offset resolution
- [08-02]: 1-minute dedup window for hasPendingReminder checks during regeneration
- [08-02]: update_reminder_settings auto-regenerates reminders after settings change
- [08-02]: REMINDER_PROMPT always included in system prompt (matches MEAL_PLANNING_PROMPT pattern)
- [08-02]: buildSystemPrompt reminderContext is optional 4th param for backward compat
- [08-02]: Empty string muted_until in tool input means unmute (null)
- [08-03]: Minimal interface types for sender deps (BotApi, ClaudeClient, RetrievalService) to decouple from grammY/Anthropic types
- [08-03]: Separate PREP_ALERT_SYSTEM_PROMPT with recipe analysis instructions vs generic REMINDER_SYSTEM_PROMPT
- [08-03]: Plain-text fallbacks per reminder type when Claude API fails
- [08-03]: Poller tick() exposed publicly for testing
- [08-04]: Bot type cast for sender's minimal BotApi interface (intentional decoupling from grammY types)
- [08-04]: regenerateReminders helper in main.ts shared between startup and tool handler callback
- [08-04]: Startup regeneration iterates all active settings before poller starts
- [09-01]: Duplicated localTimeToUtc inline in feedback/generator.ts -- keeps feedback module self-contained
- [09-01]: Fixed check-in time at 20:30 local (midpoint of 8-9pm window)
- [09-01]: Callback data format f:{sentiment}:{reminderId} -- compact, under 64 bytes
- [09-01]: No foreign key on reminder_id in feedback_checkins -- logs persist after deletion
- [09-01]: Migration test-and-recreate for existing databases with old CHECK constraint
- [09-02]: Feedback annotation appended to recipe content with "Feedback:" section format
- [09-02]: FEEDBACK_PROMPT always included in system prompt (matches REMINDER_PROMPT pattern)
- [09-02]: FeedbackCheckin type imported directly in poller (not redefined as minimal interface)
- [09-02]: Free-text feedback handler registered before catch-all messageHandler
- [09-02]: Deprioritization threshold: net score -2 (positive=+1, negative=-1)
- [09-02]: feedbackContext injected after reminderContext in system prompt template
- [10-01]: Broadened system prompt boundaries encourage general cooking knowledge, not just dinner planning
- [10-01]: Admin ID check uses case-insensitive username comparison for robustness
- [10-01]: Preference query uses OR with LIKE 'pref:%' to catch items missing base 'preference' tag
- [10-02]: is_error: true with JSON-stringified error returns tool failures to Claude instead of crashing pipeline
- [10-02]: metricsPerChat Map replaces global lastMetrics for per-chat retrieval metrics scoping
- [10-02]: getMetrics accepts optional chatId for backward compatibility

### Pending Todos

None -- all phases complete including milestone fixes.

### Blockers/Concerns

None -- project complete.

## Session Continuity

Last session: 2026-02-09
Stopped at: Completed 10-02-PLAN.md (tool call error resilience + per-chat debug metrics)
Resume file: None
