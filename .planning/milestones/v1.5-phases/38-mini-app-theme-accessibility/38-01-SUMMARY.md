---
phase: 38-mini-app-theme-accessibility
plan: 01
subsystem: ui
tags: [react, css-custom-properties, theming, dark-mode, font-size, localStorage, telegram-mini-app]

# Dependency graph
requires:
  - phase: 25-mini-app-hub
    provides: Hub page, Layout component, router, CSS variables
provides:
  - ThemeProvider React context with localStorage persistence
  - CSS custom properties for light/dark themes with Telegram variable overrides
  - Font size scale (small/medium/large) via data attributes
  - Settings page with live-preview theme and font controls
  - Gear icon navigation in Hub header
affects: [38-02-mini-app-theme-accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-attribute theming via html element, Telegram CSS variable override pattern, pill toggle buttons]

key-files:
  created:
    - mini-app/src/theme/ThemeContext.tsx
    - mini-app/src/pages/Settings.tsx
  modified:
    - mini-app/src/theme/variables.css
    - mini-app/src/theme/tokens.ts
    - mini-app/src/App.tsx
    - mini-app/src/router.tsx
    - mini-app/src/pages/Hub.tsx
    - mini-app/index.html

key-decisions:
  - "Override Telegram --tg-theme-* and --tgui--* CSS variables per theme so existing component CSS works unchanged"
  - "Default theme Dark with Small font size for new users"

patterns-established:
  - "Theme via data-theme attribute on html element, controlled by ThemeContext"
  - "Font size via data-font-size attribute on html element with 3 presets"
  - "Settings page uses inline styles consistent with Help/Feedback pages"

requirements-completed: [UX-01]

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 38 Plan 01: Theme Infrastructure Summary

**Light/Dark theme toggle and Small/Medium/Large font size scale with React context, CSS custom properties overriding Telegram variables, and a Settings page accessible from Hub gear icon**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T01:13:38Z
- **Completed:** 2026-02-24T01:18:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- CSS custom properties define complete light/dark palettes with Telegram variable overrides so existing component CSS (recipes, grocery, meal-plan) works without changes
- ThemeProvider context manages theme and fontSize state with localStorage persistence and instant DOM updates
- Settings page with pill-toggle controls for appearance and text size, plus a live preview section
- Gear icon in Hub header navigates to Settings page

## Task Commits

Each task was committed atomically:

1. **Task 1: Theme CSS variables and font size scale** - `ae4584c` (feat)
2. **Task 2: ThemeContext, Settings page, and navigation wiring** - `b310cac` (feat)

## Files Created/Modified
- `mini-app/src/theme/variables.css` - Restructured with [data-theme] dark/light selectors and [data-font-size] selectors; overrides Telegram theme variables per theme
- `mini-app/src/theme/tokens.ts` - Added fontSizePresets, FontSize, Theme type exports
- `mini-app/src/theme/ThemeContext.tsx` - React context providing theme/fontSize state with localStorage persistence
- `mini-app/src/pages/Settings.tsx` - Settings page with theme toggle, font size pills, and live preview
- `mini-app/src/App.tsx` - Wrapped RouterProvider with ThemeProvider
- `mini-app/src/router.tsx` - Added /settings route
- `mini-app/src/pages/Hub.tsx` - Added gear icon button navigating to /settings
- `mini-app/index.html` - Added default data-theme="dark" and data-font-size="small" attributes

## Decisions Made
- Override Telegram `--tg-theme-*` and `--tgui--*` CSS variables within each `[data-theme]` block so all existing component CSS files (recipes.css, grocery.css, meal-plan.css) work with themes without any modifications
- Default Dark theme and Small font size for new users, as specified by user decision
- Gear icon uses hint color (not accent) so it doesn't compete with the HeySous brand in the Hub header

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme infrastructure complete and ready for Plan 02 (high-contrast mode and ARIA accessibility)
- All existing CSS already respects the theme via Telegram variable overrides
- No blockers

## Self-Check: PASSED

All 8 files verified present. Both task commits (ae4584c, b310cac) verified in git log.

---
*Phase: 38-mini-app-theme-accessibility*
*Completed: 2026-02-24*
