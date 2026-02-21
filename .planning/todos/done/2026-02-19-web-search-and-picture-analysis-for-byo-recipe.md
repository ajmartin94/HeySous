---
created: 2026-02-19T02:03:54.431Z
title: Web search and picture analysis for byo-recipe
area: ai
files:
  - src/ai/tools.ts
  - src/ai/tool-handler.ts
  - src/knowledge/
---

## Problem

Users should be able to bring their own recipes by sharing a URL or a photo (e.g., screenshot of a recipe, photo of a cookbook page). Currently Sous can only work with text-based recipe input. Adding web search would let users say "find me a recipe for X" and picture analysis would let them snap a photo of a recipe card or cookbook.

## Solution

- Add web search tool: fetch URL content, extract recipe structured data (schema.org Recipe, or parse HTML)
- Add image analysis: leverage Claude's vision capability to extract recipe from photos
- Parse extracted content into the standard recipe card format
- Consider rate limiting and caching for web fetches
- Research: what recipe URL formats are most common (allrecipes, NYT Cooking, etc.)
