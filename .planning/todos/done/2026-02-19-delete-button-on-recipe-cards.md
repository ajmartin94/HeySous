---
created: 2026-02-19T02:03:54.431Z
title: Delete button on recipe cards
area: ui
files:
  - mini-app/src/
  - src/mini-app/routes/
  - src/knowledge/repository.ts
---

## Problem

Users cannot delete recipe cards from the Mini App. If Sous creates a duplicate, a bad recipe, or the user simply no longer wants a recipe, there's no way to remove it through the UI. Currently would need to ask Sous to delete it via chat.

## Solution

- Add delete button/icon to recipe card detail view in Mini App
- Create DELETE API endpoint (e.g., DELETE /api/knowledge/:id)
- Add confirmation dialog before deletion
- Ensure the knowledge repository has a delete method (or add one)
- Consider soft delete vs hard delete (soft delete might be safer initially)
