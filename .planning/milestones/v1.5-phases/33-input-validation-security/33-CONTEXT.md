# Phase 33: Input Validation & Security - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Sanitize user-controlled text before it enters the system prompt, validate tool handler inputs against defined bounds, and reject excessively long messages before the AI pipeline. This phase hardens existing input paths — no new features or capabilities.

</domain>

<decisions>
## Implementation Decisions

### Prompt injection stance
- Rely on sanitization to neutralize injection — no pattern-based detection of injection phrases
- Log sanitization events via Pino with a security tag for admin visibility
- No user-facing warnings or notifications about injection — silent neutralization from user's perspective
- Researcher should identify the full surface area of user-controlled text entering the system prompt (display names, preferences, and anything else)

### Sanitization scope
- Strip HTML tags entirely (not escape) — `<b>John</b>` becomes `John`
- Also strip control characters (null bytes, ANSI escapes) in addition to HTML
- Sanitize at read time (when building the system prompt), not at write time — DB stores original input, sanitization rules can evolve without data migration
- Only sanitize content that gets interpolated into the system prompt (names, preferences) — recipe content in tool results is left as-is

### Rejection experience
- Sous responds in-character when rejecting messages — conversational, not clinical
- Rejection message mentions the approximate limit so users know what to aim for
- Rejected messages are discarded entirely — not stored in conversation history
- Tool validation errors returned to Claude should be specific (e.g., "recipe_id must be a positive integer, got -3") so Claude can self-correct

### Message length limits
- 4,000 character limit on combined debounced content (not per individual Telegram message)
- Hardcoded constant in config, not an environment variable
- Applies to all message types including photo captions — consistent policy regardless of message type
- Check happens before content enters the AI pipeline

### Claude's Discretion
- Exact sanitization function implementation (regex, library, custom)
- Where in the pipeline to place the length check (middleware vs processor)
- Tool input validation bounds (string lengths, number ranges, array sizes) — determine appropriate limits from actual tool definitions
- How to structure validation errors for tool handlers

</decisions>

<specifics>
## Specific Ideas

- Rejection should feel like Sous, not a firewall — e.g., "That's a lot to take in! I can handle messages up to about 4,000 characters — mind breaking it up?"
- Sanitization logging should use structured Pino entries (not Telegram admin notifications) to keep signal/noise ratio manageable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-input-validation-security*
*Context gathered: 2026-02-21*
