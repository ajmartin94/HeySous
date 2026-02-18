# Phase 12: Grocery List - Research

**Researched:** 2026-02-09
**Domain:** Telegram Mini App grocery list UI (React + @tma.js/sdk-react + @telegram-apps/telegram-ui)
**Confidence:** HIGH

## Summary

Phase 12 builds the visual Grocery List Mini App on top of the existing Phase 11 foundation (React + Vite SPA, Express API, auth middleware) and the existing v1.0 grocery data model (SQLite tables, repository with full CRUD). The primary challenge is building a responsive, animated checklist UI with store tabs, section grouping, haptic feedback, optimistic updates, and a quick-add form -- all within the constraints of the Telegram Mini App WebView.

The existing stack is well-suited: `@tma.js/sdk-react` v3.0.15 provides `hapticFeedback`, `mainButton`, `backButton`, and `closingBehavior` as stateful singleton objects. `@telegram-apps/telegram-ui` v2.1.13 provides `Accordion` (for collapsible Done section), `Badge` (for quantity pills), `Chip` (for store tabs), `Input` (for quick-add form), and `Section`/`Cell` (for list structure). The API pattern from Phase 11 (`createApiRouter` + factory route handlers + `apiFetch` client wrapper) extends naturally to grocery endpoints.

**Primary recommendation:** Build grocery API routes first (GET items, POST toggle, POST add-item, POST complete), then the React page component tree (store tabs -> section groups -> item rows -> Done accordion), then layer in animations, haptic feedback, MainButton, and quick-add FAB.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Shopping interaction:** Tap anywhere on item row to check off (full-row touch target). Checked items get strikethrough + fade for ~1 second, then animate to Done section. Uncheck by tapping in Done section. Haptic feedback on check/uncheck.
- **List layout & density:** Compact single-line rows: item name + quantity on one line. Quantities as trailing pill/badge. Section headers show remaining count (e.g., "Produce (4)"). When all items checked, section hides from active list.
- **Store & section organization:** Horizontal scrollable pill-shaped tabs for store selection. Tab bar always shown. Fixed aisle order: Produce -> Dairy -> Meat -> Bakery -> Frozen -> Pantry -> Other. Done section at bottom of each store tab, collapsed by default, shows "Done (8)".
- **Progress tracking:** Progress indicator ("12/28 items") below store tabs, always visible. MainButton shows "Done Shopping". BackButton returns to chat.
- **Quick-add experience:** FAB "+" in bottom-right corner. Form: item name + optional quantity. Added to active store tab. Form stays open for multiple adds. Close explicitly.

### Claude's Discretion
- Section auto-assignment logic for quick-add items
- Exact animation timing and easing curves
- Empty state design (when grocery list has no items)
- Error handling for sync failures
- FAB positioning relative to MainButton
- Typography and spacing details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI framework | Already in mini-app |
| @tma.js/sdk-react | ^3.0.15 | Telegram SDK (haptic, mainButton, backButton) | Already in mini-app |
| @telegram-apps/telegram-ui | ^2.1.13 | Telegram-native UI components | Already in mini-app |
| lucide-react | ^0.563.0 | Icons (Plus, Check, ChevronDown, ShoppingCart) | Already in mini-app |
| react-router-dom | ^7.13.0 | Client-side routing | Already in mini-app |

### Supporting (Already Available Server-Side)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express | (existing) | API routes for grocery endpoints | Server-side API |
| better-sqlite3 | (existing) | Direct SQL queries | Repository pattern |
| @tma.js/init-data-node | (existing) | Auth middleware | API auth |

### No New Dependencies Required
The existing stack covers all needs. CSS transitions/animations handle the check-off animation. No animation library needed -- CSS `transition` and `@keyframes` are sufficient for the ~1s fade-and-slide pattern.

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
mini-app/src/
  pages/
    Grocery.tsx              # Main page (data fetching, state management)
  components/
    grocery/
      StoreTabs.tsx          # Horizontal scrollable pill tabs
      SectionGroup.tsx       # Section header + item list
      GroceryItem.tsx        # Single item row (tap target, animation)
      DoneSection.tsx        # Collapsible accordion for checked items
      ProgressBar.tsx        # "12/28 items" indicator
      QuickAddFab.tsx        # Floating action button + form overlay
      EmptyState.tsx         # No-items placeholder
  hooks/
    useGroceryList.ts        # Data fetching + optimistic state
    useMainButton.ts         # MainButton lifecycle hook
    useHaptic.ts             # Haptic feedback wrapper

