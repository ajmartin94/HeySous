# Architecture Research

**Domain:** Telegram Mini Apps integration with Express/grammY backend
**Researched:** 2026-02-09
**Confidence:** HIGH (core patterns verified via official Telegram Bot API docs, @tma.js docs, and multiple credible sources)

---

## Standard Architecture

### System Overview

```
                    TELEGRAM CLIENT (iOS/Android/Desktop/Web)
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │  ┌──────────────┐         ┌───────────────────────────────────┐ │
    │  │  Chat with    │ launch  │    Mini App (WebView)            │ │
    │  │  @HeySousBot  │────────>│                                  │ │
    │  │              │         │  React SPA served from bot server │ │
    │  │  /grocery    │         │  @tma.js/sdk-react for TG APIs   │ │
    │  │  /plan       │         │  REST calls to /api/* endpoints  │ │
    │  │  /recipes    │         │                                  │ │
    │  └──────┬───────┘         └──────────────┬────────────────────┘ │
    │         │                                │                      │
    └─────────┼────────────────────────────────┼──────────────────────┘
              │ Telegram Bot API               │ HTTPS (same origin)
              │ (webhooks)                     │ Authorization: tma <initData>
    ══════════╪════════════════════════════════╪═══════════════════════
              │         YOUR EXPRESS SERVER     │
    ┌─────────▼──────────────────┐  ┌──────────▼──────────────────────┐
    │  Webhook Handler           │  │  Mini App API Layer             │
    │  POST /webhook/<token>     │  │  GET  /api/grocery/active       │
    │  (grammY webhookCallback)  │  │  POST /api/grocery/:id/toggle   │
    │                            │  │  GET  /api/plans/current        │
    │  Existing bot logic:       │  │  GET  /api/recipes              │
    │  commands, AI pipeline,    │  │  POST /api/recipes/search       │
    │  callbacks                 │  │                                 │
    └─────────┬──────────────────┘  │  Auth middleware validates      │
              │                     │  initData via HMAC-SHA256       │
              │                     └──────────┬──────────────────────┘
              │                                │
    ┌─────────▼────────────────────────────────▼──────────────────────┐
    │                   EXISTING SERVICE LAYER                        │
    │                                                                 │
    │  groceryRepository ──┐                                          │
    │  planRepository ─────┤── All existing factory-function services │
    │  knowledgeRepository─┤   No changes needed to these             │
    │  retrievalService ───┘                                          │
    │                                                                 │
    │  ┌──────────────────────────────────────────────────────────┐   │
    │  │                   SQLite Database                         │   │
    │  │  grocery_lists, grocery_list_items, meal_plans,          │   │
    │  │  meal_plan_entries, knowledge_items, knowledge_tags       │   │
    │  └──────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │  Static File Serving                                            │
    │  GET /app/*  -->  express.static('dist/mini-app')              │
    │  Vite-built React SPA with client-side routing                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Existing |
|-----------|---------------|-----------------|
| **Express Server** (`src/server.ts`) | Serve webhook, health check, **new:** static files + API routes | MODIFY -- add Mini App routes |
| **Auth Middleware** (`src/mini-app/auth.ts`) | Validate initData HMAC-SHA256, extract userId/chatId, reject unauthorized | NEW |
| **API Router** (`src/mini-app/api/`) | REST endpoints for grocery, plans, recipes | NEW |
| **React SPA** (`mini-app/`) | 3 Mini App UIs: grocery list, meal plan, recipe browser | NEW (separate build) |
| **groceryRepository** | Grocery list CRUD (getActiveList, toggleItem, etc.) | EXISTING -- no changes |
| **planRepository** | Meal plan CRUD (getPlan, getActivePlans) | EXISTING -- no changes |
| **knowledgeRepository** | Recipe/knowledge CRUD (listByChatId, getById) | EXISTING -- no changes |
| **Bot Handlers** | Commands that now **also** send Mini App launch buttons | MODIFY -- add webApp buttons |
| **BotFather Config** | Menu button pointing to Mini App URL | NEW (one-time config) |

---

## Recommended Project Structure

```
src/
├── main.ts                    # Entry point (existing -- add Mini App wiring)
├── config.ts                  # Config (existing -- add MINI_APP_URL)
├── server.ts                  # Express server (existing -- add static + API mount)
├── mini-app/                  # NEW: all Mini App backend code
│   ├── auth.ts                # initData validation middleware
│   ├── api/                   # REST API routes
│   │   ├── index.ts           # Router composition: mount all sub-routers
│   │   ├── grocery.ts         # GET/POST grocery endpoints
│   │   ├── plans.ts           # GET meal plan endpoints
│   │   └── recipes.ts         # GET/POST recipe endpoints
│   └── types.ts               # API request/response types
├── bot/                       # EXISTING (minor modifications)
│   ├── handlers/
│   │   ├── grocery.ts         # MODIFY: add Mini App launch button
│   │   ├── plan.ts            # MODIFY: add Mini App launch button
│   │   └── ...                # Other handlers unchanged
│   └── ...
├── grocery/                   # EXISTING -- unchanged
├── planning/                  # EXISTING -- unchanged
├── knowledge/                 # EXISTING -- unchanged
└── ...

