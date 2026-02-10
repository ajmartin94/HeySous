# Phase 11: Mini App Foundation - Research

**Researched:** 2026-02-09
**Domain:** Telegram Mini Apps infrastructure (React+Vite SPA, Express API, initData auth, iOS fixes, theming)
**Confidence:** HIGH

## Summary

This phase delivers the shared infrastructure that Phases 12-14 will build on: a React+Vite SPA served by the existing Express server, authenticated via Telegram's initData HMAC-SHA256 mechanism, with iOS-specific fixes (scroll collapse, safe areas) and Telegram theme integration. The user has locked decisions around a single SPA with client-side routing, a hub dashboard page, deep-linking from inline keyboard buttons, and a Telegram-native UI with sage-green accent color personality.

The standard stack is well-established: `@tma.js/sdk-react` v3 for Telegram SDK integration, `@telegram-apps/telegram-ui` for native-feeling components, `@tma.js/init-data-node` for server-side auth validation, `react-router-dom` v7 for client-side routing, and `lucide-react` for food-themed icons. The mini-app frontend lives in a `mini-app/` subdirectory with its own `package.json` and builds to `mini-app/dist/` which Express serves at `/app/*`.

**Primary recommendation:** Build the mini-app as a separate Vite project in `mini-app/` with its own `package.json`. Express serves the built static files at `/app/*` with SPA fallback, and API routes at `/api/*` reuse existing repository factories via DI injection. Deep-linking uses the `web_app` URL field in inline keyboard buttons (e.g., `https://domain.com/app/grocery`) rather than `startapp` parameters.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Entry Points & Navigation
- BotFather menu button opens a **hub page** (not a specific Mini App)
- Bot responses include **contextual inline keyboard buttons** -- e.g., grocery list response gets "View List" button, meal plan response gets "View Plan"
- Users can navigate **between Mini App views without closing** -- the hub page or in-app navigation supports cross-view switching (grocery -> recipes -> plan)
- Contextual buttons **deep-link directly to the relevant view** -- tapping "View List" opens the grocery list, not the hub. Hub is only reached via the menu button
- This means the Mini App is a **single React SPA with client-side routing** -- hub, grocery, recipes, and meal plan are all routes within one app

#### Landing Experience
- Hub page shows **dashboard cards with live data previews** -- e.g., "12 items on your list", "3 meals planned this week", "24 recipes saved"
- Each card is tappable to navigate to that Mini App view
- **Skeleton screens** for loading states -- gray placeholder shapes matching the layout, content fills in
- Empty states use a **helpful nudge tone** -- e.g., "No recipes yet -- ask me to save one in chat!" with guidance back to the bot
- Hub page has a **brief header** with "HeySous" branding at the top, then dashboard cards below -- personality without wasting space

#### Theme & Styling
- **Telegram-native base with HeySous personality** -- use @telegram-apps/telegram-ui components as the foundation, add subtle brand touches
- Personality via **accent color + food-related icons** (no emoji) -- section headers, empty states, and interactive elements get food-themed iconography
- Accent color: **fresh/green palette** -- sage green, herb green tones. Must work in both light and dark Telegram themes
- **Spacious layout** -- generous padding, larger text, breathing room. Comfortable for scanning, not dense

