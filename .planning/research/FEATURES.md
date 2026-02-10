# Feature Research: Telegram Mini Apps for Meal Planning

**Domain:** Telegram Mini Apps (TWA) for Grocery Lists, Meal Plans, and Recipe Browsing
**Researched:** 2026-02-09
**Confidence:** MEDIUM-HIGH (Telegram API docs verified, UI patterns from multiple sources, codebase data model inspected)

## Context: What Exists Today

The existing v1.0 HeySous bot already has:

- **Grocery lists** -- stored with `store`, `section`, `name`, `quantity`, `checked` fields; displayed as HTML text with inline keyboard buttons for toggle (2 per row, 80-item cap before falling back to text-only). Current pain: inline buttons are cramped, limited to label text, cannot show section headers inline, no visual progress, 100-button Telegram limit.
- **Meal plans** -- stored as `mealPlanEntries` with `dayOfWeek` (0-6), `mealType` (breakfast/lunch/dinner), `recipeName`, and optional `knowledgeItemId` link. Currently displayed as plain text list. No way to tap a meal and see the recipe.
- **Knowledge items (recipes)** -- stored with `title`, `summary`, `content`, `source`, `tags`. Searchable via FTS5 with BM25 ranking. No visual browse capability at all; user must ask Claude to find recipes.

The Mini Apps address a known limitation noted in v1.0 research: "Telegram as a platform is a constraint. No rich UI means grocery list management is inferior to native apps until Mini Apps are built."

## Chat vs. Mini App: What Goes Where

This is the most important design decision. Based on Telegram UX best practices and the hybrid model.

**Stays in chat (bot messages):**
- Recipe entry (conversational by design)
- Meal plan generation (conversation with Claude to discuss preferences, constraints)
- Plan adjustments ("swap Tuesday's dinner")
- Pivot assistance ("chicken burned, what else?")
- Preference changes ("actually dinner is at 6:30 now")
- Feedback check-ins ("how was the butter chicken?")
- All notifications and reminders
- Quick status checks (/plan, /grocery for text summaries)

**Moves to Mini App (visual tasks):**
- Grocery list check-off while shopping (the primary use case -- needs speed, one-hand use, haptic feedback)
- Weekly meal plan visualization (grid view, tap to see recipe)
- Recipe browsing and search (card layout, tag filtering, full recipe detail)

**The handoff pattern:** Bot sends a message with a `web_app` inline keyboard button (e.g., "Open Grocery List"). User taps it, Mini App opens inside Telegram. Mini App communicates with the same backend API. When done, user closes Mini App and returns to chat.

## Feature Landscape

### Table Stakes: Grocery List Mini App

Features users expect from any grocery list UI. Missing these means the Mini App is worse than the inline buttons it replaces.

| Feature | Why Expected | Complexity | Backend Dependency | Notes |
|---------|--------------|------------|-------------------|-------|
| **Tap to check off items** | The entire reason this Mini App exists. Tap an item, it gets checked with strikethrough. Must be faster than the current inline button approach. | LOW | `toggleItem(itemId)` exists | Use haptic feedback (`selectionChanged()`) on each tap. Optimistic UI -- check immediately, sync in background. |
| **Items grouped by store** | Current bot already groups by store (Kroger/Costco). Users expect the same organization in the visual UI. | LOW | Items already have `store` field | Collapsible store sections. Visual separation with store name headers. |
| **Items grouped by section within store** | Current bot groups by section (Produce, Dairy, etc.). Users expect aisle-based organization to match their shopping route. | LOW | Items already have `section` field | Nested grouping: Store > Section > Items. Sections collapsible. |
| **Checked items visually distinct** | Strikethrough, grayed out, moved to bottom. Standard grocery app pattern. | LOW | `checked` boolean exists | Checked items move to collapsed "Done" section at bottom of each store. |
| **Progress indicator** | "12/28 items" or a progress bar. Users want to know how far through the list they are. | LOW | Computed from item states | Per-store and overall progress. Visual bar or fraction. |
| **Item quantity display** | "2 lbs chicken thighs" not just "chicken thighs". | LOW | `quantity` field exists | Display as `{quantity} {name}` -- same as current text format. |
| **Pull to refresh** | Standard mobile pattern. If items were added via chat while Mini App is open, user expects to pull down and see updates. | LOW | Re-fetch from API | Standard web pull-to-refresh pattern. |
| **Back button navigation** | Telegram provides `BackButton` API. Must work correctly to return to chat. | LOW | None | Use `Telegram.WebApp.BackButton` API. |
| **Theme matching** | Must respect Telegram's light/dark mode. Cannot look like a foreign app dropped into the chat. | MEDIUM | None (client-side) | Use `ThemeParams` CSS variables for all colors. TelegramUI component library handles this automatically. |

