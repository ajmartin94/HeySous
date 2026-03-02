---
created: 2026-02-21T15:25:00.866Z
title: Make conversation session boundary configurable
area: ai
tags: [configuration, audit-low]
files:
  - src/conversation/context-builder.ts:19-20
---

## Problem

The 4-hour session boundary is hardcoded:

```typescript
const SESSION_GAP_MS = 4 * 60 * 60 * 1000;
```

No configuration option, no documentation of why 4 hours was chosen, no way to override per-user. A Telegram conversation could naturally extend over an evening of cooking, and users might come back to planning the same meal multiple times within 4 hours.

## Solution

Move `SESSION_GAP_MS` to config (with 4 hours as default). Add a comment documenting the rationale. Consider whether the session boundary should be per-household configurable or remain a global setting.
