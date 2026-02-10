---
status: resolved
trigger: "Investigate why grocery item check-off has no animation/delay before moving to Done section."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:03:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: Animation CSS or timing logic is missing or not being applied when item is checked
test: Read the three key files to understand animation implementation
expecting: Find missing animation trigger, CSS class, or timing delay
next_action: Read GroceryItem.tsx, grocery.css, and useGroceryList.ts

## Symptoms

expected: 800ms animation delay with visual check effect before item moves to Done section
actual: Item immediately moves to Done with no animation or pause
errors: None reported
reproduction: Check off any grocery item
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: GroceryItem.tsx lines 14-20
  found: handleTap sets checking state, calls onToggle immediately, then sets 800ms timeout to clear checking state
  implication: Animation state is set locally but parent state changes immediately

- timestamp: 2026-02-10T00:01:30Z
  checked: useGroceryList.ts lines 95-101
  found: toggleItem immediately updates items state with optimistic update (checked: !item.checked)
  implication: State change happens instantly, no delay

- timestamp: 2026-02-10T00:02:00Z
  checked: grocery.css lines 92-96
  found: CSS class .grocery-item--checking applies opacity 0.4 and line-through
  implication: Animation CSS exists but item moves to Done section before animation completes

## Resolution

root_cause: In GroceryItem.tsx, the onToggle callback is called immediately on line 17, which triggers an optimistic state update in useGroceryList.ts that flips the checked boolean. This causes React to re-render and move the item to the Done section instantly. The local checking state and 800ms timeout only affect the CSS animation class, but the item has already moved sections because the parent state changed.
fix: Delay the onToggle callback by 800ms to allow the animation to complete before the parent state changes. Move onToggle(item.id) inside the setTimeout.
verification: Check off an item and verify it shows animation for 800ms before moving to Done section
files_changed: []