### Table Stakes: Meal Plan Mini App

| Feature | Why Expected | Complexity | Backend Dependency | Notes |
|---------|--------------|------------|-------------------|-------|
| **7-day grid/list view** | The whole point is seeing the week at a glance, which text cannot do well. Every meal planning app shows a calendar or grid. | MEDIUM | `getPlan()` returns entries with `dayOfWeek` + `mealType` | Monday-Sunday layout. Show recipe name in each cell. Highlight today. |
| **Meal type rows** | Breakfast / Lunch / Dinner rows (or just dinner if dinner-only plan). Must adapt to what meals are actually planned. | LOW | `mealType` field exists | Auto-detect: if all entries are dinner, show single-row. If mixed, show multi-row grid. |
| **Tap meal to see recipe** | Users will tap a planned meal expecting to see the recipe. This is the primary interaction beyond just viewing. | MEDIUM | `knowledgeItemId` links to recipe content | Navigate to recipe detail view within the Mini App. If no linked recipe, show recipe name only with a "not stored yet" indicator. |
| **Current week + next week navigation** | Users plan ahead. Must be able to see next week's plan if it exists. | LOW | `getActivePlans()` returns current + next week | Simple week toggle or swipe between weeks. |
| **Today highlight** | Immediately see what is planned for today. Most important day in the view. | LOW | Compare `dayOfWeek` to current day | Visual emphasis: bolder border, background color, or "TODAY" label. |
| **Theme matching** | Same as grocery -- must look native to Telegram. | MEDIUM | None | ThemeParams CSS variables. |

### Table Stakes: Recipe Browser Mini App

| Feature | Why Expected | Complexity | Backend Dependency | Notes |
|---------|--------------|------------|-------------------|-------|
| **Recipe card list** | Visual browse of all stored recipes. Cards with title and summary. The reason this Mini App exists -- you cannot browse a knowledge base through conversation alone. | MEDIUM | `listByChatId()` exists, returns title + summary | Card layout with title, summary snippet, and tags. Paginated or virtual scroll for large collections. |
| **Search** | Type to filter recipes. Must match the FTS5 search that already powers the bot. | MEDIUM | `searchFts()` exists with BM25 ranking | Search bar at top. Debounced search as user types. Show results as cards. |
| **Full recipe detail view** | Tap a card to see the complete recipe -- ingredients, instructions, notes. | LOW | `getFullItem()` returns full `content` field | Content is stored as markdown/text. Render with basic formatting (bold, lists). |
| **Tag display** | Show recipe tags on cards for quick scanning (e.g., "quick", "Thai", "sous vide"). | LOW | Tags already stored in `knowledgeTags` | Pill/chip UI on each card. |
| **Back navigation within Mini App** | Card list -> recipe detail -> back to list. Must maintain scroll position and search state. | MEDIUM | None (client-side routing) | Use BackButton API. Maintain state in memory (no full page reload). |

### Differentiators (Competitive Advantage)

