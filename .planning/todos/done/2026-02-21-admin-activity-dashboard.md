---
created: 2026-02-21T04:17:00.000Z
title: Admin activity dashboard
area: ui
files:
  - mini-app/src/pages/Help.tsx
  - src/mini-app/router.ts
  - src/pipeline/processor.ts
---

## Problem

As the app admin, there's no easy way to see what's happening across the application. Checking activity currently requires SSH-ing into prod and running raw SQL queries via the MCP debug server. There's no at-a-glance view of:

- Who's using the bot and how often
- Recent conversations / message volume
- Tool call activity (what Claude is doing)
- Feedback submitted (meal feedback checkins, app feedback)
- Token usage / cost trends
- Errors or failed interactions

This makes it hard to understand usage patterns, spot issues, or know if features are actually being used (e.g., we just discovered feedback checkins are stuck in pending and app_feedback has 0 rows despite a user submitting feedback).

## Solution

Add an admin-only dashboard to the Mini App (behind the existing `isAdmin` role check). Could include:

- **Activity feed**: Recent messages across all households (last 24h/7d)
- **Usage stats**: Message counts, active users, conversations per day
- **Cost tracking**: Token usage and estimated costs over time (data already in `token_usage` table)
- **Feedback overview**: Meal feedback checkin statuses, app feedback entries
- **Health indicators**: Pending reminders, stuck checkins, error counts

API routes would go under `/api/admin/*` with admin-only middleware. Data is all already in the database -- just needs API endpoints and a UI to surface it.