src/mini-app/
  routes/
    summary.ts               # (existing)
    grocery.ts               # NEW: GET /api/grocery, POST /api/grocery/toggle, POST /api/grocery/add, POST /api/grocery/complete
  router.ts                  # (existing -- add grocery routes)
```

### Pattern 1: API Route Factory (Matches Existing Pattern)
**What:** Factory functions that receive `sqlite` and return Express route handlers.
**When to use:** All new grocery API endpoints.
**Example:**
```typescript
// Source: src/mini-app/routes/grocery.ts (following summary.ts pattern)
import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { createGroceryRepository } from "../../grocery/repository.js";

export function createGroceryRoutes(sqlite: BetterSqlite3.Database) {
  const repo = createGroceryRepository(sqlite);

  return {
    getList(_req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const list = repo.getActiveList(chatId);
      if (!list) {
        res.json({ items: [], stores: [] });
        return;
      }
      const items = repo.getListItems(list.id);
      res.json({ listId: list.id, items });
    },

    toggleItem(req: Request, res: Response) {
      const { itemId } = req.body;
      const newChecked = repo.toggleItem(itemId);
      res.json({ itemId, checked: newChecked });
    },

    addItem(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const list = repo.getActiveList(chatId);
      if (!list) {
        res.status(404).json({ error: "No active list" });
        return;
      }
      const { name, quantity, store, section } = req.body;
      repo.addItems(list.id, [{ name, quantity, store, section }]);
      // Return full updated list for simplicity
      const items = repo.getListItems(list.id);
      res.json({ items });
    },

    completeList(_req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      // Need to add completeList to repository
      // Sets status = 'completed' on active list
      // ...
      res.json({ ok: true });
    },
  };
}
```

### Pattern 2: Optimistic UI with State Recovery
**What:** Update local state immediately on user tap, then sync to server. Revert on failure.
**When to use:** Item check/uncheck, quick-add.
**Example:**
```typescript
// Source: Custom pattern for grocery optimistic updates
function useGroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);

  const toggleItem = useCallback(async (itemId: number) => {
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));

    try {
      await apiFetch('/grocery/toggle', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
    } catch {
      // Revert on failure
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ));
    }
  }, []);

  return { items, toggleItem };
}
```

### Pattern 3: Telegram SDK Component Lifecycle
**What:** Mount, configure, and clean up Telegram SDK components (mainButton, hapticFeedback).
**When to use:** Any page that uses MainButton or haptic feedback.
**Example:**
```typescript
// Source: @tma.js/sdk-react type definitions (verified from node_modules)
import { mainButton, hapticFeedback } from '@tma.js/sdk-react';

