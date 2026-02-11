# Phase 19: User Help Functionality - Research

**Researched:** 2026-02-11
**Domain:** Telegram bot /help command, Mini App help page (React), system prompt augmentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three access points: `/help` command, Mini App help page, Hub "Help" card
- `/help` sends a friendly message with a deep link to the Mini App help page -- no inline help content in chat
- Hub card links directly to the Mini App help page
- Claude proactively mentions help when it detects user confusion or misuse -- no hard frequency limits, natural tone ("if you need help, just ask!")
- When user explicitly asks for help, Claude sends the Mini App deep link
- Help covers: feature overview + all commands + usage tips (comprehensive)
- Mini App features (grocery list, recipe browser, meal plan viewer) integrated alongside chat features -- unified view
- Admin users see admin-only commands (/invite) in addition to regular content
- Regular users do not see admin commands
- No "what's new" or changelog section -- static reference only
- `/help` is a lightweight pointer: friendly message + Mini App deep link (no full content in chat)
- Mini App help page: sections with headers, grouped by category (Recipes, Meal Planning, Grocery, Reminders, etc.)
- Tips and examples inline with each feature section (not a separate section)
- Help content hardcoded in the Mini App React component (not served from API)
- Warm and friendly tone matching bot personality
- Static content -- same page for all users regardless of onboarding state
- System prompt includes a HELP block so Claude knows /help exists and can reference the Mini App help page
- On confusion detection: Claude mentions help availability naturally ("if you need help, just ask!")
- On explicit help request: Claude sends the Mini App deep link directly

### Claude's Discretion
- Exact wording of the /help response message
- How to group features into sections on the help page
- When confusion warrants a help mention vs when to stay quiet
- System prompt HELP block wording

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase adds user help functionality across three access points: a `/help` bot command, a Mini App help page, and a Hub card. The implementation touches four distinct areas: (1) a new grammY command handler following the established factory pattern, (2) a new React page in the Mini App with hardcoded help content, (3) a Hub card addition, and (4) system prompt augmentation so Claude knows about help and can reference it.

The technical surface area is modest. The `/help` command follows the exact same pattern as `/reminders`, `/plan`, `/grocery` -- a factory function returning a `Composer<BotContext>` that sends a message with a `webApp` inline keyboard button. The Mini App help page follows the same pattern as `Feedback.tsx` -- a static page with no API calls, just rendering hardcoded content. The Hub card follows the same pattern as existing cards in `Hub.tsx`. The only nuance is admin detection for conditionally showing admin commands on the help page.

**Primary recommendation:** Follow established patterns exactly. The `/help` handler mirrors `createRemindersHandler`. The help page mirrors `Feedback.tsx` (static, no API). For admin detection, add a `/api/me` endpoint that returns `{ role: "admin" | "member" }` since the auth middleware already has the full user record.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammY | (existing) | `/help` command handler with InlineKeyboard | Already used for all command handlers |
| React | ^19.2.4 | Mini App help page component | Already used for all Mini App pages |
| react-router-dom | ^7.13.0 | Route for `/help` page | Already used for all Mini App routing |
| @telegram-apps/telegram-ui | ^2.1.13 | Section/Cell components for help page | Already used in Hub and other pages |
| lucide-react | ^0.563.0 | Icons for help page sections | Already used throughout Mini App |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tma.js/sdk-react | ^3.0.15 | BackButton for help page navigation | Already used in all sub-pages |

### Alternatives Considered
None -- all decisions are locked to existing stack. No new dependencies needed.

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  bot/
    handlers/
      help.ts           # NEW: /help command handler (factory pattern)
  ai/
    system-prompt.ts     # MODIFY: add HELP_PROMPT block
mini-app/
  src/
    pages/
      Help.tsx           # NEW: help page component
    pages/
      Hub.tsx            # MODIFY: add Help card
    router.tsx           # MODIFY: add /help route
  src/
    hooks/
      useUserRole.ts     # NEW: hook to fetch user role for admin detection
src/
  mini-app/
    router.ts            # MODIFY: add /me endpoint
    routes/
      me.ts              # NEW: endpoint returning user role
