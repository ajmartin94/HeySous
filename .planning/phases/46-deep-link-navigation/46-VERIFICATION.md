---
phase: 46-deep-link-navigation
verified: 2026-03-04T05:55:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
gaps: []
---

# Phase 46: Deep-Link Navigation Verification Report

**Phase Goal:** Inline buttons in Sous responses link directly to Mini App content
**Verified:** 2026-03-04T05:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

Phase 46 delivers deep-link navigation from Telegram chat messages and reminders into the Mini App. The goal is fully achieved: both plans executed exactly as written, TypeScript compiles cleanly, and all four NAV requirements are satisfied.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A deep-link builder module exists that constructs InlineKeyboard objects for recipe, plan, and grocery destinations | VERIFIED | `src/deep-links/builder.ts` exports `buildDeepLinkKeyboard` and `buildDeepLinksFromToolCalls`; handles all 4 destination types |
| 2 | An attach_deep_link tool is registered that Claude can call to provide navigation buttons on demand | VERIFIED | `DEEP_LINK_TOOLS` array in `src/ai/tools.ts` contains `attach_deep_link`; imported and spread into `allTools` in `processor.ts` |
| 3 | The system prompt no longer tells Claude to paste plain grocery URLs in text | VERIFIED | `buildPantryResponsePrompt()` contains no URL format instruction; no "Format the link as a plain URL" or `miniAppUrl` interpolation for grocery links |
| 4 | The Mini App Recipes page reads ?id query param on mount and auto-opens that recipe's detail view | VERIFIED | `Recipes.tsx` uses `useSearchParams`, parses `id`, passes `initialRecipeId` to `useRecipes()`; hook runs `fetchDetail` on mount via `useEffect` |
| 5 | After Claude calls save_meal_plan, the user automatically sees a "View Plan" button | VERIFIED | Processor tracks tool calls via `trackingHandler`; `buildDeepLinksFromToolCalls` maps `save_meal_plan` -> `{ type: "plan" }`; button sent via `ctx.reply("Open in app:", { reply_markup: keyboard })` |
| 6 | After Claude calls save_grocery_list or update_grocery_list, the user automatically sees a "View Grocery List" button | VERIFIED | Both tools in `GROCERY_TOOLS` set tracked by `buildDeepLinksFromToolCalls`; produces `{ type: "grocery" }` target |
| 7 | After Claude calls save_knowledge (recipe save), the user automatically sees a "View Recipe" button | VERIFIED | `save_knowledge` in `RECIPE_TOOLS`; builder extracts `id` from result JSON and produces `{ type: "recipe", recipeId }` |
| 8 | After Claude calls attach_deep_link, the user sees the requested navigation button | VERIFIED | Tool handler returns marker JSON `{ deep_link: true, target, recipe_id }`; processor parses this in `explicitLinks` loop and builds keyboard |
| 9 | Multiple tool types in one response produce multiple buttons (one per type) | VERIFIED | Deduplication logic in processor merges explicit and auto targets by type, one entry per type |
| 10 | Cooking reminders that reference a recipe include an inline "View Recipe" button | VERIFIED | `sender.ts` imports `buildDeepLinkKeyboard`; section 3b checks `context.knowledgeItemId` and builds keyboard; passed as `reply_markup` in sendMessage options |
| 11 | Buttons are sent as a separate message immediately after the main response | VERIFIED | Deep-link send block at label `l3` is placed after `streamSender.finalize()` / `sendFormattedMessage()`, wrapped in try/catch, uses `ctx.reply("Open in app:", { reply_markup: keyboard })` |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/deep-links/builder.ts` | InlineKeyboard construction for all Mini App destinations | VERIFIED | 167 lines; exports `DeepLinkTarget` type, `buildDeepLinkKeyboard`, `buildDeepLinksFromToolCalls`; handles recipe/recipes/plan/grocery; returns null when `config.miniAppUrl` not set |
| `src/ai/tools.ts` | attach_deep_link tool definition | VERIFIED | `DEEP_LINK_TOOLS` array at line 626; `attach_deep_link` with target enum and optional recipe_id |
| `src/ai/tool-handler.ts` | attach_deep_link handler returning marker JSON | VERIFIED | `case "attach_deep_link"` at line 1232; validates target and recipe_id; returns `{ deep_link: true, target, recipe_id }` |
| `src/ai/system-prompt.ts` | Updated prompt without plain grocery URL instruction | VERIFIED | `buildPantryResponsePrompt()` contains no URL format instruction; `DEEP_LINK_PROMPT` added with `<deep_links>` section when miniAppUrl configured |
| `mini-app/src/pages/Recipes.tsx` | Query param ?id handling on mount | VERIFIED | `useSearchParams` at line 16; parses `id`; passes `initialRecipeId` to `useRecipes()` |
| `mini-app/src/hooks/useRecipes.ts` | initialRecipeId parameter and auto-open effect | VERIFIED | `export function useRecipes(initialRecipeId?: number)` at line 40; `useEffect` at line 149 triggers `fetchDetail(initialRecipeId)` on mount |
| `src/pipeline/processor.ts` | Post-response deep-link button injection | VERIFIED | `buildDeepLinksFromToolCalls` and `buildDeepLinkKeyboard` imported at line 60; `trackedToolCalls` array at line 488; `trackingHandler` wrapper at line 489; l3 deep-link send block at line 729 |
| `src/reminders/sender.ts` | Inline keyboard buttons on reminder messages | VERIFIED | `buildDeepLinkKeyboard` imported at line 13; `BotApi` interface includes `reply_markup?: unknown`; section 3b at line 309 builds keyboard when `knowledgeItemId` present; spread into sendMessage options |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/deep-links/builder.ts` | `config.miniAppUrl` | URL construction | VERIFIED | Line 24: `if (!config.miniAppUrl) return null`; all URL strings use `config.miniAppUrl + "/..."` |
| `mini-app/src/pages/Recipes.tsx` | `useRecipes.openDetail` via ?id | useEffect on mount reading ?id | VERIFIED | `searchParams.get('id')` -> `initialRecipeId` -> `useRecipes(initialRecipeId)`; hook effect calls `fetchDetail` |
| `src/pipeline/processor.ts` | `src/deep-links/builder.ts` | import buildDeepLinksFromToolCalls, buildDeepLinkKeyboard | VERIFIED | Line 60: `import { buildDeepLinksFromToolCalls, buildDeepLinkKeyboard } from "../deep-links/builder.js"` |
| `src/pipeline/processor.ts` | `ctx.reply` with reply_markup | separate message after finalize | VERIFIED | Line 770: `await ctx.reply("Open in app:", { reply_markup: keyboard })` inside l3 block |
| `src/reminders/sender.ts` | `src/deep-links/builder.ts` | import buildDeepLinkKeyboard | VERIFIED | Line 13: `import { buildDeepLinkKeyboard } from "../deep-links/builder.js"` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NAV-01 | 46-01, 46-02 | Sous responses include inline keyboard buttons to open referenced recipes in Mini App | SATISFIED | `save_knowledge` tracked -> `{ type: "recipe", recipeId }` -> keyboard sent; `attach_deep_link` tool available for on-demand recipe buttons |
| NAV-02 | 46-02 | Sous responses include inline keyboard buttons to open meal plan view in Mini App | SATISFIED | `save_meal_plan` / `get_meal_plan` tracked -> `{ type: "plan" }` -> "View Plan" button sent |
| NAV-03 | 46-01, 46-02 | Sous responses include inline keyboard buttons to open grocery list in Mini App | SATISFIED | `save_grocery_list` / `update_grocery_list` / `get_grocery_list` tracked -> `{ type: "grocery" }` -> "View Grocery List" button sent |
| NAV-04 | 46-02 | Cooking reminders include a button to open the relevant recipe directly | SATISFIED | `sender.ts` section 3b: `buildDeepLinkKeyboard([{ type: "recipe", recipeId: context.knowledgeItemId }])` attached to `start_cooking` and `prep_alert` reminders |