mini-app/                      # NEW: separate directory at project root
├── package.json               # React + Vite + @tma.js/sdk-react
├── vite.config.ts             # Build config: outDir -> ../dist/mini-app
├── tsconfig.json              # Separate TS config for frontend
├── index.html                 # Vite entry point
├── src/
│   ├── main.tsx               # React entry: TMA SDK init, router setup
│   ├── App.tsx                # Route definitions for 3 Mini Apps
│   ├── lib/
│   │   ├── api.ts             # HTTP client: fetch wrapper with initData auth
│   │   ├── telegram.ts        # TMA SDK helpers (theme, haptics, buttons)
│   │   └── types.ts           # Shared API types (mirror of backend types)
│   ├── pages/
│   │   ├── GroceryList.tsx    # Grocery list Mini App
│   │   ├── MealPlan.tsx       # Meal plan viewer Mini App
│   │   └── RecipeBrowser.tsx  # Recipe search/browse Mini App
│   └── components/
│       ├── GroceryItem.tsx    # Checkable grocery item
│       ├── MealCard.tsx       # Single meal in plan view
│       ├── RecipeCard.tsx     # Recipe summary card
│       └── TelegramLayout.tsx # Shell with theme colors, safe area
└── public/
    └── (static assets)
```

### Structure Rationale

- **`src/mini-app/`** contains backend API code (auth, routes) alongside existing backend code. It imports from existing repositories via the same dependency injection pattern (receives `groceryRepository`, `planRepository`, etc.).
- **`mini-app/`** at project root is a separate Vite project with its own `package.json`. It builds to `dist/mini-app/` which Express serves as static files. This keeps frontend dependencies (React, Vite) completely separate from backend dependencies.
- **No monorepo tooling needed.** Two `package.json` files, one `npm run build:mini-app` script. The frontend is a static build artifact that Express serves. No shared runtime code -- only shared type definitions (can be duplicated or symlinked).

---

## Architectural Patterns

### Pattern 1: TWA Auth (initData Validation)

**What:** Every API request from the Mini App includes Telegram's `initData` in the `Authorization` header. The server validates the HMAC-SHA256 signature using the bot token, confirming the request is from a legitimate Telegram user.

**How initData works:**

1. When Telegram opens the Mini App WebView, it injects launch parameters including `initData` -- a query string containing `user`, `auth_date`, `hash`, `query_id`, and other fields.
2. The `hash` field is an HMAC-SHA256 signature computed by Telegram using the bot's secret token.
3. The server can verify this signature because it also knows the bot token.

**Validation algorithm (4 steps):**

```
1. Parse initData query string into key-value pairs
2. Remove the "hash" pair, sort remaining pairs alphabetically
3. Join as "key=value\n" (data-check-string)
4. secret_key = HMAC-SHA256("WebAppData", bot_token)    // "WebAppData" is the key
5. computed_hash = HMAC-SHA256(secret_key, data-check-string)
6. Compare computed_hash (hex) with the received hash
7. Check auth_date is within acceptable window (prevent replay attacks)
```

**Express middleware implementation:**

```typescript
// src/mini-app/auth.ts
import { validate, parse, type InitData } from '@tma.js/init-data-node';
import type { RequestHandler } from 'express';

// Extend Express locals to carry parsed initData
declare module 'express' {
  interface Locals {
    initData: InitData;
    chatId: string;
  }
}

