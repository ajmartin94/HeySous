# Stack Research: Telegram Mini Apps (TWA) with React

**Domain:** Telegram Mini Apps (TWA) with React frontend for existing Node.js/Express/grammY bot
**Researched:** 2026-02-09
**Confidence:** HIGH

This document covers ONLY the stack additions needed for Mini App features. The existing bot stack (Node.js 22, TypeScript/ESM, grammY 1.39.x, better-sqlite3, Drizzle ORM, Anthropic SDK, Express 5, Pino) is validated and unchanged. See the v1.0 STACK.md in git history for that research.

---

## Recommended Stack

### Core Frontend Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.2.4 | UI framework for Mini Apps | Current stable. Component model suits 3 distinct Mini App views (grocery, meal plan, recipes). React 19 has improved Suspense, use() hook, and better performance. Massive ecosystem. Best Telegram Mini Apps SDK support of any framework. |
| Vite | ^7.3.1 | Build tool and dev server | Standard tool for Telegram Mini Apps (all official templates use it). Fast HMR in development, Rollup-based production builds output static files servable from existing Express server. Vite 7 requires Node.js 20.19+ (we use 22, compatible). |
| @vitejs/plugin-react | ^5.1.3 | Vite React integration | Official Vite plugin for React. Provides Fast Refresh (HMR), JSX transform, and optimized builds. |
| @tma.js/sdk | ^3.1.4 | Core Telegram Mini Apps SDK | The current recommended package (replaces deprecated `@telegram-apps/sdk` namespace). Exposes components: `backButton`, `mainButton`, `viewport`, `themeParams`, `hapticFeedback`, `closingBehavior`, `miniApp`, `initData`. Signal-based reactivity. |
| @tma.js/sdk-react | ^3.0.15 | React bindings for Telegram Mini Apps SDK | Provides `useSignal` hook for reactive access to Telegram platform signals (viewport, theme, buttons). Thin wrapper over `@tma.js/sdk` that bridges signals to React state. |
| react-router | ^7.13.0 | Client-side routing | React Router v7 (simplified from react-router-dom -- single package now). Needed for routing between the 3 Mini App views and deep-linking via Telegram `startParam`. |

### UI Components

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @telegram-apps/telegram-ui | ^2.1.13 | Telegram-native React UI components | Official component library matching Telegram's look and feel. Provides `AppRoot`, buttons, lists, cells, and other Telegram-styled components. Auto-adapts to iOS/Android platform differences. Handles dark/light theme. Eliminates need to manually match Telegram's UI design. |

### Server-Side Addition

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @tma.js/init-data-node | ^2.0.4 | Validate Telegram initData on backend | Official package for HMAC-SHA256 validation of Telegram Mini App init data. Critical for authentication -- verifies requests actually come from Telegram, not spoofed. Runs as Express middleware in existing server. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| vite-plugin-mkcert | ^3.0.0 | HTTPS for local dev server | Dev only. Telegram requires HTTPS for Mini Apps. Generates local SSL certs via mkcert. **Limitation:** self-signed certs only work in Telegram Desktop -- use tunneling for mobile testing. |
| Cloudflare Tunnel (cloudflared) | latest | Expose local dev server for mobile testing | Free, stable tunnel for testing Mini Apps on real mobile Telegram clients. Better than ngrok (no connection limits on free tier). |

---

## Project Structure

The Mini App frontend lives in a `mini-app/` directory at the project root, alongside the existing `src/` (backend). This is NOT a monorepo -- it is a single repo with a frontend subdirectory that builds to static files served by the existing Express server.

```
heysous/
  src/                     # Existing backend (unchanged)
    server.ts              # Express -- add static file serving + API routes
    bot/                   # grammY bot handlers
    ...
  mini-app/                # NEW: React frontend
    package.json           # Separate deps from backend
    tsconfig.json          # Separate tsconfig (DOM libs, JSX)
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      init.ts              # @tma.js/sdk initialization
      pages/
        GroceryList.tsx
        MealPlan.tsx
        RecipeBrowser.tsx
      components/          # Shared UI components
      hooks/
        useTelegram.ts     # Thin wrapper for common SDK patterns
      api/
        client.ts          # Fetch wrapper with initData auth header
  dist/                    # Backend build output (tsc)
  mini-app/dist/           # Frontend build output (vite) -- served by Express
```

