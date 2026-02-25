---
created: 2026-02-21T15:25:00.866Z
title: Replace token estimation heuristic with accurate counting
area: ai
tags: [performance, accuracy, audit-medium]
files:
  - src/knowledge/token-budget.ts:13-15
---

## Problem

Token budget enforcement uses a 4 chars/token heuristic:

```typescript
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

Claude's tokenizer averages ~1.3 chars/token for English. The 4 chars/token estimate is ~3x too conservative, meaning token budgets are exhausted much earlier than necessary. Useful context (conversation history, knowledge items, preferences) gets dropped prematurely because the budget thinks it's fuller than it actually is.

## Solution

Options (in order of preference):
1. Use `js-tiktoken` library for accurate cl100k_base token counting.
2. Calibrate the heuristic using actual token counts from API responses (logged in `token_usage` table) -- could derive a project-specific chars/token ratio.
3. At minimum, adjust the heuristic to ~1.5 chars/token (conservative but much more accurate than 4).

Add logging to compare estimated vs. actual tokens for ongoing calibration.
