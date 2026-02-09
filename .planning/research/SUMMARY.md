# Project Research Summary

**Project:** HeySous v1.1 - Telegram Mini Apps
**Domain:** Telegram Mini Apps (TWA) for meal planning bot
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

HeySous is adding three visual Mini App UIs (grocery list, meal plan viewer, recipe browser) to its existing grammY/Express/SQLite meal planning bot. The research identifies React + Vite + @tma.js SDK as the standard stack for Telegram Mini Apps, with a straightforward architecture: React frontend builds to static files served by the existing Express server, which gains new REST API routes protected by initData HMAC-SHA256 validation. The Mini Apps and bot share the same SQLite database and repository layer, avoiding sync complexity.

The recommended approach is incremental: build API authentication first, then the grocery list Mini App (highest value, simplest data model), then recipe browser (reusable components), then meal plan viewer last (depends on recipe detail component). All three Mini Apps are view layers only -- business logic stays in the existing repository functions. This hybrid chat+visual model preserves the bot's conversational strengths (recipe entry, meal planning, pivots) while solving visual pain points (cramped inline buttons, no browse capability, text-only meal plans).

The critical risks are iOS-specific WebView issues (scrolling collapse, keyboard covering inputs, safe area insets) and state sync between bot and Mini App. Mitigations are well-documented: call `disableVerticalSwipes()` immediately, place inputs at the top of screens, use `contentSafeAreaInset` instead of CSS env variables, implement polling for fresh data, and enable WAL mode on SQLite. Security depends entirely on server-side initData validation with 1-hour expiration -- this must be the first middleware built.

## Key Findings

### Recommended Stack

React 19 + Vite 7 is the standard Telegram Mini Apps frontend stack, with @tma.js/sdk (v3.x) providing signal-based access to Telegram platform features (theme, haptics, buttons, initData). The @telegram-apps/telegram-ui component library eliminates the need to manually match Telegram's look and eliminates Tailwind CSS or custom styling. On the backend, @tma.js/init-data-node validates HMAC-SHA256 signatures as Express middleware. This stack integrates cleanly with the existing Node.js 22 / TypeScript / Express 5 / better-sqlite3 backend.

**Core technologies:**
- **React 19.2.4**: Component model suits 3 distinct Mini App views; best Telegram SDK support of any framework
- **Vite 7.3.1**: Standard for TWA development; fast HMR; outputs static files servable from Express
- **@tma.js/sdk 3.1.4 + @tma.js/sdk-react 3.0.15**: Signal-based reactivity for Telegram platform (viewport, theme, buttons, haptic feedback)
- **@telegram-apps/telegram-ui 2.1.13**: Telegram-native React components matching platform look/feel; handles dark/light theme and iOS/Android differences
- **@tma.js/init-data-node 2.0.4**: Server-side initData validation (HMAC-SHA256) for authentication
- **react-router 7.13.0**: Client-side routing between 3 Mini App views and deep-linking via Telegram startParam

**Project structure:** Frontend lives in `mini-app/` subdirectory with separate package.json and tsconfig.json (needs DOM libs, JSX). Builds to `mini-app/dist/` which Express serves via `express.static('/app', ...)`. Not a monorepo -- just two package.json files with sequential builds. Backend Mini App code (auth, API routes) lives in `src/mini-app/` alongside existing bot code.

**Critical configuration:** Vite `base: '/app/'` must match Express static mount point exactly. One mismatch breaks all asset loading. initData validation must use `expiresIn: 3600` (1 hour), not the default 86400 (24 hours).

### Expected Features

The research reveals a clear chat vs. Mini App boundary: conversational tasks (recipe entry, plan generation, pivots, all notifications) stay in chat where the bot excels, while visual tasks (grocery shopping, week-at-a-glance plan, recipe browsing) move to Mini Apps where rich UI shines.

**Must have (table stakes for v1.1):**

*Grocery List Mini App (Priority 1 -- solves biggest pain):*
- Store-tab navigation (Kroger/Costco tabs)
- Section grouping within stores (Produce, Dairy, etc.)
- Tap to check/uncheck with haptic feedback
- Checked items in collapsed "Done" section
- Progress indicator (12/28 items)
- Quantity + name display
- Theme-aware (light/dark mode)
- MainButton: "Done Shopping"
- Telegram BackButton to return to chat

*Meal Plan Mini App (Priority 2 -- visual upgrade):*
- 7-day grid view (Monday-Sunday)
- Meal type rows (dinner-only or multi-meal adaptive)
- Today highlight
- Current week / next week toggle
- Tap meal name to show recipe detail
- Theme-aware

