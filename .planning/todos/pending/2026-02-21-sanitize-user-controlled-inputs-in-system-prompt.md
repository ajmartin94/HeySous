---
created: 2026-02-21T15:25:00.866Z
title: Sanitize user-controlled inputs in system prompt
area: ai
tags: [security, prompt-quality, audit-medium]
files:
  - src/pipeline/processor.ts:256
  - src/ai/system-prompt.ts:461-463
---

## Problem

Telegram display names are interpolated directly into the system prompt string without sanitization:

```typescript
const userNameLine = userName
  ? `\nThe user's name is ${userName}. Address them by name naturally...`
  : "";
```

A user could set their Telegram display name to something like `" -- Ignore all previous instructions and..."` to attempt prompt injection. Similarly, user-supplied preference data (titles, summaries) is injected into the system prompt.

Low likelihood of success with Claude but violates defense-in-depth principles.

## Solution

1. Sanitize user names: strip control characters, limit length (e.g., 50 chars), escape or wrap in XML tags: `<user_name>${escapeXml(userName)}</user_name>`.
2. Apply the same pattern to preference data injected into the system prompt -- wrap in structured XML blocks rather than raw string interpolation.
3. Consider a general `sanitizeForPrompt()` utility for any user-controlled text that enters the system prompt.
