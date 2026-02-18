---
phase: 11-mini-app-foundation
plan: 03
subsystem: bot
tags: [telegram-mini-apps, inline-keyboard, web-app-button, menu-button, deep-linking, grammy]

# Dependency graph
requires:
  - phase: 11-mini-app-foundation plan 01
    provides: "miniAppUrl config field, API router, static serving at /app/*"
  - phase: 11-mini-app-foundation plan 02
    provides: "React SPA with client-side routing at /app/grocery and /app/plan"
provides:
  - "Inline keyboard webApp buttons for grocery (View List) and plan (View Plan) deep-linking"
  - "BotFather menu button configured to open Mini App hub"
  - "Verified end-to-end build pipeline (backend tsc + frontend vite)"
affects: [12-grocery-mini-app, 13-recipe-browser, 14-meal-plan-view]

# Tech tracking
tech-stack:
  added: []
  patterns: ["webApp inline button with conditional miniAppUrl guard", "setChatMenuButton web_app type on startup"]

key-files:
  created:
    - src/telegram/menu-button.ts
  modified:
    - src/bot/handlers/grocery.ts
    - src/bot/handlers/plan.ts
    - src/main.ts

key-decisions:
  - "Plan handler switched from sendFormattedMessage to ctx.reply with reply_markup to support inline keyboard attachment"
  - "WebApp button preserved on grocery keyboard rebuild during item toggle callbacks"

patterns-established:
  - "Conditional webApp button: check config.miniAppUrl before adding .row().webApp() to keyboard"
  - "Menu button setup: async setupMenuButton() called once after bot creation, idempotent, graceful error handling"

# Metrics
duration: 7min
completed: 2026-02-10
---

# Phase 11 Plan 03: Bot-to-Mini-App Wiring Summary

**Inline webApp buttons on grocery/plan responses for Mini App deep-linking, BotFather menu button opening hub, and verified build:all pipeline**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-10T02:28:39Z
- **Completed:** 2026-02-10T02:35:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Grocery handler adds "View List" webApp button opening /app/grocery in Telegram WebView, preserved through item toggle keyboard rebuilds
- Plan handler adds "View Plan" webApp button opening /app/plan in Telegram WebView
- Both buttons conditionally appear only when MINI_APP_URL is configured (graceful fallback for dev without tunnel)
- BotFather menu button setup function calls setChatMenuButton with web_app type on every startup (idempotent)
- Verified build:all pipeline produces both backend TypeScript and frontend Vite SPA output

## Task Commits

Each task was committed atomically:

1. **Task 1: Inline keyboard buttons for deep-linking** - `5aa6078` (feat)
2. **Task 2: Menu button setup + build pipeline** - `fd55492` (feat)

## Files Created/Modified
- `src/bot/handlers/grocery.ts` - Added config import, webApp("View List") button on /grocery command and callback rebuild
- `src/bot/handlers/plan.ts` - Added config + InlineKeyboard imports, webApp("View Plan") button on /plan command, switched to ctx.reply with reply_markup
- `src/telegram/menu-button.ts` - New file: setupMenuButton() calls setChatMenuButton with web_app type, graceful no-op when URL empty or API fails
- `src/main.ts` - Added setupMenuButton import and call after bot creation, before webhook/polling start

## Decisions Made
- Plan handler switched from `sendFormattedMessage(ctx, message)` to `ctx.reply(message, replyOptions)` to support attaching InlineKeyboard reply_markup. Weekly plan messages are always well under 4096 chars, so message splitting is unnecessary here.
- WebApp button is also added during grocery callback handler keyboard rebuilds (item toggle), ensuring the "View List" button persists after check-off interactions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

MINI_APP_URL environment variable must be set to a public HTTPS URL (e.g., `https://your-domain.com/app`) for webApp buttons and menu button to appear. Without it, all Mini App features gracefully degrade to standard text-only responses. For local development, use ngrok or cloudflared tunnel.

## Next Phase Readiness
- All three Phase 11 plans complete: API+auth (01), frontend SPA (02), bot wiring (03)
- Bot responses now include webApp buttons linking users to Mini App views
- BotFather menu button opens the hub dashboard
- Full build pipeline verified end-to-end
- Ready for Phase 12 (grocery Mini App view) to implement the actual /app/grocery page content

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 11-mini-app-foundation*
*Completed: 2026-02-10*
