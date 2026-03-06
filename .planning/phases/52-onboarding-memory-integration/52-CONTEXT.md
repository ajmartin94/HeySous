# Phase 52: Onboarding Memory Integration - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify that the onboarding preferences phase actually calls save_memory to persist user preferences as atomic facts. The system prompt already instructs Claude to use save_memory — this phase confirms it works end-to-end and fixes any gaps.

</domain>

<decisions>
## Implementation Decisions

### Verification approach
- Check prod DB: do users who completed onboarding have memories saved from that conversation?
- The onboarding prompt (preferences phase) already explicitly instructs: "Save memories as you learn them using save_memory (don't wait until the end)"
- If memories ARE being saved: this phase is a no-op verification
- If memories are NOT being saved: investigate whether save_memory tool is available during onboarding, and fix

### Claude's Discretion
- How to verify (prod DB query vs. test scenario vs. code audit)
- Any prompt adjustments needed if save_memory isn't being called reliably

</decisions>

<specifics>
## Specific Ideas

- Mike's onboarding conversation from prod shows Claude discussing preferences but we need to verify memories table has his data
- The onboarding prompt references save_memory explicitly — this may already work

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/onboarding/prompt.ts` — buildPreferencesPrompt() already references save_memory with category instructions
- `src/memory/repository.ts` — getMemoriesByHousehold() for verification
- MCP debug tools — can query prod DB to verify

### Established Patterns
- Onboarding uses system prompt injection via `buildOnboardingPrompt(state)`
- Memory tools (save_memory, delete_memory, search_memories) are in the MEMORY_TOOLS array
- Tool availability during onboarding depends on which tools are passed to the Claude call

### Integration Points
- `processor.ts` passes `allTools` to Claude call — need to verify MEMORY_TOOLS is included during onboarding
- Memory dedup pipeline runs on save_memory calls

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-onboarding-memory-integration*
*Context gathered: 2026-03-06*