Features that make the Mini Apps feel like a real cooking partner, not just a generic UI.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Grocery: store-tab navigation** | Instead of scrolling a long list, tabs at the top for "Kroger" / "Costco". Tap the store you are currently in. No other meal planning TWA does multi-store tabbed navigation. | LOW | Straightforward tab UI; data already split by store. |
| **Grocery: haptic feedback on check** | Physical "thunk" when checking an item. Makes shopping feel satisfying and confirms the tap registered. Standard in native apps, rare in web-based Mini Apps. | LOW | `HapticFeedback.impactOccurred('light')` API available. |
| **Grocery: swipe to uncheck** | User checks wrong item, swipe left to uncheck. More natural than finding the item in "done" and tapping again. | MEDIUM | Swipe gesture detection in web. Must disable Telegram's vertical swipe-to-close via `disableVerticalSwipes()`. |
| **Meal plan: tap meal to open recipe** | Seamless flow from "what am I cooking tonight?" to seeing the full recipe. No other Telegram meal bot has visual plan-to-recipe navigation. | MEDIUM | Requires recipe browser view to be reachable from meal plan view. Shared component. |
| **Meal plan: visual meal type indicators** | Color-coded or icon-based indicators for breakfast/lunch/dinner. Quick visual parsing of the week without reading every label. | LOW | Simple CSS styling per meal type. |
| **Recipe: tag-based filtering** | Tap a tag to filter recipes. "Show me all 'quick' recipes" or "all 'Thai' recipes." Leverages the tag system already in the knowledge base. | MEDIUM | Need to fetch distinct tags, then filter by tag. Query exists via raw SQL. |
| **Recipe: "last cooked" date display** | On each recipe card, show when you last made this dish. "Pad Thai -- last cooked 3 weeks ago." Surfaces the cooking history data that no other app exposes at browse time. | MEDIUM | Requires joining `cooking_history` with `knowledge_items` on recipe name or `knowledgeItemId`. |
| **Recipe: tap to add to plan from browser** | While browsing recipes, tap "Add to plan" to slot a recipe into the current week. Bridges browse and planning. | HIGH | Requires write API endpoint. Must handle day/meal-type selection UI. Deferred to v1.2+. |
| **Grocery: "add item" from Mini App** | Quick-add an item to the list without returning to chat. Useful for items forgotten during planning. | MEDIUM | Need a write endpoint. Simple form: name, quantity, store, section (with defaults). |
| **MainButton integration** | Use Telegram's MainButton for the primary action in each context: "Done Shopping" in grocery, "This Week" in plan, "Search" in recipe. Native feel. | LOW | `MainButton.setText()`, `MainButton.show()` APIs. |

### Anti-Features (Do NOT Build)

| Feature | Why Tempting | Why Problematic | Alternative |
|---------|-------------|-----------------|-------------|
| **Drag-and-drop meal rearrangement** | Plan to Eat and Paprika have drag-drop calendars. Feels premium. | Drag-drop in a WebView is unreliable. Touch target accuracy is poor in Telegram's viewport. Swipe gestures conflict with Telegram's own swipe-to-close. Performance on Android WebView is inconsistent. This will feel janky, not premium. | To swap meals, return to chat: "swap Monday and Wednesday dinners." The bot handles this in one message. |
| **Offline grocery list** | "What if I lose signal in the store?" | Telegram Mini Apps have no guaranteed offline capability. DeviceStorage (5MB) exists but is not a full offline sync solution. Building offline-first adds massive complexity (sync conflicts, versioning, stale state). The target user (Apple ecosystem, US) rarely loses signal in a grocery store. | CloudStorage for small caches. Optimistic UI that does not block on network. If truly offline, the chat message with the text list is still visible. |
| **Recipe editing in Mini App** | "Let me fix this ingredient amount right here." | Recipe content is complex, freeform text. Building a recipe editor in a Mini App means designing a full form (ingredients list, instructions steps, notes) -- an entire app within an app. The existing conversational edit ("change the chicken to 3 lbs in the pad thai recipe") is faster and more flexible. | "Edit in chat" button that sends the user back to conversation with a prompt. |
| **Complex week-by-week navigation (infinite scroll back)** | "Show me what I cooked in January." | The plan view is for THIS week and NEXT week -- the actionable horizon. Historical browsing belongs in the cooking history context, not the planner. Building infinite week navigation adds complexity with near-zero value for a single user. | Current + next week only. For history, ask the bot ("what did I cook last month?"). |
| **Nutritional info on recipe cards** | "Show calories on each card." | Explicitly an anti-feature from v1.0 research. AI-estimated nutrition data is unreliable. Displaying unverified numbers looks authoritative and erodes trust. No nutrition database is integrated. | If a user stored nutritional info in their recipe text, it will appear in the recipe detail view naturally. Do not compute or display calculated macros. |
| **Real-time collaborative editing** | "My partner and I both check items simultaneously." | Single-user product. WebSocket real-time sync adds backend complexity for zero users. The partner can use the inline buttons in chat or open their own Mini App session, with eventual consistency via API. | Single-user optimistic updates. If partner checks an item via bot buttons, it appears checked when the Mini App user refreshes. |
| **Push notifications from Mini App** | "Remind me I need to buy milk." | Mini Apps are session-based. When closed, they cannot push. The bot already handles all notifications (prep reminders, daily summaries). Adding notification logic to the Mini App duplicates the bot's job. | All notifications stay in the bot. Mini Apps are view+interact only. |
| **Image/photo display for recipes** | "Show a photo of each dish." | No recipe photos exist in the data model. The knowledge base stores text only (title, summary, content). Adding image storage requires file hosting, image optimization, and a fundamentally different content pipeline. Images would also slow Mini App loading significantly. | Text-only recipe cards. The summary field provides enough context to identify dishes. If photos are added later (v2+), the card component can be extended. |

