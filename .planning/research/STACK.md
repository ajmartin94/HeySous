# Technology Stack

**Project:** HeySous v1.4 Backlog Sweep
**Researched:** 2026-02-19

## Recommended Stack

### One New Dependency (cheerio), Rest Existing

v1.4 requires **one new npm package** (cheerio for HTML parsing) and leverages existing dependencies for everything else. The Anthropic SDK (v0.73.0) already includes full vision/image types. grammY's built-in `ctx.getFile()` plus Node.js `fetch()` handles Telegram photo downloads without an additional plugin. The migration framework is a DIY pattern (~50 lines) using SQLite's `PRAGMA user_version`.

### Core Technologies (all existing)

| Technology | Version | Purpose | Why (for v1.4) |
|------------|---------|---------|----------------|
| Node.js | >= 22 | Runtime | Built-in `fetch()` for URL import and Telegram file download. `Buffer.from()` for base64 encoding. |
| TypeScript | ^5.9.3 | Language | Existing. Anthropic SDK types include `ImageBlockParam`, `Base64ImageSource`, `URLImageSource`. |
| @anthropic-ai/sdk | ^0.73.0 | AI | Already supports vision/multimodal messages. No upgrade needed. Verified in installed `node_modules`. |
| grammY | ^1.39.3 | Bot framework | `ctx.getFile()` returns file path. `message:photo` filter for photo handling. No plugin needed. |
| better-sqlite3 | ^12.6.2 | Database | Synchronous API ideal for migration runner. `PRAGMA user_version` for migration tracking. Transaction support for atomic migrations. |
| Drizzle ORM | ^0.45.1 | ORM | Existing. Schema definitions if needed for new columns. |
| Express | ^5.2.1 | HTTP server | No changes needed for v1.4. |
| Pino | ^10.3.0 | Logging | Migration runner and import operations use existing logger. |

### New Dependency

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **cheerio** | ^1.2.0 | HTML parsing for recipe URL import | Extracts JSON-LD `<script>` tags AND Microdata `itemprop` attributes from recipe pages. 28M+ weekly downloads, actively maintained, lightweight (~1MB). Handles edge cases (malformed HTML, multiple script tags, `@graph` patterns) that regex cannot. |

### URL Import Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| HTTP fetching | Node.js built-in `fetch()` | Stable since Node 21. Zero dependencies. Handles redirects, timeouts, streaming. |
| HTML parsing | cheerio ^1.2.0 | Parse HTML, extract `<script type="application/ld+json">` content, handle `@graph` nesting, extract Microdata `itemprop` attributes as fallback. |
| JSON-LD parsing | `JSON.parse()` | Standard. JSON-LD content is valid JSON once extracted from script tag. |
| Claude fallback | Existing @anthropic-ai/sdk | When no structured data found, send page text to Claude for extraction. |

**Why cheerio over regex:**

Regex CAN extract JSON-LD from `<script>` tags (~80% of recipe sites), and some prior analysis suggested this is sufficient with Claude as fallback. However, cheerio is recommended because:

1. **Microdata support.** Some recipe sites (especially older ones, food blogs with custom themes) use Microdata (`itemprop="recipeIngredient"`) instead of JSON-LD. Cheerio handles both; regex only handles JSON-LD.
2. **Robustness.** Real-world HTML has malformed tags, multiple JSON-LD blocks (some for BreadcrumbList, some for Recipe), HTML comments, CDATA sections. Cheerio's parser handles all of this. Regex handles the common case but breaks on edge cases.
3. **Marginal cost.** cheerio is ~1MB in node_modules with its parse5/htmlparser2 dependencies. The project already has 200MB+ of node_modules. This is noise.
4. **Maintenance.** A 5-line cheerio extraction is easier to understand and debug than a regex with capture groups and post-processing.

**If the team strongly prefers zero new dependencies**, a regex approach works for the MVP:
```typescript
const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
```
This handles ~80% of recipe sites. Claude fallback covers the rest. The cost is that Microdata-only sites go straight to Claude fallback (more token usage, slightly slower), and debugging HTML edge cases becomes harder.

**Recommendation: use cheerio.** The dependency is tiny, well-maintained, and eliminates a class of edge-case bugs.

### Photo Import Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Photo detection | grammY `bot.on("message:photo")` | Built-in message filter. No plugin needed. |
| File info | grammY `ctx.getFile()` | Returns `File` object with `file_path`. No plugin needed. |
| File download | Node.js `fetch()` | Construct URL: `https://api.telegram.org/file/bot${token}/${file.file_path}`. |
| Base64 encoding | `Buffer.from(arrayBuffer).toString("base64")` | Node.js built-in. |
| Vision API | @anthropic-ai/sdk `ImageBlockParam` | `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }` |
| MIME type | Hardcoded `"image/jpeg"` | Telegram sends photos as JPEG. For documents (PDFs, etc.), detect from filename. |