### Why a Subdirectory (Not a Monorepo)

For 3 simple Mini Apps sharing a single Express backend, monorepo tooling (Nx, Turborepo) adds complexity without value:

- Separate `npm install` for frontend deps (keeps backend lean -- no React in production server)
- Separate TypeScript config (frontend needs `"lib": ["DOM", "DOM.Iterable"]`, backend does not)
- Root `npm run build` orchestrates both builds sequentially
- Vite outputs to `mini-app/dist/`, Express serves it with `express.static()`

---

## Integration Points with Existing Express Server

### 1. Static File Serving (Production)

The existing `src/server.ts` adds static file serving for the built Mini App:

```typescript
import path from 'path';

// Serve Mini App static files
app.use('/app', express.static(path.resolve('mini-app/dist')));

// SPA fallback -- client-side routing needs this
app.get('/app/*', (_req, res) => {
  res.sendFile(path.resolve('mini-app/dist/index.html'));
});
```

### 2. API Routes for Mini App Data

New routes alongside existing webhook handler. Reuse existing Drizzle queries:

```typescript
app.get('/api/grocery-list', validateInitData, groceryListHandler);
app.post('/api/grocery-list/toggle', validateInitData, toggleItemHandler);
app.get('/api/meal-plan', validateInitData, mealPlanHandler);
app.get('/api/recipes', validateInitData, recipesHandler);
```

### 3. InitData Validation Middleware

Every API request from the Mini App includes Telegram's init data. Validate it server-side:

```typescript
import { validate } from '@tma.js/init-data-node';

function validateInitData(req, res, next) {
  const initData = req.headers['x-init-data'] as string;
  if (!initData) {
    return res.status(401).json({ error: 'Missing init data' });
  }
  try {
    validate(initData, config.botToken);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid init data' });
  }
}
```

### 4. Bot Integration (Opening Mini Apps from Chat)

grammY's InlineKeyboard has a `.webApp()` method for opening Mini Apps:

```typescript
import { InlineKeyboard } from 'grammy';

const keyboard = new InlineKeyboard()
  .webApp('Open Grocery List', `${config.webhookUrl}/app/grocery`);

await ctx.reply('Here is your grocery list:', { reply_markup: keyboard });
```

The Mini App URL must be on the same domain as the webhook URL (both served by the same Express server).

---

## Telegram Mini App SDK Usage Pattern

### Initialization (app entry point)

```typescript
// mini-app/src/init.ts
import { init, viewport, miniApp } from '@tma.js/sdk';

export function initTelegramApp() {
  init();

  // Expand to full viewport height
  viewport.mount();
  viewport.expand();

  // Enable closing confirmation to prevent accidental dismissal
  miniApp.mount();
}
```

### Using Signals in React Components

```typescript
import { useSignal } from '@tma.js/sdk-react';
import { mainButton, backButton, themeParams } from '@tma.js/sdk';

function GroceryList() {
  const bgColor = useSignal(themeParams.bgColor);

  useEffect(() => {
    mainButton.mount();
    mainButton.setParams({ text: 'Done Shopping', isVisible: true });
    const off = mainButton.onClick(() => { /* handle */ });
    return () => { off(); mainButton.hide(); };
  }, []);

  useEffect(() => {
    backButton.mount();
    backButton.show();
    const off = backButton.onClick(() => navigate(-1));
    return () => { off(); backButton.hide(); };
  }, []);
}
```

### Getting Launch Params (v3 workaround)

The `useLaunchParams` hook was removed in v3. Use `retrieveLaunchParams` directly:

```typescript
import { retrieveLaunchParams } from '@tma.js/sdk';
import { useMemo } from 'react';

function useLaunchParams() {
  return useMemo(() => retrieveLaunchParams(), []);
}
```

