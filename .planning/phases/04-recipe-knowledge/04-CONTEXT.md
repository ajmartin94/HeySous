# Phase 4: Recipe Knowledge - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can teach the bot their recipes through conversation and retrieve them anytime. The primary flow is the bot generating/proposing recipes on request, the user tweaking them, then saving. Users can also retrieve, update, and delete recipes conversationally. The bot reasons across the full recipe collection to answer comparative and filtering questions.

Out of scope: photo/image import, web page scraping, Telegram Mini Apps — these are future phases.

</domain>

<decisions>
## Implementation Decisions

### Capture flow
- Bot detects when a recipe is being shared/created and offers to save it (proactive detection + user confirmation)
- Primary flow: user asks bot to generate a recipe → bot proposes → user tweaks → bot saves
- Bot keeps prompting for missing details until the recipe is complete
- Everything before the first save is one "creation session" — bot accumulates all tweaks into a single final version
- Before saving, bot shows the full recipe summary (name, ingredients, steps, times, notes) for user approval

### Recipe structure
- Full detail: name, ingredients with quantities, numbered steps, prep/cook time, servings, notes
- Bot auto-tags recipes with metadata: cuisine type, meal type (dinner/lunch), protein, difficulty — user doesn't have to think about it
- Rich contextual notes preserved: tips, pairings, who likes it, when it works well ("good for weeknights", "kids love this", "pair with crusty bread")
- Changelog stored in DB for data mining potential, but NOT fed into agent context — agent always works with current version

### Retrieval & display
- Full formatted recipe displayed inline using HTML in Telegram when user asks for a specific recipe
- Multiple matches shown as a list with brief info (name, time, difficulty) — user picks one for full details
- Cross-recipe reasoning supported: "what's the quickest dinner?", "which recipes use chicken?" — bot queries across all recipes
- Contextual notes displayed inline with the recipe (tips, pairings, etc.)

### Updates & corrections
- Conversational partial updates: user says what changed, bot updates just that part without re-confirming the whole recipe
- Ambiguity resolved by asking: if "change the chicken recipe" matches multiple, bot lists them and asks which one
- Deletion supported with confirmation: "Delete the stromboli recipe" → "Are you sure?" → deleted

### Claude's Discretion
- Exact recipe display formatting layout within Telegram HTML constraints
- How to structure recipe data in the knowledge system (schema design)
- Tag taxonomy and auto-tagging logic
- How to handle recipe generation prompting (Claude's culinary knowledge)
- Changelog schema and what constitutes a "change" worth logging

</decisions>

<specifics>
## Specific Ideas

- "The vast majority of interactions will be the user asking the bot to make a recipe and tweaking it as needed" — bot is the chef, user is the editor
- Recipes are "rich context the agent reasons over, not rigid database records" — the knowledge system should treat them as living documents with notes, context, and history
- Future phases will add photo import and web scraping as additional recipe input methods

</specifics>

<deferred>
## Deferred Ideas

- Photo/image recipe import (snap a pic of a recipe) — future phase
- Web page recipe import (provide a URL) — future phase
- Telegram Mini Apps for recipe display — future phase
- Recipe versioning exposed to users (viewing history) — no current use case, but changelog data is stored

</deferred>

---

*Phase: 04-recipe-knowledge*
*Context gathered: 2026-02-06*
