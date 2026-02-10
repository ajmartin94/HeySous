# Phase 13: Recipe Browser - Research

**Researched:** 2026-02-10
**Domain:** Recipe browsing UI (React SPA, FTS5 search, SQLite queries, Telegram Mini App)
**Confidence:** HIGH

## Summary

Phase 13 adds a read-only recipe browsing experience to the existing Mini App. Users see all their recipes as scrollable cards, search via FTS5, tap into full recipe detail, and filter by tags. The infrastructure is already in place from Phases 11/12: React+Vite SPA at `/app/recipes`, Express API router at `/api/*` with initData auth, and the full knowledge system with FTS5 search, knowledge_tags, and cooking history.

The primary technical challenge is mapping the existing knowledge_items data model (which stores recipes as plain-text content with structured sections) to a visual card/detail UI. Recipes are identified by having a `recipe` tag in knowledge_tags. The "last cooked" date comes from the cooking_history table (joined via knowledge_item_id). There is no numeric "rating" field -- feedback is stored as sentiment annotations (positive/neutral/negative) appended to recipe content, so the recipe browser can derive a simple aggregate (e.g., net positive count or most recent sentiment).

No new libraries are needed. The existing stack (React 19, react-router-dom, @telegram-apps/telegram-ui, lucide-react, @tma.js/sdk-react) provides everything required. The API layer follows the established pattern: factory function returning route handlers, using raw SQLite queries, with chatId from auth middleware. The FTS5 search infrastructure (escapeForFts5, bm25 ranking, LIKE fallback) already exists in `src/knowledge/fts.ts` and can be reused directly for the recipe search API.

**Primary recommendation:** Build recipe API routes in `src/mini-app/routes/recipes.ts` using the same factory pattern as grocery.ts. Reuse existing `searchFts()` and `getFullItem()` from `src/knowledge/fts.ts` for search. Build the frontend as a `recipes/` component folder under `mini-app/src/components/` with a custom `useRecipes` hook following the `useGroceryList` pattern. Use React Router's existing `/recipes` route (already declared in router.tsx) with state-based navigation for list vs. detail views (no new routes needed).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Card design & list layout
- Full-width vertical list (one card per row), not a grid
- Text-only cards -- no thumbnails or images
- Card content: title, summary snippet (1-2 lines), tag pills, last-cooked date, rating (if available)
- Tag pills: show max 3 per card, then "+N more" indicator
- Tapping a tag pill filters the list to that tag

#### Recipe detail view
- Header shows: title, tag pills, last-cooked date, rating (if available)
- Ingredients grouped by section when sections exist (e.g., "For the crust", "For the filling"), flat list otherwise
- Instructions displayed as numbered steps with clear separation
- Notes section shown at the bottom when the recipe has personal notes (read-only)
- BackButton returns to list with scroll position preserved (per roadmap)

#### Search & filtering feel
- Search bar hidden behind a search icon in the header -- tap to expand
- Real-time FTS5 filtering as user types
- Active tag filter shown as a removable chip bar below the header (e.g., "dinner x")
- Search and tag filter combine -- results match both text query and tag
- Sort picker available: recent (default), alphabetical, most cooked

#### Empty & edge states
- Zero recipes: friendly message pointing back to bot ("No recipes yet -- tell me about a recipe in the chat to get started!")
- No search results: "No recipes found" + suggestion to try different search or clear filters
- Missing card data: hide missing fields (no tags = no pills shown, no date = line absent) -- cards adapt to available data
- Long recipes: natural scrolling, no collapsible sections -- everything visible

### Claude's Discretion
- Card spacing, typography, and shadow styling
- Search debounce timing
- Loading skeleton / spinner design
- Exact sort picker UI component
- How FTS5 query is constructed from user input
- Scroll position restoration technique

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.x | UI framework | Already installed in mini-app |
| `react-router-dom` | 7.13.x | Client-side routing | Already installed; `/recipes` route already declared |
| `@telegram-apps/telegram-ui` | 2.1.x | Telegram-native components | Already installed; Cell, Section, Chip, IconButton |
| `@tma.js/sdk-react` | 3.0.x | Telegram SDK (backButton) | Already installed; BackButton already wired |
| `lucide-react` | 0.563.x | Icons (Search, X, ChevronDown, CookingPot, Tag) | Already installed; tree-shakeable |

