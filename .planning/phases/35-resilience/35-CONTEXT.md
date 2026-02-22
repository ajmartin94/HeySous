# Phase 35: Resilience - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Gracefully handle API rate limits, concurrent modifications, and oversized context. The pipeline should retry intelligently, prevent data races on shared household data, and trim context when it approaches the model window — instead of failing silently or crashing.

</domain>

<decisions>
## Implementation Decisions

### Retry experience
- Retry up to 3 times on 429 with exponential backoff and jitter
- Respect the Retry-After header from the API when present; fall back to own backoff timing if absent
- Retries apply to ALL Anthropic API calls (initial message, tool-use continuations, everything)
- After the first retry fails, send an in-character message to the user: something like "I'm thinking a little longer on this one..." before continuing retries
- If all retries exhaust, stop — do not auto-retry later. User re-sends when ready

### Concurrent edit behavior
- Optimistic locking on ALL stateful household writes (meal plan, recipes, preferences), not just meal plans
- On conflict, fail the tool call immediately — no auto-retry, no queuing
- Claude tells the user the data just changed and they should review before re-requesting. Simple approach for a rare event
- Add edit metadata (last edited by, timestamp) to knowledge items as part of versioning fields — this data is captured for locking but also visible to Claude in responses

### Context trimming priority
- Trim oldest messages first, no special treatment for any message
- Only check estimated token count when it crosses ~80% of the context window (not every call)
- Silent continuation — Claude does NOT explicitly mention to the user that context was trimmed; it just continues naturally
- Claude receives an internal system notice about omitted messages (per success criteria), but does not surface it to the user

### Failure messaging
- One generic in-character failure message for all resilience failures (429 exhausted, context overflow, etc.) — Sous stays in character with an apology
- User must re-send their message; no automatic retry after failure
- Detailed failure logs: household ID, failure type, retry count, timestamps — builds on Phase 34 observability infrastructure

### Claude's Discretion
- Exact backoff timing and jitter algorithm
- Specific wording of the "thinking longer" and failure messages (must be in Sous's voice)
- Implementation of optimistic locking mechanism (version column, timestamp comparison, etc.)
- Context trimming granularity (whole messages vs partial)
- Token estimation approach for the 80% threshold check

</decisions>

<specifics>
## Specific Ideas

- "I'm thinking a little longer on this one..." — the retry notification should feel natural, like Sous is working on a tough request, not a system status message
- Conflict message should tell the user someone else just changed the plan and they need to review it to make sure their request still makes sense
- Keep it simple — this is resilience, not a complex concurrency system. These are rare edge cases that need graceful handling, not elaborate recovery flows

</specifics>

<deferred>
## Deferred Ideas

- Display "last edited by" metadata in the Mini App UI — the tracking fields will exist from optimistic locking, but Mini App display is new UI work for a future phase
- Display edit metadata visibly across all knowledge items in Mini App — future phase

</deferred>

---

*Phase: 35-resilience*
*Context gathered: 2026-02-22*