```

### Pattern 1: Command Handler Factory (established)
**What:** Factory function that takes dependencies and returns a `Composer<BotContext>`
**When to use:** Every bot command
**Example:**
```typescript
// Source: src/bot/handlers/reminders.ts (existing pattern)
import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { config } from "../../config.js";

export function createHelpHandler(): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("help", async (ctx) => {
    const text = `Here's everything I can help you with!`;

    const replyOptions: { parse_mode: "HTML"; reply_markup?: InlineKeyboard } = {
      parse_mode: "HTML",
    };
    if (config.miniAppUrl) {
      replyOptions.reply_markup = new InlineKeyboard().webApp(
        "Open Help",
        config.miniAppUrl + "/help",
      );
    }

    await ctx.reply(text, replyOptions);
  });

  return handler;
}
```

### Pattern 2: Mini App Static Page (established)
**What:** A React page component with hardcoded content, no API calls
**When to use:** Pages that display static information
**Example:**
```typescript
// Source: mini-app/src/pages/Feedback.tsx (pattern reference)
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

export function Help() {
  const navigate = useNavigate();

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => { off(); };
  }, [navigate]);

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      {/* Hardcoded help content */}
    </div>
  );
}
```

### Pattern 3: Hub Card (established)
**What:** A Cell component in the Hub page that navigates to a sub-page
**When to use:** Adding new sections to the Hub dashboard
**Example:**
```typescript
// Source: mini-app/src/pages/Hub.tsx (existing pattern)
import { HelpCircle } from 'lucide-react';

// Inside the Hub component's Section:
<Cell
  before={<HelpCircle size={24} style={iconStyle} />}
  subtitle="Learn what I can do"
  onClick={() => navigate('/help')}
  style={cellStyle}
>
  Help
</Cell>
```

### Pattern 4: webApp Inline Keyboard Button (established)
**What:** Sends a message with a button that opens the Mini App at a specific URL
**When to use:** Linking from bot messages to Mini App pages
**Example:**
```typescript
// Source: src/bot/handlers/grocery.ts, src/bot/handlers/plan.ts (existing pattern)
import { InlineKeyboard } from "grammy";
import { config } from "../../config.js";

if (config.miniAppUrl) {
  keyboard.row().webApp("View List", config.miniAppUrl + "/grocery");
}
```

### Pattern 5: System Prompt Block (established)
**What:** XML-tagged block appended to the system prompt string
**When to use:** Teaching Claude about new capabilities
**Example:**
```typescript
// Source: src/ai/system-prompt.ts (existing pattern)
const HELP_PROMPT = `
<help>
You have a /help command. When users seem confused or explicitly ask for help, point them to it.
On confusion: casually mention "if you need help, just ask!" or similar.
On explicit help request: send the help page link directly.
</help>`;
```

### Pattern 6: API Endpoint for User Role (new but follows established pattern)
**What:** Express route handler that returns user metadata
**When to use:** When the Mini App needs to know the user's role
**Example:**
```typescript
// Follows pattern from src/mini-app/routes/summary.ts
import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { getUserByTelegramId } from "../../users/repository.js";

