# Phase 2: Async Pipeline & Claude Integration - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Bot processes messages through Claude asynchronously, responding with intelligent conversation while tracking costs. Includes: async webhook processing, Claude API integration with system prompt, message debouncing/batching, token usage logging, and prompt caching. Does NOT include: knowledge retrieval (Phase 3), recipe handling (Phase 4), or preference learning (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Claude's personality & system prompt
- Warm & casual tone — like a friend who loves cooking ("oh nice, that stromboli sounds amazing!")
- Named persona: "Sous" — the user's kitchen sidekick, has a personality
- Strict food-only boundaries — politely declines anything not food-related ("I only know my way around a kitchen!")
- Actively helpful / proactive — regularly suggests ideas, follows up, nudges ("It's Sunday — want me to plan the week?")

### Cost tracking & guardrails
- Per-request token logging — each Claude call logs input/output tokens and estimated cost, tagged by user and conversation type
- Log only (no hard limits) for early stages — track everything per-user but no cutoffs yet
- Admin bot command — a `/costs` command in Telegram for quick usage checks, only visible to admin users
- Backend is the source of truth for per-user cost attribution (Anthropic dashboard only shows account-level aggregates)

### Error & fallback behavior
- Friendly in-character error messages — "Sorry, I'm having trouble thinking right now. Try again in a moment!" (as Sous)
- Retry once silently before showing error — user only sees error if both attempts fail
- Timeout messaging at 30s — after 30 seconds, tell user "This is taking longer than usual, hang tight..." then continue waiting
- Detailed error logging — full error details, request context, user ID, timestamps for post-hoc debugging

### Claude's Discretion
- Message batching debounce window timing
- System prompt structure and exact wording (within personality constraints above)
- Prompt caching strategy details
- Retry delay timing and backoff approach

</decisions>

<specifics>
## Specific Ideas

- Sous persona should feel like a knowledgeable friend in the kitchen, not a corporate assistant
- Admin `/costs` command for quick Telegram-based cost monitoring without needing to query the database directly
- Error messages stay in character — Sous acknowledges the issue warmly, doesn't break the fourth wall with technical jargon

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-async-pipeline-claude-integration*
*Context gathered: 2026-02-06*
