# Phase 26: Knowledge Dedup - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent duplicate knowledge items from being created. When a user tells Sous about a recipe or preference that already exists, Sous finds the existing match and asks the user whether to update the existing item or create a new one. Also validate that update_knowledge calls contain actual changes. This phase modifies the save_knowledge tool handler and system prompt -- it does NOT add new tools or UI.

</domain>

<decisions>
## Implementation Decisions

### Match detection strategy
- Use existing FTS5 search (search_knowledge) to find potential matches before saving -- this is the established retrieval mechanism
- Match detection happens inside the save_knowledge tool handler: before creating, search by title similarity
- Return match info to Claude as a tool result (not an error) so Claude can present it conversationally
- The tool should return the top match with its ID, title, and summary so Claude has enough context to tell the user
- Threshold: if a title match scores above a reasonable FTS5 relevance threshold, flag it as a potential duplicate
- For exact title matches (case-insensitive), always flag regardless of score

### Match presentation to user
- Claude (via system prompt instructions) presents the match conversationally: "I already have something similar -- [title]. Want me to update it or save this as a new recipe?"
- Show the existing item's title and a brief summary so the user can distinguish
- Never auto-merge or silently overwrite -- the user always decides (KNOW-02)
- If user says "update", Claude should use update_knowledge on the existing item
- If user says "new" or "save as new", Claude proceeds with save_knowledge (with a force/skip-dedup flag)

### Preference dedup behavior
- Preferences use the same dedup mechanism but match on tag patterns (e.g., two items both tagged "preference" + "pref:dietary" with similar titles)
- For preferences, exact semantic matches matter more than title (e.g., "no cilantro" and "I don't like cilantro" are the same preference)
- Claude's system prompt should instruct: when saving a preference, search existing preferences first

### update_knowledge validation
- If update_knowledge is called with no substantive fields (no title, summary, content, or tags changes), return an error message to Claude explaining nothing was provided to update
- This prevents silent no-op calls that waste a tool use turn
- The change_description field alone is not a substantive change

### Claude's Discretion
- Exact FTS5 query construction for finding matches (title-weighted search is already in place)
- How to phrase the dedup prompt in system instructions (conversational Sous tone)
- Whether to show 1 best match or up to 2-3 close matches

</decisions>

<specifics>
## Specific Ideas

- The v1.3 decision established the pattern: "search-then-suggest with Claude + user deciding is the correct pattern" -- this phase implements that pattern for save_knowledge
- The dedup check should be lightweight -- a single FTS5 query, not a heavy comparison operation
- The save_knowledge tool should gain a `skip_dedup` boolean parameter that Claude sets to true when the user explicitly says "save as new" after seeing a match

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 26-knowledge-dedup*
*Context gathered: 2026-02-20*