**Why NOT `@grammyjs/files` plugin:**

The official grammY files plugin adds a `.download()` convenience method to `getFile()` results. However:
- Photo download is 5 lines of code: `getFile()` + construct URL + `fetch()` + `arrayBuffer()` + `Buffer.from()`
- The plugin saves ~3 lines but adds a dependency and requires `FileFlavor` context type extension
- The manual approach is transparent and debuggable

The plugin is fine if the team prefers it (`npm install @grammyjs/files`), but it is not necessary.

### Migration Framework - DIY with user_version

| Component | Mechanism |
|-----------|-----------|
| Version tracking | `PRAGMA user_version` -- SQLite built-in integer, no extra table needed |
| Migration execution | better-sqlite3 transactions for atomicity |
| Migration discovery | Static import array in migration runner (avoids filesystem reads) |
| Version ordering | Integer versions: 1, 2, 3... |

**Why `user_version` over a `schema_migrations` table:**

- `user_version` is a single integer pragma built into SQLite -- zero schema overhead
- Reads with `sqlite.pragma("user_version", { simple: true })`
- Writes with `sqlite.pragma("user_version = N")`
- Simpler than creating and querying a migrations table
- Sufficient when migrations are strictly sequential (no cherry-picking)

**Migration runner pattern (~50 LOC):**
```typescript
interface Migration {
  version: number;
  description: string;
  up(sqlite: BetterSqlite3.Database): void;
}

export function runMigrations(
  sqlite: BetterSqlite3.Database,
  migrations: Migration[],
  logger: Logger,
): void {
  const current = sqlite.pragma("user_version", { simple: true }) as number;
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const pending = sorted.filter(m => m.version > current);

  for (const migration of pending) {
    logger.info({ version: migration.version, description: migration.description }, "Running migration");
    sqlite.transaction(() => {
      migration.up(sqlite);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();
  }

  if (pending.length > 0) {
    logger.info({ from: current, to: pending[pending.length - 1].version, count: pending.length }, "Migrations complete");
  }
}
```

**First migration:**
```typescript
// src/db/migrations/001-add-source-url.ts
export const migration: Migration = {
  version: 1,
  description: "Add source_url column to knowledge_items",
  up(sqlite) {
    sqlite.exec(`ALTER TABLE knowledge_items ADD COLUMN source_url TEXT`);
  },
};
```

### Knowledge Dedup, Bot Notifications, Notification Tone

These features require **zero new dependencies**:

| Feature | Stack Impact | Notes |
|---------|-------------|-------|
| Knowledge dedup | None | Pre-save FTS5 title search in `save_knowledge` tool handler. Existing retrieval service. |
| Bot update notifications | None | `bot.api.sendMessage()` from grammY. Iterate users table. Rate-limit with `setTimeout`. |
| Notification tone overhaul | None | System prompt text changes in `src/ai/system-prompt.ts`. Pure content work. |

---

## Anthropic Vision API Reference

Verified against installed `@anthropic-ai/sdk@0.73.0` type definitions in `node_modules`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Image content block (from SDK types: ImageBlockParam, Base64ImageSource)
const imageBlock: Anthropic.ImageBlockParam = {
  type: "image",
  source: {
    type: "base64",                    // or "url" (URLImageSource)
    media_type: "image/jpeg",          // "image/jpeg" | "image/png" | "image/gif" | "image/webp"
    data: "<base64-encoded-string>",   // without data: URI prefix
  },
};

// Mixed content message for photo + text
const message: Anthropic.MessageParam = {
  role: "user",
  content: [
    imageBlock,
    { type: "text", text: "Extract the recipe from this photo." },
  ],
};

// This works with existing sendMessageWithTools() -- the messages array
// already accepts Anthropic.MessageParam[], which supports content arrays.
```

**SDK type hierarchy (verified in node_modules):**
```
ContentBlockParam = TextBlockParam | ImageBlockParam | DocumentBlockParam | ...
ImageBlockParam = { type: "image", source: Base64ImageSource | URLImageSource }
Base64ImageSource = { type: "base64", media_type: "image/jpeg"|"image/png"|"image/gif"|"image/webp", data: string }
URLImageSource = { type: "url", url: string }
```

**Image constraints (from official docs):**

| Property | Value |
|----------|-------|
| Supported formats | JPEG, PNG, GIF, WebP |
| Max file size (API) | 5 MB per image |
| Max dimensions | 8000x8000 px (single image), 2000x2000 px (>20 images) |
| Optimal size | 1568px max on long edge, ~1600 tokens |
| Token formula | `tokens = (width * height) / 750` |
| Placement | Images before text in content array for best results |
| Telegram photos | JPEG, typically ~1280px on long edge, well within all limits |

---

## Installation

```bash
# One new production dependency
npm install cheerio