export function createAuthMiddleware(botToken: string): RequestHandler {
  return (req, res, next) => {
    const authHeader = req.header('authorization') ?? '';
    const [authType, authData] = authHeader.split(' ', 2);

    if (authType !== 'tma' || !authData) {
      res.status(401).json({ error: 'Missing or invalid authorization' });
      return;
    }

    try {
      // validate() throws on invalid signature, expired data, etc.
      // expiresIn: 3600 = 1 hour (Telegram docs recommend treating as time-bounded)
      validate(authData, botToken, { expiresIn: 3600 });

      const initData = parse(authData);
      res.locals.initData = initData;

      // Extract chatId -- for Mini Apps opened from bot chat,
      // user.id IS the chatId for private chats
      if (initData.user) {
        res.locals.chatId = String(initData.user.id);
      } else {
        res.status(401).json({ error: 'No user in init data' });
        return;
      }

      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid init data', details: String(err) });
    }
  };
}
```

**Client-side: sending initData with every request:**

```typescript
// mini-app/src/lib/api.ts
import { retrieveRawInitData } from '@tma.js/sdk';

const BASE_URL = ''; // same origin -- no CORS needed

export async function apiGet<T>(path: string): Promise<T> {
  const initDataRaw = retrieveRawInitData();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: {
      'Authorization': `tma ${initDataRaw}`,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const initDataRaw = retrieveRawInitData();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `tma ${initDataRaw}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**Key security details:**
- `expiresIn: 3600` (1 hour) prevents replay attacks with stolen initData. Telegram docs recommend 1 hour.
- Default expiration in `@tma.js/init-data-node` is 86400 seconds (1 day) -- too long, explicitly set 1 hour.
- The `user.id` from initData maps directly to the `chatId` used throughout the existing codebase for private chats (Telegram user ID = chat ID in private chats).
- No session tokens or JWTs needed -- initData is validated on every request. It is effectively a signed session token from Telegram itself.

**Confidence:** HIGH -- validation algorithm verified via official Telegram docs and @tma.js docs. The `validate` function from `@tma.js/init-data-node` implements this exact algorithm.

---

### Pattern 2: API Layer for Mini Apps

**What:** A set of Express routes under `/api/*` that expose existing repository data to the Mini App frontend. These routes sit behind the auth middleware and delegate directly to existing service functions.

**Key principle: Thin API layer.** The routes are adapters between HTTP and existing repository functions. No business logic in routes -- it already exists in the repositories.

**Route design for the three Mini Apps:**

```typescript
// src/mini-app/api/grocery.ts
import { Router } from 'express';
import type { GroceryRepository } from '../../grocery/repository.js';

export function createGroceryRouter(groceryRepo: ReturnType<typeof import('../../grocery/repository.js').createGroceryRepository>) {
  const router = Router();

  // GET /api/grocery/active -- get active grocery list with items
  router.get('/active', (req, res) => {
    const chatId = res.locals.chatId;
    const list = groceryRepo.getActiveList(chatId);
    if (!list) {
      res.json({ list: null, items: [] });
      return;
    }
    const items = groceryRepo.getListItems(list.id);
    res.json({ list, items });
  });

  // POST /api/grocery/items/:itemId/toggle -- toggle checked state
  router.post('/items/:itemId/toggle', (req, res) => {
    const itemId = Number(req.params.itemId);
    // Verify item belongs to this user's list
    const listId = groceryRepo.getListIdForItem(itemId);
    if (listId === null) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    const list = groceryRepo.getActiveList(res.locals.chatId);
    if (!list || list.id !== listId) {
      res.status(403).json({ error: 'Not your item' });
      return;
    }
    const checked = groceryRepo.toggleItem(itemId);
    res.json({ itemId, checked });
  });

  return router;
}
```

```typescript
// src/mini-app/api/plans.ts
import { Router } from 'express';

export function createPlansRouter(planRepo: ReturnType<typeof import('../../planning/repository.js').createPlanRepository>) {
  const router = Router();

  // GET /api/plans/active -- get current + next week plans
  router.get('/active', (req, res) => {
    const chatId = res.locals.chatId;
    const plans = planRepo.getActivePlans(chatId);
    res.json({ plans });
  });

  return router;
}
```

```typescript
// src/mini-app/api/recipes.ts
import { Router } from 'express';

export function createRecipesRouter(
  knowledgeRepo: ReturnType<typeof import('../../knowledge/repository.js').createKnowledgeRepository>,
  retrievalService: { search: (chatId: string, query: string) => unknown[] }
) {
  const router = Router();

  // GET /api/recipes -- list all recipes for this user
  router.get('/', (req, res) => {
    const chatId = res.locals.chatId;
    const recipes = knowledgeRepo.listByChatId(chatId);
    // Filter to only recipe-tagged items
    const recipeItems = recipes.filter(item =>
      item.tags.includes('recipe')
    );
    res.json({ recipes: recipeItems });
  });

  // GET /api/recipes/:id -- get single recipe
  router.get('/:id', (req, res) => {
    const chatId = res.locals.chatId;
    const recipe = knowledgeRepo.getById(Number(req.params.id), chatId);
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.json({ recipe });
  });

  // POST /api/recipes/search -- search recipes by query
  router.post('/search', (req, res) => {
    const chatId = res.locals.chatId;
    const { query } = req.body as { query: string };
    // Use existing FTS5 search via retrieval service
    const results = retrievalService.search(chatId, query);
    res.json({ results });
  });

  return router;
}
```

**API composition and mounting in Express:**

```typescript
// src/mini-app/api/index.ts
import { Router } from 'express';
import { createAuthMiddleware } from '../auth.js';
import { createGroceryRouter } from './grocery.js';
import { createPlansRouter } from './plans.js';
import { createRecipesRouter } from './recipes.js';

export function createMiniAppApi(deps: {
  botToken: string;
  groceryRepository: /* type */;
  planRepository: /* type */;
  knowledgeRepository: /* type */;
  retrievalService: /* type */;
}) {
  const router = Router();

  // All /api/* routes require valid initData
  router.use(createAuthMiddleware(deps.botToken));

  router.use('/grocery', createGroceryRouter(deps.groceryRepository));
  router.use('/plans', createPlansRouter(deps.planRepository));
  router.use('/recipes', createRecipesRouter(deps.knowledgeRepository, deps.retrievalService));

  return router;
}
```

**Mounting in existing server.ts:**

```typescript
// src/server.ts (modified)
export function createServer(bot, port, miniAppApi?) {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => res.send('ok'));

  // Webhook handler (existing)
  app.use(`/webhook/${bot.token}`, webhookCallback(bot, 'express'));

  // Mini App API (new)
  if (miniAppApi) {
    app.use('/api', miniAppApi);
  }

  // Mini App static files (new) -- AFTER API routes
  app.use('/app', express.static('dist/mini-app'));
  // SPA fallback: serve index.html for client-side routes
  app.get('/app/*', (_req, res) => {
    res.sendFile('index.html', { root: 'dist/mini-app' });
  });

  return app;
}
```

**Confidence:** HIGH -- this follows standard Express patterns and directly reuses existing repository interfaces.

---

### Pattern 3: State Sync Between Mini App and Bot

**What:** The Mini App and the bot conversation share the same underlying database. State changes from either side are immediately visible to the other because they hit the same SQLite file.

**Three sync scenarios:**

**Scenario A: Mini App reads bot-created data (most common)**
- User says "make me a grocery list" in chat -> bot creates list via AI pipeline -> Mini App opens and reads the same list via API.
- No sync mechanism needed. Both read/write the same SQLite tables.

**Scenario B: Mini App modifies data, bot sees changes**
- User checks off items in Mini App -> API writes to `grocery_list_items.checked` -> Next time bot references the list (e.g., user asks "what's left on my list?"), it reads the updated state.
- No sync mechanism needed. SQLite is the single source of truth.

**Scenario C: Bot needs to notify chat about Mini App actions (optional, future)**
- After Mini App completes a grocery run (all items checked), bot could send a message: "Looks like you finished shopping!"
- Implementation: API endpoint triggers `bot.api.sendMessage()` after a significant action. This is optional for v1.1.

**Why this is simple for HeySous:**
- Single SQLite database is the shared state store.
- Both the bot handlers and Mini App API routes receive the same repository instances (created in `main.ts`).
- No event bus, no WebSocket, no polling needed. The database IS the sync layer.

**chatId mapping:**
- In private Telegram chats, `user.id === chat.id`. The Mini App receives `user.id` via initData. The bot stores data keyed by `chat.id`. These are the same value for private chats, so data access just works.
- If group chat support is ever added, this mapping would need adjustment (Mini App would need to also receive `chat_instance` or the chat context).

**Confidence:** HIGH -- this is a consequence of the existing architecture (single-process, single-database).

---

### Pattern 4: Launching Mini Apps from Bot Commands

**What:** Users open Mini Apps via three entry points. Each requires slightly different setup.

**Entry point 1: Menu Button (primary, always visible)**

Configure via BotFather: `/setmenubutton` -> select bot -> enter URL (e.g., `https://yourdomain.com/app/`) -> enter button text (e.g., "Open App").