## Feature Dependencies

```
[Backend: REST API Layer]  <-- NEW: Required by all 3 Mini Apps
    |
    +---> [Auth: initData validation]  <-- Required before any data flows
    |
    +---> [Grocery List Mini App]
    |        |
    |        +-- Store-tab navigation (data: store field)
    |        +-- Section grouping (data: section field)
    |        +-- Tap-to-check (API: toggleItem)
    |        +-- Progress bar (computed from checked states)
    |        +-- Haptic feedback (client-only, TWA API)
    |
    +---> [Meal Plan Mini App]
    |        |
    |        +-- Week grid view (data: dayOfWeek + mealType)
    |        +-- Today highlight (client-side date comparison)
    |        +-- Tap meal -> recipe detail  ----+
    |        +-- Week navigation (data: getActivePlans) |
    |                                                    |
    +---> [Recipe Browser Mini App]  <-------------------+
             |
             +-- Card list (data: listByChatId)
             +-- Search (data: searchFts via API)
             +-- Tag filtering (data: knowledgeTags)
             +-- Recipe detail view (data: getFullItem)
             +-- Last cooked date (data: cooking_history join)
```

### Critical Path

1. **REST API layer** must exist before any Mini App can function. Currently the bot uses direct SQLite access. The Mini Apps need HTTP endpoints.
2. **Auth (initData validation)** is the security gate. Without it, anyone could call the API.
3. **Grocery list Mini App** should be built first -- highest user value, most concrete improvement over inline buttons, and simplest data model.
4. **Recipe browser** should come second because the meal plan "tap to see recipe" depends on having a recipe detail view component.
5. **Meal plan Mini App** should come last -- it requires the recipe detail component from the recipe browser, and the current text display is adequate (less painful than the grocery list).

## MVP Definition

### Launch With (v1.1)

The first Mini App release. Must feel complete for the features included.

**Grocery List Mini App (Priority 1 -- highest value, most pain solved):**
- [x] Store tabs (Kroger / Costco)
- [x] Section grouping within each store
- [x] Tap to check/uncheck with haptic feedback
- [x] Checked items in collapsed "Done" section
- [x] Progress indicator (per-store and overall)
- [x] Quantity + name display
- [x] Theme-aware (light/dark mode via ThemeParams)
- [x] MainButton: "Done Shopping" (marks list as completed)
- [x] Telegram BackButton to return to chat

**Meal Plan Mini App (Priority 2 -- visual upgrade):**
- [x] 7-day grid view (Monday-Sunday)
- [x] Meal type rows (dinner-only or multi-meal adaptive)
- [x] Today highlight
- [x] Current week / next week toggle
- [x] Tap meal name (shows recipe name; deep link to recipe detail if knowledgeItemId exists)
- [x] Theme-aware

**Recipe Browser Mini App (Priority 3 -- enables browsing, supports plan):**
- [x] Scrollable card list (title + summary + tags)
- [x] Search bar with debounced FTS5 search
- [x] Full recipe detail view (formatted content)
- [x] Tag pills on cards
- [x] BackButton navigation (list -> detail -> back)
- [x] Theme-aware

**Shared Infrastructure (required for all):**
- [x] REST API with initData HMAC-SHA256 validation
- [x] API endpoints: grocery list + items, meal plan + entries, knowledge items + search
- [x] Mini App entry points: web_app inline keyboard buttons in bot responses
- [x] Telegram Web App SDK integration