function useMainButton(text: string, onClick: () => void) {
  useEffect(() => {
    mainButton.mount();
    mainButton.setParams({ text, isVisible: true });
    const off = mainButton.onClick(onClick);

    return () => {
      off();
      mainButton.hide();
      mainButton.unmount();
    };
  }, [text, onClick]);
}
```

### Pattern 4: CSS Animation for Check-off
**What:** Pure CSS transitions for the strikethrough + fade + slide-down animation.
**When to use:** Item check-off interaction.
**Example:**
```css
/* Check-off animation: strikethrough + fade, then move to Done */
.grocery-item {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.grocery-item--checking {
  text-decoration: line-through;
  opacity: 0.5;
}

/* After ~1s delay, item is removed from active list and appears in Done */
```

### Anti-Patterns to Avoid
- **Don't use polling for real-time sync:** The "within seconds" requirement (GROC-10) means the Mini App should re-fetch when it regains focus or on a short interval, NOT use WebSocket. Simple refetch-on-visibility-change + periodic polling (5-10s) is sufficient.
- **Don't animate with JavaScript timers:** Use CSS `transition` and `animation` properties. JS-driven animation causes jank in Telegram WebView.
- **Don't store UI state in URL:** Store tabs and collapsed state are ephemeral. Use React state, not URL params.
- **Don't import from `@tma.js/sdk` directly:** Always import from `@tma.js/sdk-react` to avoid package duplication bugs (per official docs).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible Done section | Custom accordion logic | `Accordion` from `@telegram-apps/telegram-ui` | Handles expand/collapse animation, ARIA attributes |
| Store tab navigation | Custom horizontal scroll tabs | `Chip` components in horizontal scroll div (custom) or custom pill tabs | `TabsList` from telegram-ui is full-width, not scrollable pills. Build custom pill tabs with `Chip` |
| Haptic feedback | navigator.vibrate() calls | `hapticFeedback.impactOccurred('light')` from SDK | Platform-native, handles iOS/Android differences |
| MainButton | Fixed-position HTML button | `mainButton` from SDK | Rendered by Telegram native UI, not the WebView |
| Auth on API calls | Custom token management | `apiFetch()` wrapper (already exists) | Handles X-Init-Data header injection automatically |
| Back navigation | Custom browser history | `backButton` from SDK (already wired in Layout) | Native Telegram back button, already configured |

**Key insight:** The Telegram SDK components (`mainButton`, `backButton`, `hapticFeedback`) are NOT rendered inside the WebView -- they're native Telegram UI elements controlled via postMessage. You configure them via the SDK singleton objects, not by rendering React components.

## Common Pitfalls

### Pitfall 1: MainButton Must Be Mounted Before Use
**What goes wrong:** Calling `mainButton.show()` without `mainButton.mount()` throws an error.
**Why it happens:** TMA SDK components require explicit mounting to restore state and begin event forwarding.
**How to avoid:** Always call `mainButton.mount()` in a `useEffect` and `mainButton.unmount()` in cleanup.
**Warning signs:** "Component is not mounted" errors in console.

### Pitfall 2: MainButton Conflicts Between Pages
**What goes wrong:** Navigating away from Grocery page leaves MainButton visible.
**Why it happens:** MainButton is a global Telegram native element, not scoped to React components.
**How to avoid:** Unmount/hide MainButton in `useEffect` cleanup. Every page that shows MainButton must hide it on unmount.
**Warning signs:** "Done Shopping" button appearing on Hub page.

### Pitfall 3: Haptic Feedback Doesn't Work on Android for impactOccurred
**What goes wrong:** `hapticFeedback.impactOccurred()` and `selectionChanged()` produce no haptic on Telegram Android app.
**Why it happens:** Known Telegram Android bug (GitHub issue #28 on Telegram-Mini-Apps/issues).
**How to avoid:** Use `hapticFeedback.notificationOccurred('success')` as fallback, which works on both platforms. Or accept that haptics are iOS-primary.
**Warning signs:** No haptic feedback during testing on Android.

### Pitfall 4: Optimistic State Divergence
**What goes wrong:** Multiple rapid taps cause local state to drift from server state.
**Why it happens:** Toggle is not idempotent -- two rapid toggles cancel each other locally but may not on the server if requests arrive out of order.
**How to avoid:** Use optimistic updates with the item's current local state. Consider debouncing rapid taps (100-200ms). The `toggleItem` repository method is atomic (SQL UPDATE + SELECT), so server state is always consistent.
**Warning signs:** Items appear checked on one view but unchecked after refetch.

### Pitfall 5: Store/Section Are Freeform Text, Not Enums
**What goes wrong:** Assuming stores and sections are from a fixed set.
**Why it happens:** The schema defines `store` and `section` as `text`, not enums. Claude generates them from user context.
**How to avoid:** The fixed aisle ordering (Produce -> Dairy -> Meat -> Bakery -> Frozen -> Pantry -> Other) is a display sort order, not a data constraint. Unknown sections should sort to the end (after "Other"). Store names come directly from the data.
**Warning signs:** Items with sections like "Beverages" or "Condiments" not appearing.

### Pitfall 6: FAB Overlapping MainButton
**What goes wrong:** The floating "+" button overlaps with Telegram's native MainButton at the bottom.
**Why it happens:** MainButton is rendered by Telegram below the WebView content area. Its exact height varies by platform.
**How to avoid:** Position FAB with `bottom: calc(var(--tg-viewport-content-safe-area-inset-bottom, 0px) + 80px)` or higher. The MainButton takes approximately 48-60px of height.
**Warning signs:** FAB partially hidden behind MainButton.

### Pitfall 7: completeList Repository Method Missing
**What goes wrong:** No method to mark the active list as completed from the Mini App.
**Why it happens:** The v1.0 grocery repository only completes lists as a side effect of `createList()`. There's no standalone `completeList()` method.
**How to avoid:** Add a `completeList(chatId: string)` method to the repository before building the "Done Shopping" API route.
**Warning signs:** "Done Shopping" button has no server-side action to call.

### Pitfall 8: Section Assignment for Quick-Add Items
**What goes wrong:** Quick-add items have no section picker, so they need auto-assignment.
**Why it happens:** User decision: "minimal -- no section picker, auto-assign."
**How to avoid:** Implement a simple keyword-based section mapper (e.g., "milk" -> "Dairy", "chicken" -> "Meat"). Fallback to "Other" for unrecognized items. Keep the mapping small and maintainable -- this is a convenience feature, not a classification engine.
**Warning signs:** All quick-add items ending up in "Other."

## Code Examples

### Telegram SDK: Haptic Feedback
```typescript
// Source: @tma.js/sdk type definitions (verified from node_modules/@tma.js/sdk/dist/dts)
import { hapticFeedback } from '@tma.js/sdk-react';

// ImpactHapticFeedbackStyle: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
// NotificationHapticFeedbackType: 'error' | 'success' | 'warning'

// For item check-off -- light tap feel
hapticFeedback.impactOccurred('light');

// Alternative that works on Android too
hapticFeedback.notificationOccurred('success');

// For selection changes (scrolling through store tabs)
hapticFeedback.selectionChanged();
```

### Telegram SDK: MainButton
```typescript
// Source: @tma.js/sdk type definitions (verified from node_modules/@tma.js/sdk/dist/dts)
import { mainButton } from '@tma.js/sdk-react';

// MainButtonState: { isVisible, bgColor?, hasShineEffect, isEnabled, isLoaderVisible, text, textColor? }

// Mount and configure
mainButton.mount();
mainButton.setParams({
  text: 'Done Shopping',
  isVisible: true,
  isEnabled: true,
});

// Listen for clicks (returns cleanup function)
const off = mainButton.onClick(() => {
  // Complete the shopping trip
});

// Show loading state during API call
mainButton.showLoader();
// ... after API response:
mainButton.hideLoader();

// Cleanup
off();
mainButton.hide();
mainButton.unmount();
```

### Telegram SDK: ClosingBehavior (prevent accidental close)
```typescript
// Source: @tma.js/sdk type definitions (verified from node_modules/@tma.js/sdk/dist/dts)
import { closingBehavior } from '@tma.js/sdk-react';

// During active shopping, prevent accidental close
closingBehavior.mount();
closingBehavior.enableConfirmation();

// On "Done Shopping" or clean exit
closingBehavior.disableConfirmation();
closingBehavior.unmount();
```

### Accordion (Done Section)
```typescript
// Source: @telegram-apps/telegram-ui type definitions
import { Accordion } from '@telegram-apps/telegram-ui';

// AccordionProps: { expanded: boolean, onChange: (expanded: boolean) => void, children: ReactNode }
// Sub-components: Accordion.Summary, Accordion.Content

<Accordion expanded={doneExpanded} onChange={setDoneExpanded}>
  <Accordion.Summary>Done ({checkedCount})</Accordion.Summary>
  <Accordion.Content>
    {checkedItems.map(item => (
      <GroceryItem key={item.id} item={item} onToggle={toggleItem} />
    ))}
  </Accordion.Content>
</Accordion>
```

### Chip (Store Tab Pills)
```typescript
// Source: @telegram-apps/telegram-ui type definitions
import { Chip } from '@telegram-apps/telegram-ui';

// ChipProps: { mode?: 'elevated' | 'mono' | 'outline', before?, after?, children, Component? }

<div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px' }}>
  {stores.map(store => (
    <Chip
      key={store}
      mode={activeStore === store ? 'elevated' : 'outline'}
      onClick={() => setActiveStore(store)}
    >
      {store}
    </Chip>
  ))}
</div>
```

### API Fetch Pattern (Matches Existing apiFetch)
```typescript
// Source: mini-app/src/api.ts (existing)
// All API calls go through apiFetch which adds X-Init-Data header

// GET grocery list
const res = await apiFetch('/grocery');
const { listId, items } = await res.json();

// POST toggle item
await apiFetch('/grocery/toggle', {
  method: 'POST',
  body: JSON.stringify({ itemId }),
});

// POST add item
await apiFetch('/grocery/add', {
  method: 'POST',
  body: JSON.stringify({ name: 'Bananas', quantity: '3', store: 'Kroger', section: 'Produce' }),
});

// POST complete shopping trip
await apiFetch('/grocery/complete', { method: 'POST' });
```

### Section Sort Order
```typescript
// Fixed aisle order per user decision
const SECTION_ORDER: Record<string, number> = {
  'Produce': 0,
  'Dairy': 1,
  'Meat': 2,
  'Bakery': 3,
  'Frozen': 4,
  'Pantry': 5,
  'Other': 6,
};

function sectionSortKey(section: string): number {
  // Case-insensitive lookup; unknown sections sort after "Other"
  return SECTION_ORDER[section] ?? 99;
}
```

### Simple Section Auto-Assignment (Quick-Add)
```typescript
// Discretion area: keyword-based section mapping for quick-add
const SECTION_KEYWORDS: Record<string, string[]> = {
  'Produce': ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'pepper', 'avocado', 'lemon', 'lime', 'garlic', 'ginger', 'cilantro', 'basil', 'berries', 'grapes', 'orange', 'celery', 'cucumber', 'spinach', 'kale', 'mushroom'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'sour cream'],
  'Meat': ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'fish', 'shrimp', 'bacon', 'sausage', 'ground'],
  'Bakery': ['bread', 'tortilla', 'bun', 'roll', 'bagel', 'muffin', 'croissant'],
  'Frozen': ['ice cream', 'frozen', 'pizza'],
  'Pantry': ['rice', 'pasta', 'flour', 'sugar', 'oil', 'vinegar', 'sauce', 'spice', 'salt', 'pepper', 'can', 'bean', 'cereal', 'oat', 'nut'],
};