### Supporting (server-side, already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-sqlite3` | (project dep) | Raw SQL for FTS5 queries | Recipe list, search, detail, last-cooked date |
| `express` | (project dep) | API route handlers | New recipe routes in `/api/recipes/*` |

### Alternatives Considered

No new libraries needed. The existing stack covers all requirements.

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom scroll restoration | react-router-dom ScrollRestoration | ScrollRestoration component restores based on URL, but recipe list/detail uses same route (`/recipes`) with state-based view switching, so manual scroll position tracking via ref is more appropriate |
| Custom tag chips | @telegram-apps/telegram-ui Chip | Chip component exists but may need custom styling for removable filter chips; evaluate during implementation |

**Installation:** None required -- all dependencies already present.

## Architecture Patterns

### Recommended Project Structure

```
mini-app/src/
├── pages/
│   └── Recipes.tsx              # REPLACE placeholder with recipe browser
├── components/
│   └── recipes/
│       ├── RecipeCard.tsx        # Single recipe card component
│       ├── RecipeDetail.tsx      # Full recipe detail view
│       ├── RecipeList.tsx        # Scrollable card list with filters
│       ├── SearchHeader.tsx      # Expandable search bar + sort picker
│       ├── TagChipBar.tsx        # Active tag filter chip bar
│       ├── RecipeEmptyState.tsx  # Empty/no-results states
│       └── recipes.css           # Recipe-specific styles
├── hooks/
│   └── useRecipes.ts            # Data fetching, search, filter state
└── utils/
    └── recipeParser.ts          # Parse recipe content text into sections

src/mini-app/
├── router.ts                    # ADD recipe routes to API router
└── routes/
    └── recipes.ts               # NEW: Recipe API route handlers
```

### Pattern 1: Recipe API Routes (Server-Side)

**What:** API endpoints for recipe list, search, and detail.
**When to use:** All recipe data access from the Mini App.

Three endpoints following the existing grocery.ts pattern:

```typescript
// src/mini-app/routes/recipes.ts
import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { searchFts, escapeForFts5, getFullItem } from "../../knowledge/fts.js";

export function createRecipeRoutes(sqlite: BetterSqlite3.Database) {
  return {
    // GET /api/recipes?q=chicken&tag=dinner&sort=recent&limit=50
    getList(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const { q, tag, sort, limit } = req.query;
      // ... query recipes filtered by tag='recipe', optional search, optional tag filter
      // ... join cooking_history for last-cooked date
      // ... join feedback_checkins or parse content for rating
    },

    // GET /api/recipes/:id
    getDetail(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const id = Number(req.params.id);
      // ... getFullItem() then parse content sections
      // ... include last-cooked date from cooking_history
    },
  };
}
```

**Key design decisions for the API:**

1. **Recipe identification:** Recipes are knowledge_items that have a `recipe` tag in knowledge_tags. The list query JOINs these tables.

2. **Last-cooked date:** Derived from `cooking_history` table via `knowledge_item_id`:
   ```sql
   SELECT MAX(ch.cooked_date) AS last_cooked
   FROM cooking_history ch
   WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ?
   ```

3. **Rating/sentiment:** Feedback annotations are embedded in recipe content as text lines like `- 2026-01-15 [positive]: (button response, no notes)`. The API should parse these to derive a simple aggregate (count of positive, neutral, negative). Alternatively, query feedback_checkins directly via the meals_json field. Recommendation: Parse content's `Feedback:` section -- it is the authoritative source and avoids complex joins.

4. **FTS5 search with tag filter:** When the user types a search query, use the existing `searchFts()` function. When a tag filter is also active, add a WHERE clause filtering by knowledge_tags. When combining search + tag filter, first get FTS5 results, then filter by tag in a subquery or post-filter.

5. **Sort options:**
   - `recent` (default): ORDER BY ki.last_accessed_at DESC (or ki.updated_at DESC)
   - `alphabetical`: ORDER BY ki.title ASC
   - `most_cooked`: ORDER BY cooking count DESC (subquery on cooking_history)