export function createMeRoute(sqlite: BetterSqlite3.Database) {
  return (req: Request, res: Response) => {
    const chatId = res.locals.chatId as string;
    const user = getUserByTelegramId(sqlite, chatId);
    res.json({ role: user?.role ?? "member" });
  };
}
```

### Anti-Patterns to Avoid
- **Sending full help content in the /help command response:** Decision says lightweight pointer only -- one or two sentences plus the Mini App deep link button
- **Fetching help content from API:** Decision says hardcoded in React component
- **Creating separate admin/regular help pages:** One page with conditional rendering based on role
- **Complex stateful help (tracking what user has seen):** Decision says static content, same for all users

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mini App deep linking | Custom URL encoding/startapp parsing | `InlineKeyboard.webApp(text, url)` with full path URL | Established pattern in codebase; `web_app` buttons open the Mini App at exact URL path |
| Admin detection in Mini App | Parsing Telegram initData client-side for admin IDs | `/api/me` endpoint that returns user role from DB | Auth middleware already resolves user; clean separation of concerns |
| Help content sections | Dynamic content loading | Hardcoded React JSX | Decision says no API; static content; simpler, faster, no loading states |
| Back navigation | Custom history management | `@tma.js/sdk-react` backButton with `navigate(-1)` | Established pattern across all Mini App pages |

**Key insight:** This phase introduces zero new libraries and zero new architectural patterns. Every piece follows an established pattern in the codebase. The main work is content creation (help text) and wiring up existing patterns.

## Common Pitfalls

### Pitfall 1: Forgetting to Register the /help Handler in Bot Factory
**What goes wrong:** /help command silently does nothing because it was never `.use()`'d on the bot
**Why it happens:** The bot uses explicit handler registration in `src/bot/index.ts` with a specific ordering
**How to avoid:** Add `helpHandler` to `CreateBotOptions` interface and register it BEFORE the catch-all `messageHandler`
**Warning signs:** /help command gets caught by the catch-all message handler and processed by Claude instead

### Pitfall 2: Missing miniAppUrl Guard
**What goes wrong:** Bot crashes or sends a broken link when `MINI_APP_URL` is not set (dev mode)
**Why it happens:** `config.miniAppUrl` can be empty string in dev/polling mode
**How to avoid:** Always wrap `webApp` button creation in `if (config.miniAppUrl)` guard, just like grocery and plan handlers do
**Warning signs:** TypeError or bot crash in polling mode without tunnel

### Pitfall 3: Help Page Not Accessible via Direct URL
**What goes wrong:** User clicks webApp button but sees a blank page or 404
**Why it happens:** Route not added to `mini-app/src/router.tsx`, or SPA fallback not catching `/app/help`
**How to avoid:** Add `{ path: 'help', element: <Help /> }` to the router's children array
**Warning signs:** 404 in Telegram WebView (hard to debug -- no dev tools in production)

### Pitfall 4: Admin Content Leaking to Regular Users
**What goes wrong:** Regular users see admin commands (/invite) on the help page
**Why it happens:** Role check not implemented or fetched incorrectly
**How to avoid:** Fetch role via `/api/me` endpoint; conditionally render admin section only when `role === "admin"`
**Warning signs:** Non-admin users can see /invite documentation

### Pitfall 5: Help Handler Ordering in Bot Middleware Chain
**What goes wrong:** `/help` command text gets processed by Claude (expensive API call) instead of the direct handler
**Why it happens:** Handler registered after the catch-all `messageHandler` or not registered at all
**How to avoid:** Register helpHandler in the correct position (after accessGate, before messageHandler), consistent with other command handlers
**Warning signs:** Claude responds to /help conversationally instead of the instant direct response

### Pitfall 6: System Prompt HELP Block Not Injected
**What goes wrong:** Claude doesn't know about /help and never mentions it when users are confused
**Why it happens:** HELP_PROMPT constant defined but not concatenated into the `buildSystemPrompt` return string
**How to avoid:** Add HELP_PROMPT to the template literal concatenation at the end of `buildSystemPrompt`
**Warning signs:** Claude never mentions /help or the Mini App help page in conversations

### Pitfall 7: BackButton Handler Cleanup in Help Page
**What goes wrong:** Navigation breaks when switching between pages
**Why it happens:** onClick handler not cleaned up in useEffect return
**How to avoid:** Follow the exact pattern from `Feedback.tsx`: store the `off` function and call it in cleanup
**Warning signs:** Clicking back button navigates to wrong page or does nothing

## Code Examples

Verified patterns from the existing codebase:

### Registering a Command Handler in bot/index.ts
```typescript
// Source: src/bot/index.ts (lines 36-51, 94-106)
// 1. Add to CreateBotOptions interface:
helpHandler: Composer<BotContext>;

// 2. Destructure from options:
const { helpHandler, ...rest } = options;

// 3. Register BEFORE messageHandler:
bot.use(helpHandler);   // /help command
bot.use(messageHandler); // catch-all -- MUST be last
```

### Creating the Handler in main.ts
```typescript
// Source: src/main.ts (pattern from lines 160-181)
import { createHelpHandler } from "./bot/handlers/help.js";

const helpHandler = createHelpHandler();

const bot = createBot(config.botToken, {
  // ... existing handlers ...
  helpHandler,
  // ...
});
```

### Adding a Route to Mini App Router
```typescript
// Source: mini-app/src/router.tsx (pattern from lines 9-26)
import { Help } from './pages/Help';

