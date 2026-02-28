---
created: 2026-02-21T15:25:00.866Z
title: Validate extracted recipe quality before allowing save
area: ai
tags: [data-integrity, validation, audit-medium]
files:
  - src/ai/tool-handler.ts:658-671
---

## Problem

The `import_from_url` tool handler returns whatever `fetchAndParseRecipe()` extracts with no quality validation:

```typescript
const result = await fetchAndParseRecipe(url);
return JSON.stringify(result);
```

If the extraction returns a recipe with missing ingredients or incomplete steps, Claude receives it and may save it as-is. Partial extractions get saved to the knowledge base as broken recipe entries.

## Solution

After extracting, validate that the result contains minimum required fields:
- Recipe has a title
- Recipe has ingredients (at least 2-3)
- Recipe has instructions/steps (at least 1)

If any critical field is missing, return a clear error message to Claude: "Could not extract a complete recipe from that URL -- missing [field]. Try a different link or add the recipe manually."
