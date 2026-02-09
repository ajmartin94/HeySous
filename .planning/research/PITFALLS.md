# Pitfalls Research

**Domain:** Adding Telegram Mini Apps to existing bot (HeySous v1.1)
**Researched:** 2026-02-09
**Confidence:** HIGH (verified against official Telegram Mini Apps documentation, community issue trackers, and @tma.js SDK docs)

**Context:** HeySous is an 8,263 LOC TypeScript bot (grammY, Express, SQLite/Drizzle) on Railway. v1.1 adds 3 React Mini Apps (grocery list, meal plan, recipe browser) served from the same Express server, sharing the same SQLite database. Target platform is iOS Telegram client.

---

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or broken user experience.

### Pitfall 1: initData Validation Missing or Misconfigured

**What goes wrong:**
The Mini App sends requests to your Express API endpoints, claiming to be a specific Telegram user. Without server-side initData validation, anyone who discovers your API URL can impersonate any user, read their recipes, modify their grocery lists, or corrupt their meal plans. Even for a single-user system, this is a security hole -- an attacker could wipe your data.

**Why it happens:**
During development, you skip validation because "it's just me." The Mini App works perfectly without it. Then you deploy, and any HTTP client can hit your `/api/groceries` endpoint with no authentication. initData validation has a multi-step HMAC-SHA256 process that's easy to get wrong: you must sort parameters alphabetically, join with newline, HMAC with `WebAppData` as the key first (not the bot token directly), then HMAC the result with the bot token.

**How to avoid:**
- Implement initData validation as Express middleware before writing any API routes. Make it the first thing you build in the Mini App API layer.
- Use the `@telegram-apps/init-data-node` package which handles the HMAC-SHA256 validation correctly, rather than implementing it manually.
- Add expiration checking using `auth_date` -- reject initData older than 1 hour (the default in many libraries is 24 hours, which is too long for a live editing interface like a grocery list).
- Never trust `initDataUnsafe` on the client side for authorization decisions. Always validate on the server.
- In development, use a bypass flag (e.g., `SKIP_TMA_AUTH=true`) that is impossible to accidentally deploy (check in middleware, log a warning).

**Warning signs:**
- API endpoints work when called from curl/Postman without any Telegram headers
- No `Authorization` or `X-Init-Data` header being checked on API routes
- Using `initDataUnsafe.user.id` on the client to decide what data to show

**Phase to address:** Phase 1 (API Foundation). Must be the first middleware added, before any data endpoints exist.

**Severity:** SECURITY BREACH if skipped. Even for a solo user, the database is exposed.