// Inside children array:
{ path: 'help', element: <Help /> },
```

### Adding a Hub Card
```typescript
// Source: mini-app/src/pages/Hub.tsx (pattern from lines 97-130)
// The Hub card does NOT need summary data -- it's always-visible, static subtitle
// Place it after the "Give Feedback" card
<Cell
  before={<HelpCircle size={24} style={iconStyle} />}
  subtitle="Learn what I can do"
  onClick={() => navigate('/help')}
  style={cellStyle}
>
  Help
</Cell>
```

### Adding an API Route for User Role
```typescript
// Source: src/mini-app/router.ts (pattern from lines 26-56)
// In createApiRouter:
import { createMeRoute } from "./routes/me.js";

router.get("/me", createMeRoute(deps.sqlite));
```

### System Prompt Block Injection
```typescript
// Source: src/ai/system-prompt.ts (pattern from lines 333, 473)
// 1. Define the constant:
const HELP_PROMPT = `
<help>
The bot has a /help command and a Mini App help page.
When users seem confused about what you can do, naturally mention
"if you need help, just ask!" or "you can check /help to see everything I can do."
When users explicitly ask for help or say "help", send the Mini App help page link.
Do NOT try to list all features yourself -- point to the help page instead.
</help>`;

// 2. Append in the return string (line 473):
// ...${APP_FEEDBACK_PROMPT}${HELP_PROMPT}${onboardingContext || ""}...
```

### Help Page with Conditional Admin Content
```typescript
// Source: Pattern combining existing apiFetch usage and conditional rendering
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export function Help() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch('/me')
      .then(res => res.json())
      .then(data => setIsAdmin(data.role === 'admin'))
      .catch(() => {}); // silently default to non-admin
  }, []);

  return (
    <div>
      {/* Regular help sections */}
      {isAdmin && (
        <div>
          {/* Admin-only sections like /invite */}
        </div>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `startapp` parameter for Mini App deep linking | Direct URL path in `web_app` button | Phase 11 decision (this project) | Simpler -- no parameter encoding needed, just URL paths |
| Help as inline bot content | Help as Mini App page with bot pointer | Phase 19 decision | Better UX -- rich formatted page vs limited Telegram message |

**Deprecated/outdated:**
- None applicable -- this phase uses only established patterns

## Open Questions

1. **Where to position the Help card on the Hub?**
   - What we know: Currently 4 cards: Grocery List, Recipes, Meal Plan, Give Feedback
   - What's unclear: Should Help be before or after Feedback?
   - Recommendation: Place Help as the last card (after Feedback). Help is a reference page, not a primary action. Users who need it will find it; users who don't won't be distracted.

2. **How to determine admin status without loading delay on help page?**
   - What we know: Need to fetch `/api/me` which adds a network round trip
   - What's unclear: Will there be a visible flash when admin section appears?
   - Recommendation: Default to showing non-admin content. Admin section appears below regular content when role resolves. Since it's at the bottom, there's no layout shift for most of the page. Alternatively, the `/api/me` call could be made at app init and cached -- but that's over-engineering for one use case.

## Sources

### Primary (HIGH confidence)
- Existing codebase (`src/bot/handlers/grocery.ts`, `src/bot/handlers/plan.ts`, `src/bot/handlers/reminders.ts`) -- command handler factory pattern, webApp button pattern
- Existing codebase (`mini-app/src/pages/Feedback.tsx`, `mini-app/src/pages/Hub.tsx`) -- static page pattern, Hub card pattern
- Existing codebase (`src/ai/system-prompt.ts`) -- system prompt block injection pattern
- Existing codebase (`src/bot/index.ts`, `src/main.ts`) -- handler registration and wiring pattern
- Existing codebase (`src/mini-app/auth-middleware.ts`, `src/mini-app/router.ts`) -- API endpoint and auth pattern

### Secondary (MEDIUM confidence)
- [Telegram Mini Apps docs](https://core.telegram.org/bots/webapps) -- web_app button behavior verified
- Phase 11 Research (`11-RESEARCH.md`) -- deep linking approach via `web_app` URL field

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- every pattern directly observed in existing codebase
- Pitfalls: HIGH -- derived from existing handler registration patterns and known failure modes
- Code examples: HIGH -- all examples derived from existing working code in the codebase

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependencies or fast-moving targets)