### Add After Validation (v1.2)

After the base Mini Apps are working and used regularly.

- [ ] **Grocery: swipe to uncheck** -- Swipe gesture adds polish but requires gesture library and swipe-conflict handling.
- [ ] **Grocery: quick-add item** -- Form to add forgotten items without returning to chat. Needs store/section picker with smart defaults.
- [ ] **Recipe: tag-based filtering** -- Tap a tag to filter the list. Needs tag aggregation endpoint.
- [ ] **Recipe: "last cooked" display** -- Join cooking_history to show recency on cards. Needs new query.
- [ ] **Meal plan: tap to open full recipe** -- Navigate from meal plan to recipe detail view. Needs shared routing between Mini Apps or embedded recipe component.
- [ ] **Grocery: uncheck all (reset)** -- Start a fresh shopping trip with the same list.

### Future Consideration (v2+)

- [ ] **Recipe: "Add to plan" button** -- From recipe browser, add to this week's plan. Requires day/meal-type picker UI and write API.
- [ ] **Grocery: item reordering within section** -- Manual sort for personal shopping route optimization.
- [ ] **Meal plan: cooking history overlay** -- Show "cooked 3x" indicators on recipes in the plan.
- [ ] **Shared Mini App shell** -- All three Mini Apps in one with bottom tab navigation instead of separate entry points.
- [ ] **Recipe: source link** -- If recipe has a URL source, show a link button.
- [ ] **Grocery: aisle number annotations** -- Per-store aisle mapping for even faster shopping.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| REST API + auth layer | CRITICAL | HIGH | P0 | Blocks everything. No API = no Mini Apps. |
| Grocery: tap-to-check with sections | HIGH | LOW | P1 | Core value. Most-used interaction. |
| Grocery: store tabs | HIGH | LOW | P1 | Kroger/Costco split is existing pain point. |
| Grocery: progress indicator | MEDIUM | LOW | P1 | Quick win, satisfying UX. |
| Grocery: haptic feedback | MEDIUM | LOW | P1 | Tiny cost, noticeable polish. |
| Grocery: theme matching | HIGH | MEDIUM | P1 | Looks broken without it. Non-negotiable. |
| Meal plan: week grid view | HIGH | MEDIUM | P1 | Primary visual upgrade over text. |
| Meal plan: today highlight | MEDIUM | LOW | P1 | Tiny cost, high orientation value. |
| Meal plan: week navigation | MEDIUM | LOW | P1 | Simple toggle, enables next-week viewing. |
| Recipe: card list + search | HIGH | MEDIUM | P1 | Enables browsing for first time. |
| Recipe: detail view | HIGH | LOW | P1 | Required for card list to be useful. |
| Recipe: tag display | MEDIUM | LOW | P1 | Already in data model. Low effort. |
| Grocery: swipe to uncheck | LOW | MEDIUM | P2 | Polish. Tap works fine for uncheck too. |
| Grocery: quick-add item | MEDIUM | MEDIUM | P2 | Useful but can return to chat instead. |
| Recipe: tag filtering | MEDIUM | MEDIUM | P2 | Search covers most cases. |
| Recipe: last cooked date | MEDIUM | MEDIUM | P2 | Valuable context but not blocking. |
| Plan: tap meal -> recipe | MEDIUM | MEDIUM | P2 | Requires cross-view navigation. |
| Recipe: add to plan | MEDIUM | HIGH | P3 | Complex UI (day/meal picker). |
| Grocery: item reorder | LOW | HIGH | P3 | Drag-drop in WebView is risky. |
| Shared Mini App shell | LOW | HIGH | P3 | Three entry points work fine for now. |

## Chat-to-Mini-App Interaction Patterns

### Pattern 1: Bot Message with WebApp Button

The primary entry point. After generating a grocery list or meal plan, the bot includes an inline keyboard button with `web_app` type.

```
Bot: "Here's your grocery list for this week!"
     [Open Grocery List]    <-- web_app button
     [View in Chat]         <-- fallback: shows text + inline buttons
```

### Pattern 2: Bot Menu Button