### Pattern 2: Recipe Content Parsing (Client-Side)

**What:** Parse the plain-text recipe content into structured sections for the detail view.
**When to use:** After fetching recipe detail, before rendering.

Recipe content follows this format (from system prompt):
```
Ingredients:
- 2 cups flour
- 1 tsp salt

Steps:
1. Mix dry ingredients
2. Add wet ingredients

Prep Time: 10 min
Cook Time: 30 min
Total Time: 40 min
Servings: 4

Notes:
- Great with a side salad

Feedback:
- 2026-01-15 [positive]: loved it
- 2026-01-20 [neutral]: (button response, no notes)
```

**Ingredient sections:** Some recipes have sub-sections like "For the crust:" within the Ingredients block. These should be detected and grouped.

```typescript
// mini-app/src/utils/recipeParser.ts
interface ParsedRecipe {
  ingredientGroups: Array<{ heading: string | null; items: string[] }>;
  steps: string[];
  metadata: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
  };
  notes: string[];
  feedback: Array<{ date: string; sentiment: string; notes: string }>;
}

export function parseRecipeContent(content: string): ParsedRecipe {
  // Split content into sections by known headers
  // Parse each section according to its format
}
```

### Pattern 3: useRecipes Hook (Client-Side Data Management)

**What:** Custom hook managing recipe list state, search, filtering, and detail fetching.
**When to use:** In the Recipes page component.

```typescript
// mini-app/src/hooks/useRecipes.ts
// Follows same pattern as useGroceryList.ts

export function useRecipes() {
  // State: recipes[], loading, error, searchQuery, activeTag, sortBy
  // Actions: setSearchQuery (debounced), setActiveTag, setSortBy, fetchDetail
  // Returns: list data + active recipe detail + filter state + actions
}
```

**Debounce strategy for search:** Use a 300ms debounce on the search input. This balances responsiveness with API call frequency. The debounce is implemented via a setTimeout pattern (no need for lodash/debounce):

```typescript
const [inputValue, setInputValue] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(inputValue), 300);
  return () => clearTimeout(timer);
}, [inputValue]);

// Fetch triggered by debouncedQuery changes
useEffect(() => {
  fetchRecipes({ q: debouncedQuery, tag: activeTag, sort: sortBy });
}, [debouncedQuery, activeTag, sortBy]);
```

### Pattern 4: Scroll Position Preservation

**What:** When the user taps into recipe detail and presses BackButton, the list should restore to the previous scroll position.
**When to use:** List-to-detail navigation within the `/recipes` route.

**Technique:** Use a ref to store scroll position before navigating to detail. On returning, restore it.

```typescript
const scrollPositionRef = useRef(0);
const listRef = useRef<HTMLDivElement>(null);

function openDetail(recipeId: number) {
  // Save scroll position before switching to detail view
  scrollPositionRef.current = window.scrollY;
  setSelectedRecipeId(recipeId);
}

function closeDetail() {
  setSelectedRecipeId(null);
  // Restore after React re-renders the list
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollPositionRef.current);
  });
}
```

**Why this works:** The recipe list and detail are not separate routes -- they are different view states within the same `/recipes` route. This means the list component stays mounted (or re-mounts from the same data) when returning from detail. The scroll position ref survives because it is in the parent Recipes page component.

**BackButton integration:** The BackButton already navigates via `navigate(-1)` in the Layout. For the detail view, we need to intercept the BackButton to close the detail view instead of navigating away from `/recipes`. This requires a conditional BackButton handler.

```typescript
// In Recipes.tsx
useEffect(() => {
  if (selectedRecipeId === null) return;
  // Override back button to close detail instead of navigating away
  const off = backButton.onClick(() => {
    closeDetail();
  });
  return () => off();
}, [selectedRecipeId]);
```

### Pattern 5: List-Detail View Switching

**What:** Single-route view switching between recipe list and recipe detail.
**When to use:** Within the `/recipes` route.

**Why not separate routes:** Using `/recipes/:id` as a separate route would unmount the list component, losing list state (scroll position, loaded items, filter state). A single-route approach with `selectedRecipeId` state keeps everything in memory.