### Claude's Discretion
- Exact green accent color values (light/dark mode variants)
- Specific food icon choices and icon library
- Skeleton screen shapes and animation style
- Hub card layout (grid vs stacked)
- Navigation pattern between views (tabs, back arrows, or hub-centric)
- All technical architecture: middleware patterns, file structure, build config

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.x | UI framework | Current stable, required by @telegram-apps/telegram-ui |
| `react-dom` | 19.2.x | DOM rendering | Pairs with React |
| `@tma.js/sdk-react` | 3.0.x | Telegram Mini App SDK (React bindings) | Official SDK by Telegram team; re-exports @tma.js/sdk, provides hooks like useSignal, useLaunchParams |
| `@telegram-apps/telegram-ui` | 2.1.x | Telegram-native UI components | Official component library; AppRoot, Cell, Section, List, Button, etc. |
| `@tma.js/init-data-node` | 2.0.x | Server-side initData HMAC-SHA256 validation | Official package; validate() throws typed errors |
| `react-router-dom` | 7.13.x | Client-side SPA routing | Standard React routing; createBrowserRouter with basename |
| `lucide-react` | 0.563.x | Food-themed SVG icons | 69+ food/cooking icons (CookingPot, Salad, Utensils, Beef, Cherry, Wheat, etc.); tree-shakeable |
| `vite` | 7.3.x | Frontend build tool | Fast HMR, ESM-native, React plugin |
| `@vitejs/plugin-react` | 5.1.x | Vite React plugin | JSX transform, Fast Refresh |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typescript` | 5.9.x | Type safety for mini-app code | Already in project; mini-app gets its own tsconfig |
| `@types/react` | 19.x | React type definitions | TypeScript support |
| `@types/react-dom` | 19.x | ReactDOM type definitions | TypeScript support |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-router-dom` | `@telegram-apps/react-router-integration` | Official Telegram integration package exists (v1.0.1) but it uses a HashNavigator that stores state in sessionStorage rather than the URL, breaking direct deep-link URLs. Standard react-router-dom with BrowserRouter and basename="/app" is simpler and supports the web_app URL deep-linking pattern directly. |
| `lucide-react` | `react-icons` or custom SVGs | lucide-react has better tree-shaking, consistent style, and extensive food category (69+ icons). react-icons bundles are larger. |
| Separate Vite project | Monorepo (Turborepo/nx) | Overkill for one SPA; a simple `mini-app/` subdirectory with its own package.json is sufficient |

**Installation (in `mini-app/` directory):**
```bash
npm init -y
npm install react react-dom react-router-dom @tma.js/sdk-react @telegram-apps/telegram-ui lucide-react
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

**Installation (in root project for server-side validation):**
```bash
npm install @tma.js/init-data-node
```

## Architecture Patterns

### Recommended Project Structure

```
heysous/
├── src/                           # Existing backend code
│   ├── server.ts                  # Express -- add /app/* static + /api/* routes
│   ├── mini-app/                  # NEW: backend Mini App code
│   │   ├── router.ts             # Express Router for /api/* routes
│   │   ├── auth-middleware.ts    # initData validation middleware
│   │   └── routes/               # API route handlers
│   │       ├── grocery.ts        # GET /api/grocery (reuses groceryRepository)
│   │       ├── plans.ts          # GET /api/plans (reuses planRepository)
│   │       └── knowledge.ts      # GET /api/knowledge (reuses knowledgeRepository)
│   ├── config.ts                  # Add MINI_APP_URL config
│   └── ...existing code...
├── mini-app/                      # NEW: frontend SPA
│   ├── package.json              # Separate deps (react, vite, etc.)
│   ├── tsconfig.json             # Frontend-specific TS config
│   ├── vite.config.ts            # base: '/app/', build to dist/
│   ├── index.html                # SPA entry point
│   └── src/
│       ├── main.tsx              # React entry: init SDK, mount router
│       ├── init.ts               # SDK initialization (extracted for clarity)
│       ├── App.tsx               # AppRoot + RouterProvider
│       ├── router.tsx            # createBrowserRouter definition
│       ├── theme/
│       │   ├── variables.css     # HeySous accent colors, spacing overrides
│       │   └── tokens.ts         # Color constants for JS usage
│       ├── components/
│       │   ├── Layout.tsx        # Shared layout with nav
│       │   ├── BackButton.tsx    # Telegram back button integration
│       │   └── SkeletonCard.tsx  # Skeleton loading component
│       └── pages/
│           ├── Hub.tsx           # Dashboard hub page
│           ├── Grocery.tsx       # Grocery list (Phase 12)
│           ├── Recipes.tsx       # Recipe browser (Phase 13)
│           └── MealPlan.tsx      # Meal plan view (Phase 14)
└── ...existing files...
```

### Pattern 1: SDK Initialization (Critical)

**What:** Initialize the Telegram SDK before React renders. Must call `init()` first, then mount components.
**When to use:** At app entry point, before React tree mounts.

```typescript
// mini-app/src/init.ts
import {
  init,
  miniApp,
  themeParams,
  viewport,
  swipeBehavior,
  backButton,
} from '@tma.js/sdk-react';

