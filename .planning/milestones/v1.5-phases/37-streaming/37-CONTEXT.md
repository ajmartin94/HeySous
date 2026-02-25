# Phase 37: Streaming - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Stream Claude responses progressively to Telegram so users see text appearing as it generates, instead of waiting for the full response. Tool calls within streaming responses must still execute correctly. Long responses that require message splitting must render correctly when streamed.

</domain>

<decisions>
## Implementation Decisions

### Update cadence
- Skip streaming for short replies (under ~50 chars) — send as a single message to avoid flicker
- Append a blinking cursor (▍) while generating, remove it when response is complete
- Final message must be clean (no cursor, no artifacts)

### Tool call experience
- Show inline status messages specific to each tool: "Searching recipes...", "Updating meal plan...", "Checking your pantry...", etc.
- For multi-tool sequences, update the status as each tool runs — user sees the progression
- Status messages appear in the streamed message itself (not as separate messages)

### Streaming visual style
- Send a placeholder message immediately (e.g., the cursor ▍) so the user knows something is happening
- Keep Telegram typing indicator (`sendChatAction("typing")`) running the entire time alongside the streaming message — belt and suspenders
- Keep the "thinking longer" message only for 429 retries — streaming already shows progress for normal responses

### Failure handling
- If stream breaks midway: keep partial text already shown, append an error note like "(response interrupted — try again)"
- If a Telegram `editMessageText` call fails (rate limited): skip that update and catch up on the next chunk — user sees a text jump but no error
- Partial text is preferable to losing all progress

### Claude's Discretion
- Update pacing strategy (time-based interval vs chunk-size based)
- Message splitting approach for long responses (stream into new message vs buffer and split at end)
- Whether to keep partial streamed text visible above tool status messages or replace with status
- HTML formatting during streaming vs plain text with a final formatted edit
- Overall timeout for streaming responses
- Whether to fall back to non-streaming on complete failure

</decisions>

<specifics>
## Specific Ideas

- "Belt and suspenders" — typing indicator should run continuously alongside the streaming content, not just before it
- Per-tool status labels should feel natural, not robotic — match the Sous personality
- The cursor (▍) is a clear visual signal borrowed from terminal/chat UX that users intuitively understand

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-streaming*
*Context gathered: 2026-02-22*
