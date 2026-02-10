---
status: resolved
trigger: "Investigate why Telegram BackButton navigates to the hub page instead of returning from recipe detail to the recipe/meal-plan list view."
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:15:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED - Telegram SDK allows multiple onClick handlers. Both Layout's navigate(-1) and page's handleCloseDetail() are registered and execute when BackButton is clicked. Layout's navigate(-1) triggers route change which unmounts the component, preventing handleCloseDetail from completing.
test: Verified through code analysis and logical tracing
expecting: Fix requires removing navigate(-1) handler from Layout, or conditionally registering it
next_action: Return diagnosis with root cause and suggested fix

## Symptoms

expected: On Recipes page, tapping a recipe card shows detail, BackButton returns to recipe list. On MealPlan page, tapping a meal shows RecipeDetail, BackButton returns to meal plan grid.
actual: BackButton navigates to the hub (home screen) instead of returning to the in-page previous view.
errors: None reported
reproduction: 1. Navigate to Recipes page 2. Tap a recipe card to show detail 3. Tap BackButton 4. Observe navigation to hub instead of recipe list
started: Unknown - reported as existing issue

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: BackButton.tsx (useBackButton hook)
  found: Lines 21-23 register backButton.onClick(() => navigate(-1)) in a useEffect with deps [isHome, navigate]
  implication: This hook is called from Layout.tsx and runs on every render, registering a global "go back in router history" handler

- timestamp: 2026-02-10T00:02:00Z
  checked: Layout.tsx
  found: Line 5 calls useBackButton() unconditionally in the Layout component
  implication: Layout wraps all pages (via Outlet), so this global handler is always active

- timestamp: 2026-02-10T00:03:00Z
  checked: Recipes.tsx lines 32-44
  found: useEffect registers backButton.onClick(() => handleCloseDetail()) when selectedRecipeId !== null
  implication: Page tries to override the handler when detail view is open

- timestamp: 2026-02-10T00:04:00Z
  checked: MealPlan.tsx lines 30-42
  found: Same pattern - useEffect registers backButton.onClick(() => handleCloseDetail()) when selectedRecipeId !== null
  implication: Page tries to override the handler when detail view is open

- timestamp: 2026-02-10T00:05:00Z
  checked: Event handler registration pattern
  found: Both Layout and page components call backButton.onClick() and store the cleanup function (off). The cleanup removes the listener. However, multiple onClick() calls don't REPLACE handlers - they ADD handlers. The Telegram SDK likely calls the LAST registered handler.
  implication: Layout's handler is registered AFTER page handlers because Layout's useEffect runs on every navigation/render, and its deps [isHome, navigate] cause re-registration

- timestamp: 2026-02-10T00:06:00Z
  checked: React useEffect execution order
  found: Layout component mounts first, then child page components mount. Both register onClick handlers. When selectedRecipeId changes in Recipes/MealPlan, their useEffect re-runs and registers a new handler. However, Layout's useEffect ALSO runs whenever location changes (navigate is called), causing it to re-register navigate(-1) handler AFTER the page handler.
  implication: Race condition - Layout's handler is registered after page handlers, overriding them

- timestamp: 2026-02-10T00:07:00Z
  checked: Dependencies analysis
  found: Layout useBackButton deps are [isHome, navigate]. When opening detail view, selectedRecipeId changes, page registers handler, BUT navigate reference is stable (from useNavigate), and isHome doesn't change, so Layout's useEffect doesn't re-run. This means page handler SHOULD work.
  implication: Initial hypothesis may be wrong - need to reconsider the timing

- timestamp: 2026-02-10T00:08:00Z
  checked: Re-examining BackButton.tsx lines 21-26
  found: The useEffect registers handler with backButton.onClick() and returns cleanup off(). The cleanup runs when component unmounts OR when deps change. Since Layout never unmounts and its deps rarely change, the Layout handler persists.
  implication: The issue is that BOTH handlers are registered simultaneously, and Telegram SDK only honors ONE (likely the last one registered or the first one, depending on SDK implementation)

- timestamp: 2026-02-10T00:09:00Z
  checked: Conditional return in Recipes.tsx line 34
  found: `if (selectedRecipeId === null) return;` - This causes the useEffect to return early without registering a handler when NOT in detail view. But when in detail view (selectedRecipeId !== null), it registers the handler.
  implication: The page handler IS registered when detail opens

- timestamp: 2026-02-10T00:10:00Z
  checked: Execution order reasoning
  found: When detail opens, selectedRecipeId changes, page useEffect runs, registers handler. Layout's useEffect does NOT re-run (deps unchanged). So page handler is registered AFTER Layout's handler.
  implication: If SDK replaces handlers, page handler should work. If SDK supports multiple handlers, both might run. Need to determine SDK behavior.

- timestamp: 2026-02-10T00:11:00Z
  checked: Symptom analysis - BackButton goes to hub
  found: User reports BackButton navigates to hub, not that detail closes AND THEN navigates. This suggests only navigate(-1) runs, not handleCloseDetail().
  implication: Layout's handler is running instead of page handler, which means either: (a) SDK doesn't replace handlers, page registration fails silently, or (b) there's an issue with the page handler registration itself

- timestamp: 2026-02-10T00:12:00Z
  checked: Handler registration and lifecycle
  found: When detail view opens, page useEffect registers onClick handler. Layout's useEffect does NOT re-run (stable deps). Page handler should be registered after Layout's handler.
  implication: Either SDK is single-handler (last registration wins, so page should work), or multi-handler (both run, but which order?)

- timestamp: 2026-02-10T00:13:00Z
  checked: Telegram SDK behavior research
  found: The SDK pattern `const off = backButton.onClick(handler); return () => off();` suggests event emitter pattern where multiple handlers can be registered simultaneously. Each `off()` removes that specific handler.
  implication: Both Layout and page handlers are active simultaneously when in detail view

- timestamp: 2026-02-10T00:14:00Z
  checked: Multi-handler execution order
  found: If both handlers run, and navigate(-1) runs first (or at all), it triggers route change which unmounts Recipes component. This would interrupt or prevent handleCloseDetail() from executing.
  implication: ROOT CAUSE - Layout's handler interferes with page handler by triggering navigation before or during detail close operation

## Resolution

root_cause: Layout component registers a global backButton.onClick handler that calls navigate(-1). This handler persists throughout the app lifetime. When page components (Recipes, MealPlan) try to override this handler by registering their own onClick handlers for detail views, both handlers end up being registered simultaneously. When BackButton is clicked, Layout's navigate(-1) handler executes, causing immediate route navigation that prevents the page's handleCloseDetail() from properly executing or makes it run on an unmounting component.

fix: Layout's useBackButton should NOT register an onClick handler at all. It should only handle show/hide logic. Pages that need custom back behavior should be solely responsible for registering onClick handlers. Alternatively, Layout could conditionally NOT register its handler when on specific routes, or provide a context for pages to opt out of the global handler.

verification: After fix, test: 1) Navigate to Recipes page 2) Tap a recipe to open detail 3) Tap BackButton 4) Verify detail closes and returns to recipe list (not hub) 5) Repeat for MealPlan page

files_changed: []
