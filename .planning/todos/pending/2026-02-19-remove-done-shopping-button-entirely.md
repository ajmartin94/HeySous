---
created: 2026-02-19T02:03:54.431Z
title: Remove done shopping button entirely
area: grocery
files:
  - src/grocery/
  - src/bot/handlers/
---

## Problem

The "done shopping" button on the grocery list is unnecessary and should be removed entirely.

## Solution

- Remove the "done shopping" inline button from grocery list messages
- Clean up any handler code for the done shopping callback
- Remove any related state tracking if it exists
