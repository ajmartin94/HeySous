# Phase 7: Grocery Lists - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Grocery lists generated automatically from active meal plans with ingredient aggregation, user-configurable store splitting, and interactive check-off. Stores are user-defined (not hardcoded). Includes a "check the pantry" workflow after generation where users remove what they have and add non-recipe items.

</domain>

<decisions>
## Implementation Decisions

### List format & display
- Single message with store headers as top-level sections
- Items grouped by store section within each store (Produce, Dairy, Meat, Pantry, etc.)
- Item format: quantity + item only (no recipe source attribution)
- `/grocery` command for quick access AND conversational retrieval ("show my grocery list")

### Store splitting logic
- Stores are user-configurable, not hardcoded — each user defines their own stores
- User teaches store preferences explicitly (item-by-item or by category, e.g., "I get all meat at Costco")
- Store preferences stored as user preferences (existing Phase 5 preference system), not a separate data model
- Each user sets a default store — unassigned items go there
- Unlimited stores per user (Kroger, Costco, Trader Joe's, farmer's market, etc.)

### Ingredient aggregation
- Claude handles aggregation — no code-level ingredient parsing
- Claude reads recipes from the meal plan and intelligently combines quantities when generating the list
- Full list generated first (all ingredients included, no staple filtering)
- After generation: "check the pantry" step where user conversationally removes what they have and adds extras (snacks, drinks, non-recipe items)
- Extra items mixed into appropriate store sections (not a separate "Other" section)

### Checking off items
- Both inline Telegram buttons (tap-to-check) AND conversational check-off ("got the chicken and onions", "got everything from produce")
- List message edits in place when items are checked (single source of truth)
- Checked items shown with strikethrough (stay visible, easy to undo)
- No special completion interaction when all items checked

### Claude's Discretion
- Store section categorization logic (what counts as "produce" vs "pantry")
- Exact inline button layout and grouping
- How to handle the conversational "check the pantry" flow prompt
- Aggregation approach for ambiguous quantities

</decisions>

<specifics>
## Specific Ideas

- The generation flow is: meal plan → full ingredient list → "check the pantry" conversational step → finalized list with user additions
- Users should be encouraged during pantry check to add non-recipe items they need (snacks, beverages, household items)
- Store preference teaching should feel natural — "I get bulk meat at Costco" style, not a configuration form

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-grocery-lists*
*Context gathered: 2026-02-08*
