---
created: 2026-02-21T15:25:00.866Z
title: Cross-reference dinner time sync in reminder prompt
area: ai
tags: [prompt-quality, audit-low]
files:
  - src/ai/system-prompt.ts:197-233
  - src/ai/system-prompt.ts:404-406
---

## Problem

There's a special rule about syncing dinner time to reminder settings in the PREFERENCE_MANAGEMENT section (line 404-406):

```
DINNER TIME SYNC:
- When a user states their dinner time, save it as a preference AND call
  update_reminder_settings with the corresponding dinner_time value
```

But this is NOT mentioned in the REMINDER_PROMPT section (lines 197-233) which defines reminder operations. A user asking to change dinner time in a reminder context could trigger Claude to update reminder settings but forget to save the preference, or vice versa.

## Solution

Add a cross-reference in the REMINDER_PROMPT section near the `dinner_time` field documentation:

```
Note: When a user mentions their dinner time, this must be saved BOTH as a preference
(via save_knowledge) AND as a reminder setting (via update_reminder_settings).
See DINNER TIME SYNC in preference management.
```
