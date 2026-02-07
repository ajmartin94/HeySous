---
phase: 05-preference-learning
plan: 02
subsystem: bot-commands
tags: [preferences, telegram, command-handler, html-formatting]
dependency-graph:
  requires: [05-01]
  provides: ["/preferences command handler", "preference display grouping"]
  affects: [06-meal-planning]
tech-stack:
  added: []
  patterns: ["tag-based category grouping", "factory command handler"]
key-files:
  created:
    - src/bot/handlers/preferences.ts
  modified:
    - src/bot/index.ts
    - src/main.ts
decisions:
  - id: "05-02-01"
    decision: "Preference grouping priority: household > dietary > schedule > cooking > other"
    reason: "Household preferences (e.g. kid allergies) are most important and should always group separately regardless of other tags"
  - id: "05-02-02"
    decision: "No admin restriction on /preferences -- any user can view their own"
    reason: "Consistent with /debug pattern; preferences are per-chat so no privacy concern"
metrics:
  duration: "2 min"
  completed: "2026-02-07"
---

# Phase 5 Plan 2: Preferences Command Summary

**Instant /preferences command displaying grouped preferences with allergy/restriction/inferred markers, wired into bot middleware before the catch-all message handler.**

## What Was Done

### Task 1: Create /preferences command handler
Created `src/bot/handlers/preferences.ts` with:
- `createPreferencesHandler(sqlite)` factory returning `Composer<BotContext>`
- `groupPreferences(prefs)` function classifying by tag priority: household > dietary > schedule > cooking > other
- `formatPreferenceLine(pref)` adding [ALLERGY], [RESTRICTION], [inferred] markers based on tags
- `buildPreferencesMessage(groups)` generating HTML with section headers, only for non-empty groups
- Empty state returns helpful onboarding message (no HTML formatting needed)
- Uses `sendFormattedMessage` for reliable HTML delivery with fallback
- Zero Claude API calls -- pure database read

### Task 2: Wire preferences handler into bot and main
- Added `preferencesHandler: Composer<BotContext>` to `CreateBotOptions` interface
- Registered `bot.use(preferencesHandler)` after debugHandler, before messageHandler (catch-all)
- Updated middleware order comment to 9 items
- In `main.ts`: imported `createPreferencesHandler`, created with `sqlite`, passed to `createBot`

## Decisions Made

1. **Preference grouping priority** (05-02-01): household > dietary > schedule > cooking > other. Household preferences override all other categories because they represent different people's needs.
2. **No admin restriction** (05-02-02): Any user can view their own preferences, matching /debug pattern.

## Deviations from Plan

None -- plan executed exactly as written.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create /preferences command handler | f3c3589 | src/bot/handlers/preferences.ts |
| 2 | Wire preferences handler into bot and main | e3d286e | src/bot/index.ts, src/main.ts |

## Verification

- `npx tsc --noEmit` passes with zero errors
- `src/bot/handlers/preferences.ts` exports `createPreferencesHandler`
- `src/bot/index.ts` registers preferencesHandler before messageHandler
- `src/main.ts` creates and passes preferencesHandler
- Middleware order: costs -> debug -> preferences -> message
- All imports use `.js` extensions

## Self-Check: PASSED
