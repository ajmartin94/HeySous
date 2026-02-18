# Phase 14: Meal Plan Viewer - Research

**Researched:** 2026-02-10
**Domain:** Telegram Mini App UI -- weekly meal plan grid with swipe navigation and recipe detail drill-down
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Vertical stack orientation -- days stacked top-to-bottom, each day is a full-width row
- Recipe name only per meal cell -- no tags, no summary, tap for details
- Day headers show full format: "Monday, Feb 10"
- Multiple meals within a day use labeled rows -- each meal on its own line with meal type label
- Swipe between weeks (horizontal swipe gesture) -- current week and next week
- Week header shows "This Week" / "Next Week" label only (no date range)
- Auto-scroll to today when opened
- Today's day row gets a subtle accent background to stand out
- When no meal plan exists for a week: show the empty 7-day grid structure (days visible, no meals)
- Days with no meals show a subtle gray "No meals planned" label
- Past days in the current week are visually dimmed (reduced opacity)
- Meals without a matching recipe in the knowledge base: show meal name + "no recipe" indicator, not tappable
- Small icon (sun/noon/moon) + text label before recipe name -- breakfast/lunch/dinner
- Only 3 standard meal types: breakfast, lunch, dinner
- Only show meal types that have recipes -- skip empty meal type rows
- Always show the meal type label, even when a day has only one meal

### Claude's Discretion
- Exact swipe gesture implementation (library choice, animation)
- Icon design for meal types
- Accent color choice for today highlight
- Dimming opacity level for past days
- Loading state while fetching meal plan data

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

## Summary

Phase 14 builds a read-only weekly meal plan viewer in the Telegram Mini App. The viewer displays a 7-day vertical stack (Monday-Sunday) with meal entries per day, supports horizontal swipe navigation between current and next week, and allows tapping a meal to view its full recipe detail (reusing the RecipeDetail component from Phase 13).

The existing codebase provides almost everything needed. The `meal_plans` and `meal_plan_entries` database tables are already defined (Phase 11), with a working Drizzle repository (`createPlanRepository`) that includes `getPlan()` and `getActivePlans()` methods. The mini-app already has the routing infrastructure (`/plan` route), API authentication middleware, the RecipeDetail component, and consistent patterns for data fetching hooks and CSS styling. The main work is: (1) create a server-side API endpoint for meal plan data, (2) create a client-side data fetching hook, (3) build the weekly grid UI with swipe navigation and today highlighting, and (4) wire up recipe detail drill-down.