All 4 NAV requirements from REQUIREMENTS.md are satisfied. No orphaned requirements for Phase 46.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/ai/system-prompt.ts` line 198 | Residual reference "include the grocery list link so users can view and manage their list visually" that points to a `<pantry_response>` section which no longer contains a URL format | Info | Claude won't have a URL format to use; automatic buttons from processor cover this; minor prompt inconsistency only |

No blocker or warning anti-patterns found. The residual sentence at line 198 is informational only -- the `<pantry_response>` section it references contains no URL format instruction, so Claude cannot paste a plain URL.

### Human Verification Required

None. All critical behaviors are verifiable programmatically. The visual appearance of inline buttons in Telegram and the Mini App deep-link navigation UX would benefit from manual testing but are not blocking.

### Build and Test Results

- **TypeScript typecheck:** Passes with zero errors (`npm run typecheck`)
- **Test suite:** 258 passed, 3 failed -- the 3 failures are pre-existing in `tests/notifications/update-notifier.test.ts` (unrelated to Phase 46, confirmed by SUMMARY.md and present on base branch)

### Summary

Phase 46 goal fully achieved. All infrastructure is wired:

1. **Builder module** (`src/deep-links/builder.ts`) -- creates `InlineKeyboard` objects for all Mini App destinations; returns null gracefully when `miniAppUrl` not configured.

2. **on-demand tool** (`attach_deep_link` in `tools.ts` + `tool-handler.ts`) -- Claude can explicitly attach navigation buttons; returns marker JSON for processor.

3. **Automatic injection** (`processor.ts`) -- `trackingHandler` wraps `instrumentedHandler` to collect all tool calls; post-response l3 block merges explicit and auto targets, sends `"Open in app:"` message with `InlineKeyboard`.

4. **Reminder buttons** (`sender.ts`) -- `buildDeepLinkKeyboard` called in section 3b when `knowledgeItemId` present; attached to `start_cooking` and `prep_alert` reminders.

5. **Mini App routing** (`Recipes.tsx` + `useRecipes.ts`) -- `?id` query param parsed and passed to hook; `useEffect` auto-opens recipe detail on mount.

---

_Verified: 2026-03-04T05:55:00Z_
_Verifier: Claude (gsd-verifier)_
