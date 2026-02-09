---
phase: 07-grocery-lists
plan: 03
subsystem: ui
tags: [grammy, inline-keyboard, html-formatter, telegram, strikethrough, callback-data]

# Dependency graph
requires:
  - phase: 01-bot-foundation
    provides: "escapeHtml utility from telegram/formatter.ts"
  - phase: 07-grocery-lists
    provides: "GroceryItem type from grocery/repository.ts (plan 01)"
provides:
  - "buildGroceryKeyboard InlineKeyboard builder for per-item toggle buttons"
  - "encodeToggle/parseGroceryCallback callback data encoding/decoding"
  - "formatGroceryList HTML formatter with store/section grouping and strikethrough"
  - "formatGroceryListSummary one-line progress counter"
  - "GROCERY_CB_PREFIX constant for callback routing"
affects: [07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InlineKeyboard from grammy for inline button generation (first use in codebase)"
    - "Callback data encoding with prefix routing (g:t:{id} format)"
    - "HTML list formatting with <s> strikethrough for checked items"

key-files:
  created:
    - src/grocery/buttons.ts
    - src/grocery/formatter.ts
  modified: []

key-decisions:
  - "Callback data format g:t:{id} -- 13 bytes max, well under 64-byte Telegram limit"
  - "80-item safety valve on buttons -- skip keyboard entirely for very large lists"
  - "2 buttons per row for mobile readability"
  - "Button labels truncated to 30 chars to prevent overflow"
  - "Unchecked items sorted before checked within each section for visibility"
  - "Empty list handled gracefully with 'No items yet.' message"

patterns-established:
  - "InlineKeyboard builder grouped by store/section with row management"
  - "Callback data prefix routing pattern (GROCERY_CB_PREFIX = 'g:')"
  - "HTML grocery list with store (bold) > section (italic) > item hierarchy"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 7 Plan 3: Telegram Interaction Utilities Summary

**InlineKeyboard builder with compact callback encoding and HTML grocery list formatter with store/section grouping and strikethrough for checked items**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T21:53:17Z
- **Completed:** 2026-02-08T21:54:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Inline keyboard builder generates per-item toggle buttons for unchecked grocery items, grouped by store and section
- Compact callback data encoding (g:t:{id}) stays under 64 bytes even with large item IDs
- HTML formatter produces Telegram-ready output with bold store headers, italic section headers, and strikethrough for checked items
- Safety valve skips buttons when >80 unchecked items to stay under Telegram's 100-button limit

## Task Commits

Each task was committed atomically:

1. **Task 1: Inline keyboard builder with callback data encoding** - `0c3a79b` (feat)
2. **Task 2: Grocery list HTML formatter with strikethrough** - `b9e41e4` (feat)

## Files Created/Modified
- `src/grocery/buttons.ts` - InlineKeyboard builder, callback data encoding/decoding, GROCERY_CB_PREFIX constant
- `src/grocery/formatter.ts` - HTML formatting for grocery list display with store/section grouping and strikethrough

## Decisions Made
- Callback data format "g:t:{id}" chosen for compactness -- 13 bytes max even with large IDs, well under 64-byte Telegram limit
- 80-item safety valve: when unchecked items exceed 80, keyboard is returned empty (conversational check-off fallback) to stay under Telegram's 100-button limit
- Button labels truncated at 30 characters to prevent mobile overflow
- 2 buttons per row chosen for mobile readability (Telegram displays cleanly at this width)
- Unchecked items sorted before checked items within each section so active items are visible at top
- Empty list case handled with "No items yet." message

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both utility modules ready for consumption by plan 07-04 (pipeline wiring)
- buildGroceryKeyboard ready for callback query handler to rebuild keyboard after toggle
- formatGroceryList ready for /grocery command and post-tool-loop message editing
- parseGroceryCallback ready for bot.on("callback_query:data") routing
- No blockers or concerns

## Self-Check: PASSED

---
*Phase: 07-grocery-lists*
*Completed: 2026-02-08*
