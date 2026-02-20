---
created: 2026-02-19T02:06:36.757Z
title: Dates occasionally screwed up in meal plans
area: planning
files:
  - src/planning/date-utils.ts
  - src/planning/context.ts
  - src/ai/system-prompt.ts
---

## Problem

Dates in meal plans are intermittently wrong. This is a bug that surfaces occasionally but not consistently, making it hard to reproduce. Could be related to timezone handling, week start date calculation, day-of-week indexing, or how the AI interprets/generates dates in the system prompt context.

## Solution

- TBD -- needs investigation to identify root cause
- Audit date-utils.ts for timezone edge cases (UTC vs local, midnight boundaries)
- Check how the current date/week is communicated to Claude in the system prompt
- Review day-of-week mapping (0=Monday through 6=Sunday) for off-by-one potential
- Look at production logs/MCP debug server to capture the next occurrence
- Consider adding date validation in savePlan to catch obviously wrong dates