A persistent menu button in the chat header that opens a Mini App selector or the most relevant Mini App.

### Pattern 3: Mini App Closes, Bot Confirms

After the user finishes in the Mini App (e.g., marks shopping complete), the Mini App sends data back via `sendData()` or the API, and the bot sends a confirmation message in chat.

```
User: [closes Mini App after shopping]
Bot: "Shopping complete! 28/28 items checked off. Enjoy cooking this week!"
```

### Pattern 4: Deep Links Between Mini Apps

From the meal plan Mini App, tapping a recipe name opens the recipe detail. This can either navigate within the same Mini App (shared component) or open a new Mini App via Telegram deep link. Shared component within one app is preferred (faster, maintains context).

## Platform Constraints to Design Around

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| WebView performance varies (especially older Android) | Animations may stutter, long lists may lag | Virtual scrolling for recipe list. Minimal animations. Test on low-end device. |
| No offline guarantee | List disappears if signal drops | Optimistic UI. Cache current list state in DeviceStorage (5MB). Text list in chat serves as backup. |
| Viewport height changes during drag gestures | List may jump/resize while shopping | Use `viewportStableHeight` not `viewportHeight`. Disable vertical swipes via `disableVerticalSwipes()`. |
| 100-button limit on inline keyboards (chat) | Not a Mini App issue, but affects the fallback | Mini App has no button limit. This is a key reason to build it. |
| Session-based (no background processing) | Cannot send notifications from Mini App | All notifications remain in the bot. Mini App is view+interact only. |
| CloudStorage: 1024 items, 4KB each | Too small for full recipe cache | Use CloudStorage for preferences/settings only. Fetch data from API. |
| DeviceStorage: 5MB | Adequate for list cache, not full recipes | Cache active grocery list and current week plan. Fetch recipes on demand. |

## Sources

- [Telegram Mini Apps Official Documentation](https://core.telegram.org/bots/webapps) -- API reference, WebApp class, all methods and events (HIGH confidence)
- [Telegram Mini Apps Community Docs](https://docs.telegram-mini-apps.com/) -- Haptic feedback, swipe behavior, platform events (HIGH confidence)
- [TelegramUI React Component Library](https://github.com/telegram-mini-apps-dev/TelegramUI) -- Pre-built components for native Telegram look (HIGH confidence)
- [Telegram Mini Apps UI Kit (Figma)](https://www.figma.com/community/file/1348989725141777736/telegram-mini-apps-ui-kit) -- Design reference for Telegram-native UI patterns (MEDIUM confidence)
- [BAZU - Best Practices for UI/UX in Telegram Mini Apps](https://bazucompany.com/blog/best-practices-for-ui-ux-in-telegram-mini-apps/) -- Design principles, performance, accessibility (MEDIUM confidence)
- [Magnetto - Everything About Telegram Mini Apps 2026](https://magnetto.com/blog/everything-you-need-to-know-about-telegram-mini-apps) -- Platform overview, limitations, what not to build (MEDIUM confidence)
- [Ronasit - Telegram Mini App Examples](https://ronasit.com/blog/examples-of-telegram-mini-apps/) -- Real-world examples including food/grocery apps (MEDIUM confidence)
- [DurgerKingBot Demo](https://core.telegram.org/bots/webapps#implementing-mini-apps) -- Official Telegram food ordering Mini App example (HIGH confidence)
- [listOK - Telegram Shopping List Bot](https://shallowdepth.online/projects/listok/) -- Existing Telegram grocery list implementation (LOW confidence)
- [CNN - Best Meal Planning Apps 2026](https://www.cnn.com/cnn-underscored/reviews/best-meal-planning-apps) -- Feature expectations from native meal planning apps (MEDIUM confidence)
- [Tubik Studio - Recipe Card UI Experiments](https://blog.tubikstudio.com/ui-experiments-options-for-recipe-cards-in-a-food-app/) -- Recipe card design patterns (MEDIUM confidence)
- [Plan to Eat](https://www.plantoeat.com/) -- Competitor reference for meal plan calendar and grocery list features (MEDIUM confidence)

---
*Feature research for: Telegram Mini Apps (v1.1 milestone) -- HeySous Meal Planning Bot*
*Researched: 2026-02-09*
