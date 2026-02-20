---
phase: 28-recipe-url-import
type: context
created: 2026-02-20
---

# Phase 28 Context: Recipe URL Import

## Decision 1: URL detection strategy

**Decision:** Claude detects recipe URLs, not the bot. When a user sends a message containing a URL, Claude sees it and decides whether to call `import_from_url`. The bot does NOT pre-fetch URLs or detect them in the message handler. This follows the "Claude as reasoning engine" principle.

The system prompt instructs Claude that when a user shares a URL that looks like a recipe, Claude should call `import_from_url` to fetch and extract the recipe. If the URL is shared mid-conversation, Claude offers to import it rather than doing so automatically.

## Decision 2: Extraction pipeline (3-strategy)

**Decision:** Three strategies in order:
1. JSON-LD `<script type="application/ld+json">` with `@type: "Recipe"` (covers ~80% of recipe sites)
2. Microdata extraction via `itemprop` attributes (fallback for older sites)
3. Return raw truncated HTML text for Claude to parse (last resort)

Use cheerio for HTML parsing. No Puppeteer/headless browser -- recipe structured data is in the initial HTML response.

## Decision 3: Async tool handler

**Decision:** Make `handleToolCall` return `string | Promise<string>`. Update `claude-client.ts` to `await` the result using `Promise.all` on tool call map. Only the `import_from_url` case is actually async; all other cases return synchronously and the await is a no-op.

## Decision 4: Source URL storage

**Decision:** Add a `source_url` TEXT column to knowledge_items via migration 001 (the first actual migration since the runner was established in Phase 25 with no migrations yet). The column is nullable and only populated for URL-imported recipes. The `save_knowledge` tool gains an optional `source_url` parameter.

## Decision 5: Error handling and graceful degradation

**Decision:** Every failure mode returns a helpful suggestion:
- Network timeout (10s): "That URL is taking too long to respond. Try pasting the recipe text instead."
- 403/blocked: "That site seems to be blocking me. Try copy-pasting the recipe text."
- Non-recipe page: "I couldn't find a recipe on that page. Is it the right URL?"
- Paywall detected: "That recipe seems to be behind a paywall. Try pasting the text if you can see it."
- Response too large (>2MB): "That page is too large for me to process. Try sharing the recipe text."

## Decision 6: Recipe normalization

**Decision:** After extraction, normalize:
- Strip HTML tags from text fields
- Parse ISO 8601 durations (PT1H30M -> "1 hour 30 minutes")
- Clean SEO-bloated titles (strip " - RecipeSite.com" suffixes)
- Flatten instruction arrays into numbered steps
- Return structured data that Claude can format for the user

---
*Phase: 28-recipe-url-import*
*Created: 2026-02-20 (auto-generated during --auto advance)*