**Primary recommendation:** Follow the exact patterns established by the Recipes page (Phase 13) -- factory route handler on server, data-fetching hook on client, BEM-style CSS file, conditional rendering for detail view. Use `react-swipeable` (~1.3 kB gzipped) for horizontal swipe detection. Use vanilla JS Date utilities (duplicated client-side per prior decisions) for week calculations. Use existing lucide-react icons (Sunrise/Sun/Moon) for meal type indicators.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | UI framework | Already in mini-app |
| react-router-dom | ^7.13.0 | Client routing | Already in mini-app, `/plan` route exists |
| Express | ^5.2.1 | API server | Already used for all API routes |
| better-sqlite3 | ^12.6.2 | Database queries | Already used for recipe/grocery/summary routes |
| lucide-react | ^0.563.0 | Icons (Sunrise, Sun, Moon) | Already in mini-app for all icons |
| @tma.js/sdk-react | ^3.0.15 | Telegram SDK (backButton) | Already in mini-app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-swipeable | ^7.0.2 | Horizontal swipe detection for week navigation | Recommended for swipe gesture (Claude's Discretion) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-swipeable | Custom touchstart/touchend handler | react-swipeable is 1.3 kB gzipped, zero deps, handles edge cases (velocity, threshold, multi-touch). Custom code is ~30 lines but needs testing for diagonal swipes, scroll conflicts, etc. |
| date-fns | Vanilla JS Date + custom utils | Existing codebase already uses vanilla Date in `src/planning/date-utils.ts`. No need to add date-fns for these simple week calculations. |

**Recommendation (Claude's Discretion -- Swipe Gesture):** Use `react-swipeable`. It is tiny (1.3 kB gzipped), has zero dependencies, is TypeScript-native, hook-based (`useSwipeable`), and handles edge cases like diagonal swipes and velocity thresholds. The `onSwipedLeft`/`onSwipedRight` handlers map directly to week navigation. Set `preventScrollOnSwipe: false` and `trackMouse: false` for optimal Telegram Mini App behavior.

**Installation:**
```bash
cd mini-app && npm install react-swipeable
```

## Architecture Patterns

### Recommended Project Structure
```
src/mini-app/routes/
  meal-plan.ts              # NEW: API route handler (factory function)
src/mini-app/router.ts      # MODIFY: register meal plan routes

mini-app/src/
  hooks/
    useMealPlan.ts           # NEW: data fetching hook
  utils/
    dateUtils.ts             # NEW: client-side week/date utilities
  components/
    meal-plan/
      meal-plan.css          # NEW: BEM-style CSS
      WeekHeader.tsx         # NEW: "This Week"/"Next Week" + swipe container
      DayRow.tsx             # NEW: single day with header + meal entries
      MealEntry.tsx          # NEW: single meal (icon + name, tappable)
  pages/
    MealPlan.tsx             # MODIFY: replace placeholder with full viewer
```

### Pattern 1: Factory Route Handler (Server API)
**What:** Server-side API endpoint following `createRecipeRoutes` pattern
**When to use:** All new API routes
**Example:**
```typescript
// Source: existing pattern from src/mini-app/routes/recipes.ts
import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";

export function createMealPlanRoutes(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * GET /api/meal-plan?week=current|next
     * Returns the meal plan for the specified week.
     */
    getPlan(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const week = (req.query.week as string) || "current";

      // Calculate week_start_date (Monday) for current or next week
      const now = new Date();
      const jsDay = now.getDay();
      const daysSinceMonday = (jsDay + 6) % 7;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - daysSinceMonday);
      if (week === "next") {
        monday.setDate(monday.getDate() + 7);
      }
      const weekStartDate = formatIsoDate(monday);

      // Query meal plan + entries joined with knowledge_items for linked recipes
      const rows = sqlite.prepare(`
        SELECT mpe.id, mpe.day_of_week, mpe.meal_type, mpe.recipe_name,
               mpe.knowledge_item_id,
               ki.id AS ki_id
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.plan_id = mp.id
        LEFT JOIN knowledge_items ki ON mpe.knowledge_item_id = ki.id
          AND ki.chat_id = mp.chat_id
        WHERE mp.chat_id = ? AND mp.week_start_date = ?
        ORDER BY mpe.day_of_week ASC, mpe.meal_type ASC
      `).all(chatId, weekStartDate) as Array<{
        id: number; day_of_week: number; meal_type: string;
        recipe_name: string; knowledge_item_id: number | null;
        ki_id: number | null;
      }>;

      res.json({
        weekStartDate,
        entries: rows.map(r => ({
          id: r.id,
          dayOfWeek: r.day_of_week,
          mealType: r.meal_type,
          recipeName: r.recipe_name,
          knowledgeItemId: r.knowledge_item_id,
          hasRecipe: r.ki_id !== null, // recipe still exists in KB
        })),
      });
    },
  };
}
```

### Pattern 2: Data Fetching Hook (Client)
**What:** React hook following `useRecipes` and `useGroceryList` patterns
**When to use:** All new data fetching in mini-app
**Example:**
```typescript
// Source: existing pattern from mini-app/src/hooks/useRecipes.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api.js";

export function useMealPlan() {
  const [currentWeek, setCurrentWeek] = useState<MealPlanWeek | null>(null);
  const [nextWeek, setNextWeek] = useState<MealPlanWeek | null>(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0); // 0=current, 1=next
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ... isMountedRef pattern, fetchBothWeeks, detail state
}
```

### Pattern 3: RecipeDetail Reuse
**What:** Reusing RecipeDetail from Phase 13 for drill-down when tapping a meal
**When to use:** When user taps a meal entry that has a linked recipe
**Example:**
```typescript
// Source: existing pattern from mini-app/src/pages/Recipes.tsx
// Same conditional render pattern: if selectedRecipeId !== null, show RecipeDetail
if (selectedRecipeId !== null) {
  if (detailLoading || !recipeDetail) {
    return <SkeletonCard lines={6} />;
  }
  return <RecipeDetail recipe={recipeDetail} onBack={handleCloseDetail} />;
}
```

### Pattern 4: Swipe Navigation with react-swipeable
**What:** Horizontal swipe between current week and next week views
**When to use:** Week navigation container
**Example:**
```typescript
import { useSwipeable } from 'react-swipeable';

const swipeHandlers = useSwipeable({
  onSwipedLeft: () => setActiveWeekIndex(1),   // swipe left = go to next week
  onSwipedRight: () => setActiveWeekIndex(0),  // swipe right = go to current week
  delta: 50,               // min px to register as swipe (higher = less accidental)
  trackTouch: true,
  trackMouse: false,        // don't track mouse in mobile context
  swipeDuration: 500,       // max ms for swipe gesture
});

return <div {...swipeHandlers}>{/* week content */}</div>;
```

### Pattern 5: Client-Side Date Utilities
**What:** Duplicated date helpers for client (following prior decision: no shared imports across build boundary)
**When to use:** Week start calculation, today detection, date formatting
**Example:**
```typescript
// mini-app/src/utils/dateUtils.ts
// Duplicated from src/planning/date-utils.ts per prior decision

export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
] as const;

/** Get today's day index (0=Monday..6=Sunday) */
export function getTodayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

/** Format a week start date + day offset as "Monday, Feb 10" */
export function formatDayHeader(weekStartDate: string, dayOfWeek: number): string {
  const d = new Date(weekStartDate + "T00:00:00");
  d.setDate(d.getDate() + dayOfWeek);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return `${DAY_NAMES[dayOfWeek]}, ${month} ${day}`;
}

/** Get Monday ISO date for current week */
export function getCurrentWeekStart(): string {
  const d = new Date();
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return formatIsoDate(d);
}
```

### Anti-Patterns to Avoid
- **Importing from `src/planning/date-utils.ts` into mini-app:** The server and client have separate build boundaries. Duplicate the ~20 lines of date utilities client-side instead.
- **Using `getActivePlans()` from the Drizzle repository directly:** The API route receives a `BetterSqlite3.Database` instance, not a Drizzle DB. Write raw SQL queries like the recipe routes do.
- **Fetching recipe detail content in the meal plan list response:** Only return recipe IDs and `hasRecipe` flag. Fetch full detail on tap (same as Recipes page).
- **Making meal entries always tappable:** Entries without a matching `knowledge_item_id` (or where the knowledge item has been deleted) should be non-tappable and show a "no recipe" indicator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Custom touchstart/touchmove/touchend handler | `react-swipeable` useSwipeable hook | Handles diagonal detection, velocity, multi-touch, scroll interference. 1.3 kB. |
| Meal type icons | Custom SVG or emoji | `lucide-react` Sunrise/Sun/Moon | Already a dependency, consistent with ChefHat/ShoppingCart/CalendarDays used in Hub |
| Skeleton loading | Custom shimmer animation | Existing `SkeletonCard` component | Already used by Recipes and Hub pages |

**Key insight:** The entire UI stack (routing, API auth, data fetching, CSS variables, icon library, back button) is already established. This phase is a composition exercise, not a new-stack phase.

## Common Pitfalls

### Pitfall 1: Scroll Position Lost After Detail View
**What goes wrong:** User taps a meal, views recipe detail, goes back, and loses their scroll position in the week view.
**Why it happens:** React re-renders the list from top.
**How to avoid:** Use the same `scrollPositionRef` + `requestAnimationFrame` pattern from `Recipes.tsx` (lines 30-31, 48-56).
**Warning signs:** Testing the back-from-detail flow and seeing the view jump to top.

### Pitfall 2: Auto-Scroll to Today Conflicts with Layout Render
**What goes wrong:** `scrollIntoView()` called before the DOM has settled, scrolls to wrong position or doesn't work.
**Why it happens:** React hasn't finished rendering the day rows when the scroll effect fires.
**How to avoid:** Use `useEffect` with a `ref` on today's row element, and call `scrollIntoView({ behavior: 'smooth', block: 'start' })` after initial data load completes (not during loading state). Consider a small `setTimeout` or `requestAnimationFrame` wrapper.
**Warning signs:** Today's row not visible on initial load, or scroll position jumping after content appears.

### Pitfall 3: Swipe Gesture Interfering with Vertical Scroll
**What goes wrong:** User tries to scroll down through the week but triggers a horizontal swipe instead.
**Why it happens:** Low swipe delta threshold or no angle detection.
**How to avoid:** Set `delta: 50` (higher than default 10) on `useSwipeable` to require intentional horizontal swipes. The library handles diagonal gesture rejection automatically. Do NOT set `preventScrollOnSwipe: true`.
**Warning signs:** Accidental week switches when scrolling.

### Pitfall 4: Telegram swipeBehavior.disableVertical Misunderstanding
**What goes wrong:** Developer worries horizontal swipes won't work because vertical swipes are disabled in `init.ts`.
**Why it happens:** Confusion about what `swipeBehavior.disableVertical()` does.
**How to avoid:** Understand that `disableVertical` only prevents the Telegram app-level minimize gesture (swiping down to close the Mini App). It does NOT affect DOM-level touch events. Horizontal swipe via `react-swipeable` uses standard `touchstart`/`touchmove`/`touchend` events and works independently.
**Warning signs:** None -- this is a misconception pitfall, not a runtime bug.

### Pitfall 5: knowledge_item_id Pointing to Deleted Recipe
**What goes wrong:** A meal plan entry has a `knowledge_item_id` but the recipe has been deleted from `knowledge_items`.
**Why it happens:** No foreign key constraint on `mealPlanEntries.knowledgeItemId` to `knowledgeItems`.
**How to avoid:** The API query should `LEFT JOIN knowledge_items` and check if the join returned a row. Return `hasRecipe: ki_id !== null` so the client can show "no recipe" indicator for orphaned entries.
**Warning signs:** Tapping a meal entry that should have a recipe but gets a 404 from `/api/recipes/:id`.

### Pitfall 6: Week Start Date Timezone Issues
**What goes wrong:** The client calculates a different Monday than the server because of timezone differences.
**Why it happens:** `new Date()` uses local timezone. If server is UTC and client is UTC-5, the "current Monday" might differ near midnight.
**How to avoid:** The server should calculate `weekStartDate` and return it in the API response. The client uses the returned `weekStartDate` for display formatting, not its own calculation. For week navigation, use `?week=current` and `?week=next` query params (server determines the actual dates).
**Warning signs:** Empty meal plan appearing when there should be data, especially around midnight.

## Code Examples

### API Registration in Router
```typescript
// Source: existing pattern from src/mini-app/router.ts
import { createMealPlanRoutes } from "./routes/meal-plan.js";

// Inside createApiRouter():
const mealPlan = createMealPlanRoutes(deps.sqlite);
router.get("/meal-plan", mealPlan.getPlan);
```

### Meal Type Icon Mapping
```typescript
// Source: lucide-react (already installed)
import { Sunrise, Sun, Moon } from 'lucide-react';

const MEAL_TYPE_CONFIG = {
  breakfast: { icon: Sunrise, label: 'Breakfast' },
  lunch:     { icon: Sun,     label: 'Lunch' },
  dinner:    { icon: Moon,    label: 'Dinner' },
} as const;
```

### Today Highlight and Past Day Dimming (CSS)
```css
/* Today's row -- subtle accent background */
.day-row--today {
  background: var(--hs-accent-subtle);  /* rgba(91, 140, 90, 0.12) */
  border-radius: var(--hs-border-radius);
}

/* Past days -- reduced opacity */
.day-row--past {
  opacity: 0.5;
}

/* "No meals planned" placeholder */
.day-row__empty {
  font-size: var(--hs-font-size-small);
  color: var(--tg-theme-hint-color, #999);
  padding: 8px 0;
  font-style: italic;
}
```

### BackButton Override for Detail View
```typescript
// Source: existing pattern from mini-app/src/pages/Recipes.tsx
useEffect(() => {
  if (selectedRecipeId === null) return;
  if (!backButton.onClick.isAvailable()) return;

  const off = backButton.onClick(() => {
    handleCloseDetail();
  });

  return () => { off(); };
}, [selectedRecipeId]);
```

### Auto-Scroll to Today
```typescript
const todayRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!loading && todayRef.current) {
    requestAnimationFrame(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}, [loading]);

// In render:
<div ref={dayOfWeek === todayIndex ? todayRef : undefined} className={...}>
```

### Swipe Week Navigation with Animation
```typescript
import { useSwipeable } from 'react-swipeable';

function WeekView({ activeWeekIndex, onWeekChange, children }) {
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeWeekIndex === 0) onWeekChange(1);
    },
    onSwipedRight: () => {
      if (activeWeekIndex === 1) onWeekChange(0);
    },
    delta: 50,
    trackTouch: true,
    trackMouse: false,
    swipeDuration: 500,
  });

  return <div {...handlers}>{children}</div>;
}
```

### API Response Shape
```typescript
// GET /api/meal-plan?week=current
{
  "weekStartDate": "2026-02-09",  // Monday ISO date
  "entries": [
    {
      "id": 1,
      "dayOfWeek": 0,           // 0=Monday
      "mealType": "dinner",
      "recipeName": "Chicken Tikka Masala",
      "knowledgeItemId": 42,
      "hasRecipe": true          // recipe exists in knowledge base
    },
    {
      "id": 2,
      "dayOfWeek": 1,
      "mealType": "breakfast",
      "recipeName": "Overnight Oats",
      "knowledgeItemId": null,
      "hasRecipe": false         // no linked recipe
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-swipeable-views (full carousel) | react-swipeable hook + CSS transition | 2023 | react-swipeable-views is unmaintained; the hook approach is simpler for 2-panel navigation |
| date-fns for all date logic | Vanilla JS Date for simple cases | Ongoing | No need to add 7 kB (tree-shaken) for week start + day format calculations |

**Deprecated/outdated:**
- `react-swipeable-views`: Unmaintained since 2022. Do not use.
- Using Drizzle ORM in API route handlers: This codebase's API routes use raw `better-sqlite3` queries. Follow the existing pattern.

## Open Questions

1. **CSS transition for week switch animation**
   - What we know: When swiping between weeks, we need some visual feedback (slide animation or fade)
   - What's unclear: Whether a CSS `transform: translateX()` transition or a simple opacity fade is more appropriate
   - Recommendation: Use a simple CSS `opacity` transition (0.15s) on week content swap. A full slide animation adds complexity without much benefit for a 2-view toggle. If desired, a `translateX` transition could be added later.

2. **Fetch both weeks at once or on-demand?**
   - What we know: Users only see one week at a time. Fetching both on mount means instant switching.
   - What's unclear: Whether the extra network request matters
   - Recommendation: Fetch both weeks in parallel on mount (2 small API calls). The data is tiny (7 days x 3 meals max = 21 rows at most). This gives instant swipe response with no loading spinner on week switch.

## Sources

### Primary (HIGH confidence)
- Codebase investigation: `src/planning/schema.ts`, `src/planning/repository.ts`, `src/planning/date-utils.ts` -- database schema and existing utilities
- Codebase investigation: `src/mini-app/router.ts`, `src/mini-app/routes/recipes.ts`, `src/mini-app/routes/grocery.ts` -- API patterns
- Codebase investigation: `mini-app/src/hooks/useRecipes.ts`, `mini-app/src/pages/Recipes.tsx` -- client-side patterns
- Codebase investigation: `mini-app/src/init.ts` -- swipeBehavior.disableVertical() only affects app minimize gesture
- react-swipeable official docs: https://nearform.com/open-source/react-swipeable/docs/api -- API reference (v7.0.2)
- Telegram Mini Apps swipe behavior docs: https://docs.telegram-mini-apps.com/platform/swipe-behavior

### Secondary (MEDIUM confidence)
- react-swipeable GitHub: https://github.com/FormidableLabs/react-swipeable -- 2.1k stars, TypeScript, active maintenance
- Bundle size: ~1.3 kB gzipped, 0 dependencies (from community reports, bundlephobia)
- lucide-react icons: Sunrise, Sun, Moon available at https://lucide.dev/icons/

### Tertiary (LOW confidence)
- None. All findings verified against codebase or official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely based on existing codebase patterns, no new major dependencies
- Architecture: HIGH -- follows established factory-route + data-hook + CSS patterns exactly
- Pitfalls: HIGH -- identified from direct codebase analysis (timezone, orphaned FK, scroll position, swipe conflicts)

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable -- no fast-moving dependencies)
