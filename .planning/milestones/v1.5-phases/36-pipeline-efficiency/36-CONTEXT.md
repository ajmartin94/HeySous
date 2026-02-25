# Phase 36: Pipeline Efficiency - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce per-household daily token budgets, use accurate token counting, optimize preference loading (N+1 fix), make session timeout configurable, and add content-aware knowledge deduplication. No new user-facing features — this is pipeline hardening and efficiency.

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting Experience
- Token budget only — no separate message count limit
- Friendly system notice (not in-character Sous persona) when budget exhausted: clear "daily limit reached" message
- No warning at 80% — hard stop only when budget is exhausted
- Daily reset at midnight (aligned with session reset), not rolling window
- When budget exhausted: all non-AI interactions continue working (bot commands, mini app, grocery viewing). Only messages that would trigger a Claude API call receive a canned "daily limit reached" response instead of silence

### Budget Thresholds
- Default ~500k tokens/day per household (generous — safety net, not restrictive)
- Configurable via env var from the start (DAILY_TOKEN_BUDGET)
- Same limits for all households — admin is NOT exempt
- Budget tracks token spend per household per calendar day

### Knowledge Dedup Matching
- Content search covers both recipes AND preferences (not just titles)
- Recipe dedup: title similarity + ingredient overlap matching
- Very high overlap threshold (>85%) to catch near-exact duplicates only — not aggressive
- Claude decides silently when duplicate found — no extra user prompt, no "potential duplicate" tagging
- For preferences: content-level matching to catch semantic duplicates ("I don't like cilantro" vs "no cilantro please")

### Session Boundary Behavior
- Sessions reset at midnight, aligned with token budget reset — no inactivity timeout
- One continuous session per calendar day (all messages from midnight to midnight share context)
- Session boundary is invisible to user — no greeting or notification on new day
- Single configurable timezone via env var (SESSION_TIMEZONE) for the whole instance
- Replaces the current hardcoded 4-hour inactivity timeout entirely

### Claude's Discretion
- Exact token counting implementation (tiktoken, approximation algorithm, etc.)
- N+1 preference query optimization approach
- Canned rate limit message wording (should be brief and friendly)
- How to implement ingredient overlap calculation for dedup

</decisions>

<specifics>
## Specific Ideas

- Token budget and session resets are synchronized at midnight — one reset event, one timezone config
- "Daily limit reached" message should be a quick canned response, not a Claude-generated message (saves tokens and avoids API call)
- Dedup matching should be conservative (>85%) — better to save a near-duplicate than miss a real new recipe

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-pipeline-efficiency*
*Context gathered: 2026-02-22*