```typescript
export function Recipes() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const { recipes, loading, /* ...filter state */ } = useRecipes();
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null);

  if (selectedRecipeId !== null && recipeDetail) {
    return <RecipeDetail recipe={recipeDetail} onBack={closeDetail} />;
  }

  return <RecipeList recipes={recipes} onSelect={openDetail} /* ...filters */ />;
}
```

### Anti-Patterns to Avoid

- **Fetching all recipe content for the list view:** The list only needs title, summary, tags, and last-cooked date. Full content should only be fetched when the user taps into detail view.
- **Client-side FTS5 search:** FTS5 runs on the server (SQLite). Do not try to implement search client-side.
- **Separate routes for list and detail:** This unmounts the list, losing scroll position and filter state.
- **Updating last_accessed_at on browse:** The existing `getFullItem()` updates `last_accessed_at`. For browse purposes, this side effect is acceptable since it tracks when the user last viewed a recipe. However, the list endpoint should NOT update `last_accessed_at` for every recipe in the list.
- **Complex rating calculations on every list fetch:** Parse feedback counts on the server and cache them in the API response. Do not send raw feedback text to the client for list cards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom search algorithm | Existing `searchFts()` from `src/knowledge/fts.ts` | Already implements BM25 ranking, escaping, porter stemming, LIKE fallback |
| FTS5 query escaping | Custom sanitization | Existing `escapeForFts5()` from `src/knowledge/fts.ts` | Handles all FTS5 operators, wraps terms in quotes |
| Recipe content parsing | Regex from scratch | Simple line-based parser with known section headers | Content format is defined by the system prompt; headers are deterministic ("Ingredients:", "Steps:", "Notes:", "Feedback:") |
| Debounce | lodash debounce or custom hook library | setTimeout + useEffect cleanup | 4 lines of code, no dependency needed |
| Scroll restoration | Complex scroll manager | ref + requestAnimationFrame | Same-route view switching means scroll position is trivial to save/restore |
| Tag filtering | Custom filter UI from scratch | CSS pills with remove button | Simple flex layout with themed colors |
| API authentication | Custom auth | Existing `validateInitData` middleware + `res.locals.chatId` | Already handles HMAC validation, user extraction, 401 responses |

**Key insight:** Nearly all infrastructure exists. This phase is primarily UI work on the frontend and 1-2 new API endpoints on the backend. The FTS5 search, knowledge system, cooking history, and auth middleware are all battle-tested from prior phases.

## Common Pitfalls

### Pitfall 1: N+1 Query for Tags in Recipe List
**What goes wrong:** Fetching the recipe list and then making a separate query per recipe to get tags, causing O(n) queries.
**Why it happens:** Tags are in a separate table (knowledge_tags). The naive approach queries tags per item inside a loop, matching the pattern in `repository.ts` `listByChatId()`.
**How to avoid:** Use a single query that JOINs knowledge_tags and aggregates tags with GROUP_CONCAT:
```sql
SELECT ki.id, ki.title, ki.summary, ki.last_accessed_at,
       GROUP_CONCAT(kt.tag, ',') AS tags
FROM knowledge_items ki
JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
WHERE ki.chat_id = ? AND EXISTS (
  SELECT 1 FROM knowledge_tags kt2
  WHERE kt2.knowledge_item_id = ki.id AND kt2.tag = 'recipe'
)
GROUP BY ki.id
```
**Warning signs:** Slow recipe list load times with many recipes.

### Pitfall 2: FTS5 Search + Tag Filter Combination
**What goes wrong:** Combining FTS5 MATCH with tag filtering produces incorrect results or errors.
**Why it happens:** FTS5 queries use `knowledge_fts MATCH ?` which operates on the virtual table. Adding a tag filter requires joining back to knowledge_tags. The query order matters.
**How to avoid:** When search query is provided, use FTS5 first to get matching IDs, then filter by tag. When only tag filter (no search), use a direct SQL query. Two separate query paths:
```
- Search only: searchFts() -> results have IDs -> filter by tag in post-processing or subquery
- Tag only: Direct SQL with knowledge_tags JOIN
- Both: searchFts() -> filter results by tag (in-memory or subquery)
- Neither: Direct SQL, all recipes
```
**Warning signs:** Empty results when both search and tag filter are active, even though matches exist.

