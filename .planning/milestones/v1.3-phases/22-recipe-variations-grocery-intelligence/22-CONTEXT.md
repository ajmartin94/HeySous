# Phase 22: Recipe Variations & Grocery Intelligence - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Handle recipe modification requests gracefully (inline substitution notes, not separate cards), wire grocery store preferences into list generation reliably, and move the destructive "Done shopping" button to a safer location in the Mini App. The store-split tab display already exists in the Mini App -- the work here is the preference-to-generation pipeline.

</domain>

<decisions>
## Implementation Decisions

### Recipe variation behavior
- Tweaks to a recipe (spicier, less salt, different method) are updates in-place on the existing card -- not new cards
- Interchangeable ingredients (chicken OR tofu OR shrimp) are handled as inline substitution notes on a single card, not separate variation cards
- Format: note alternatives inline in the recipe content, e.g. "Protein: chicken (or tofu, shrimp)"
- When Sous adds a recipe with substitutions to a meal plan, it picks a default (first listed or most recent) and mentions alternatives: "I put chicken stir fry on Tuesday -- want tofu or shrimp instead?"
- Substitution behavior is user-driven: user mentions alternatives or asks Sous to suggest some. No extremely specific language required to trigger, but Sous doesn't proactively suggest adding substitution notes unprompted

### Done shopping button
- The "Done shopping" button in the Mini App grocery list screen must be moved from its current prominent position to an overflow menu (three-dot menu or similar)
- Rename to "Clear list" in the overflow menu
- Always require a confirmation dialog: "Clear entire grocery list? This can't be undone." with Cancel/Clear buttons
- This is NOT about bot messages -- it's purely a Mini App change

### Store preference pipeline
- Store preferences (Kroger primary, Costco bulk) are already captured during onboarding conversation
- The real problem: stored preferences don't reliably flow into grocery list generation
- Fix the wiring: ensure store preferences are retrieved from the knowledge base and passed to Claude during grocery list generation so items get assigned to the right store
- Sous assigns items to stores (bulk items to Costco, fresh/regular to Kroger), user can override by telling Sous to move items between stores
- Mini App already has tab-based store-split display -- no changes needed to the grocery list UI tabs

### Claude's Discretion
- How to structure inline substitution notes in the recipe content format (exact markup/formatting)
- Logic for which items default to which store (bulk vs regular heuristics)
- How to handle store override requests in conversation
- Whether to add a swap icon indicator approach or simpler text badge on recipe cards with substitutions

</decisions>

<specifics>
## Specific Ideas

- The Mini App recipe detail view should have a separate "Variations" section (below the recipe) listing all substitution options together, rather than highlighting them inline in the ingredients list
- Recipe cards in the browser should have a subtle indicator (small icon or badge) when they have substitution options
- Store assignment should feel natural -- Sous makes smart defaults, user corrects over time through conversation

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 22-recipe-variations-grocery-intelligence*
*Context gathered: 2026-02-19*
