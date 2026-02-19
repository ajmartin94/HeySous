---
created: 2026-02-19T02:03:54.431Z
title: Easy-click filtering on tags in mini app
area: ui
files:
  - mini-app/src/
---

## Problem

The Mini App already has search/filtering functionality and recipe tags, but the UX for filtering by tag requires manual searching. Users should be able to tap a tag on a recipe card and immediately filter the list to show all recipes with that tag.

## Solution

- Make tag chips on recipe cards clickable/tappable
- On tap, apply that tag as a filter to the recipe list view
- Consider: tag chips in the search/filter bar for active filters with "x" to remove
- Keep the existing search functionality, just add tag-click as a shortcut to filter
- Ensure smooth navigation: tapping a tag from a recipe detail view should go back to list with filter applied