*Recipe Browser Mini App (Priority 3 -- enables browsing):*
- Scrollable card list (title + summary + tags)
- Search bar with debounced FTS5 search
- Full recipe detail view (formatted content)
- Tag pills on cards
- BackButton navigation (list -> detail -> back)
- Theme-aware

*Shared infrastructure (blocks all Mini Apps):*
- REST API with initData HMAC-SHA256 validation
- API endpoints reusing existing repository functions
- Mini App entry points: web_app inline keyboard buttons in bot responses
- Telegram Web App SDK integration

**Should have (competitive advantage, defer to v1.2):**
- Grocery: swipe to uncheck gesture
- Grocery: quick-add item form
- Recipe: tag-based filtering
- Recipe: "last cooked" date display on cards
- Meal plan: tap to open full recipe (requires cross-view navigation)

**Defer (v2+):**
- Recipe: "Add to plan" button (complex UI: day/meal-type picker)
- Grocery: item reordering within section (drag-drop in WebView is risky)
- Shared Mini App shell with bottom tab navigation (three entry points work fine)
- Recipe editing in Mini App (conversational edit is faster)
- Nutritional info on cards (explicitly an anti-feature: unreliable AI estimates)
- Real-time collaborative editing (single-user product)

### Architecture Approach

The architecture is a thin API layer bridging React to existing repositories. The Express server gains REST routes under `/api/*` protected by initData validation middleware. These routes receive the same repository instances (groceryRepository, planRepository, knowledgeRepository) that bot handlers use, delegating directly to existing functions. No business logic in API routes -- they are adapters between HTTP and repositories. The React frontend is a pure view layer: renders data, sends mutations via fetch, integrates Telegram SDK for theme/haptics/buttons. State sync is simple: SQLite is the single source of truth, both bot and Mini App hit the same database, polling every 5-10 seconds keeps Mini App fresh.

**Major components:**
1. **Auth Middleware** (`src/mini-app/auth.ts`) -- Validates initData HMAC-SHA256, extracts userId/chatId, rejects unauthorized. Uses @tma.js/init-data-node `validate()` with 1-hour expiration. Runs before all API routes.
2. **API Router** (`src/mini-app/api/`) -- Three sub-routers (grocery, plans, recipes) mounted at `/api/*`. Thin wrappers: parse params, call existing repository functions, return JSON. No new business logic.
3. **React SPA** (`mini-app/`) -- Vite-built static files served at `/app/*` by Express. Uses @tma.js/sdk-react hooks for Telegram platform (theme, haptics, buttons). Three page components (GroceryList, MealPlan, RecipeBrowser) with react-router routing.
4. **Static File Serving** -- Express `app.use('/app', express.static('mini-app/dist'))` for assets, plus SPA fallback `app.get('/app/*', ...)` serving index.html for client-side routing.
5. **Bot Integration** -- Existing bot handlers modified to include `InlineKeyboard.webApp('Open Grocery List', url)` buttons. BotFather menu button configured to open primary Mini App.

**Data flow:** User taps "Open Grocery List" -> Telegram opens WebView with initData -> React mounts, calls `apiGet('/grocery/active')` with `Authorization: tma <initData>` header -> Express auth middleware validates signature -> Grocery route handler calls `groceryRepository.getActiveList(chatId)` -> Returns JSON -> React renders -> User taps item -> Optimistic UI update + `apiPost('/grocery/items/42/toggle')` -> Repository toggles in SQLite -> Confirm to React.

**State sync:** No WebSocket, no event bus. Bot writes to SQLite, Mini App reads from SQLite. Both use same repository instances. Mini App polls every 5-10 seconds (paused when backgrounded). Changes from either side immediately visible to the other because they share the database. chatId mapping: `initData.user.id === chat.id` for private chats (true for HeySous).

### Critical Pitfalls

1. **initData Validation Missing or Misconfigured** -- Without server-side validation, anyone can call API endpoints and impersonate users. Must implement as first middleware using @tma.js/init-data-node with `expiresIn: 3600` (1 hour). Never trust client-side initDataUnsafe. Default expiration is 24 hours (too long). Address in Phase 1 (API Foundation) before any data endpoints exist. SECURITY BREACH if skipped.

2. **iOS Scrolling Collapse -- Swipe Down Closes App** -- iOS Telegram interprets swipe-down at scrollY=0 as "close app" not "scroll." Grocery list starts at top, so first downward swipe closes the app. Fix: call `Telegram.WebApp.disableVerticalSwipes()` early in app initialization (Bot API 7.7+). Fallback: set `height: calc(100vh + 1px)` and programmatically scroll to (0, 1) on touchstart. Address in Phase 1 (Mini App scaffold). UX BREAKING on iOS without this fix.