function guessSection(itemName: string): string {
  const lower = itemName.toLowerCase();
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return section;
  }
  return 'Other';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@twa-dev/sdk` | `@tma.js/sdk-react` v3 | 2024 | Singleton objects instead of class instances; mount/unmount lifecycle |
| `setParams()` for MainButton | Individual methods + `setParams()` | TMA.js v3 | Both patterns work; `setParams` is more convenient for batch updates |
| Custom theme CSS | `themeParams.bindCssVars()` + `miniApp.bindCssVars()` | TMA.js v3 | Auto-binds `--tg-theme-*` CSS variables |

**Deprecated/outdated:**
- `@twa-dev/sdk`: Old Telegram Web App SDK. This project uses `@tma.js/sdk-react` (correct).
- `Telegram.WebApp.HapticFeedback`: Old global API. Use imported `hapticFeedback` singleton from `@tma.js/sdk-react`.

## Open Questions

1. **Bot notification on "Done Shopping"**
   - What we know: The "Done Shopping" MainButton should complete the trip (set list status to 'completed').
   - What's unclear: Should the bot send a confirmation message to the chat? (e.g., "Shopping complete! You got 28/28 items.")
   - Recommendation: Add an optional bot notification. The API route can return success, and the Mini App can use `miniApp.close()` to return to chat. The bot can detect the status change on next interaction.

2. **Real-time sync direction (bot -> Mini App)**
   - What we know: GROC-10 says "items added by the bot appear in the Mini App within seconds."
   - What's unclear: No WebSocket infrastructure exists. How to push updates?
   - Recommendation: Use simple polling (refetch every 5-10 seconds while Mini App is open) + refetch on visibility change. This is the simplest approach that meets "within seconds" and requires no new infrastructure.

3. **What happens to checked items on "Done Shopping"?**
   - What we know: completeList sets status to 'completed' on the grocery_lists row.
   - What's unclear: Should the Mini App close immediately, show a summary, or do nothing?
   - Recommendation: Show MainButton loader, call API, then use `miniApp.close()` to return to chat. Keep it simple.

## Sources

### Primary (HIGH confidence)
- `@tma.js/sdk` v3.0.15 type definitions -- `node_modules/@tma.js/sdk/dist/dts/features/` (HapticFeedback, MainButton, ClosingBehavior)
- `@tma.js/bridge` type definitions -- `node_modules/@tma.js/bridge/dist/dts/methods/types/haptic-feedback.d.ts` (ImpactHapticFeedbackStyle, NotificationHapticFeedbackType)
- `@telegram-apps/telegram-ui` v2.1.13 type definitions -- `node_modules/@telegram-apps/telegram-ui/dist/cjs/components/` (Accordion, Badge, Chip, Cell, Section, Input)
- Existing codebase: `src/grocery/repository.ts`, `src/grocery/schema.ts`, `src/mini-app/router.ts`, `src/mini-app/routes/summary.ts`, `mini-app/src/api.ts`

### Secondary (MEDIUM confidence)
- [Telegram Mini Apps Haptic Feedback docs](https://docs.telegram-mini-apps.com/platform/haptic-feedback) -- Confirms impact_style values
- [TMA.js SDK Usage Tips](https://docs.telegram-mini-apps.com/packages/tma-js-sdk/usage-tips) -- Mount/isAvailable pattern
- [JSR @tma/sdk documentation](https://jsr.io/@tma/sdk/doc) -- API method signatures

### Tertiary (LOW confidence)
- [Telegram Android haptic bug](https://github.com/Telegram-Mini-Apps/issues/issues/28) -- impactOccurred may not work on Android; needs validation during testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified from node_modules type definitions
- Architecture: HIGH -- Direct extension of Phase 11 patterns (API route factory, apiFetch, SDK singleton lifecycle)
- Pitfalls: HIGH -- Verified against actual SDK types and known Telegram platform issues
- Animation/UX: MEDIUM -- CSS animation approach is standard but exact timing will need iteration
- Section auto-assignment: LOW -- Keyword heuristic is reasonable but may need tuning based on real grocery data

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable -- all dependencies already locked in package.json)