### Theming with CSS Variables

The SDK binds Telegram theme params as CSS variables automatically:
- `var(--tg-theme-bg-color)`
- `var(--tg-theme-text-color)`
- `var(--tg-theme-hint-color)`
- `var(--tg-theme-link-color)`
- `var(--tg-theme-button-color)`
- `var(--tg-theme-button-text-color)`
- `var(--tg-theme-secondary-bg-color)`

Use these in CSS to auto-match the user's Telegram theme. The `@telegram-apps/telegram-ui` library uses these internally.

---

## Installation

### Frontend (run from mini-app/ directory)

```bash
# Initialize mini-app directory
mkdir -p mini-app && cd mini-app
npm init -y

# Core runtime dependencies
npm install react react-dom react-router @tma.js/sdk @tma.js/sdk-react @telegram-apps/telegram-ui

# Dev dependencies
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vite-plugin-mkcert
```

### Backend addition (run from project root)

```bash
# Server-side init data validation
npm install @tma.js/init-data-node
```

### Root package.json script additions

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "dev:app": "cd mini-app && npx vite --host",
    "build": "tsc && cd mini-app && npx vite build",
    "build:app": "cd mini-app && npx vite build",
    "typecheck": "tsc --noEmit && cd mini-app && npx tsc --noEmit"
  }
}
```

---

## Key Configuration Files

### mini-app/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],
  base: '/app/',  // Must match Express static mount point
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // Proxy API calls to Express in dev
        changeOrigin: true,
      },
    },
  },
});
```

**Critical:** `base: '/app/'` must match the Express `app.use('/app', express.static(...))` mount point. Mismatch breaks all asset loading in production.

### mini-app/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

### Development Environment Mock

