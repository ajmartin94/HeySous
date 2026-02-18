# Phase 13: Recipe Browser - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual browsing and reading experience for the user's recipe collection. Users can see all recipes as scrollable cards, search via FTS5, tap into full recipe detail, and filter by tags. Creating, editing, or deleting recipes is out of scope — this is read-only browsing.

</domain>

<decisions>
## Implementation Decisions

### Card design & list layout
- Full-width vertical list (one card per row), not a grid
- Text-only cards — no thumbnails or images
- Card content: title, summary snippet (1-2 lines), tag pills, last-cooked date, rating (if available)
- Tag pills: show max 3 per card, then "+N more" indicator
- Tapping a tag pill filters the list to that tag

### Recipe detail view
- Header shows: title, tag pills, last-cooked date, rating (if available)
- Ingredients grouped by section when sections exist (e.g., "For the crust", "For the filling"), flat list otherwise
- Instructions displayed as numbered steps with clear separation
- Notes section shown at the bottom when the recipe has personal notes (read-only)
- BackButton returns to list with scroll position preserved (per roadmap)

### Search & filtering feel
- Search bar hidden behind a search icon in the header — tap to expand
- Real-time FTS5 filtering as user types
- Active tag filter shown as a removable chip bar below the header (e.g., "dinner ✕")
- Search and tag filter combine — results match both text query and tag
- Sort picker available: recent (default), alphabetical, most cooked

### Empty & edge states
- Zero recipes: friendly message pointing back to bot ("No recipes yet — tell me about a recipe in the chat to get started!")
- No search results: "No recipes found" + suggestion to try different search or clear filters
- Missing card data: hide missing fields (no tags = no pills shown, no date = line absent) — cards adapt to available data
- Long recipes: natural scrolling, no collapsible sections — everything visible

### Claude's Discretion
- Card spacing, typography, and shadow styling
- Search debounce timing
- Loading skeleton / spinner design
- Exact sort picker UI component
- How FTS5 query is constructed from user input
- Scroll position restoration technique

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches that match the existing Mini App design language from Phase 11/12.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-recipe-browser*
*Context gathered: 2026-02-10*