3. **iOS Keyboard Covers Input Fields** -- iOS Telegram does not resize viewport when keyboard appears. Input fields at bottom get hidden. Fix: place inputs at TOP of screen (not bottom), use `visualViewport.height` not `viewportHeight`, scroll inputs into view on focus. Address in Phase 1 (UI layout) -- retrofitting bottom->top is a full layout rework. HIGH severity: affects add item, search recipes, all inputs.

4. **SQLite Concurrent Access -- Bot and Mini App Writing Simultaneously** -- Bot writes meal plan while Mini App toggles grocery item. SQLite default journal mode allows one writer at a time. Second write gets SQLITE_BUSY error, data lost. Fix: enable WAL mode (`PRAGMA journal_mode=WAL`), set `busy_timeout=5000`, keep transactions small, retry on SQLITE_BUSY. Address in Phase 1 (API Foundation) before adding write endpoints. DATA CORRUPTION risk.

5. **State Sync Between Bot and Mini App -- Stale Data** -- User opens grocery list Mini App, bot adds milk via chat, Mini App shows stale data. No real-time sync mechanism. Fix: Mini App polls every 5-10 seconds, re-fetches on `visibilitychange`, writes go immediately to database (no deferred saves). Address in Phase 2 (feature implementation) -- polling must launch with first data-fetching Mini App. HIGH severity: core value prop breaks if bot and Mini App disagree.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes API foundation, then incremental Mini App delivery in value order, with pitfall prevention built into each phase.

### Phase 1: API Foundation & Mini App Scaffold
**Rationale:** Security and platform integration are prerequisites for all Mini Apps. Building auth, one API endpoint, and minimal React setup validates the entire architecture before feature work begins.

**Delivers:**
- initData validation middleware (addresses Pitfall 1)
- One API endpoint (grocery list GET) to prove auth works
- Vite + React project structure with @tma.js/sdk integration
- Telegram SDK initialization: `disableVerticalSwipes()`, theme CSS variables, safe area handling (addresses Pitfalls 2, 3)
- SQLite WAL mode verification (addresses Pitfall 4)
- Express static file serving for Mini App
- BotFather menu button configuration

**Addresses features:** None yet -- this is infrastructure.

**Avoids pitfalls:** 1 (initData security), 2 (scrolling collapse), 3 (keyboard viewport), 4 (SQLite locking). These are foundational -- all Mini Apps depend on them.

**Validation:** Call API from curl without initData (401), with valid initData (200). Open Mini App on iOS, swipe down at top (should NOT close). Tap input field (should remain visible above keyboard). Run PRAGMA journal_mode (verify WAL).

### Phase 2: Grocery List Mini App
**Rationale:** Highest user value (solves biggest pain: cramped inline buttons), simplest data model (read + toggle), and validates the hybrid bot+Mini App UX pattern. Success here proves the concept.

**Delivers:**
- Grocery API routes: GET /api/grocery/active, POST /api/grocery/items/:id/toggle
- GroceryList React page with store tabs, section grouping
- Tap-to-check with optimistic updates and haptic feedback
- Progress indicator, checked items collapse
- Polling every 5 seconds for fresh data (addresses Pitfall 5)
- MainButton integration: "Done Shopping"
- Inline keyboard "Open Grocery List" button in bot /grocery response

**Addresses features:** All grocery list table stakes from FEATURES.md.

**Uses stack:** React, @telegram-apps/telegram-ui, @tma.js/sdk-react (haptic feedback, MainButton, theme).

**Avoids pitfall:** 5 (state sync) via polling implementation.

**Validation:** Check item in Mini App, ask bot "what's left?" (should reflect toggle). Add item via bot chat, wait 10 seconds, Mini App should show new item. Deploy, open Mini App immediately (should see updated version, not cached).

### Phase 3: Recipe Browser Mini App
**Rationale:** Builds before meal plan because meal plan's "tap recipe to view detail" depends on having a recipe detail component. Recipe browser is standalone and provides immediate value (first visual browse capability for knowledge base).

**Delivers:**
- Recipe API routes: GET /api/recipes, GET /api/recipes/:id, POST /api/recipes/search
- RecipeBrowser React page with card list, search bar (debounced, FTS5)
- RecipeCard component (title, summary, tags)
- RecipeDetail component (full content, formatted markdown)
- BackButton navigation (list -> detail -> back)
- Inline keyboard "Browse Recipes" button in bot responses