export async function initializeTelegramSDK(): Promise<void> {
  // 1. Initialize the SDK (must be first)
  init();

  // 2. Mount theme params and mini app
  themeParams.mount();
  miniApp.mount();

  // 3. Bind CSS variables for theming
  themeParams.bindCssVars();
  miniApp.bindCssVars();

  // 4. Mount and configure viewport
  await viewport.mount();
  viewport.bindCssVars();

  // 5. Expand to full height
  viewport.expand();

  // 6. Disable vertical swipes (iOS scroll collapse fix)
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
    swipeBehavior.disableVertical();
  }

  // 7. Mount back button
  backButton.mount();

  // 8. Signal ready (hides loading placeholder)
  miniApp.ready();
}
```

```typescript
// mini-app/src/main.tsx
import { initializeTelegramSDK } from './init';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@telegram-apps/telegram-ui/dist/styles.css';
import './theme/variables.css';

async function bootstrap() {
  await initializeTelegramSDK();
  const root = document.getElementById('root')!;
  createRoot(root).render(<App />);
}

bootstrap();
```

### Pattern 2: Deep Linking via web_app URL

**What:** Inline keyboard buttons specify the full URL path to the target view. The SPA router handles it.
**When to use:** When bot sends responses with contextual "View X" buttons.

```typescript
// src/bot/handlers/grocery.ts (backend, adding inline button)
import { InlineKeyboard } from 'grammy';

// The web_app URL points directly to the route:
const keyboard = new InlineKeyboard()
  .webApp('View List', `${config.miniAppUrl}/grocery`);
// config.miniAppUrl = "https://your-domain.com/app"

await ctx.reply('Here is your grocery list!', {
  reply_markup: keyboard,
});
```

```typescript
// mini-app/src/router.tsx (frontend routing)
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Hub /> },
      { path: 'grocery', element: <Grocery /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'plan', element: <MealPlan /> },
    ],
  },
], {
  basename: '/app',  // All routes prefixed with /app
});
```

**Key insight:** The `web_app` field in `InlineKeyboardButton` accepts any HTTPS URL. By passing `https://domain.com/app/grocery`, Telegram opens the WebView at that path. The SPA's BrowserRouter with `basename="/app"` picks up the `/grocery` route. No `startapp` parameter encoding/decoding needed.

### Pattern 3: initData Authentication Middleware

**What:** Express middleware that validates every `/api/*` request using initData HMAC-SHA256.
**When to use:** All API routes that the Mini App calls.

```typescript
// src/mini-app/auth-middleware.ts
import { validate } from '@tma.js/init-data-node';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function validateInitData(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers['x-init-data'] as string | undefined;

  if (!initData) {
    res.status(401).json({ error: 'Missing initData' });
    return;
  }

  try {
    // validate() throws if invalid; expiresIn in seconds (1 hour = 3600)
    validate(initData, config.botToken, { expiresIn: 3600 });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid initData' });
    return;
  }
}
```

```typescript
// Frontend: attach initData to every API request
// mini-app/src/api.ts
import { retrieveLaunchParams } from '@tma.js/sdk-react';

const { initDataRaw } = retrieveLaunchParams();

export async function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'X-Init-Data': initDataRaw ?? '',
    },
  });
}
```