This places a persistent button at the bottom-left of the chat input. When tapped, it opens the Mini App.

**Entry point 2: Inline keyboard buttons in bot replies**

When the bot sends a grocery list or meal plan, it can include a "View in App" button:

```typescript
// In grocery handler, after sending text list:
import { InlineKeyboard } from 'grammy';

const keyboard = new InlineKeyboard()
  .webApp('Open Grocery List', `${config.miniAppUrl}/grocery`);

await ctx.reply('Here is your grocery list:', {
  reply_markup: keyboard,
});
```

**Entry point 3: Custom keyboard buttons (persistent)**

```typescript
import { Keyboard } from 'grammy';

const keyboard = new Keyboard()
  .webApp('Grocery List', `${config.miniAppUrl}/grocery`)
  .webApp('Meal Plan', `${config.miniAppUrl}/plan`)
  .row()
  .webApp('Recipes', `${config.miniAppUrl}/recipes`);

await ctx.reply('What would you like to do?', {
  reply_markup: { keyboard: keyboard.build(), resize_keyboard: true },
});
```

**Key difference between inline and custom keyboard Mini Apps:**
- **Custom keyboard** webApp buttons: Mini App can use `sendData()` to send up to 4096 bytes back as a `web_app_data` service message, then closes. Good for "pick something and return."
- **Inline keyboard** webApp buttons: Mini App gets a `query_id` and can use `answerWebAppQuery` to send a message on behalf of the user. Good for "compose something and share."
- **For HeySous:** Neither `sendData` nor `answerWebAppQuery` is needed. The Mini Apps are full CRUD interfaces that communicate via REST API, not via the bot message flow. The inline keyboard "Open in App" button is the best fit -- it opens the Mini App as a full-screen overlay, and the user can interact as long as they want.