### Pitfall 3: Recipe Content Format Variations
**What goes wrong:** Content parser fails on recipes with non-standard formatting.
**Why it happens:** Recipes are created by Claude via save_knowledge. While the system prompt defines the format, Claude may introduce variations (extra whitespace, slightly different section headers, missing sections).
**How to avoid:** Make the parser defensive: handle missing sections gracefully, trim whitespace, use case-insensitive header matching, fall back to showing raw content if parsing fails completely. Each section is optional.
**Warning signs:** Recipe detail view shows empty sections or crashes on certain recipes.

### Pitfall 4: BackButton Conflict Between List and Detail
**What goes wrong:** Pressing BackButton in detail view navigates away from `/recipes` entirely instead of returning to the list.
**Why it happens:** The Layout component's useBackButton already binds `navigate(-1)` to the BackButton. Opening detail view doesn't push a new route, so BackButton goes to the previous route (e.g., Hub).
**How to avoid:** When detail view is active, register a new BackButton onClick handler that closes the detail view. The new handler should be registered in a useEffect that runs when `selectedRecipeId` changes. The Layout's handler will be superseded by the more recent onClick registration. On cleanup (detail closes), the Layout's handler resumes.
**Warning signs:** BackButton takes user back to Hub instead of recipe list.

### Pitfall 5: Search Debounce Fires After Unmount
**What goes wrong:** State update on unmounted component warning, or stale results appear.
**Why it happens:** The 300ms debounce timer fires after the user navigates away from the recipes page.
**How to avoid:** Clear the timeout in the useEffect cleanup. Use an isMounted ref pattern (same as useGroceryList):
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (isMountedRef.current) setDebouncedQuery(inputValue);
  }, 300);
  return () => clearTimeout(timer);
}, [inputValue]);
```
**Warning signs:** Console warnings about state updates on unmounted components.

### Pitfall 6: Cooking History Count for "Most Cooked" Sort
**What goes wrong:** "Most cooked" sort returns unexpected order or is very slow.
**Why it happens:** The cooking_history table links via knowledge_item_id, which may be NULL for some entries (unplanned meals without a stored recipe). Also, counting requires a subquery or GROUP BY that can be slow without an index.
**How to avoid:** Use a LEFT JOIN with COUNT and handle NULL knowledge_item_id. Consider adding an index on `cooking_history(knowledge_item_id)` if performance is an issue. Recipes with no cooking history should sort to the end (count = 0).
**Warning signs:** Recipes that have been cooked appear with count 0, or sort is noticeably slow.

## Code Examples

### Recipe List API Query (Verified Pattern from Existing Codebase)

Based on the existing `searchFts()` and `createSummaryRoute()` patterns:

```typescript
// Get all recipes for a user with tags, last-cooked date, and cook count
// Source: derived from src/knowledge/fts.ts and src/mini-app/routes/summary.ts patterns
const recipes = sqlite.prepare(`
  SELECT
    ki.id,
    ki.title,
    ki.summary,
    ki.content,
    ki.updated_at,
    ki.last_accessed_at,
    GROUP_CONCAT(DISTINCT kt.tag) AS tags,
    (
      SELECT MAX(ch.cooked_date)
      FROM cooking_history ch
      WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id
    ) AS last_cooked,
    (
      SELECT COUNT(*)
      FROM cooking_history ch
      WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id
    ) AS cook_count
  FROM knowledge_items ki
  JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
  WHERE ki.chat_id = ?
    AND ki.id IN (
      SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'recipe'
    )
  GROUP BY ki.id
  ORDER BY ki.last_accessed_at DESC
`).all(chatId);
```

### FTS5 Search Combined with Tag Filter

```typescript
// When user types a search query AND has a tag filter active:
// 1. Get FTS5 results (IDs only)
// 2. Filter those IDs by tag

