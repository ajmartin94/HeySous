---
created: 2026-02-19T02:03:54.431Z
title: Onboarding should push users to add existing recipes first
area: onboarding
files:
  - src/onboarding/
  - src/ai/system-prompt.ts
  - src/knowledge/
---

## Problem

Current onboarding is open-ended, which can feel overwhelming. Users get more value when they start from recipes they already make regularly. The onboarding flow should actively encourage users to share their existing go-to meals, even if Sous generates the recipe cards from descriptions. This builds an immediately useful recipe brain and makes the first meal plan more relevant.

## Solution

- Modify onboarding flow to include a "What do you already cook?" step
- Prompt users to list 5-10 meals they make regularly (even just names)
- Sous generates recipe cards from these, confirming details as needed
- First meal plan suggestion draws from these established recipes rather than being open-ended
- Tricky trade-off: some users may prefer discovery/new ideas over existing recipes. Consider detecting user intent or offering both paths ("Want to plan from your favorites, or try something new?")
- Could be a phased approach: get existing recipes first, then layer in new suggestions