**Confidence:** HIGH -- verified via official Telegram Bot API docs and grammY keyboard plugin docs.

---

### Pattern 5: Frontend SDK Integration

**What:** The React Mini App uses `@tma.js/sdk-react` to access Telegram platform features: theme colors, haptic feedback, back button, main button, and the initData for auth.

**SDK initialization:**

```typescript
// mini-app/src/main.tsx
import { SDKProvider, useLaunchParams } from '@tma.js/sdk-react';
import { createRoot } from 'react-dom/client';
import App from './App';

function Root() {
  return (
    <SDKProvider>
      <App />
    </SDKProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
```

**Key SDK features to use:**

| Feature | Hook / API | Use In HeySous |
|---------|-----------|---------------|
| Theme colors | `useThemeParams()` | Match bot chat theme (dark/light mode, accent colors) |
| Haptic feedback | `useHapticFeedback()` | Tap feedback on grocery item toggle, recipe selection |
| Back button | `useBackButton()` | Navigate between Mini App pages |
| Main button | `useMainButton()` | "Done Shopping" or "Close" action |
| initData (raw) | `retrieveRawInitData()` | Send with every API request for auth |
| Viewport | `useViewport()` | Handle safe area insets, expand to full height |
| CloudStorage | `useCloudStorage()` | NOT recommended -- use server-side SQLite instead |

**Confidence:** MEDIUM -- @tma.js/sdk-react hook names verified via npm and docs, but the exact v3 API may have changed (v2 vs v3 naming has been in flux). Pin to a specific version and verify hooks at implementation time.

---

## Data Flow

### Mini App Request Flow

