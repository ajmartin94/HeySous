---
phase: 02-async-pipeline-claude-integration
plan: 01
subsystem: ai
tags: [anthropic, claude, haiku, prompt-caching, token-tracking, sqlite, drizzle]

# Dependency graph
requires:
  - phase: 01-bot-foundation
    provides: "Config pattern, database schema, factory function conventions"
provides:
  - "Claude API client factory with prompt caching"
  - "Sous persona system prompt builder"
  - "Token usage database schema with cost tracking"
  - "AI type definitions (ClaudeResponse, TokenUsage, ModelPricing)"
  - "Cost calculation function for USD from token counts"
  - "Config fields: anthropicApiKey, anthropicModel, adminUserIds"
affects: [02-02, 02-03, 03-knowledge-system]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk"]
  patterns: ["Factory function for API clients", "Prompt caching with cache_control blocks", "Per-model pricing lookup for cost calculation"]

key-files:
  created:
    - "src/ai/claude-client.ts"
    - "src/ai/system-prompt.ts"
    - "src/ai/types.ts"
  modified:
    - "src/config.ts"
    - "src/db/schema.ts"
    - ".env.example"
    - "package.json"

key-decisions:
  - "maxRetries: 0 on Anthropic client -- we handle retries ourselves for user-facing messaging"
  - "60s timeout on Anthropic client -- generous window for Claude responses"
  - "cache_control ephemeral on system prompt -- costs nothing below 4096 token minimum, ready for Phase 3+"
  - "Factory pattern createClaudeClient() matches existing codebase conventions"

patterns-established:
  - "AI module structure: src/ai/ with separate types, system-prompt, and client files"
  - "Model pricing as typed Record for per-model cost lookup"
  - "System prompt as function (not constant) for future context injection"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 2 Plan 1: Config, Claude Client, System Prompt, and Token Usage Schema Summary

**Anthropic SDK integration with Sous persona system prompt, prompt caching, cost tracking schema, and extended config validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T13:19:07Z
- **Completed:** 2026-02-06T13:22:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @anthropic-ai/sdk and extended config with ANTHROPIC_API_KEY validation, model selection, and admin user IDs
- Created Claude client factory with prompt caching (cache_control: ephemeral), maxRetries: 0, 60s timeout
- Built Sous persona system prompt with warm/casual tone, food-only boundaries, HTML formatting, no-markdown rules
- Added tokenUsage table to database schema with full cost tracking columns (input/output/cache tokens, estimated cost, duration)
- Defined TypeScript types for ClaudeResponse, TokenUsage, and ModelPricing with Haiku 4.5 pricing constants

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Anthropic SDK, extend config and database schema** - `7e7eddf` (feat)
2. **Task 2: Create Claude client, system prompt, and AI types** - `c8e75eb` (feat)

## Files Created/Modified
- `src/ai/claude-client.ts` - Claude API wrapper factory with prompt caching and cost calculation
- `src/ai/system-prompt.ts` - Sous persona system prompt builder function
- `src/ai/types.ts` - ClaudeResponse, TokenUsage, ModelPricing types and Haiku 4.5 pricing constants
- `src/config.ts` - Added anthropicApiKey (validated), anthropicModel (defaults to Haiku 4.5), adminUserIds (parsed from CSV)
- `src/db/schema.ts` - Added tokenUsage table with cost tracking columns
- `.env.example` - Documented ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ADMIN_USER_IDS
- `package.json` - Added @anthropic-ai/sdk dependency

## Decisions Made
- maxRetries: 0 on Anthropic client -- per research, we handle retries ourselves in the pipeline processor for user-facing messaging control
- 60-second timeout on Anthropic client -- generous window for Claude responses
- cache_control: ephemeral on system prompt -- costs nothing below 4096 token minimum, positions for Phase 3+ when knowledge context exceeds threshold
- Factory pattern createClaudeClient(apiKey, model) -- matches existing codebase convention (createDatabase, createBot)
- System prompt as function buildSystemPrompt() -- allows future phases to inject knowledge context and user preferences

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**External services require manual configuration.** The Anthropic API key is required for Claude integration:

- Set `ANTHROPIC_API_KEY` in `.env` (get from console.anthropic.com -> API Keys -> Create Key)
- Optionally set `ANTHROPIC_MODEL` to override the default Haiku 4.5 model
- Optionally set `ADMIN_USER_IDS` for /costs command access control

## Next Phase Readiness
- Claude client ready for pipeline processor (Plan 03) to call
- System prompt ready -- will be extended in Phase 3 with knowledge context
- Token usage schema ready for cost logging after each Claude call
- Ready for 02-02-PLAN.md (message debounce queue)

## Self-Check: PASSED

---
*Phase: 02-async-pipeline-claude-integration*
*Completed: 2026-02-06*
