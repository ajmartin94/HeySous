# Phase 51: Message Streaming Fixes - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two streaming bugs: (1) final message overwrites intermediate conversational text from earlier in the stream, and (2) intermediate text before tool calls disappears entirely. Also change tool status labels to persist as faded hint text in the final message.

</domain>

<decisions>
## Implementation Decisions

### Intermediate text preservation
- When Claude produces text before a tool call ("OK I'll look that up"), that text MUST be preserved in the final message
- The accumulated text across all tool-call turns should be concatenated, not replaced by the final turn's text
- Root cause: `finalize(cleanText)` in processor.ts line 723 passes `response.responseText` (last turn only) as override, wiping the stream sender's accumulated multi-turn text

### Tool status in final message
- Tool status labels like "Searching recipes..." should be KEPT in the final message as faded/hint-styled text
- During streaming: show as-is (current behavior)
- In final HTML message: render as secondary/hint color text (e.g., `<i>` or styled span)
- This gives users visibility into what Sous did behind the scenes

### Edge cases
- Short reply threshold (50 chars) and long reply splitting (>4096 chars) behavior stays the same
- If Claude produces ONLY tool status with no text, still show the tool status as hint text

### Claude's Discretion
- Exact HTML formatting for persisted tool status labels
- How to accumulate text across multiple tool-call rounds in the stream sender
- Whether to add a separator (blank line, etc.) between pre-tool text and post-tool text

</decisions>

<specifics>
## Specific Ideas

- User reported: Mike saw a good streaming message get completely overwritten at finalize with a shorter, different message
- User reported: intermediate conversational text ("OK I understand, I'll look up your recipes") was deleted at the end
- Tool calling status ("Searching recipes...") is transient progress — but user wants it preserved as faded text rather than removed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stream-sender.ts` — manages placeholder -> edits -> finalize lifecycle
- `tool-status.ts` — provides `getToolStatusLabel()` for human-readable tool names
- `processor.ts` — orchestrates streaming, tool handling, and finalize

### Established Patterns
- Stream sender accumulates text via `appendText(delta)` and tracks `currentToolStatus` separately
- `finalize(overrideText?)` replaces accumulated text when override is provided — this is the bug vector
- Plain text during streaming, HTML only on finalize
- `response.responseText` from claude-client only contains the LAST turn's text content

### Integration Points
- `streamMessageWithTools()` in claude-client handles multi-turn tool loops
- `cleanText` in processor is derived from `response.responseText` after marker extraction
- Deep-link keyboard attached at finalize via `reply_markup`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-message-streaming-fixes*
*Context gathered: 2026-03-06*