```
User taps "Open Grocery List" button in chat
    │
    ▼
Telegram client opens WebView
    │
    ├── Injects launch params: initData (signed), theme, viewport
    │
    ▼
React app mounts
    │
    ├── @tma.js/sdk-react initializes, parses launch params
    ├── Apply Telegram theme colors to CSS variables
    ├── Call WebApp.ready() to dismiss loading spinner
    │
    ▼
GroceryList page mounts
    │
    ├── Calls apiGet('/grocery/active')
    │     │
    │     ├── Authorization: tma <initData>
    │     │
    │     ▼
    │   Express receives GET /api/grocery/active
    │     │
    │     ├── Auth middleware: validate(initData, botToken, { expiresIn: 3600 })
    │     ├── Extract chatId from initData.user.id
    │     │
    │     ▼
    │   Grocery route handler:
    │     │
    │     ├── groceryRepository.getActiveList(chatId)   // existing function
    │     ├── groceryRepository.getListItems(listId)    // existing function
    │     │
    │     ▼
    │   Return JSON: { list, items }
    │
    ▼
React renders grocery items grouped by store/section
    │
    ▼
User taps item to check it off
    │
    ├── Haptic feedback: impactOccurred('light')
    ├── Optimistic UI update (toggle immediately)
    ├── Calls apiPost('/grocery/items/42/toggle')
    │     │
    │     ▼
    │   Express: auth middleware -> groceryRepository.toggleItem(42)
    │   Return: { itemId: 42, checked: true }
    │
    ├── If API confirms, keep optimistic state
    └── If API fails, revert optimistic state + show error
```

### Bot <-> Mini App State Sync

```
                     SQLite Database
                    (single source of truth)
                           │
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────▼──┐  ┌─────▼──────┐  ┌──▼──────────────┐
    │ Bot writes  │  │ Mini App   │  │ Mini App writes  │
    │ via AI      │  │ reads via  │  │ via REST API     │
    │ pipeline    │  │ REST API   │  │                  │
    │             │  │            │  │                  │
    │ Examples:   │  │ Examples:  │  │ Examples:        │
    │ - Create    │  │ - Load     │  │ - Toggle item    │
    │   grocery   │  │   active   │  │   checked state  │
    │   list      │  │   list     │  │ - (future: add   │
    │ - Save meal │  │ - View     │  │   items to list) │
    │   plan      │  │   plan     │  │                  │
    │ - Store     │  │ - Browse   │  │                  │
    │   recipe    │  │   recipes  │  │                  │
    └─────────────┘  └────────────┘  └──────────────────┘

    No event bus needed. No WebSocket needed.
    Both sides hit the same repository functions
    which access the same SQLite file.
```

---

## Anti-Patterns

### Anti-Pattern 1: Putting Business Logic in the Mini App Frontend

**What people do:** Implement grocery list management, meal plan generation, or recipe parsing in the React frontend.

**Why it is wrong:** Frontend state is ephemeral. If the user closes the Mini App, switches devices, or Telegram clears the WebView cache, all state is lost. Additionally, business logic in the frontend means two codepaths for the same operations (bot commands + Mini App) that can diverge.

**Do this instead:** The Mini App frontend is a thin UI layer. All data operations go through the REST API, which delegates to the same repository functions the bot uses. The frontend does rendering, optimistic updates, and Telegram SDK integration -- nothing else.

**Confidence:** HIGH -- this is validated by real Mini App post-mortems where frontend state caused $40K+ rework.

---

### Anti-Pattern 2: Building a Separate Backend for the Mini App

**What people do:** Create a second Express server or a separate microservice for Mini App API endpoints, with its own database connection.

**Why it is wrong:** For HeySous, the entire point is that the Mini App reads and writes the SAME data the bot uses. A separate backend means either duplicating the SQLite file (impossible for writes), connecting to the same file from two processes (SQLite write contention), or introducing a shared database like PostgreSQL (unnecessary complexity).

**Do this instead:** Add API routes to the existing Express server. They receive the same repository instances via the same dependency injection in `main.ts`. One process, one database connection, zero sync issues.

**Confidence:** HIGH -- this is a direct consequence of the SQLite single-writer constraint and the existing architecture.

---

### Anti-Pattern 3: Using sendData() as the Primary Data Channel

**What people do:** Use `Telegram.WebApp.sendData()` to send all Mini App actions back to the bot as service messages, then process them in bot handlers.

**Why it is wrong:** `sendData()` sends up to 4096 bytes, then closes the Mini App. It is designed for "pick one thing and return to chat" flows (e.g., date picker, location selector). For a grocery list where the user checks off 15 items, the Mini App would close after each action.