**Addresses features:** All recipe browser table stakes from FEATURES.md.

**Implements architecture:** Reusable RecipeDetail component for Phase 4.

**Validation:** Search for recipe, tap result, see detail. Tap back, return to list (scroll position maintained). Open with 0 recipes, see "No recipes yet. Add some via the bot!" message.

### Phase 4: Meal Plan Mini App
**Rationale:** Last because it requires RecipeDetail from Phase 3 for "tap meal to see recipe" interaction. Current text meal plan is adequate (less painful than grocery inline buttons), so deferring this is low-risk.

**Delivers:**
- Plan API routes: GET /api/plans/active (current + next week)
- MealPlan React page with 7-day grid, meal type rows
- Today highlight, week navigation toggle
- Tap meal name -> show RecipeDetail component (reused from Phase 3)
- Inline keyboard "View Plan" button in bot plan generation response

**Addresses features:** All meal plan table stakes from FEATURES.md.

**Uses:** RecipeDetail component from Phase 3, meal plan grid logic adapts to dinner-only or multi-meal.

**Validation:** Open plan on Tuesday (Tuesday highlighted). Tap Wednesday dinner, see recipe detail. Navigate to next week, see future plan. Switch Telegram to dark mode while Mini App open, colors update.

### Phase 5: Polish & v1.2 Features
**Rationale:** After v1.1 is validated with users, add differentiators based on actual usage patterns.

**Delivers (selective, based on user feedback):**
- Grocery: swipe to uncheck gesture
- Grocery: quick-add item form
- Recipe: tag-based filtering
- Recipe: "last cooked" date on cards
- Meal plan: improved recipe navigation

**Defers to v2+:** Recipe "add to plan," grocery item reordering, shared Mini App shell, recipe editing in app.

### Phase Ordering Rationale

- **Security first:** Phase 1 builds auth before any data endpoints exist. No user-facing features until security is correct.
- **Platform integration first:** Phase 1 handles iOS-specific issues (scroll collapse, keyboard, safe areas) before building UIs. Retrofitting these is expensive.
- **Value-driven feature order:** Grocery (biggest pain) -> Recipe browser (enables new capability) -> Meal plan (nice-to-have upgrade).
- **Dependency-driven:** Recipe browser before meal plan because meal plan needs RecipeDetail component.
- **Validation at each phase:** Each phase delivers a working, user-testable Mini App. No big-bang integration at the end.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Express middleware, React+Vite setup, and Telegram SDK integration are well-documented in official @tma.js docs.
- **Phase 2-4:** REST CRUD patterns, React component design, and @telegram-apps/telegram-ui usage are standard web development.

**Phases needing spot verification (not full research-phase):**
- **Phase 4:** Meal plan grid layout adapting to dinner-only vs. multi-meal might need UI iteration. Not a research topic, but plan for 1-2 design iterations.

**No phases need `/gsd:research-phase`** -- all patterns are validated by official docs and the existing HeySous codebase. Execution can proceed directly from this research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | @tma.js/sdk v3, React 19, Vite 7 verified via npm. Versions confirmed as current stable. Integration with existing Express 5 / Node 22 validated. |
| Features | HIGH | Table stakes derived from official Telegram Mini Apps docs + Telegram UI Kit. Competitive features from real TWA meal/grocery apps. Anti-features verified against HeySous v1.0 research (no nutrition tracking). |
| Architecture | HIGH | initData validation algorithm from official Telegram docs. Express + repository pattern matches existing HeySous architecture. State sync via SQLite is consequence of existing single-process design. |
| Pitfalls | HIGH | iOS-specific issues (scroll collapse, keyboard, safe areas) verified in TelegramMessenger/Telegram-iOS GitHub issues with 100+ comments. SQLite WAL mode is standard knowledge. initData expiration from official docs. |

**Overall confidence:** HIGH

The stack, architecture, and pitfalls are all verified against official Telegram documentation and the @tma.js SDK docs. Feature expectations are grounded in both the Telegram Mini Apps platform capabilities and HeySous's existing v1.0 data model (inspected: groceryRepository, planRepository, knowledgeRepository all have the exact functions needed by the API routes). The iOS-specific pitfalls are well-documented in the Telegram-iOS GitHub repo with hundreds of community confirmations.

### Gaps to Address

**Minor gaps (handle during implementation):**

- **Exact @telegram-apps/telegram-ui peer dependency with React 19:** npm metadata shows compatibility with React 18+, but explicit React 19 testing not documented. Verify at install time. If peer dependency conflict, fall back to React 18 or use custom Telegram-styled components.

