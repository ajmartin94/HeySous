---
created: 2026-02-21T15:25:00.866Z
title: Improve knowledge deduplication beyond title-only matching
area: ai
tags: [data-integrity, audit-high]
files:
  - src/ai/tool-handler.ts:106-148
---

## Problem

The deduplication logic in `save_knowledge` only checks:
1. Exact title match (case-insensitive)
2. FTS BM25 relevance on title-weighted search (threshold < 5)

This misses:
- Near-match titles: "Chicken Stir Fry" vs "Chicken Stir-Fry"
- Reordered titles: "Baked Chicken" vs "Chicken Baked"
- Same recipe, different name: "Mom's Pasta" vs "Spaghetti Bolognese"

The BM25 threshold of 5 is arbitrary and undocumented. Users can accumulate duplicate recipe entries, fragmenting their knowledge base.

## Solution

1. Search on both title AND summary/content for better duplicate detection.
2. Normalize titles before comparison (lowercase, strip punctuation, sort words).
3. Consider fuzzy matching (Levenshtein distance) for near-match titles.
4. Document why the BM25 threshold was chosen and calibrate it.
5. When a near-match is found, return it to Claude with instructions to ask the user if they want to update or create new.