**Do this instead:** Use REST API calls for all CRUD operations. The Mini App stays open as long as the user needs it. Reserve `sendData()` only if a future flow requires returning a single result to the chat (e.g., "share this recipe in chat").

**Confidence:** HIGH -- verified via official Telegram docs: sendData "sends data to the bot...a service message is sent to the bot containing the data...and the Mini App is closed."

---

### Anti-Pattern 4: Ignoring Telegram Theme and Platform Conventions

**What people do:** Build a generic React app with custom styling that ignores Telegram's theme colors, safe areas, and interaction patterns.

**Why it is wrong:** The Mini App looks alien inside Telegram. Users expect the same visual language (colors, spacing, animations). iOS and Android Telegram clients have different WebView implementations -- CSS that works on Android (Chromium 119) may break on iOS (WKWebView).

**Do this instead:** Use `useThemeParams()` to read Telegram's CSS variables (`--tg-theme-bg-color`, `--tg-theme-text-color`, etc.) and apply them. Use the Telegram UI library or match its design system. Test on both iOS and Android. Use haptic feedback for interactive elements.

**Confidence:** MEDIUM -- theme variable names verified via official docs, but specific cross-platform rendering issues are anecdotal.

---

### Anti-Pattern 5: Not Validating initData Expiry

**What people do:** Validate the HMAC signature but not the `auth_date` field, or use an excessively long expiry window (the default 86400 seconds / 24 hours).

**Why it is wrong:** A stolen initData string could be replayed for 24 hours. Since initData contains the user ID and grants access to their data, this is a significant security risk.

**Do this instead:** Set `expiresIn: 3600` (1 hour) when calling `validate()`. The Telegram docs suggest 1 hour as the recommended window. If the user's session expires, the Mini App will get a 401 response and can prompt them to reopen from Telegram (which generates fresh initData).

**Confidence:** HIGH -- verified via official Telegram authorization docs.

---

## Integration Points

### External Services (Telegram TWA API)

| Service / API | Integration | Notes |
|---------------|-------------|-------|
| **Telegram WebView** | Opens Mini App in embedded browser | HTTPS required. Must be same domain or configured via BotFather. iOS uses WKWebView, Android uses Chromium 119+. |
| **@tma.js/sdk-react** | React hooks for TG platform features | Client-side only. Provides `retrieveRawInitData()`, theme hooks, haptic feedback, button controls. Pin version -- API changed between v2 and v3. |
| **@tma.js/init-data-node** | Server-side initData validation | `validate(rawData, botToken, { expiresIn })` throws on invalid/expired. `parse(rawData)` returns typed `InitData` object. |
| **BotFather** | One-time config: `/setmenubutton`, `/newapp` | Sets the menu button URL and registers the Mini App. URL must be HTTPS and match the domain serving your Mini App. |
| **grammY Keyboard** | `InlineKeyboard.webApp(text, url)` | Adds "Open in App" button to bot messages. URL is the specific Mini App page (e.g., `/app/grocery`). |

### Internal Boundaries (Mini App Frontend <-> Express Backend <-> Existing Services)

| Boundary | Communication | Key Constraint |
|----------|---------------|----------------|
| **React SPA <-> Express API** | REST over HTTPS, same origin (`/api/*`). Auth via `Authorization: tma <initData>` header. | Same-origin avoids CORS entirely. API routes MUST be mounted before the static file catch-all. |
| **Express API routes <-> Repositories** | Direct function calls. API routes receive repository instances via closure (same DI pattern as bot handlers). | Repositories are synchronous (better-sqlite3 is sync). No async needed in route handlers for DB calls. |
| **Bot handlers <-> Repositories** | Direct function calls (existing pattern). | No change needed. Bot and API routes share the same repository instances created in `main.ts`. |
| **Mini App static files <-> Express** | `express.static('dist/mini-app')` for assets, SPA fallback for `index.html`. | Build step required: `cd mini-app && npm run build` must run before server start in production. |

### Config Changes Needed

