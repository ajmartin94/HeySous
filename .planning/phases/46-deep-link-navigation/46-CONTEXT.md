# Phase 46: Deep-Link Navigation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can jump directly from Sous chat messages and reminders into the relevant Mini App view. Inline buttons on bot responses and reminders open specific recipes, the meal plan, or the grocery list in the Mini App.

</domain>

<decisions>
## Implementation Decisions

### Button attachment strategy
- **Two paths to buttons:**
  1. **Automatic** — When Claude calls `set_meal_plan`, `save_recipe`, or grocery tools, the system always attaches the relevant button without Claude doing anything. This is post-tool-call logic, not Claude's responsibility.
  2. **On-demand** — A new tool (e.g., `attach_deep_link`) lets Claude explicitly attach a button when the user requests navigation but no other tool was triggered (e.g., "show me that recipe", "open my grocery list").
- The on-demand tool can link to any Mini App destination: a specific recipe (by ID), the meal plan view, or the grocery list.
- **Remove the existing system prompt instruction** that tells Claude to paste a plain grocery list URL in text. The button approach replaces it entirely.

### Reminder buttons
- All reminders that reference a recipe get an inline button linking to that specific recipe in the Mini App.
- Not just cooking reminders — any reminder type that mentions a recipe.

### Recipe deep-link routing
- **URL query params** — `miniAppUrl + "/recipes?id=42"` — the Recipes page reads `?id` on mount and auto-opens the recipe detail for that ID.
- Plan and grocery open to their default views with no params needed.
- No new React Router routes required — existing SPA catch-all handles query params.

### Button density rules
- Single tool call → specific button (e.g., "View Recipe" linking to that recipe)
- Multiple tool calls of the same type in one response → one generic button (e.g., "View Recipes" linking to the recipes page)
- Mixed tool types in one response → multiple buttons, one per type (e.g., "View Plan" + "View Grocery List")

### Button labeling
- Follow the existing codebase pattern: "View Recipe", "View Recipes", "View Plan", "View Grocery List"
- Generic labels, no recipe names in button text

### Button delivery
- Buttons sent as a **separate message** immediately after the main response finalizes (not attached to the streamed message).
- Must be near-instantaneous — no perceptible delay for the user.

### Claude's Discretion
- Exact implementation of the on-demand tool interface (params, naming)
- How to detect "multiple same-type" tool calls for the collapsing logic
- How to extract recipe IDs from reminder data for button generation

</decisions>

<specifics>
## Specific Ideas

- The automatic path should feel invisible — users just see buttons appear after Sous does something, without Claude needing extra prompting
- The on-demand tool is for conversational moments where the user wants to jump to the app but didn't trigger a data-changing action

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InlineKeyboard` from grammY: already used for grocery toggle buttons, feedback sentiment, and `webApp()` buttons
- `keyboard.webApp(label, url)`: existing pattern for opening Mini App to specific pages (`/grocery`, `/plan`, `/help`)
- `config.miniAppUrl`: base URL already available in config
- `knowledgeItemId` on meal plan entries: bridges recipes to plans, provides the ID for deep links

### Established Patterns
- `web_app` buttons: `/grocery`, `/plan`, `/help` commands already attach these — deep links extend the same pattern
- Grocery buttons in `src/grocery/buttons.ts`: inline keyboard construction with callback data encoding
- Feedback buttons in `src/feedback/sender.ts`: example of attaching `reply_markup` to `bot.api.sendMessage()`

### Integration Points
- `src/pipeline/processor.ts`: streaming finalize path needs post-processing to send a follow-up message with buttons after tool calls
- `src/reminders/sender.ts`: `sendMessage()` call needs `reply_markup` support added (currently plain text only)
- `src/ai/tools.ts` + `src/ai/tool-handler.ts`: new on-demand deep-link tool definition and handler
- `src/ai/system-prompt.ts`: remove plain-URL grocery instruction, add on-demand tool guidance
- `mini-app/src/pages/Recipes.tsx`: read `?id` query param on mount, auto-open recipe detail

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-deep-link-navigation*
*Context gathered: 2026-03-04*
