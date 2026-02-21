# Phase 32: Prompt Quality & Persona - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Unify the Sous persona across all Claude interaction points (chat, reminders, prep alerts, feedback extraction), resolve conflicting/redundant instructions in the system prompt, fill documented instruction gaps, and restructure the system prompt for Anthropic API prompt caching. No new features or capabilities.

</domain>

<decisions>
## Implementation Decisions

### Prompt structure & caching
- Reorganize the system prompt so ALL static instructions form a single cacheable prefix, with dynamic context (preferences, meal plans, grocery list, reminders, feedback, date, user name) appended at the end
- No intent routing or selective prompt assembly — keep the monolithic prompt, just restructured for caching
- The Anthropic API caches the stable prefix across requests (90% cost reduction on cached tokens). Current static content is ~7,400 tokens (~91% of total prompt)
- Goal: the static instruction block never changes between requests for the same deployment, maximizing cache hits

### Prompt trimming
- Trim redundancy and conflicting instructions only — do NOT reduce detail level
- Merge overlapping sections where instructions repeat across features
- Resolve the import_from_url conflict: tool description says "wait for confirmation before saving" but system prompt says "import AND save in the same turn" — pick one consistent behavior and align both

### Claude's Discretion
- Which import behavior to standardize on (the system prompt's "auto-save" approach is likely correct since it was added later to fix a real bug with tool call context not persisting across turns)
- How to unify the Sous persona across chat, reminders, and prep alerts (currently 3 separate persona definitions)
- How to structure the unified persona block (single source of truth referenced by all interaction points)
- How to document the missing instruction gaps: recipe ID format [recipe #ID] for plan modifications, preference durability signals (save vs skip), dinner time cross-reference in reminders
- Exact ordering of instruction sections within the static prefix
- How aggressively to merge overlapping sections

</decisions>

<specifics>
## Specific Ideas

- Current system prompt is ~8,100 tokens total (~7,400 static + ~700 dynamic)
- Without caching: ~$0.024/msg, ~$73/month at 3,000 msgs
- With caching: ~$0.004/msg, ~$13/month — 82% savings
- Three separate persona definitions exist: main chat ("friendly and knowledgeable kitchen sidekick"), reminder sender ("friendly kitchen companion"), prep alert sender (same as reminder). These should converge to a single definition.
- Feedback extractor has no persona at all (pure JSON extraction) — this is fine as-is, no persona needed there
- The user noted some "odd behaviors" from Claude, likely from the volume of instructions. Trimming redundancy may help.

</specifics>

<deferred>
## Deferred Ideas

- Intent-based prompt assembly (only include relevant instruction sections per message) — evaluated and deferred. Adds ~6% additional savings over caching but introduces classification complexity and maintenance burden. Revisit if prompt size grows significantly.

</deferred>

---

*Phase: 32-prompt-quality-persona*
*Context gathered: 2026-02-21*
