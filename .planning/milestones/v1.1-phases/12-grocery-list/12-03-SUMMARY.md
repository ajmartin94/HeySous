---
phase: 12-grocery-list
plan: 03
subsystem: ui
tags: [react, telegram-mini-app, grocery, mainbutton, fab, polling, closing-behavior]

requires:
  - phase: 12-grocery-list
    provides: Grocery API endpoints, useGroceryList hook with toggle and refetch, grocery component library
  - phase: 11-mini-app-foundation
    provides: React SPA shell, apiFetch utility, Layout component, Telegram SDK singleton pattern
provides:
  - useMainButton hook for Telegram MainButton lifecycle management
  - QuickAddFab component with bottom-sheet form for rapid item addition
  - Enhanced useGroceryList with addItem, completeList, polling, and visibility sync
  - Complete grocery Mini App satisfying all 10 GROC requirements
affects: []

tech-stack:
  added: []
  patterns:
    - "useMainButton hook: mount/setParams/onClick/hide/unmount lifecycle with isAvailable guard"
    - "Bottom-sheet form pattern: FAB trigger, backdrop overlay, fixed-position panel"
    - "Polling sync: setInterval + visibilitychange listener for near-real-time data"
    - "SDK singleton direct usage for one-off calls (mainButton.setParams in handler)"

key-files:
  created:
    - mini-app/src/hooks/useMainButton.ts
    - mini-app/src/components/grocery/QuickAddFab.tsx
  modified:
    - mini-app/src/hooks/useGroceryList.ts
    - mini-app/src/components/grocery/grocery.css
    - mini-app/src/pages/Grocery.tsx

key-decisions:
  - "Always poll every 8s when Grocery page is mounted (avoids circular hook dependency with hasActiveList)"
  - "mainButton.setParams called directly in handleDoneShopping for loader (avoids useCallback dep cycle)"
  - "QuickAddFab form stays open after add for rapid multiple additions"
  - "FAB positioned at bottom: calc(safe-area + 80px) to sit above native MainButton"

patterns-established:
  - "useMainButton: reusable hook for any page needing Telegram MainButton"
  - "Bottom-sheet overlay: backdrop + fixed panel pattern for mobile-friendly forms"
  - "Polling with visibility: setInterval + visibilitychange for background sync"

duration: 4min
completed: 2026-02-10
---

# Phase 12 Plan 03: Quick-add, MainButton, Polling & ClosingBehavior Summary

**MainButton "Done Shopping" with loader, FAB quick-add form with rapid multi-add, 8s polling sync with visibility refetch, and closingBehavior confirmation dialog**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T03:34:46Z
- **Completed:** 2026-02-10T03:38:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created useMainButton hook managing mount/show/onClick/hide/unmount lifecycle with showLoader/hideLoader helpers
- Built QuickAddFab component with FAB button and bottom-sheet form overlay supporting rapid multi-item addition
- Enhanced useGroceryList with addItem (POST /grocery/add), completeList (POST /grocery/complete), polling interval, and visibility change refetch
- Integrated all features into Grocery page: MainButton completes shopping and closes Mini App, QuickAddFab adds items to active store, polling syncs bot-added items every 8s, closingBehavior prevents accidental close
- All 10 GROC requirements (GROC-01 through GROC-10) now satisfied across Plans 01-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useMainButton hook, QuickAddFab component, enhance useGroceryList** - `804a10b` (feat)
2. **Task 2: Integrate MainButton, QuickAddFab, polling, closingBehavior into Grocery page** - `41b1b4b` (feat)

## Files Created/Modified
- `mini-app/src/hooks/useMainButton.ts` - Telegram MainButton lifecycle hook with mount/unmount and showLoader/hideLoader
- `mini-app/src/components/grocery/QuickAddFab.tsx` - FAB button + bottom-sheet form for adding items to active store
- `mini-app/src/hooks/useGroceryList.ts` - Enhanced with addItem, completeList, pollInterval, and visibility change refetch
- `mini-app/src/components/grocery/grocery.css` - FAB positioning, backdrop overlay, form panel, submit button, hint text styles
- `mini-app/src/pages/Grocery.tsx` - Integrated MainButton, QuickAddFab, polling, closingBehavior with full error handling

## Decisions Made
- Always poll every 8 seconds when the Grocery page is mounted rather than conditionally based on hasActiveList (avoids circular dependency where pollInterval depends on a value returned by the hook that takes pollInterval as input)
- Used mainButton.setParams directly in handleDoneShopping callback for the loader rather than using the hook's showLoader return (avoids useCallback dependency cycle)
- QuickAddFab form stays open after adding an item, clearing only the input fields, enabling rapid multiple additions without reopening
- FAB positioned at `calc(safe-area-inset-bottom + 80px)` to sit above the native Telegram MainButton per research Pitfall 6

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 GROC requirements satisfied -- grocery Mini App is feature-complete
- Phase 12 (Grocery List) is complete with all 3 plans executed
- Ready for Phase 13 (Meal Plan Mini App) or phase verification

## Self-Check: PASSED

All 5 key files verified on disk. Both task commits (804a10b, 41b1b4b) verified in git log.

---
*Phase: 12-grocery-list*
*Completed: 2026-02-10*
