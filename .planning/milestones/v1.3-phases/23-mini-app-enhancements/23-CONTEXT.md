# Phase 23: Mini App Enhancements - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add recipe deletion to the Mini App recipe detail view with confirmation dialog, and wire tag click filtering in the recipe browser. Tag filtering is already fully implemented (v1.1 Phase 13) -- this phase validates MINI-02 as already complete and focuses on MINI-01 (recipe deletion).

</domain>

<decisions>
## Implementation Decisions

### Delete button placement
- Delete button lives in the recipe detail view (RecipeDetail component), not on recipe cards in the list
- Use the same overflow menu pattern from grocery page (Phase 22) -- three-dot menu in the detail header with "Delete recipe" as a destructive menu item
- This keeps the detail view clean while making delete discoverable

### Confirmation dialog
- Reuse the same dialog pattern as ClearListDialog from Phase 22 (modal overlay, cancel/confirm buttons)
- Title: "Delete this recipe?" with recipe title shown
- Body: "This can't be undone. The recipe will be removed from your collection."
- Confirm button is destructive red, cancel is neutral

### Delete behavior (cascading)
- Permanently delete the knowledge item, its tags, and its FTS5 index entry
- Cooking history rows referencing the recipe should be deleted (clean removal)
- If the recipe is in a current meal plan, the meal plan entry becomes orphaned (acceptable -- meal plans are ephemeral weekly snapshots)
- No soft-delete -- permanent removal per success criteria

### Post-delete navigation
- After successful deletion, navigate back to the recipe list automatically
- The recipe list should re-fetch to reflect the deletion

### Tag filtering (MINI-02)
- Already fully implemented in v1.1 Phase 13: RecipeCard has onTagClick, TagChipBar shows active filter with X to clear, useRecipes hook sends ?tag= parameter to API, server filters by tag
- Phase 23 validates this as complete -- no additional work needed

### Claude's Discretion
- Exact API endpoint path for delete (e.g., DELETE /api/recipes/:id)
- Error handling UX (toast vs inline error)
- Whether to add haptic feedback on delete confirmation

</decisions>

<specifics>
## Specific Ideas

- Follow the existing overflow menu + confirmation dialog pattern established in Phase 22 for the grocery page (OverflowMenu.tsx, ClearListDialog.tsx)
- Detail view already has an onBack callback -- delete navigates back through the same path
- The existing RecipeDetail component receives recipe data and onBack -- add onDelete callback prop

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 23-mini-app-enhancements*
*Context gathered: 2026-02-19*
