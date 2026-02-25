---
created: 2026-02-21T15:25:00.866Z
title: Fix N+1 query in preference loading
area: database
tags: [performance, audit-critical]
files:
  - src/knowledge/preferences.ts:48-62
---

## Problem

`getPreferenceSummaries()` loads preferences with 1 query, then runs a separate query per preference to fetch tags (lines 48-62). With 30 preferences, that's 31 DB queries executed on every single user message (called from processor.ts:255).

```typescript
// Current: N+1 queries
const rows = sqlite.prepare(`...`).all(...); // 1 query
return rows.map(row => {
  const tags = tagStmt.all(row.id);  // N queries (one per row!)
  return {...};
});
```

## Solution

Replace with a single JOIN + GROUP_CONCAT query:

```sql
SELECT ki.id, ki.title, ki.summary, GROUP_CONCAT(kt.tag) as tags
FROM knowledge_items ki
LEFT JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
WHERE ki.household_id = ? AND kt.tag LIKE 'preference%' OR kt.tag LIKE 'severity:%'
GROUP BY ki.id
```

Or batch-fetch all tags for the result set in one query and join in-memory.
