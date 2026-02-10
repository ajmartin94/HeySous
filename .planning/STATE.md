# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** Phase 12 - Grocery List Mini App (v1.1 Mini Apps milestone)

## Current Position

Phase: 12 of 14 (Grocery List)
Plan: 3 of 3 in current phase (12-03 complete -- phase done)
Status: Phase 12 Complete
Last activity: 2026-02-10 -- Completed 12-03 Quick-add, MainButton, Polling

Progress: [########░░] 14%

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 30
- Average duration: 2.8 min
- Total execution time: 83 min

**v1.1 Velocity:**
- Total plans completed: 6
- Average duration: 8 min
- Total execution time: 45 min

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 11-01 | API & Auth Infrastructure | 8 min | 2 | 7 |
| 11-02 | Frontend SPA | 21 min | 2 | 19 |
| 11-03 | Bot-to-Mini-App Wiring | 7 min | 2 | 4 |
| 12-01 | Grocery API & Section Utilities | 2 min | 2 | 5 |
| 12-02 | Grocery List React Page | 3 min | 2 | 10 |
| 12-03 | Quick-add, MainButton, Polling | 4 min | 2 | 5 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v1.0 decisions documented with outcomes.

v1.1 decisions:
- Recipes counted via knowledge_tags (tag='recipe') since knowledge_items has no type column
- API router created in both webhook and polling modes for dev testing
- Express route order: static -> API -> webhook -> SPA fallback
- Used retrieveRawInitData() instead of retrieveLaunchParams().initDataRaw (SDK v3 API)
- Used --legacy-peer-deps for React 19 + @telegram-apps/telegram-ui peer dep conflict
- BackButton uses isAvailable() guard for graceful non-Telegram env handling
- Plan handler uses ctx.reply with reply_markup instead of sendFormattedMessage for keyboard support
- WebApp button preserved on grocery keyboard rebuild during item toggle callbacks
- Duplicated SECTION_ORDER constants across server/client (no shared imports across build boundary)
- guessSection uses case-insensitive substring matching with ~50 keywords across 6 sections
- Used notificationOccurred('success') for haptic feedback (Android-compatible)
- GroceryItem interface defined locally in useGroceryList.ts (createdAt as string)
- Progress counter shows global totals across all stores
- 800ms animation delay before checked item moves to Done section
- Always poll every 8s on Grocery page (avoids circular hook dependency with hasActiveList)
- mainButton.setParams called directly in handler for loader (avoids useCallback dep cycle)
- QuickAddFab form stays open after add for rapid multi-item entry
- FAB positioned at safe-area + 80px to sit above native MainButton

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 12-03-PLAN.md (Quick-add, MainButton, Polling)
Resume file: None
Next action: Phase 12 complete. Plan Phase 13 or verify Phase 12.
