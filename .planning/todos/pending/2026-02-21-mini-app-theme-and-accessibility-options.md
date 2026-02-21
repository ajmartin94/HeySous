---
created: 2026-02-21T04:15:00.000Z
title: Mini App theme and accessibility options
area: ui
files:
  - mini-app/src/pages/Help.tsx
  - mini-app/src/App.tsx
---

## Problem

Bekah reported that the Mini App's color scheme and font choices in the recipe section are hard to read. The green tags don't pop and can appear blurred for users with glasses. Currently there are no user-facing options to adjust themes, font sizes, or contrast.

Accessibility is a real concern -- users have different vision needs and the current one-size-fits-all design doesn't accommodate that.

## Solution

Add a settings/preferences page in the Mini App with options for:
- Theme selection (e.g., light/dark/high-contrast)
- Font size adjustment (small/medium/large)
- Tag color contrast improvements (the green tags specifically need better contrast ratios)

Consider using CSS custom properties (already in use as `var(--hs-accent)`, etc.) to make theming straightforward. Store preferences in localStorage or per-user in the database.