### Pattern 4: Express Static Serving with SPA Fallback

**What:** Serve the Vite build at `/app/*` with fallback to `index.html` for client-side routes.
**When to use:** In `server.ts` -- add before webhook handler.

```typescript
// src/server.ts additions
import { resolve } from 'node:path';
import express from 'express';

// Serve built Mini App static files
const miniAppDist = resolve(import.meta.dirname, '..', 'mini-app', 'dist');
app.use('/app', express.static(miniAppDist));

// SPA fallback: any /app/* request that didn't match a static file
// gets the index.html so React Router can handle it
app.get('/app/*', (_req, res) => {
  res.sendFile(resolve(miniAppDist, 'index.html'));
});

// API routes (before webhook, after static)
app.use('/api', apiRouter);
```

### Pattern 5: API Routes Reusing Existing Repositories (DI)

**What:** API handlers receive the same repository instances used by the bot handlers.
**When to use:** For all /api/* routes.

```typescript
// src/mini-app/router.ts
import { Router } from 'express';
import type BetterSqlite3 from 'better-sqlite3';
import { validateInitData } from './auth-middleware.js';

interface ApiRouterDeps {
  sqlite: BetterSqlite3.Database;
  // Add specific repos as needed
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  // All API routes require valid initData
  router.use(validateInitData);

  // Example: grocery summary for hub
  router.get('/grocery/summary', (req, res) => {
    // Extract chatId from validated initData
    // Use deps.sqlite to query groceryRepository
  });

  return router;
}
```

### Pattern 6: Telegram Theme + HeySous Accent Colors

**What:** Use Telegram's CSS variables as base, overlay HeySous green accent.
**When to use:** In the theme CSS variables file.

```css
/* mini-app/src/theme/variables.css */
:root {
  /* HeySous sage green accent -- works on both light and dark Telegram themes */
  --hs-accent: #5B8C5A;           /* Primary sage green */
  --hs-accent-light: #7DB87C;     /* Lighter variant for hover states */
  --hs-accent-dark: #3D6B3C;      /* Darker variant for active states */
  --hs-accent-subtle: rgba(91, 140, 90, 0.12); /* Background tint */

  /* Spacious layout tokens */
  --hs-spacing-card: 16px;
  --hs-spacing-section: 24px;
  --hs-border-radius: 14px;
}
```

### Anti-Patterns to Avoid

- **Installing both `@tma.js/sdk` and `@tma.js/sdk-react`:** The React package re-exports everything from the base SDK. Installing both causes duplicate instances and bugs.
- **Calling SDK methods before `init()`:** The SDK has no side effects until explicitly initialized. Calling `backButton.show()` before `init()` and `backButton.mount()` will throw.
- **Using `mockTelegramEnv()` in production:** The development mock that simulates the Telegram environment must be excluded from production builds. Use Vite's `import.meta.env.DEV` guard.
- **Using HashRouter instead of BrowserRouter:** Hash-based routing breaks the `web_app` URL deep-linking strategy because the web_app URL IS the route path. BrowserRouter with `basename="/app"` is correct.
- **Synchronous SDK init in module scope:** Wrap initialization in an async function. Synchronous IIFEs at module top-level have caused crashes on Android (see tma.js issue #624).
- **Skipping `viewport.expand()` call:** Without this, the Mini App opens at a compact height instead of full viewport.
- **Not extracting `initDataRaw` at launch:** `retrieveLaunchParams()` reads from `window.location.hash` which may be overwritten by React Router. Call it once at startup and store it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| initData HMAC-SHA256 validation | Custom crypto code | `@tma.js/init-data-node` validate() | Handles key derivation from "WebAppData", field ordering, hash comparison, expiration; custom code will have subtle bugs |
| Telegram theme CSS variables | Manual color extraction from tgWebAppThemeParams | `themeParams.bindCssVars()` from @tma.js/sdk-react | Auto-creates `--tg-theme-*` CSS vars, updates on theme change events |
| Safe area inset handling | Manual env() CSS or JS measurement | `viewport.bindCssVars()` + `viewport.contentSafeAreaInsets()` | Creates `--tg-viewport-*` CSS vars, handles both device and Telegram UI safe areas |
| iOS scroll collapse prevention | CSS overflow hacks or touch-event listeners | `swipeBehavior.disableVertical()` from @tma.js/sdk-react | Official Telegram API (Bot API 7.7+), works reliably across versions |
| Telegram-native UI components | Custom buttons, cells, sections | `@telegram-apps/telegram-ui` (AppRoot, Cell, Section, List, Button) | Platform-adaptive (iOS vs Android), handles theme automatically, consistent with Telegram UX |
| Back button behavior | Custom back button UI | `backButton` from @tma.js/sdk-react | Controls Telegram's native back button in the WebView header |
| Skeleton loading states | Custom shimmer animations | CSS `@keyframes` pulse on neutral backgrounds | Simple CSS approach; @telegram-apps/telegram-ui provides `--tgui--skeleton` token for skeleton color |

## Common Pitfalls

### Pitfall 1: iOS Scroll Collapse (CRITICAL)
**What goes wrong:** On iOS, swiping down at the top of the page closes the Mini App instead of scrolling.
**Why it happens:** Telegram's iOS WebView interprets downward swipes as "close" gestures by default.
**How to avoid:** Call `swipeBehavior.mount()` then `swipeBehavior.disableVertical()` during SDK initialization. Requires Bot API 7.7+ (supported on all current Telegram iOS versions).
**Warning signs:** App closes unexpectedly when user tries to scroll up on any page.

### Pitfall 2: initData Expires After 1 Hour
**What goes wrong:** Users who leave the Mini App open for a long time get 401 errors.
**Why it happens:** The `validate()` function checks auth_date against the `expiresIn` option (default: 86400 seconds = 24 hours). The milestone research recommends 1 hour (3600 seconds).
**How to avoid:** Set `expiresIn: 3600` in the validate options. On the frontend, detect 401 responses and prompt the user to reopen the Mini App (which generates fresh initData).
**Warning signs:** API calls fail after the app has been open for a while.

### Pitfall 3: Launch Parameters Lost to Router
**What goes wrong:** `retrieveLaunchParams()` returns empty data after initial navigation.
**Why it happens:** The function reads from `window.location.hash`, which React Router's BrowserRouter may modify. Hash data from Telegram is only available at first load.
**How to avoid:** Call `retrieveLaunchParams()` ONCE at startup, store `initDataRaw` in a module-level variable or React context, and reference that stored value for all subsequent API calls.
**Warning signs:** initData is empty string after navigating to a second page.

### Pitfall 4: Vite Base Path Mismatch
**What goes wrong:** Static assets (JS, CSS) return 404 after deploying.
**Why it happens:** Vite defaults to `base: '/'` but the app is served at `/app/`. Asset references point to `/assets/main.js` instead of `/app/assets/main.js`.
**How to avoid:** Set `base: '/app/'` in `vite.config.ts`. Also set `basename: '/app'` in `createBrowserRouter`. These MUST match.
**Warning signs:** White screen, console shows 404 for JS/CSS files.

### Pitfall 5: Express Catch-All Route Order
**What goes wrong:** SPA fallback serves index.html for API routes, or webhook stops working.
**Why it happens:** Express processes middleware in registration order. A wildcard `/app/*` before `/api/*` catches API calls.
**How to avoid:** Register in this order: (1) `express.static` for `/app`, (2) `/api/*` router, (3) webhook handler, (4) `/app/*` SPA fallback. The static middleware handles known files, API router handles data, SPA fallback catches remaining /app/* for client-side routes.
**Warning signs:** API calls return HTML instead of JSON.

### Pitfall 6: CORS and Same-Origin
**What goes wrong:** API calls from the Mini App get blocked by CORS.
**Why it happens:** If serving API and frontend from different origins/ports during development.
**How to avoid:** In production, API (/api/*) and frontend (/app/*) are on the same Express server -- same origin, no CORS needed. During development, use Vite proxy to forward /api/* requests to the Express server.
**Warning signs:** "Access-Control-Allow-Origin" errors in console.

### Pitfall 7: chatId Extraction from initData
**What goes wrong:** API routes cannot identify which user's data to return.
**Why it happens:** After validation, you need to parse the initData string to extract the user ID or chat info.
**How to avoid:** After `validate()` succeeds, use `parse()` from `@tma.js/init-data-node` to extract structured data including `user.id`. Use this as the chatId for repository queries.
**Warning signs:** API returns data for wrong user or empty results.

## Code Examples

### Vite Configuration for Sub-App

```typescript
// mini-app/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Dev proxy: forward API calls to Express backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### AppRoot with Telegram UI

```tsx
// mini-app/src/App.tsx
import { AppRoot } from '@telegram-apps/telegram-ui';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export function App() {
  return (
    <AppRoot>
      <RouterProvider router={router} />
    </AppRoot>
  );
}
```

### Back Button Integration with React Router

```tsx
// mini-app/src/components/BackButton.tsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/app' || location.pathname === '/app/';

  useEffect(() => {
    if (isHome) {
      backButton.hide();
    } else {
      backButton.show();
    }

    const off = backButton.onClick(() => {
      navigate(-1);
    });

    return () => {
      off();
    };
  }, [isHome, navigate]);
}
```

### Hub Summary API Endpoint

```typescript
// src/mini-app/routes/summary.ts
import type { Request, Response } from 'express';
import type BetterSqlite3 from 'better-sqlite3';

export function createSummaryRoute(sqlite: BetterSqlite3.Database) {
  return (_req: Request, res: Response) => {
    // Query counts for each section
    const groceryCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM grocery_list_items gli
                JOIN grocery_lists gl ON gli.list_id = gl.id
                WHERE gl.chat_id = ? AND gl.status = 'active' AND gli.checked = 0`)
      .get(res.locals.chatId) as { count: number };

    // ... similar for recipes and plans

    res.json({
      grocery: { uncheckedCount: groceryCount.count },
      // recipes: { count: ... },
      // plans: { mealCount: ... },
    });
  };
}
```

### BotFather Menu Button Setup (via grammY API)

```typescript
// Called once during setup (or in a setup script)
await bot.api.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: 'Open App',
    web_app: { url: `${config.miniAppUrl}` },
    // config.miniAppUrl = "https://your-domain.com/app"
    // Opens hub page (/) because basename="/app" + path="/"
  },
});
```

### Inline Keyboard with Deep Link Button

```typescript
// In a bot handler that responds with grocery data:
import { InlineKeyboard } from 'grammy';

const keyboard = new InlineKeyboard()
  .webApp('View List', `${config.miniAppUrl}/grocery`);

await ctx.reply(groceryMessage, {
  reply_markup: keyboard,
  parse_mode: 'HTML',
});
```

### Extracting chatId from Validated initData

```typescript
// src/mini-app/auth-middleware.ts (enhanced)
import { validate, parse } from '@tma.js/init-data-node';

export function validateInitData(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers['x-init-data'] as string;

  if (!initData) {
    res.status(401).json({ error: 'Missing initData' });
    return;
  }

  try {
    validate(initData, config.botToken, { expiresIn: 3600 });
    const parsed = parse(initData);
    // Store chatId (user.id) for downstream route handlers
    res.locals.chatId = String(parsed.user?.id ?? '');
    if (!res.locals.chatId) {
      res.status(401).json({ error: 'No user in initData' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid initData' });
    return;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useLaunchParams()` hook | `retrieveLaunchParams()` function + `useMemo` | @tma.js/sdk v3 | The hook still exists in v3 but `retrieveLaunchParams()` is more reliable; call once at startup |
| Manual CSS variable extraction from `tgWebAppThemeParams` | `themeParams.bindCssVars()` auto-binds `--tg-theme-*` | @tma.js/sdk v2+ | No manual parsing needed |
| CSS `env(safe-area-inset-*)` hacks | `viewport.contentSafeAreaInsets()` + `viewport.safeAreaInsets()` | Bot API 8.0 | Separate device safe area (notch) from Telegram UI safe area (header) |
| Polling with `disableVerticalSwipes()` on WebApp object | `swipeBehavior.disableVertical()` via SDK signal | Bot API 7.7 / @tma.js/sdk v3 | Type-safe, availability-checked |
| `@telegram-apps/sdk-react` v2 | `@tma.js/sdk-react` v3 | 2025 | Package renamed/restructured; v3 uses signals pattern throughout |

**Deprecated/outdated:**
- `Telegram.WebApp.*` global object: Still works but prefer `@tma.js/sdk-react` for type safety and React integration
- `@telegram-apps/sdk-react` v2: Superseded by `@tma.js/sdk-react` v3
- `useLaunchParams` as a "hook that subscribes to changes": In v3 it's a simple function call, not reactive

## Discretion Recommendations

### Accent Color Values
**Recommendation:** Sage green `#5B8C5A` as primary. This hex is a muted, natural sage that:
- Has sufficient contrast (4.5:1) against white text on buttons
- Reads as "fresh/herbal" without being neon
- Dark mode variant: `#7DB87C` (lighter to maintain contrast on dark backgrounds)
- Subtle background tint: `rgba(91, 140, 90, 0.12)` for card highlights

### Icon Library
**Recommendation:** `lucide-react`. It has 69+ food-related icons including: `CookingPot`, `Salad`, `Utensils`, `UtensilsCrossed`, `Beef`, `Cherry`, `Apple`, `Wheat`, `Fish`, `Egg`, `Carrot`, `ChefHat`, `Coffee`, `Milk`, `Sandwich`, `Pizza`, `Soup`. Tree-shakeable (only used icons in bundle). Consistent stroke-based style that complements Telegram UI's clean aesthetic.

Suggested icon mapping:
- Hub header: `ChefHat` or `CookingPot`
- Grocery card: `ShoppingCart` (from lucide) or `Salad`
- Recipes card: `CookingPot` or `UtensilsCrossed`
- Meal Plan card: `CalendarDays` (from lucide) + food accent

### Skeleton Screen Style
**Recommendation:** Use `@telegram-apps/telegram-ui`'s built-in `--tgui--skeleton` CSS token for background color. Apply CSS `@keyframes` pulse animation (opacity 0.4 to 0.7, 1.5s ease-in-out infinite). Shape skeletons to match content layout: rounded rectangles for cards, lines for text.

### Hub Card Layout
**Recommendation:** Stacked (full-width) cards, not grid. Reasons:
- Mobile-first: Telegram Mini Apps are phone-only
- Spacious layout aligns with locked design decision
- Stacked cards have room for the data preview text
- Each card: icon + title + summary stat + subtle accent border-left

### Navigation Pattern
**Recommendation:** Hub-centric with Telegram back button. No tab bar.
- Hub is the home page (menu button destination)
- Deep-linked views show Telegram's native back button to return to hub
- Within views, use the SDK `backButton` component
- Cross-navigation: each view can have a subtle "navigation row" at top or links to other views
- Tab bars consume valuable vertical space on small screens and fight with Telegram's own UI

## Open Questions

1. **HTTPS URL for Development Testing**
   - What we know: Telegram requires HTTPS for Mini App URLs. Self-signed certs don't work on iOS/Android Telegram apps.
   - What's unclear: Whether the existing deployment has HTTPS configured, or if ngrok/cloudflared tunnel is needed for testing.
   - Recommendation: Use ngrok or cloudflared to expose local dev server for testing. Add `MINI_APP_URL` env var that can be set to tunnel URL during dev.

2. **chatId Mapping: user.id vs chat.id**
   - What we know: Existing bot code uses `ctx.chat.id` as chatId (which equals user.id in private chats). initData provides `user.id`.
   - What's unclear: Need to verify that `String(parsed.user.id)` matches the chatId used in existing repository queries.
   - Recommendation: Should be identical for private chats (1:1 bot conversations), but verify with a test.

3. **Build Process Integration**
   - What we know: Backend uses `tsc` for build. Mini App uses Vite.
   - What's unclear: How to coordinate builds for deployment.
   - Recommendation: Add npm scripts to root package.json: `"build:app": "cd mini-app && npm run build"`, `"build:all": "npm run build && npm run build:app"`.

## Sources

### Primary (HIGH confidence)
- @tma.js/sdk-react docs: https://docs.telegram-mini-apps.com/packages/tma-js-sdk-react -- hooks, init, signals
- @tma.js/sdk features: https://docs.telegram-mini-apps.com/packages/tma-js-sdk/features -- viewport, miniApp, swipeBehavior, themeParams
- @tma.js/init-data-node: https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating -- validate API
- Telegram Bot API: https://core.telegram.org/bots/webapps -- WebAppInfo, inline buttons, menu button, initData
- Telegram Mini Apps Launch Params: https://docs.telegram-mini-apps.com/platform/launch-parameters -- tgWebAppStartParam, tgWebAppData
- Telegram Mini Apps Start Parameter: https://docs.telegram-mini-apps.com/platform/start-parameter -- startapp restrictions
- @telegram-apps/telegram-ui: https://github.com/telegram-mini-apps-dev/TelegramUI -- components, AppRoot, theming
- TelegramUI DeepWiki: https://deepwiki.com/Telegram-Mini-Apps/TelegramUI/1.1-getting-started -- setup guide, component categories
- npm registry (verified versions via `npm view`): @tma.js/sdk-react@3.0.15, @tma.js/init-data-node@2.0.6, @telegram-apps/telegram-ui@2.1.13, react-router-dom@7.13.0, lucide-react@0.563.0, vite@7.3.1, react@19.2.4

### Secondary (MEDIUM confidence)
- Telegram Mini Apps official React template: https://github.com/Telegram-Mini-Apps/reactjs-template -- project structure patterns, mockTelegramEnv
- tma.js GitHub issue #624: https://github.com/Telegram-Mini-Apps/telegram-apps/issues/624 -- init() crash on Android, async init fix
- grammY keyboard plugin: https://grammy.dev/plugins/keyboard -- InlineKeyboard.webApp() method
- Vite build docs: https://vite.dev/guide/build -- base path configuration

### Tertiary (LOW confidence)
- @telegram-apps/react-router-integration: Package exists (v1.0.1) but uses HashNavigator/sessionStorage approach; unclear if it supports BrowserRouter pattern. Docs page returned 404. Recommendation: skip this package, use standard react-router-dom.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm, versions confirmed, official docs reviewed
- Architecture: HIGH -- patterns validated against official template, existing codebase reviewed for DI patterns
- Deep linking: HIGH -- web_app inline button URL mechanism verified via Telegram Bot API docs and grammY docs
- initData validation: HIGH -- @tma.js/init-data-node validate() API documented with typed errors
- iOS fixes: HIGH -- swipeBehavior.disableVertical() documented in official SDK docs, viewport expand/safe area APIs confirmed
- Theming: HIGH -- themeParams.bindCssVars() and @telegram-apps/telegram-ui AppRoot confirmed
- Pitfalls: HIGH -- drawn from official docs, known GitHub issues, and cross-verified patterns

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable ecosystem, packages actively maintained)