function searchRecipesWithTag(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  query: string,
  tag: string,
  limit: number = 50
) {
  const escaped = escapeForFts5(query);
  if (!escaped) return [];

  return sqlite.prepare(`
    SELECT
      ki.id, ki.title, ki.summary, ki.last_accessed_at,
      GROUP_CONCAT(DISTINCT kt.tag) AS tags,
      bm25(knowledge_fts, 10.0, 5.0, 1.0) AS relevance,
      (SELECT MAX(ch.cooked_date) FROM cooking_history ch
       WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS last_cooked
    FROM knowledge_fts
    JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid
    JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
    WHERE knowledge_fts MATCH ?
      AND ki.chat_id = ?
      AND ki.id IN (
        SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'recipe'
      )
      AND ki.id IN (
        SELECT knowledge_item_id FROM knowledge_tags WHERE tag = ?
      )
    GROUP BY ki.id
    ORDER BY relevance ASC
    LIMIT ?
  `).all(escaped, chatId, tag, limit);
}
```

### Recipe Content Parser

```typescript
// mini-app/src/utils/recipeParser.ts
// Source: recipe format defined in src/ai/system-prompt.ts (lines 397-413)

interface IngredientGroup {
  heading: string | null;  // null = no sub-section header
  items: string[];
}

interface FeedbackEntry {
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  notes: string;
}

export interface ParsedRecipe {
  ingredientGroups: IngredientGroup[];
  steps: string[];
  metadata: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
  };
  notes: string[];
  feedback: FeedbackEntry[];
}

export function parseRecipeContent(content: string): ParsedRecipe {
  const lines = content.split('\n');
  let currentSection = '';
  const result: ParsedRecipe = {
    ingredientGroups: [],
    steps: [],
    metadata: {},
    notes: [],
    feedback: [],
  };

  let currentIngredientGroup: IngredientGroup = { heading: null, items: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headers
    if (/^ingredients:/i.test(trimmed)) { currentSection = 'ingredients'; continue; }
    if (/^steps:/i.test(trimmed)) { currentSection = 'steps'; continue; }
    if (/^notes:/i.test(trimmed)) { currentSection = 'notes'; continue; }
    if (/^feedback:/i.test(trimmed)) { currentSection = 'feedback'; continue; }

    // Detect metadata lines (not under a section header)
    const metaMatch = trimmed.match(/^(prep time|cook time|total time|servings):\s*(.+)/i);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      if (key === 'prep time') result.metadata.prepTime = metaMatch[2];
      if (key === 'cook time') result.metadata.cookTime = metaMatch[2];
      if (key === 'total time') result.metadata.totalTime = metaMatch[2];
      if (key === 'servings') result.metadata.servings = metaMatch[2];
      continue;
    }

    // Process based on current section
    switch (currentSection) {
      case 'ingredients':
        // Check for sub-section header (e.g., "For the crust:")
        if (trimmed.endsWith(':') && !trimmed.startsWith('-')) {
          if (currentIngredientGroup.items.length > 0) {
            result.ingredientGroups.push(currentIngredientGroup);
          }
          currentIngredientGroup = { heading: trimmed.slice(0, -1), items: [] };
        } else if (trimmed.startsWith('-')) {
          currentIngredientGroup.items.push(trimmed.slice(1).trim());
        }
        break;
      case 'steps':
        // Strip leading number and period/parenthesis
        const stepText = trimmed.replace(/^\d+[\.\)]\s*/, '');
        if (stepText) result.steps.push(stepText);
        break;
      case 'notes':
        if (trimmed.startsWith('-')) {
          result.notes.push(trimmed.slice(1).trim());
        } else {
          result.notes.push(trimmed);
        }
        break;
      case 'feedback':
        // Parse: "- 2026-01-15 [positive]: loved it"
        const fbMatch = trimmed.match(/^-\s*(\d{4}-\d{2}-\d{2})\s*\[(\w+)\]:\s*(.+)/);
        if (fbMatch) {
          result.feedback.push({
            date: fbMatch[1],
            sentiment: fbMatch[2] as FeedbackEntry['sentiment'],
            notes: fbMatch[3],
          });
        }
        break;
    }
  }

  // Push last ingredient group
  if (currentIngredientGroup.items.length > 0) {
    result.ingredientGroups.push(currentIngredientGroup);
  }

  return result;
}
```

### Feedback Sentiment Aggregation

```typescript
// Derive rating from feedback entries
// Source: feedback format from src/feedback/handler.ts appendFeedbackAnnotation()