```typescript
// mini-app/src/mockEnv.ts -- for browser development outside Telegram
export function mockTelegramEnv() {
  if (typeof window !== 'undefined' && !window.Telegram) {
    // Mock minimal WebApp object for development
    (window as any).Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: { user: { id: 12345, first_name: 'Dev' } },
        version: '7.0',
        platform: 'web',
        colorScheme: 'light',
        themeParams: {
          bg_color: '#ffffff',
          text_color: '#000000',
          hint_color: '#999999',
          link_color: '#2481cc',
          button_color: '#2481cc',
          button_text_color: '#ffffff',
          secondary_bg_color: '#efeff3',
        },
        isExpanded: true,
        viewportHeight: 600,
        viewportStableHeight: 600,
        ready: () => {},
        expand: () => {},
        close: () => {},
      },
    };
  }
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **Build tool** | Vite 7 | Webpack 5 | Vite is the standard for Telegram Mini Apps (all official templates use it). Faster dev server, simpler config, smaller output. |
| **SDK namespace** | @tma.js/* | @telegram-apps/* | @telegram-apps namespace is deprecated. @tma.js is the actively maintained successor with migration guide. |
| **SDK package** | @tma.js/sdk-react | @twa-dev/sdk | @twa-dev/sdk is a thinner wrapper lacking signal-based reactivity. @tma.js provides component mounting, lifecycle, and React hooks. |
| **UI library** | @telegram-apps/telegram-ui | Tailwind CSS | For Mini Apps that should look native to Telegram, a Telegram-specific component library is better than custom styling. Tailwind would require manually matching platform-specific iOS/Android differences and theme integration. |
| **UI library** | @telegram-apps/telegram-ui | No UI library | Re-implementing Telegram's platform-specific look (iOS vs Android differences, theme adaptation, component patterns) is unnecessary work when an official library exists. |
| **Routing** | react-router v7 | No router | 3 views could use state-based navigation, but react-router handles deep-linking via Telegram `startParam`, clean URL-based navigation, and browser history within the Mini App webview. Minimal overhead. |
| **State management** | React useState + context | Redux / Zustand | Each Mini App view is independent -- grocery list fetches grocery data, meal plan fetches meal data. No complex cross-view state. Adding a state library is over-engineering for this scope. |
| **Frontend framework** | React | Solid / Svelte / Vue | React has the best Telegram Mini Apps SDK support (@tma.js/sdk-react), the most templates and examples, and the project team already uses TypeScript which pairs well. |
| **Project structure** | mini-app/ subdirectory | Monorepo (Nx/Turborepo) | Monorepo tooling is overkill for 1 backend + 1 frontend. A subdirectory with its own package.json achieves clean separation without added complexity. |
| **API calls** | fetch (built-in) | Axios | React 19 + modern browsers (Telegram webview uses Chrome/Safari engine) have excellent fetch support. 3 simple endpoints don't need Axios's interceptors. Fewer dependencies. |
| **Dev tunneling** | Cloudflare Tunnel | ngrok | Cloudflare Tunnel is free with no connection limits. ngrok's free tier has monthly connection limits that can interrupt development. Both provide HTTPS. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Next.js / Remix** | SSR framework overhead is unnecessary. Mini Apps are client-side SPAs loaded in Telegram's webview. No SEO needed, no server rendering needed. Adds massive build complexity for zero benefit. | Vite + React (client-side SPA) |
| **Redux / Zustand / Jotai** | 3 simple views with independent data fetching. No shared complex state. State library adds boilerplate for no benefit at this scope. | React useState + useReducer + Context |
| **Tailwind CSS** | Redundant with @telegram-apps/telegram-ui which handles all Telegram-native styling, theming, and platform differences. Adding Tailwind means fighting with or overriding the UI library's styles. | @telegram-apps/telegram-ui + Telegram CSS variables |
| **Styled Components / Emotion** | Extra runtime overhead in a webview. Telegram UI components handle most styling. Minimal custom CSS needed. | CSS Modules or plain CSS files for the few custom styles needed |
| **@telegram-apps/sdk-react** | **Deprecated namespace.** Actively replaced by @tma.js/sdk-react. Some hooks (like useLaunchParams) were silently removed in v3 without migration docs. Use the current namespace. | @tma.js/sdk-react |
| **Socket.IO / WebSockets** | Real-time updates are not needed. Grocery lists, meal plans, and recipes are read-heavy with occasional writes. Simple REST calls are sufficient. | REST API endpoints on existing Express server |
| **Separate API server** | The existing Express server already runs for webhooks. Adding API routes to same server avoids CORS issues, separate deployment, and infrastructure complexity. | API routes on existing Express server (same process) |
| **vite-express** | Couples Vite and Express tightly at runtime. In production there is no Vite server -- just pre-built static files served by Express. vite-express adds unnecessary abstraction. | `express.static()` serving Vite build output |
| **React Query / SWR** | Over-engineering for 3 views with simple data fetching. These libraries shine with complex caching, pagination, and real-time invalidation patterns. Our views are simple list displays. | useEffect + fetch (or a thin custom hook) |
| **CSS-in-JS (any variant)** | Telegram Mini Apps should use the platform's CSS variables for theming. CSS-in-JS adds runtime overhead and fights the platform's theming model. | CSS variables from Telegram + @telegram-apps/telegram-ui |

---

## Version Compatibility

| Concern | Status | Notes |
|---------|--------|-------|
| Node.js 22 + Vite 7 | COMPATIBLE | Vite 7 requires Node.js 20.19+. Node.js 22 is well supported. |
| React 19 + @tma.js/sdk-react 3.x | COMPATIBLE | sdk-react works with React 18+. React 19 is supported. |
| React 19 + @telegram-apps/telegram-ui 2.x | COMPATIBLE | TelegramUI supports React 18+. Browser support: Chrome 73+, Safari 12+, Edge 79+, Firefox 78+. |
| Express 5 + static file serving | COMPATIBLE | Express 5 supports `express.static()` identically to Express 4. |
| TypeScript 5.9 + Vite 7 | COMPATIBLE | Vite uses esbuild for transformation, not tsc. Separate tsconfig for mini-app/ with DOM libs and JSX. |
| @tma.js/sdk 3.x + @tma.js/sdk-react 3.x | MUST MATCH MAJOR | Both must be v3.x. sdk-react depends on signals from sdk. |
| Vitest 4.x (existing) + Vite 7 | COMPATIBLE | Vitest 4 is built on Vite's core. Can test React components if needed. |

### Known Issues

1. **useLaunchParams removed in v3:** The `useLaunchParams` hook from v2 was removed in sdk-react v3 without migration documentation. Workaround: `useMemo(() => retrieveLaunchParams(), [])`. Tracked in [GitHub issue #667](https://github.com/Telegram-Mini-Apps/telegram-apps/issues/667).

2. **Self-signed certs on mobile:** `vite-plugin-mkcert` generates certs that are NOT trusted by iOS/Android Telegram. You MUST use Cloudflare Tunnel or ngrok for mobile testing.

3. **Vite base path alignment:** `base` in vite.config.ts must exactly match the Express static mount path. If Express serves at `/app`, Vite base must be `/app/`. Mismatch causes broken asset loading (404s on JS/CSS).

4. **Mini App URL domain:** The URL passed to `.webApp()` in grammY must be on the same domain as the bot's webhook URL. Both are served by the same Express server, so this is naturally satisfied.

---

## Sources

### HIGH Confidence (Official docs, npm packages, verified GitHub repos)
- [@tma.js/sdk on npm](https://www.npmjs.com/package/@tma.js/sdk) - v3.1.4 verified, core SDK
- [@tma.js/sdk-react on npm](https://www.npmjs.com/package/@tma.js/sdk-react) - v3.0.15 verified, React bindings
- [@tma.js/init-data-node on npm](https://www.npmjs.com/package/@tma.js/init-data-node) - v2.0.4 verified, server validation
- [@telegram-apps/telegram-ui on GitHub](https://github.com/telegram-mini-apps-dev/TelegramUI) - v2.1.13 verified, UI components
- [Telegram Mini Apps official docs](https://docs.telegram-mini-apps.com/) - Platform docs, theming, init data, SDK usage
- [Telegram Bot API - Mini Apps](https://core.telegram.org/bots/webapps) - Official Mini Apps specification
- [grammY Keyboard plugin](https://grammy.dev/plugins/keyboard) - `.webApp()` method verified for inline keyboards
- [Vite releases](https://vite.dev/releases) - v7.3.1 verified as current stable
- [React on npm](https://www.npmjs.com/package/react) - v19.2.4 verified as current stable
- [react-router on npm](https://www.npmjs.com/package/react-router) - v7.13.0 verified as current stable
- [@vitejs/plugin-react on npm](https://www.npmjs.com/package/@vitejs/plugin-react) - v5.1.3 verified
- [Official React template for Telegram Mini Apps](https://github.com/Telegram-Mini-Apps/reactjs-template) - Reference structure, deps
- [tma.js GitHub monorepo](https://github.com/Telegram-Mini-Apps/telegram-apps) - Source repo for all @tma.js packages
- [Migration from @telegram-apps to @tma.js](https://docs.telegram-mini-apps.com/packages/tma-js-sdk/migrate-from-telegram-apps) - Namespace deprecation confirmed

### MEDIUM Confidence (Multiple sources agree)
- [useLaunchParams removal - issue #667](https://github.com/Telegram-Mini-Apps/telegram-apps/issues/667) - v3 breaking change and workaround
- [Telegram theming docs](https://docs.telegram-mini-apps.com/platform/theming) - CSS variable bindings
- [vite-plugin-mkcert on npm](https://www.npmjs.com/package/vite-plugin-mkcert) - Local HTTPS for development

### LOW Confidence (Verify during implementation)
- Exact `@telegram-apps/telegram-ui` peer dependency compatibility with React 19 -- verify at install time
- Vite proxy configuration with Express 5 -- standard pattern but needs testing
- `emptyDirBeforeWrite` option name in Vite 7 (was `emptyOutDir` in Vite 6) -- verify in Vite 7 docs

---
*Stack research for: Telegram Mini Apps (TWA) with React - HeySous v1.1*
*Researched: 2026-02-09*
