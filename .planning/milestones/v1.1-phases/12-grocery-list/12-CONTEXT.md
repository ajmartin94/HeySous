# Phase 12: Grocery List - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual grocery list Mini App where users can shop from a checkable list organized by store and section. Includes check-off with haptic feedback, progress tracking, quick-add for forgotten items, and real-time sync with the bot. The list data model and bot-side grocery commands already exist from v1.0 — this phase adds the visual Mini App interface.

</domain>

<decisions>
## Implementation Decisions

### Shopping interaction
- Tap anywhere on the item row to check it off (full-row touch target, no separate checkbox)
- Checked items get a strikethrough + fade for ~1 second, then animate down to the Done section (brief delay gives moment to register before moving)
- Unchecking: tap the item in the Done section to restore it to the active list (same gesture as checking off — consistent)
- Haptic feedback on check/uncheck (per success criteria)

### List layout & density
- Compact single-line rows: item name + quantity on one line
- Quantities displayed as trailing pill/badge at end of row (e.g., "x2" or "1 lb" badge)
- Section headers show remaining item count (e.g., "Produce (4)")
- When all items in a section are checked off, the section hides completely from the active list

### Store & section organization
- Horizontal scrollable pill-shaped tabs at top for store selection (Kroger, Costco, etc.)
- Tab bar always shown, even with only one store (consistent layout)
- Sections ordered in fixed logical grocery-store-aisle order: Produce → Dairy → Meat → Bakery → Frozen → Pantry → Other
- Done section at bottom of each store tab, collapsed by default showing "Done (8)" — tap to expand and see/uncheck items

### Progress tracking
- Progress indicator (e.g., "12/28 items") displayed below the store tabs, above the list — always visible
- MainButton shows "Done Shopping" as the primary action to complete the trip
- BackButton returns to chat

### Quick-add experience
- Floating action button ("+") in bottom-right corner to trigger add form
- Form fields: item name + optional quantity (minimal — no section picker, auto-assign)
- Item added to whichever store tab is currently active
- Form stays open after adding so user can quickly add multiple forgotten items
- Close form explicitly when done adding

### Claude's Discretion
- Section auto-assignment logic for quick-add items
- Exact animation timing and easing curves
- Empty state design (when grocery list has no items)
- Error handling for sync failures
- FAB positioning relative to MainButton
- Typography and spacing details

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. The overall feel should be a fast, no-friction shopping companion: tap to check, see progress, get done.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-grocery-list*
*Context gathered: 2026-02-09*
