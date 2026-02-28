---
created: 2026-02-21T04:12:25.791Z
title: Update help docs on release
area: general
files:
  - mini-app/src/pages/Help.tsx
  - src/bot/handlers/help.ts
---

## Problem

The Mini App help page (`Help.tsx`) documents available features and commands, but it doesn't get updated when new features ship. After each milestone release, users may not know about new capabilities unless they happen to see the release notes notification.

The help page should be reviewed and updated as part of the release process to ensure it accurately reflects current features.

## Solution

Add "update Help.tsx" as a step in the release checklist (CLAUDE.md Releasing section). Review the help page content against shipped features each milestone and update sections/examples as needed.