# If team prefers the grammY files plugin (optional convenience):
# npm install @grammyjs/files
```

**Total dependency impact:**
- cheerio ^1.2.0 -- adds parse5, htmlparser2, domhandler, domutils, dom-serializer (~1MB total)
- No new dev dependencies

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTML parsing | cheerio ^1.2.0 | Regex extraction | Regex works for JSON-LD (~80% of sites) but fails on Microdata, malformed HTML, multiple script tags with different types. cheerio handles all cases for ~1MB of dependencies. |
| HTML parsing | cheerio ^1.2.0 | jsdom, linkedom | jsdom is heavy (~9MB, full browser DOM). linkedom is lighter but less established. cheerio is purpose-built for extraction. |
| HTTP client | Node.js `fetch()` | axios, got, node-fetch | Zero-dependency approach. Built-in fetch is stable in Node 22. |
| Recipe extraction | cheerio + Claude fallback | recipe-data-scraper, @dimfu/recipe-scraper | All recipe-scraper packages have <100 weekly downloads, fragile site-specific logic, risk of abandonment. |
| Photo download | Manual `getFile()` + `fetch()` | @grammyjs/files plugin | Plugin saves ~3 lines but adds dependency and context type changes. Manual approach is 5 lines and fully transparent. |
| Vision API | Existing @anthropic-ai/sdk | OpenAI Vision, Google Vision | Already using Anthropic. SDK already has types. No reason for second AI provider. |
| Migration tracking | `PRAGMA user_version` | `schema_migrations` table | user_version is simpler, zero schema overhead. Sufficient for sequential migrations. |
| Migration framework | DIY ~50 LOC | @blackglory/better-sqlite3-migrations | Library has ~4 weekly downloads. DIY is same amount of code with no dependency. |
| Migration framework | DIY ~50 LOC | drizzle-kit migrations | drizzle-kit generates migrations from schema diffs. Project uses `CREATE TABLE IF NOT EXISTS` init pattern. Paradigm mismatch. |
| Image processing | None (raw buffer) | sharp, jimp | Telegram photos are JPEG, ~1280px, <5MB. Within Anthropic limits. No processing needed. |

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Puppeteer / Playwright** | Headless browser for recipe scraping adds 200MB+ Chromium, seconds of latency, massive memory. JSON-LD extraction + Claude fallback handles everything. |
| **Any recipe-scraper npm package** | Fragmented ecosystem (<100 downloads each), abandoned/archived repos, brittle site-specific scrapers. |
| **sharp / jimp** | Image processing not needed. Telegram photos fit within Anthropic API limits without resizing. |
| **Spoonacular / Edamam APIs** | External API keys, rate limits, ongoing costs. Claude already handles recipe extraction. |
| **jsdom** | Full browser DOM simulation (~9MB) for a task that needs jQuery-like selectors on static HTML. cheerio is 10x lighter. |
| **Tesseract.js** | OCR library. Claude vision handles text extraction natively, including handwriting. |

---

## Sources

### HIGH Confidence (verified against installed code / official docs)
- Anthropic Vision docs: https://platform.claude.com/docs/en/docs/build-with-claude/vision
- Anthropic SDK types: verified in `/workspace/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` -- `ImageBlockParam`, `Base64ImageSource`, `URLImageSource` confirmed
- Installed SDK version: `@anthropic-ai/sdk@0.73.0` confirmed in package.json
- grammY file handling: https://grammy.dev/guide/files -- `ctx.getFile()` returns `File` with `file_path`
- grammY files plugin: https://grammy.dev/plugins/files -- v1.2.0 (optional, not recommended)
- cheerio: https://cheerio.js.org/ -- v1.2.0, 28M+ weekly downloads, actively maintained
- Node.js built-in fetch: stable since Node 21, project requires Node 22
- SQLite `PRAGMA user_version`: standard SQLite feature, well-documented

### MEDIUM Confidence (web search, multiple sources agree)
- JSON-LD recipe extraction pattern: https://www.raymondcamden.com/2024/06/12/scraping-recipes-using-nodejs-pipedream-and-json-ld
- Schema.org Recipe type: https://schema.org/Recipe
- Recipe scraper library ecosystem assessment: based on GitHub stars, npm downloads, last commit dates across recipe-scraper, @dimfu/recipe-scraper, recipe-data-scraper, scrape-recipe-schema

### LOW Confidence (estimates, not measured)
- "~80% of recipe sites have JSON-LD" -- based on Google's structured data requirements for rich snippets, not empirically measured
- Telegram photo typical size (~1280px JPEG) -- from documentation patterns, not tested with real devices