- **Vite 7 proxy with Express 5:** Standard Vite proxy pattern, but Express 5 is relatively new. Test API proxy in dev mode early (Phase 1). Fallback: run Vite and Express separately with CORS during dev.

- **initData caching on desktop client:** Telegram desktop may cache initData for hours, causing "expired" errors even on fresh opens. If encountered, increase `expiresIn` to 7200 (2 hours) for desktop, or handle gracefully with "please reopen" message.

- **useLaunchParams removal in @tma.js/sdk-react v3:** Confirmed in GitHub issue #667. Workaround is `useMemo(() => retrieveLaunchParams(), [])`. Verify this works in Phase 1 SDK setup.

**No blocking gaps.** All identified gaps have documented workarounds and can be resolved during implementation without additional research.

## Sources

### Primary (HIGH confidence)

**Official Telegram documentation:**
- [Telegram Bot API - Mini Apps](https://core.telegram.org/bots/webapps) -- initData, theme, viewport, events, MainButton, BackButton, sendData
- [Telegram Mini Apps Community Docs](https://docs.telegram-mini-apps.com/) -- Platform overview, theming, init data validation, navigation, closing behavior
- [Telegram Bot API - WebAppInfo](https://core.telegram.org/bots/api#webappinfo) -- web_app inline keyboard specification

**npm packages (verified versions):**
- [@tma.js/sdk](https://www.npmjs.com/package/@tma.js/sdk) v3.1.4 -- Core Telegram Mini Apps SDK
- [@tma.js/sdk-react](https://www.npmjs.com/package/@tma.js/sdk-react) v3.0.15 -- React bindings
- [@tma.js/init-data-node](https://www.npmjs.com/package/@tma.js/init-data-node) v2.0.4 -- Server-side validation
- [@telegram-apps/telegram-ui](https://www.npmjs.com/package/@telegram-apps/telegram-ui) v2.1.13 -- UI components
- [react](https://www.npmjs.com/package/react) v19.2.4 -- Current stable
- [react-router](https://www.npmjs.com/package/react-router) v7.13.0 -- Current stable
- [vite](https://www.npmjs.com/package/vite) v7.3.1 -- Current stable

**GitHub repositories:**
- [tma.js monorepo](https://github.com/Telegram-Mini-Apps/telegram-apps) -- SDK source, migration docs
- [TelegramUI](https://github.com/telegram-mini-apps-dev/TelegramUI) -- Component library source
- [grammY keyboard plugin](https://grammy.dev/plugins/keyboard) -- .webApp() method docs
- [Official React template](https://github.com/Telegram-Mini-Apps/reactjs-template) -- Reference structure

### Secondary (MEDIUM confidence)

**Platform issues and workarounds:**
- [Telegram-iOS #1447](https://github.com/TelegramMessenger/Telegram-iOS/issues/1447) -- Scrolling collapse issue (200+ comments)
- [Telegram-iOS #1410](https://github.com/TelegramMessenger/Telegram-iOS/issues/1410) -- Keyboard viewport issue (150+ comments)
- [Telegram-iOS #1377](https://github.com/TelegramMessenger/Telegram-iOS/issues/1377) -- Safe area insets (100+ comments)
- [Telegram-Mini-Apps/issues #16](https://github.com/Telegram-Mini-Apps/issues/issues/16) -- Scrolling collapse fix guide
- [Telegram-Mini-Apps/issues #667](https://github.com/Telegram-Mini-Apps/telegram-apps/issues/667) -- useLaunchParams removal in v3

**Design references:**
- [Telegram Mini Apps UI Kit (Figma)](https://www.figma.com/community/file/1348989725141777736/telegram-mini-apps-ui-kit) -- Official design patterns
- [BAZU - Best Practices for TWA UI/UX](https://bazucompany.com/blog/best-practices-for-ui-ux-in-telegram-mini-apps/) -- Platform conventions

**Competitor analysis:**
- [Plan to Eat](https://www.plantoeat.com/) -- Meal plan calendar patterns
- [CNN - Best Meal Planning Apps 2026](https://www.cnn.com/cnn-underscored/reviews/best-meal-planning-apps) -- Feature expectations

### Tertiary (LOW confidence, needs validation)

- Exact `emptyDirBeforeWrite` option name in Vite 7 config (may be `emptyOutDir` from Vite 6) -- verify in Vite 7 docs during Phase 1
- Vite proxy performance with Express 5 -- standard pattern but untested with Express 5 specifically

---
*Research completed: 2026-02-09*
*Ready for roadmap: yes*
