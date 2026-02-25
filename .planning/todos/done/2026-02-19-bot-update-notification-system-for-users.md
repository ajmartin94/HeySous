---
created: 2026-02-19T02:03:54.431Z
title: Bot update notification system for users
area: bot
files:
  - src/bot/handlers/
  - src/users/
---

## Problem

Users have no way to discover new features or fixes after a deploy. There's no app store changelog -- the bot is the only communication channel. Need a mechanism for Sous to proactively message users with friendly "I've been updated!" announcements when meaningful changes ship.

## Solution

- Add `last_notified_version` column to users/households table
- Create a startup or one-shot routine that messages users whose version is behind
- Define a "current version message" config (not every deploy, only meaningful updates)
- Keep messages brief and personality-driven -- 1-2 bullet highlights, not a changelog dump
- Rate limit to meaningful updates only (bundle small fixes)
