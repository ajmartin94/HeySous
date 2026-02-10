---
status: complete
phase: v1.1-mini-apps (Phases 11-14)
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 13-01-SUMMARY.md, 13-02-SUMMARY.md, 14-01-SUMMARY.md, 14-02-SUMMARY.md
started: 2026-02-10T15:00:00Z
updated: 2026-02-10T18:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Open Mini App from bot
expected: Tap the menu button in the chat header or an inline webApp button from a bot response. A Mini App opens in Telegram's WebView showing the HeySous hub page with chef hat icon, branded header, and 3 dashboard cards (grocery, recipes, meal plan) with live counts.
result: issue
reported: "failed to start bot with error"
severity: blocker
fix: Express 5 named splat + webhook/polling conflict. Fixed in commits 98b7856, be01cc7.

### 2. Hub dashboard shows live data
expected: Hub page shows 3 cards with real counts — unchecked grocery items, recipe count, and current week meal plan entries. Cards are tappable and navigate to their respective pages. If data fails to load, cards show "--" gracefully.
result: pass

### 3. iOS scroll stability
expected: On iOS, the Mini App renders at full viewport. Swiping down at the top of the page does NOT close the Mini App (vertical swipes are disabled). The app stays open and scrolls normally.
result: pass

### 4. Theme matching
expected: The Mini App colors match Telegram's current theme (light or dark mode). The sage green accent color is visible on buttons and active elements. Switching Telegram theme and reopening reflects the new colors.
result: pass

### 5. Grocery list — store tabs and sections
expected: Opening the grocery page shows your items organized by store (e.g. Kroger/Costco tabs at top). Within each store tab, items are grouped by aisle section (Produce, Dairy, Meat, etc.) with quantities shown next to item names. A progress counter shows checked/total items.
result: pass

### 6. Grocery list — check off items
expected: Tap an item to check it off. You should feel haptic feedback. The item animates briefly (check effect), then moves to a collapsed "Done" section at the bottom. The progress count updates (e.g., "12/28 items"). Expand "Done" to see checked items.
result: issue
reported: "there is a haptic, there is no animation or pause of any kind. immediately moves to done, which works correctly"
severity: minor

### 7. Grocery list — uncheck item
expected: Expand the "Done" section and tap a checked item. It returns to its original section in the active list. Progress counter decrements.
result: pass

### 8. Grocery list — quick-add item
expected: Tap the floating "+" button at the bottom. A form slides up where you can type an item name and quantity. Submit adds the item to the current store tab. The form stays open for rapid multi-item entry.
result: pass

### 9. Grocery list — Done Shopping
expected: Tap the "Done Shopping" button at the very bottom (Telegram MainButton). A loading spinner appears briefly, then the Mini App closes and returns you to the bot chat.
result: pass

### 10. Grocery list — live sync
expected: While the grocery Mini App is open, send a message to the bot to add a grocery item (e.g., "add milk to my list"). Within ~8 seconds, the item appears in the Mini App without manual refresh.
result: pass

### 11. Recipe browser — card list
expected: Opening the recipes page shows all stored recipes as scrollable cards. Each card shows the recipe title, a short summary snippet, tag pills (max 3 with "+N" overflow), and a rating label (favorite/liked/mixed/needs work).
result: pass

### 12. Recipe browser — search
expected: Tap the search icon at the top. A search bar expands. Type a keyword and results filter in real-time as you type (with slight debounce). Results are ranked by relevance (FTS5 full-text search).
result: issue
reported: "the search bar does pop up, and the search appears to be happening (shows 'no results' when i'm halfway through a word) but as soon as a word matches something, it seems to pull the entire library, not filtering at all."
severity: major

### 13. Recipe browser — tag filter
expected: Tap a tag pill on any recipe card. The list filters to only recipes with that tag. A chip appears below the header showing the active filter with an "x" to remove. Tap the same tag again to clear the filter.
result: pass

### 14. Recipe browser — sort options
expected: Tap the sort icon in the header. A dropdown appears with sort options (relevance, alphabetical, most cooked). Select one and the list reorders. Tapping outside the dropdown closes it.
result: pass

### 15. Recipe browser — recipe detail and back
expected: Tap a recipe card to see the full recipe detail (ingredients, instructions, notes, metadata). Tap the Telegram BackButton to return to the recipe list. Your scroll position is preserved — you're back where you left off, not scrolled to the top.
result: issue
reported: "back takes me to the home screen"
severity: major

### 16. Meal plan — weekly grid
expected: Opening the meal plan page shows a 7-day vertical stack (Monday through Sunday). Each day has a header like "Monday, Feb 10". Meal entries show an icon (sunrise=breakfast, sun=lunch, moon=dinner) + type label + recipe name. Days with no meals show "No meals planned" in gray italic.
result: pass

### 17. Meal plan — today highlighting and auto-scroll
expected: Today's day row has a subtle accent background highlight. On initial load, the view auto-scrolls to today's row so you don't have to scroll down manually.
result: pass

### 18. Meal plan — past day dimming
expected: In the current week view, days before today appear dimmed (reduced opacity) to visually distinguish past from upcoming days.
result: pass

### 19. Meal plan — swipe between weeks
expected: Swipe left to see "Next Week" plan. The header changes to "Next Week" and dot indicators update. Swipe right to go back to "This Week". The switch is instant with no loading spinner.
result: pass

### 20. Meal plan — recipe drill-down
expected: Tap a meal entry that has a linked recipe. The full recipe detail appears (same RecipeDetail from the recipe browser). Tap BackButton to return to the meal plan with scroll position preserved. Meals without a linked recipe show "(no recipe)" and are not tappable.
result: issue
reported: "everything passes, except the back button goes back to the hub"
severity: major

## Summary

total: 20
passed: 16
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Item animates briefly (check effect) with 800ms delay before moving to Done section"
  status: failed
  reason: "User reported: there is a haptic, there is no animation or pause of any kind. immediately moves to done"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Search bar filters results to matching recipes only"
  status: failed
  reason: "User reported: search returns entire library when a word matches instead of filtering"
  severity: major
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "BackButton returns from recipe detail to recipe list (not hub)"
  status: failed
  reason: "User reported: back takes me to the home screen"
  severity: major
  test: 15
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "BackButton returns from meal plan recipe detail to meal plan grid (not hub)"
  status: failed
  reason: "User reported: everything passes, except the back button goes back to the hub"
  severity: major
  test: 20
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