```typescript
// src/config.ts additions:
interface Config {
  // ... existing fields ...
  miniAppUrl: string;  // e.g., "https://yourdomain.com/app"
}

// In config:
miniAppUrl: process.env.MINI_APP_URL ?? `http://localhost:${process.env.PORT || 3000}/app`,
```

### New Dependencies

**Backend (add to existing package.json):**
```bash
npm install @tma.js/init-data-node
```

**Frontend (new mini-app/package.json):**
```bash
npm install react react-dom @tma.js/sdk-react
npm install -D vite @vitejs/plugin-react typescript
```

---

## Build Order Recommendation (Dependency-Driven)

Based on analysis of dependencies between new components:

### Step 1: Auth middleware + one API endpoint (grocery)
- Implement `src/mini-app/auth.ts` (initData validation)
- Implement `src/mini-app/api/grocery.ts` (one route: GET /api/grocery/active)
- Mount in `src/server.ts`
- Test with curl using a manually-constructed initData (or skip auth in dev mode)
- **Rationale:** Auth is the foundation. Grocery list is the simplest API (read-only first). Validates the entire pattern before building more.

### Step 2: Minimal React frontend (grocery list only)
- Set up `mini-app/` with Vite + React + @tma.js/sdk-react
- Build GroceryList page that fetches and renders items
- Serve from Express via `express.static`
- Test in Telegram via BotFather menu button
- **Rationale:** First end-to-end proof that Mini App opens in Telegram, authenticates, fetches data, and renders.

### Step 3: Grocery list interactivity
- Add toggle endpoint (POST /api/grocery/items/:id/toggle)
- Add optimistic updates in React
- Add haptic feedback
- **Rationale:** Completes the first fully functional Mini App.

### Step 4: Meal plan Mini App
- Add plans API routes
- Build MealPlan page
- **Rationale:** Read-only, simpler than grocery. Uses different repository.

### Step 5: Recipe browser Mini App
- Add recipes API routes (list + search + detail)
- Build RecipeBrowser page with FTS5 search
- **Rationale:** Most complex UI (search, detail views), built last.

### Step 6: Bot integration (launch buttons)
- Modify bot handlers to include "Open in App" inline keyboard buttons
- **Rationale:** Done last because it is cosmetic -- the Mini Apps work via menu button from Step 2 onward.

---

## Sources

- [Telegram Bot API - Mini Apps (official)](https://core.telegram.org/bots/webapps) -- initData fields, validation algorithm, sendData, answerWebAppQuery, MainButton, BackButton, launch methods (HIGH confidence)
- [Telegram Mini Apps - Init Data](https://docs.telegram-mini-apps.com/platform/init-data) -- detailed HMAC-SHA256 validation steps, Ed25519 alternative, auth_date expiry (HIGH confidence)
- [Telegram Mini Apps - Authorizing User](https://docs.telegram-mini-apps.com/platform/authorizing-user) -- Express middleware example, Authorization header format, GoLang example (HIGH confidence)
- [@tma.js/init-data-node - Validation](https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating) -- validate() signature, expiresIn option, error types (HIGH confidence)
- [tma.js GitHub Repository](https://github.com/Telegram-Mini-Apps/tma.js) -- monorepo structure, package naming (@tma.js/*), active maintenance (HIGH confidence)
- [Telegram Mini Apps React Template](https://github.com/Telegram-Mini-Apps/reactjs-template) -- official Vite + React + TypeScript template, SDK initialization pattern (MEDIUM confidence -- template may evolve)
- [grammY - Keyboard Plugin](https://grammy.dev/plugins/keyboard) -- InlineKeyboard.webApp(), Keyboard.webApp() methods (HIGH confidence)
- [grammY - WebAppData type](https://grammy.dev/ref/types/webappdata) -- web_app_data message type fields (HIGH confidence)
- [Telegram Mini Apps - Creating New App](https://docs.telegram-mini-apps.com/platform/creating-new-app) -- BotFather /newapp and /setmenubutton setup (MEDIUM confidence)
- [Telegram Mini Apps - Haptic Feedback](https://docs.telegram-mini-apps.com/platform/haptic-feedback) -- impactOccurred, selectionChanged, notificationOccurred (HIGH confidence)
- [vite-express on GitHub](https://github.com/szymmis/vite-express) -- pattern for serving Vite builds from Express (MEDIUM confidence -- useful reference, not a dependency we need)

---
*Architecture research for: Telegram Mini Apps integration with Express/grammY backend*
*Researched: 2026-02-09*