export function computeRating(feedback: FeedbackEntry[]): {
  netScore: number;
  total: number;
  label: string | null;
} | null {
  if (feedback.length === 0) return null;

  let positive = 0, negative = 0;
  for (const fb of feedback) {
    if (fb.sentiment === 'positive') positive++;
    if (fb.sentiment === 'negative') negative++;
  }

  const netScore = positive - negative;
  const total = feedback.length;
  // Simple label: mostly positive, mixed, or needs improvement
  let label: string | null = null;
  if (total >= 2 && netScore >= 2) label = 'favorite';
  else if (netScore > 0) label = 'liked';
  else if (netScore === 0 && total > 0) label = 'mixed';
  else if (netScore < 0) label = 'needs work';

  return { netScore, total, label };
}
```

### Sort Picker UI (Discretion Area)

**Recommendation:** Use a simple dropdown/select styled as a pill button next to the search icon. When tapped, show a native-feeling list (using @telegram-apps/telegram-ui's Section + Cell for the options). Alternatively, use a bottom sheet pattern matching the QuickAddFab from grocery.

```typescript
// Simple sort options
type SortOption = 'recent' | 'alphabetical' | 'most_cooked';

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  alphabetical: 'A-Z',
  most_cooked: 'Most Cooked',
};
```

### Debounce Timing (Discretion Area)

**Recommendation:** 300ms debounce. Reasoning:
- 150ms feels too responsive (fires mid-typing, many unnecessary API calls)
- 500ms feels sluggish (user pauses and nothing happens)
- 300ms is the standard balance used by most search interfaces

### Loading Skeleton (Discretion Area)

**Recommendation:** Reuse the existing `SkeletonCard` component with 2-3 lines per card. Show 4-5 skeleton cards vertically during initial load. For search, show an inline spinner/dots indicator instead of replacing the list with skeletons (the list should persist during search updates to avoid layout jumping).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate route per view | State-based view switching within route | Standard pattern for list-detail in mobile SPAs | Preserves list state, simpler scroll restoration |
| Server-side HTML rendering | SPA with API + JSON | Phase 11 | Mini App is a React SPA with API calls |
| Manual tag management | Tags stored in knowledge_tags table | Phase 3 | Tags already support recipe filtering |

**Deprecated/outdated:**
- Nothing deprecated for this phase. All infrastructure from Phases 11-12 is current.

## Discretion Recommendations

### Card Spacing and Typography
- Card padding: 16px (matches `--hs-spacing-card`)
- Card gap: 12px between cards
- Title: 16px semi-bold (matches `--hs-font-size-body`)
- Summary: 14px regular, hint color, max 2 lines with text-overflow ellipsis
- Tag pills: 12px, accent color background with white text, rounded-full, 4px vertical padding, 8px horizontal padding
- Last-cooked date: 13px (matches `--hs-font-size-small`), hint color
- Cards: no box-shadow (flat design matching Telegram's aesthetic), subtle bottom border (0.5px, matches grocery items)

### Search Debounce Timing
- 300ms (reasoning detailed above in Code Examples)

### Loading Skeleton Design
- Reuse existing `SkeletonCard` component for initial load (4 cards shown)
- During search transitions: show subtle opacity change on the list (not full skeleton replacement)
- For recipe detail loading: single SkeletonCard with 6 lines

### Sort Picker UI
- Small text button next to the search icon showing current sort label (e.g., "Recent")
- Tap opens a bottom sheet (consistent with QuickAddFab pattern) showing the 3 sort options as tappable rows
- Selected option shows a checkmark
- Selecting an option closes the sheet and triggers re-sort

### FTS5 Query Construction
- Reuse existing `escapeForFts5()` from `src/knowledge/fts.ts`
- This strips operators, wraps terms in quotes, handles empty queries
- No modification needed

### Scroll Position Restoration
- Ref-based approach (detailed in Pattern 4 above)
- Save `window.scrollY` before switching to detail view
- Restore via `requestAnimationFrame` + `window.scrollTo` after returning to list

## Open Questions

1. **Feedback Sentiment vs. "Rating" Label**
   - What we know: CONTEXT.md mentions "rating (if available)" on recipe cards and detail headers. Feedback is stored as positive/neutral/negative/skipped sentiment annotations in recipe content. There is no numeric rating field.
   - What's unclear: Whether "rating" means a simple sentiment indicator (thumbs up/down count) or something more structured.
   - Recommendation: Derive rating from feedback sentiment count. Show as a simple indicator: a small colored dot or text label ("Liked", "Favorite", "Mixed") based on net score. If no feedback exists, hide the rating entirely. This matches the user's "rating (if available)" requirement.

2. **Tag Display Priority on Cards**
   - What we know: Max 3 tag pills per card, then "+N more". Recipes have many tags (recipe, cuisine:italian, meal:dinner, protein:chicken, difficulty:easy, etc.).
   - What's unclear: Which 3 tags to show first -- the "recipe" tag is always present but not useful on a recipe card.
   - Recommendation: Filter out the `recipe` tag (redundant -- every card is a recipe). Then filter out tags with prefixes that are less visually useful (like `difficulty:easy`). Prioritize showing: cuisine tags, meal type tags, protein tags. If fewer than 3 after filtering, show what's available.

3. **Tag Filter Combined with FTS5 Efficiency**
   - What we know: FTS5 MATCH and tag filtering require different table access patterns. Combining them in a single query is possible but requires careful query design.
   - What's unclear: At what recipe count (100? 1000?) does the combined query become a performance concern.
   - Recommendation: For the initial implementation, use the combined query approach (FTS5 + tag subquery). This will be efficient for typical personal recipe collections (10-200 recipes). If performance issues arise, add an index on `knowledge_tags(tag, knowledge_item_id)` and consider a two-step approach.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/knowledge/fts.ts` -- FTS5 search, escaping, BM25 ranking (direct code review)
