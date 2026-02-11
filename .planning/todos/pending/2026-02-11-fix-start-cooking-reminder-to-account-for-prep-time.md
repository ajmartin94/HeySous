---
created: 2026-02-11T19:36:34.676Z
title: Fix start_cooking reminder to account for prep time
area: reminders
files:
  - src/reminders/generator.ts:181-184
---

## Problem

The `start_cooking` reminder fires AT `dinnerTime` (e.g., 6:00 PM) instead of before it. The nudge should fire early enough for the user to prep the meal so it's ready by `dinnerTime`. Currently, `dueAt` is set directly to `localTimeToUtc(currentDate, settings.dinnerTime, settings.timezone)` with no prep offset.

The user reported: "the bot said dinner reminders will hit at 6pm but that's when dinner should be on the table."

## Solution

Calculate a prep-time offset before `dinnerTime`. Options:
- Use a fixed default (e.g., 30-60 minutes before dinner time)
- Look up recipe prep/cook time from knowledge if available and subtract that
- Add a `prep_offset_minutes` setting to `reminder_settings` table

The nudge message should say something like "Time to start cooking [recipe] -- dinner's at [dinnerTime]" rather than firing when dinner should already be ready.