**Confidence:** HIGH -- initData validation is the primary authentication mechanism for Mini Apps, documented in [official Telegram docs](https://core.telegram.org/bots/webapps) and [tma.js init-data docs](https://docs.telegram-mini-apps.com/platform/init-data).

---

### Pitfall 2: iOS Scrolling Collapse -- Swipe Down Closes the App

**What goes wrong:**
On iOS Telegram, when a user swipes down on a Mini App that is either (a) not scrollable, or (b) scrollable but scrolled to the top (scrollY === 0), the swipe gesture is interpreted as "close the Mini App" instead of "scroll." For a grocery list where users check items from the top, the very first downward swipe closes the app. Users lose unsaved state. This is the single most frustrating iOS-specific bug and it affects all three planned Mini Apps.

**Why it happens:**
Telegram's iOS WebView uses the swipe-down gesture for both "scroll content" and "dismiss sheet." When there's nowhere to scroll, the gesture goes to the sheet. The grocery list starts at the top (scrollY=0), so any downward touch triggers dismissal. This is not a bug in your code -- it's a Telegram client behavior that you must work around.

**How to avoid:**
- Call `window.Telegram.WebApp.disableVerticalSwipes()` early in app initialization (available since Bot API 7.7). This is the clean modern solution.
- As a fallback for older clients: ensure the document is always scrollable by setting `height: calc(100vh + 1px)` on the HTML element, and on `touchstart`, if `scrollY === 0`, programmatically scroll to `(0, 1)` so the swipe registers as a scroll.
- Test every Mini App view by swiping down when at the top of the list. If the app closes, the fix is not working.

**Warning signs:**
- "The app keeps closing when I scroll" (you, testing on your iPhone)
- Mini App closes when you try to pull-to-refresh or swipe down on any list view
- Works fine on desktop Telegram but breaks on iOS

**Phase to address:** Phase 1 (Mini App scaffold). Call `disableVerticalSwipes()` in the app initialization, before any UI renders.

**Severity:** UX BREAKING on iOS. The grocery list is unusable without this fix.

**Confidence:** HIGH -- well-documented in [Telegram-Mini-Apps/issues #16](https://github.com/Telegram-Mini-Apps/issues/issues/16) and [TelegramMessenger/Telegram-iOS #1447](https://github.com/TelegramMessenger/Telegram-iOS/issues/1447). The `disableVerticalSwipes()` API is documented in the [official Bot API](https://core.telegram.org/bots/webapps).

---

### Pitfall 3: iOS Keyboard Covers Input Fields and Breaks Viewport

**What goes wrong:**
When a user taps an input field (e.g., adding a grocery item, searching recipes), the iOS virtual keyboard appears. The Telegram WebView does not properly resize the viewport -- `viewportHeight` reports the same value as if the keyboard were closed. Input fields at the bottom of the screen get covered by the keyboard. The user cannot see what they're typing. Worse, the viewport shifts unpredictably, and there's often a gap between the keyboard and the input field.

**Why it happens:**
The iOS Telegram client applies `position: fixed` to the HTML document to prevent native scrolling, then manually calculates the visible area. This prevents the standard WebView resize behavior that mobile Safari uses. The `viewportHeight` in the Telegram WebApp object does not account for the keyboard, so CSS-based layouts that rely on viewport height break.

**How to avoid:**
- Place input fields at the TOP of the screen, not the bottom. For the grocery list, put the "add item" input at the top, with the list scrolling below.
- Use `window.visualViewport` API to detect actual visible area when the keyboard is open.
- On input focus, programmatically scroll the input into view with `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- Avoid fixed-position bottom bars with inputs. If you need a bottom input, use absolute positioning relative to the visual viewport, not the layout viewport.
- Test every input field on an actual iOS device with the Telegram app. The simulator does not replicate this behavior accurately.
- Consider using `Telegram.WebApp.hideKeyboard()` (Bot API 9.1+) when the user submits, to immediately dismiss the keyboard.

**Warning signs:**
- Input is visible on desktop but disappears behind keyboard on iOS
- Users have to scroll up manually after tapping an input
- The viewport "jumps" when focusing/unfocusing inputs

**Phase to address:** Phase 1 (UI scaffold). Input placement must be top-of-screen from the first prototype. Retrofitting bottom inputs to top inputs means rethinking the entire layout.

**Severity:** HIGH -- every Mini App has at least one input (add grocery item, search recipes, edit meal plan). All will be broken on iOS if not addressed.

**Confidence:** HIGH -- documented in [Telegram-iOS #1410](https://github.com/TelegramMessenger/Telegram-iOS/issues/1410), [Telegram-iOS #1296](https://github.com/TelegramMessenger/Telegram-iOS/issues/1296), [Telegram-iOS #1637](https://github.com/TelegramMessenger/Telegram-iOS/issues/1637), and [Telegram-Mini-Apps/issues #33](https://github.com/Telegram-Mini-Apps/issues/issues/33).

---

### Pitfall 4: SQLite Concurrent Access -- Bot and Mini App Writing Simultaneously

**What goes wrong:**
The bot and Mini App API share the same SQLite database. User checks off a grocery item in the Mini App while the bot is writing a new meal plan. SQLite's default journal mode allows only one writer at a time -- the second write gets `SQLITE_BUSY` ("database is locked"). In the worst case, the Mini App shows an error and the user's checkbox state is lost. With Drizzle ORM, this may surface as an unhandled promise rejection that crashes the process.

**Why it happens:**
In v1.0, the bot was the only writer. Adding Mini App API routes creates a second write path to the same database file. SQLite in default journal mode (DELETE) serializes all writes. Even with WAL mode, if a write transaction takes too long (e.g., bot generating a complex meal plan with multiple inserts), subsequent writes queue up.

**How to avoid:**
- Enable WAL (Write-Ahead Logging) mode on the SQLite database: `PRAGMA journal_mode=WAL`. This allows concurrent reads during writes and significantly reduces locking. This should already be done in v1.0 but verify it.
- Set `busy_timeout` to a reasonable value (e.g., 5000ms) so SQLite retries instead of immediately failing: `PRAGMA busy_timeout=5000`.
- Keep write transactions small. Do not wrap a full meal plan generation in a single transaction -- insert recipes, then insert plan entries in separate transactions.
- Use a single Drizzle client instance shared between the bot and the API server (they're in the same Node.js process), not separate connections.
- Add error handling for `SQLITE_BUSY` in the API layer -- retry once, then return a 503 with a "try again" message.

**Warning signs:**
- "database is locked" errors in logs after Mini App launch
- Intermittent 500 errors from API endpoints
- Grocery list checkboxes that revert (write failed silently)

**Phase to address:** Phase 1 (API Foundation). Verify WAL mode and busy_timeout before adding any Mini App write endpoints.

**Severity:** DATA CORRUPTION risk. Lost writes mean the user checks off groceries that reappear, or meal plan edits vanish.

**Confidence:** HIGH -- SQLite locking behavior is well-documented. The specific risk of shared access in a single-process Node.js app is a known pattern.

---

### Pitfall 5: State Sync Between Bot and Mini App -- Stale Data and Race Conditions

**What goes wrong:**
User opens the grocery list Mini App and sees 12 items. Meanwhile, they message the bot "add milk to the list." The bot adds milk to the database, but the Mini App still shows 12 items because it loaded data on mount and has no way to know about the change. The user doesn't see milk, adds it manually via the Mini App, and now there are two entries for milk. Alternatively: user checks off items in the Mini App, then asks the bot "what's left on my list?" -- the bot reads from the database but the Mini App hasn't synced its changes yet.

**Why it happens:**
The bot and Mini App are independent clients of the same database. There's no real-time sync mechanism. The Mini App is a web page with its own state. The bot processes messages asynchronously. Neither knows about the other's mutations without explicit coordination.

**How to avoid:**
- The Mini App must be the **view**, not the source of truth. Every mutation goes through the API to the database immediately (no optimistic-only updates that skip the server).
- Implement polling on the Mini App side: re-fetch data every 5-10 seconds while the app is visible. For a single-user app, this is low cost and avoids the complexity of WebSocket.
- When the Mini App gains focus (`visibilitychange` event), always re-fetch current data from the API.
- For the bot side: after any data mutation (add to grocery list, update meal plan), if you know the Mini App might be open, accept that it will be slightly stale. The polling will catch it.
- Consider a lightweight "version" or "lastModified" field on lists -- the Mini App can check if its version matches before showing stale data.

**Warning signs:**
- Duplicate items in grocery list
- Mini App shows stale data until manually refreshed
- Bot and Mini App disagree on checked/unchecked state

**Phase to address:** Phase 2 (Feature implementation). The API must always write-through immediately. Polling should be added alongside the first data-fetching Mini App.

**Severity:** HIGH -- this is the core value proposition of the hybrid model. If bot and Mini App disagree on state, trust in the system breaks.

**Confidence:** HIGH -- eventual consistency in multi-client systems is a fundamental distributed systems challenge. The specific TWA context makes it harder because there's no built-in Telegram mechanism for Mini App push updates.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Separate API for Mini App (new routes, new auth) instead of sharing bot's data layer | Faster to prototype, no touching existing code | Two codepaths to the same data, diverging validation logic, double the maintenance | Never -- reuse the existing data access layer from the bot |
| localStorage for Mini App state instead of server-side persistence | No API needed, instant reads/writes | Data lost when Telegram clears WebView cache (happens unpredictably), no sync with bot, gone on device switch | Only for transient UI state (scroll position, filter selection). Never for grocery checks or edits |
| Polling every 1 second for real-time feel | Feels responsive, simple implementation | 60 requests/minute per open Mini App. SQLite read load, API server load, battery drain on mobile | Never at 1s. Use 5-10s for active use, pause when app is backgrounded |
| Bundling all 3 Mini Apps into one SPA with client-side routing | Single build, shared dependencies, less deployment complexity | Larger bundle (user downloads recipe browser code when opening grocery list), more complex routing, harder to reason about | Acceptable for v1.1 given small scope. Each "app" is a route in a single React app. Split later if bundles exceed 200KB |
| Skipping `@telegram-apps/sdk-react` and using `window.Telegram.WebApp` directly | No dependency, works immediately | No TypeScript types, no React lifecycle integration, manual event cleanup, miss platform updates | Only for the initial spike/POC. Switch to the SDK before writing real features |
| Not implementing closing confirmation for the grocery list | Fewer API calls, simpler code | User swipes to close Mini App mid-edit, loses unchecked items if writes haven't flushed | Never for the grocery list Mini App -- enable `web_app_setup_closing_behavior` with confirmation |

---

## Integration Gotchas

Common mistakes when connecting Mini Apps to the existing bot system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Express routing** | Mounting Mini App static files and API routes on the same path prefix, causing conflicts with the bot webhook route | Use distinct path prefixes: `/webhook` for bot, `/api/tma/*` for Mini App API, `/app/*` for static files. Ensure the webhook route is registered first |
| **initData in API calls** | Passing initData as a query parameter (visible in logs, URLs, browser history) | Pass initData in the `Authorization` header: `Authorization: tma <initData>`. Parse and validate in middleware |
| **@tma.js/sdk-react installation** | Installing both `@tma.js/sdk` and `@tma.js/sdk-react`, causing SDK package duplication and incorrect behavior | Install only `@tma.js/sdk-react` (or current equivalent `@telegram-apps/sdk-react`). It re-exports everything from the base SDK |
| **Vite dev server + Express** | Running Vite dev server on port 5173 and Express on port 3000, then wondering why initData is empty in dev | In development, proxy API requests from Vite to Express. For Telegram testing, tunnel must point to Express which serves both static and API. Consider Vite middleware mode for dev |
| **Bot webhook vs Mini App URL** | Setting the Mini App URL to the same domain but forgetting that Telegram sends webhook POSTs to the same server | Webhook is a POST to a specific path (e.g., `/webhook/bot`). Mini App is a GET to a different path (e.g., `/app/grocery`). They coexist fine as long as routes don't conflict |
| **sendData vs API call confusion** | Using `Telegram.WebApp.sendData()` for grocery list operations, which closes the Mini App and sends data as a bot message | Use your own API calls (`fetch('/api/tma/grocery/check', ...)`) for all CRUD operations. `sendData` is only for keyboard-button Mini Apps that send a single payload and close. Our Mini Apps stay open for interactive use |
| **Theme CSS variables** | Hardcoding colors in the React app instead of using Telegram's theme variables | Use `var(--tg-theme-bg-color)`, `var(--tg-theme-text-color)`, etc. for all colors. Listen to `themeChanged` event to re-render if user switches dark/light mode while app is open |
| **Back button handling** | Not implementing BackButton.onClick, so pressing the native back button does nothing (or closes the app) | Show the back button when user navigates deeper (recipe detail, edit mode). Handle `backButtonClicked` to navigate back in your React router. Hide it on the main view |
| **CORS from Telegram WebView** | Not setting CORS headers on API routes, assuming same-origin because it's the same server | The Mini App may load from a different origin than your API in some Telegram clients. Set `Access-Control-Allow-Origin` for your domain. Include `Access-Control-Allow-Headers: Content-Type, Authorization` |

---

## Performance Traps

Patterns that work in development but fail on real iOS hardware.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Large initial bundle (>300KB) | Mini App shows white screen for 2-5 seconds on open. Users see the Telegram loading spinner, think it's broken, close it | Code-split the 3 Mini Apps. Lazy-load non-critical components. Use Vite's built-in chunking. Target <150KB initial bundle per app | Immediately on first load over cellular connection |
| Fetching all data on mount (e.g., all 200 recipes at once) | Initial load takes 3+ seconds. Memory usage spikes in iOS WebView | Paginate recipe list (20 at a time). Grocery list is fine to load fully (small dataset). Meal plan loads one week at a time | At 50+ recipes, or any slow network condition |
| Unoptimized re-renders from theme/viewport events | `themeChanged` and `viewportChanged` fire rapidly during animations. Each triggers React re-render. UI feels janky | Debounce theme and viewport event handlers (200ms). Use `viewportStableHeight` instead of `viewportHeight` for layout calculations | When user drags the sheet up/down or switches themes |
| Not compressing images in recipe cards | Each recipe thumbnail is a 2MB photo. 20 recipes = 40MB download in the recipe browser | Serve thumbnails as WebP at 200x200. Use lazy loading (`loading="lazy"`) for images below the fold | At 10+ recipes with photos |
| Polling continues when Mini App is backgrounded | API calls every 5 seconds even when user switched to the chat. Wastes battery, server resources | Pause polling on `visibilitychange` (document.hidden). Resume on focus. Clear intervals on unmount | Always, but especially noticeable on battery-constrained iOS |

---

## Security Mistakes

Mini App-specific security issues beyond the v1.0 bot security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating initData server-side | Anyone with the API URL can read/write all user data. initDataUnsafe is trivially forgeable on the client | Validate initData HMAC-SHA256 on every API request. Use `@telegram-apps/init-data-node` for correct implementation |
| Exposing bot token in client-side code | Bot token in React bundle = attacker controls your bot. Can send messages as your bot, access all user data via Bot API | Bot token must stay server-side only. The React app should never import, reference, or bundle any server-side secrets. Verify with `grep` on the built output |
| No expiration check on initData | Stolen initData (from logs, network sniffing) remains valid forever | Check `auth_date` in initData validation. Reject if older than 1 hour. Use the `expiresIn` parameter in validation libraries |
| API endpoints without rate limiting | Malicious or buggy client sends thousands of requests, overloading SQLite | Add basic rate limiting to Mini App API routes (e.g., 60 requests/minute per user). Express middleware like `express-rate-limit` works fine for this |
| Serving Mini App over HTTP in development tunnel | initData and user data visible to tunnel provider and any network observer | Always use HTTPS tunnels (ngrok provides HTTPS by default). Never use plain HTTP, even in development |
| Client-side data filtering (showing only "my" recipes based on client-side user ID) | If auth is bypassed, all data is accessible to any client | Filter data server-side in SQL queries using the validated user ID from initData. The API should never return data the user shouldn't see |

---

## UX Pitfalls

Telegram Mini App-specific user experience mistakes.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mini App opens in minimized (half-screen) state | User sees half the grocery list, has to manually drag up. Feels broken | Call `Telegram.WebApp.expand()` immediately after `ready()`. May need a small delay (50-100ms) on some iOS versions. Use `requestFullscreen()` if truly immersive content is needed |
| No loading state while data fetches | User sees empty white screen for 0.5-2 seconds after Mini App opens. Thinks it failed to load | Show a skeleton/spinner immediately. Call `Telegram.WebApp.ready()` only after the skeleton is rendered, not after data loads. This tells Telegram "I'm ready to show" |
| Theme mismatch -- Mini App looks different from Telegram | Jarring visual discontinuity. App feels foreign, not native. Especially bad when user is in dark mode and Mini App shows white background | Use Telegram's CSS variables (`--tg-theme-bg-color`, `--tg-theme-text-color`, etc.) for ALL visual styling. Never hardcode colors. Test in both light and dark mode |
| No haptic feedback on interactions | Tapping buttons and checkboxes feels "dead" compared to native Telegram UI | Use `Telegram.WebApp.HapticFeedback.impactOccurred('light')` on checkbox toggles and button taps. Use `notificationOccurred('success')` for completed actions |
| Ignoring safe area insets on iOS | Content overlaps with the notch at top or home indicator at bottom. Especially visible on iPhone with Dynamic Island | Use `contentSafeAreaInset` from the Telegram WebApp object, not `env(safe-area-inset-*)` which does not work in Telegram's WebView. Apply padding to your root container |
| No closing confirmation on grocery list | User accidentally swipes closed during shopping, losing checked state. Has to reopen and re-check items (if writes were deferred) | Enable closing confirmation via `web_app_setup_closing_behavior` for the grocery list. Disable it for read-only views (recipe browser) |
| Back button not implemented for navigation | User taps recipe in recipe browser, sees detail view, taps Telegram's back button -- nothing happens. Only option is to close and reopen | Show `BackButton` when navigated deeper than root. Handle `backButtonClicked` to call `router.back()`. Hide on root view |
| Mini App link opens but shows blank on older Telegram versions | User has not updated Telegram. Mini App uses Bot API 7.7+ features that don't exist in their client | Check `Telegram.WebApp.version` on load. If below required version, show a message: "Please update Telegram to use this feature" instead of a broken UI |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **initData validation works** -- but does it reject expired data? Test with `auth_date` from yesterday
- [ ] **Grocery list renders** -- but does checking an item persist immediately to the database, or only on close? If on close, data is lost when the user swipes away
- [ ] **Theme CSS variables applied** -- but did you test theme change mid-session? Open Mini App in light mode, switch Telegram to dark mode while Mini App is open. Does it update?
- [ ] **Back button works** -- but does it hide when on the root view? Visible back button on root view with no handler = confused user
- [ ] **expand() called** -- but did you test on a fresh open? Some iOS versions need a small delay between `ready()` and `expand()`. A race condition here means the app opens minimized
- [ ] **API routes work** -- but did you test when the bot is also writing? Check a grocery item in the Mini App while the bot is generating a meal plan. Does either fail?
- [ ] **Vertical swipes disabled** -- but only on the main view? Did you test scrolling within a modal or overlay? Nested scrollable containers may still trigger collapse
- [ ] **Recipe browser loads** -- but did you test with 0 recipes? The empty state should say "No recipes yet. Add some via the bot!" not crash or show a blank list
- [ ] **Mini App URL set in BotFather** -- but is it the HTTPS production URL? Using the dev tunnel URL in production means your Mini App dies when the tunnel closes
- [ ] **Vite build serves from Express** -- but does the build include proper cache-busting hashes in filenames? Without content hashes, Telegram's WebView will cache stale JS and CSS across deployments
- [ ] **Polling for fresh data works** -- but does it stop when the Mini App is hidden/backgrounded? Check with `document.hidden` -- a Mini App that polls in the background wastes battery and server resources
- [ ] **iOS safe areas handled** -- but did you test on an iPhone with Dynamic Island? The `contentSafeAreaInset` may differ from standard notch phones

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| No initData validation (security) | LOW | Add validation middleware to all API routes. No data migration needed. But audit logs for unauthorized access during the unprotected window |
| iOS scrolling collapse | LOW | Add `disableVerticalSwipes()` call. One line of code, instant fix. But users may have already learned to avoid the Mini App |
| Keyboard covering inputs | MEDIUM | Requires repositioning input fields from bottom to top. Layout rework affects all 3 Mini Apps. Better to get it right initially |
| SQLite locking errors | LOW | Enable WAL mode (`PRAGMA journal_mode=WAL`) and set `busy_timeout`. Can be done without data migration. May need to restart the process |
| Stale data / no sync | MEDIUM | Add polling to Mini App components. Must add `visibilitychange` handlers, loading states for re-fetches, and handle merge conflicts if user edited stale data |
| Hardcoded colors (no theming) | MEDIUM | Replace all color values with CSS variables. Tedious but straightforward find-and-replace across all components. More work the longer you wait |
| WebView caching stale builds | LOW-MEDIUM | Add content hashes to Vite build output (default behavior). Set `Cache-Control: no-cache` on HTML files from Express. For users with stale cache: they must clear Telegram data or wait |
| localStorage data loss | HIGH | If grocery checks were stored in localStorage and lost, they cannot be recovered. Must migrate to server-side persistence and re-enter lost data. Design for server-first from the start |
| `sendData` used instead of API calls | HIGH | Requires rearchitecting the data flow. `sendData` closes the Mini App on each call, so the UX is fundamentally different from a persistent interactive app. Must switch to fetch-based API calls and rewrite all data mutations |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| initData validation | Phase 1: API Foundation | Call an API endpoint from curl without initData header -- should return 401. Call with valid initData -- should return 200 |
| iOS scrolling collapse | Phase 1: Mini App Scaffold | Open any Mini App on iOS Telegram, swipe down at top of content -- app should NOT close |
| iOS keyboard viewport | Phase 1: UI Layout | Tap every input field on iOS Telegram. Input should remain visible above the keyboard. No content should be hidden |
| SQLite concurrent access | Phase 1: API Foundation | Run `PRAGMA journal_mode` and verify WAL. Simultaneously write from bot handler and API endpoint -- neither should error |
| State sync (bot + Mini App) | Phase 2: Grocery List Feature | Open grocery Mini App, message bot "add eggs", wait 10 seconds -- eggs should appear in Mini App without manual refresh |
| Theme handling | Phase 1: Mini App Scaffold | Open Mini App in light mode. Switch Telegram to dark mode. Mini App colors should update. No hardcoded white backgrounds |
| Safe area insets | Phase 1: UI Layout | Open on iPhone with notch/Dynamic Island. No content should be hidden behind system UI. Check top and bottom |
| Back button navigation | Phase 2: Recipe Browser | Navigate to recipe detail, tap back button -- should return to list. On root view, back button should not be visible |
| Closing confirmation | Phase 2: Grocery List | Open grocery list, check some items, try to close -- should see "Changes may not be saved" dialog |
| WebView caching | Phase 3: Deployment | Deploy a change, open Mini App immediately -- should see updated version, not stale cached version |
| Bundle size | Phase 1: Build Setup | Run `vite build` and check output. Initial chunk should be <150KB gzipped. Use `rollup-plugin-visualizer` to spot bloat |
| CORS configuration | Phase 1: API Foundation | Open Mini App from Telegram iOS -- API calls should succeed. Check for CORS errors in Eruda console |
| Development debugging | Phase 1: Build Setup | Include Eruda in dev builds. Verify you can see console.log output on iOS Telegram without macOS Safari |

---

## Telegram Mini App Platform-Specific Gotchas

Issues unique to the Telegram Mini App platform that don't exist in normal web development.

### Gotcha 1: WebView Cache Is Independent of Telegram Cache

**What happens:** Telegram's "Clear Cache" button does NOT clear the WebView (wvbots) cache where your Mini App files live. Users (and you during development) will see stale JavaScript/CSS even after clearing cache. On desktop, the cache is at `~/.local/share/TelegramDesktop/tdata/user_data/wvbots/cache` and must be manually deleted.

**Prevention:** Use Vite's default content-hashed filenames for JS/CSS assets. Set `Cache-Control: no-store, must-revalidate` on the HTML entry point served from Express. Never cache the `index.html`.

**Source:** [telegramdesktop/tdesktop #30127](https://github.com/telegramdesktop/tdesktop/issues/30127)

### Gotcha 2: `env(safe-area-inset-*)` Does Not Work in Telegram WebView

**What happens:** Standard CSS `env(safe-area-inset-bottom)` that works in Safari and Chrome returns 0 inside Telegram's WebView on iOS. Content overlaps with the home indicator.

**Prevention:** Use Telegram's own `contentSafeAreaInset` and `safeAreaInset` objects from the WebApp API instead of CSS environment variables. Apply padding from JavaScript, not CSS.

**Source:** [TelegramMessenger/Telegram-iOS #1377](https://github.com/TelegramMessenger/Telegram-iOS/issues/1377)

### Gotcha 3: `viewportHeight` Does Not Account for iOS Keyboard

**What happens:** When the virtual keyboard is open, `Telegram.WebApp.viewportHeight` reports the full height as if the keyboard were not there. CSS layouts using this value will be wrong.

**Prevention:** Use `window.visualViewport.height` for layouts that must account for the keyboard. Listen to `visualViewport.resize` events.

**Source:** [TelegramMessenger/Telegram-iOS #1296](https://github.com/TelegramMessenger/Telegram-iOS/issues/1296)

### Gotcha 4: Bottom Bar Flickering on iOS Scroll

**What happens:** Fixed-position elements at the bottom of the screen flicker during scroll on iOS. The element appears to "bounce" or disappear momentarily during fast scrolls.

**Prevention:** Avoid fixed-position bottom bars. Use CSS `transform: translateZ(0)` or `will-change: transform` as a hint to the compositor. Better yet, use sticky positioning or keep action buttons inline in the scroll flow.

**Source:** [Telegram-Mini-Apps/issues #50](https://github.com/Telegram-Mini-Apps/issues/issues/50)

### Gotcha 5: initData Caching on Desktop Client

**What happens:** The Telegram desktop client caches initData between sessions. The `auth_date` may be hours or days old, failing your expiration check even though the user just opened the Mini App fresh.

**Prevention:** Set a generous expiration window (1-2 hours, not minutes) for initData validation, or handle the "expired" case gracefully by prompting the user to close and reopen the Mini App. Do not set expiration to 0 (disabled) as that defeats the purpose.

**Source:** [telegramdesktop/tdesktop #28303](https://github.com/telegramdesktop/tdesktop/issues/28303)

---

## Deployment-Specific Pitfalls (Railway)

Issues specific to deploying on Railway with persistent volumes.

### Railway Pitfall 1: Volume Data Written at Build Time Does Not Persist

**What happens:** If your Dockerfile or build step writes to the volume mount path, that data is lost. Railway volumes only persist data written at runtime. If you pre-populate the SQLite database during build, it will be empty after the first deploy.

**Prevention:** The SQLite database (and any persistent data) must be created at runtime, not build time. Drizzle migrations should run on process start, not during the Docker build step.

**Source:** [Railway Volumes docs](https://docs.railway.com/volumes)

### Railway Pitfall 2: Volume Mount Path Must Include `/app` Prefix

**What happens:** Railway's Nixpacks puts your application in `/app`. If you write to `./data/heysous.db` and mount a volume at `/data`, the volume is empty because your app writes to `/app/data/heysous.db`.

**Prevention:** Mount the volume at `/app/data` (including the `/app` prefix). Or use absolute paths in your database configuration.

### Railway Pitfall 3: Single Server = Mini App Downtime During Deploys

**What happens:** Railway restarts your container on each deploy. During the ~10-30 second restart window, both the bot webhook AND the Mini App are down. If a user has the grocery list open during a deploy, their API calls fail. If they were mid-edit, data may be lost.

**Prevention:** Enable closing confirmation on the grocery list so users save before closing. Keep deploys off peak usage times. For the bot, Telegram will retry the webhook delivery after the restart (within 60s). For the Mini App, show a "reconnecting..." state when API calls fail.

---

## Sources

- [Telegram Mini Apps official documentation](https://core.telegram.org/bots/webapps) -- HTTPS requirements, initData, viewport, events, theme, closing behavior, keyboard
- [Telegram Mini Apps community docs](https://docs.telegram-mini-apps.com/platform/init-data) -- initData validation, theming, viewport, debugging, navigation
- [@telegram-apps/sdk-react npm](https://www.npmjs.com/package/@tma.js/sdk-react) -- React SDK integration, version 3.x
- [Telegram-Mini-Apps/issues GitHub](https://github.com/Telegram-Mini-Apps/issues/issues) -- viewport #16, iOS safe area #39, bottom bar flicker #50, keyboard #33
- [TelegramMessenger/Telegram-iOS GitHub](https://github.com/TelegramMessenger/Telegram-iOS/issues) -- keyboard #1410, viewport height #1296, expand #1302, scrolling collapse #1447, safe area #1377, viewport shift #1298, keyboard buggy #1637
- [telegramdesktop/tdesktop GitHub](https://github.com/telegramdesktop/tdesktop/issues) -- initData caching #28303, WebView cache #30127
- [Scrolling collapse fix article](https://dev.to/nimaxin/how-to-fix-the-telegram-mini-app-scrolling-collapse-issue-a-handy-trick-1abe) -- scrolling collapse root cause and fix
- [Railway Volumes documentation](https://docs.railway.com/volumes) -- volume mount behavior, Nixpacks paths
- [Telegram Webhook guide](https://core.telegram.org/bots/webhooks) -- port restrictions, timeout behavior, certificate requirements
- [SQLite WAL mode documentation](https://www.sqlite.org/wal.html) -- concurrent access patterns

---
*Pitfalls research for: Adding Telegram Mini Apps to HeySous (v1.1)*
*Researched: 2026-02-09*