- Existing codebase: `src/knowledge/schema.ts`, `src/knowledge/types.ts` -- knowledge data model (direct code review)
- Existing codebase: `src/knowledge/repository.ts` -- knowledge CRUD patterns (direct code review)
- Existing codebase: `src/planning/schema.ts`, `src/planning/history.ts` -- cooking history data model (direct code review)
- Existing codebase: `src/feedback/handler.ts` -- feedback annotation format (direct code review)
- Existing codebase: `src/mini-app/router.ts`, `src/mini-app/routes/grocery.ts` -- API route patterns (direct code review)
- Existing codebase: `src/mini-app/auth-middleware.ts` -- auth middleware (direct code review)
- Existing codebase: `src/ai/system-prompt.ts` -- recipe content format specification (direct code review)
- Existing codebase: `mini-app/src/hooks/useGroceryList.ts` -- hook patterns (direct code review)
- Existing codebase: `mini-app/src/components/grocery/` -- component patterns, CSS (direct code review)
- Existing codebase: `mini-app/src/theme/variables.css`, `tokens.ts` -- theme system (direct code review)
- Phase 11 RESEARCH.md -- Mini App architecture, SDK patterns, BackButton integration (direct review)

### Secondary (MEDIUM confidence)
- SQLite FTS5 documentation for GROUP_CONCAT behavior with JOINs -- standard SQLite feature, well-documented
- React scroll restoration patterns -- standard approach, widely used in SPAs

### Tertiary (LOW confidence)
- None. All findings based on direct codebase inspection and established patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed, no new libraries needed
- Architecture: HIGH -- patterns directly follow Phases 11-12 precedent, verified via codebase inspection
- Data model: HIGH -- knowledge_items, knowledge_tags, cooking_history tables inspected directly
- Recipe parsing: HIGH -- content format defined in system prompt, feedback format in handler.ts
- Pitfalls: HIGH -- derived from direct code patterns and common React/SQLite issues
- FTS5 search: HIGH -- existing implementation in fts.ts reused directly

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable ecosystem, all components already in codebase)
