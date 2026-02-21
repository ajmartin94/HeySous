# Meal Planning Assistant

## What This Is

A conversational AI meal planning assistant on Telegram powered by Claude. Users talk to it like a cooking partner with perfect memory -- teaching it recipes, getting weekly dinner plans, managing grocery lists, receiving prep reminders, and giving feedback that improves future planning. Agent-first architecture: the LLM reasons over a knowledge store, capabilities emerge from good context + good reasoning.

## Core Value

The recipe brain -- the system remembers everything about your meals (recipes, your actual prep times, what worked, what didn't) and reasons over that knowledge to help you plan. If this doesn't work, nothing else matters.

## Architectural Principle: Agent-First, Not Database-First

**This is an AI agent with a memory store, NOT a recipe database with a chatbot UI.**

The LLM is the product. It reasons, decides what to look up, and acts on what it finds. Capabilities emerge from the agent having good context and good reasoning -- not from features being individually coded as database query paths.

**What this means concretely:**
- Knowledge (recipes, preferences, history) is stored as rich context the agent retrieves and reasons over -- not as normalized tables with ingredient columns designed for specific query patterns
- "Search by ingredient" is not a feature. The agent understands "I have chicken in my freezer" and decides what to look up.
- General-purpose retrieval: the agent gets a query interface and decides what to search for. We don't build separate search-by-X features.
- Flexibility over structure. Ad-hoc information ("I have chicken in my freezer", "we're eating lighter this week") lives in conversation context. No inventory tables, no structured input forms.
- If a capability requires a purpose-built database feature rather than agent reasoning over stored knowledge, that's a red flag -- question whether the architecture is right.

**Why this matters:** Previous attempts at this idea devolved into recipe catalog apps. The value is the agent's reasoning, not the data structure.

## Requirements

### Validated

- ✓ Conversational recipe entry -- tell the bot about a recipe and it captures and stores it — v1.0
- ✓ Recipe retrieval and knowledge -- ask for any stored recipe; system remembers notes, actual times, feedback — v1.0
- ✓ Weekly meal planning -- generate a week of dinners based on your recipes, constraints, and preferences — v1.0
- ✓ Grocery list generation -- aggregate ingredients from the plan, checkable in chat, split by store (Kroger/Costco) — v1.0
- ✓ Daily prep reminder -- morning message summarizing what needs doing today (defrost, marinate, etc.) — v1.0
- ✓ Time-aware prep reminders -- specific timed reminders based on recipe analysis ("take chicken out at 8am") — v1.0
- ✓ Post-meal feedback loop -- bot offers to capture how dinner went, learnable feedback — v1.0
- ✓ Preference learning -- system accumulates knowledge from conversation (dinner time, stores, allergies, goals) — v1.0
- ✓ Cooking history and "haven't made lately" -- track what was cooked, surface forgotten favorites during planning — v1.0
- ✓ General-purpose context retrieval -- agent decides what knowledge to look up per conversation, not feature-specific queries — v1.0

- ✓ Telegram Mini App infrastructure (auth, API layer, React SPA, hub dashboard) — v1.1
- ✓ Grocery list Mini App (checkable list, store tabs, sections, haptic feedback, quick-add, polling sync) — v1.1
- ✓ Recipe browser Mini App (FTS5 search, tag filter, sort, recipe detail, scroll preservation) — v1.1
- ✓ Weekly meal plan Mini App (7-day grid, swipe weeks, today highlight, recipe drill-down) — v1.1

- ✓ Gated invite system with deep link tokens (no unfiltered access) — v1.2
- ✓ Guided onboarding flow (preference Q&A → tour → seed recipes) — v1.2
- ✓ Multi-user support with per-user identity — v1.2
- ✓ Household sharing (shared recipes, meal plans, grocery lists) — v1.2
- ✓ App feedback system (/feedback command, silent detection, hub button, periodic check-in, admin dashboard) — v1.2
- ✓ User help functionality (/help command, Mini App help page) — v1.2

- ✓ Implicit recipe card creation (Sous proactively recognizes recipes without explicit commands) — v1.3 Phase 21
- ✓ Implicit preference detection (Sous saves preferences from natural conversation) — v1.3 Phase 21
- ✓ Improved pantry check response (Mini App link or conversational walk-through) — v1.3 Phase 21
- ✓ Recipe variation handling (in-place updates + inline substitution notes) — v1.3 Phase 22
- ✓ Grocery store preferences saved and used in list generation — v1.3 Phase 22
- ✓ Remove "done shopping" button from grocery lists (overflow menu with confirmation) — v1.3 Phase 22
- ✓ Delete button on recipe cards in Mini App — v1.3 Phase 23
- ✓ Tag click filtering in recipe browser — v1.1 Phase 13 (validated v1.3 Phase 23)
- ✓ Onboarding pushes users to add existing recipes first — v1.3 Phase 24
- ✓ Fix intermittent date bugs in meal plans (timezone-aware date pipeline) — v1.3 Phase 20
- ✓ Fix start_cooking reminder to account for prep time — v1.3 Phase 20
- ✓ Data migration framework: lightweight numbered migration runner with PRAGMA user_version — v1.4 Phase 25
- ✓ Knowledge dedup: save_knowledge returns existing match instead of creating duplicates; update_knowledge rejects no-op calls — v1.4 Phase 26
- ✓ Notification tone: centralized message module with Sous personality variants for all bot-initiated messages — v1.4 Phase 27
- ✓ Recipe import from URL: fetch and parse recipe from a link (JSON-LD/Microdata/Claude fallback) — v1.4 Phase 28
- ✓ Recipe import from photo: use Claude vision to extract recipe from images — v1.4 Phase 29
- ✓ Bot update notifications: lazy-delivery "what's new" per household — v1.4 Phase 30
- ✓ Audit defect fixes: migration fresh-install guard, source_url end-to-end, BM25 threshold — v1.4 Phase 31

### Active

v1.5 Agent Hardening & Polish -- security, resilience, performance, prompt quality, observability, UI/UX, docs. See REQUIREMENTS.md.

### Out of Scope

- Voice interaction / cooking mode -- future capability
- Monetization / paid features -- personal dogfooding first
- Nutritional tracking / calorie counting -- changes product from cooking partner to diet app
- Recipe catalog / discovery database -- this is YOUR recipes, not a browsable catalog
- Grocery delivery integration -- user shops in-person at Kroger/Costco

## Context

- **Current state:** v1.5 in progress. 31 phases across 5 milestones shipped. 66 plans total. ~13,177 LOC TypeScript.
- **Tech stack:** Node.js 22, TypeScript (ESM), grammY, better-sqlite3/Drizzle, Anthropic SDK, Pino, Express, React+Vite (Mini App SPA), @telegram-apps SDK, cheerio (URL import)
- **Primary user:** Home cook who loves cooking, time-constrained on weekdays, more flexible weekends
- **Household:** Partner + 9-month-old. Partner now has access via invite system (v1.2).
- **Dinner target:** 6pm daily
- **Shopping:** Kroger (primary), Costco (bulk) -- store preferences now factored into grocery lists (v1.3)
- **Devices:** Apple ecosystem (iPhone, iPad) -- Telegram works cross-platform
- **First-run flow:** Onboarding guides new users through preferences → tour → seed 3-5 go-to recipes (v1.3 refinement)
- **Mini App model:** Hybrid — bot stays primary, Mini Apps open from chat buttons for visual tasks
- **Frontend:** React+Vite SPA inside Telegram Web Apps, served by existing Express server at /app/*
- **Known issues:** 26 audit findings (security, resilience, performance, prompt quality -- see v1.5 requirements)
- **Next step:** v1.5 execution

## Current Milestone: v1.5 Agent Hardening & Polish

**Goal:** Harden the Sous agent against security, cost, and resilience gaps identified by a comprehensive 3-agent audit. Improve prompt quality, add observability, optimize performance, and polish UI/UX.

**Target features:**
- Security: rate limiting, input validation, prompt injection defense
- Resilience: 429 backoff, race condition fix, context overflow detection
- Performance: N+1 fix, prompt caching, token estimation, streaming
- Prompt quality: conflicting instructions, durability signals, persona unification
- Observability: tool call logging, error sanitization, model pricing
- UI/UX: Mini App theming/accessibility, admin dashboard
- Docs: help page release process

## Previous Milestone: v1.4 Backlog Sweep — SHIPPED 2026-02-21

**Delivered:** Recipe import (URL + photo), knowledge dedup, Sous-personality notifications, update notifications, migration framework.

See .planning/MILESTONES.md for full history of all 5 milestones.

## Constraints

- **Platform**: Telegram Bot API -- conversation-first, push notifications via Telegram
- **AI**: Claude as the reasoning engine -- called on-demand, not running continuously
- **Architecture**: Thin backend orchestrator -- handles webhooks, storage, scheduling; Claude reasons on demand
- **Language/Framework**: Node.js 22 + TypeScript + grammY (Telegram) + @anthropic-ai/sdk (Claude)
- **Hosting**: Railway (webhook handling, persistent volume for SQLite, cron jobs)
- **Knowledge storage**: SQLite via better-sqlite3 + Drizzle ORM -- agent retrieves relevant context per request within a token budget (~4K tokens), not full dump
- **Interface**: Hybrid -- bot conversation primary, Telegram Mini Apps for visual interactions (v1.1)
- **Users**: Multi-user with household sharing (v1.2)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram as platform | Conversational interface native and polished, push notifications reliable, Mini Apps available later, no app store process | ✓ Good -- works well for solo user, push notifications reliable |
| Bot-only v1 (no Mini Apps) | Reduces frontend complexity significantly, text-based lists workable for solo user | ✓ Good -- shipped faster, inline buttons provide sufficient interactivity |
| Solo user first | Defer multi-user complexity, get core working for primary user | ✓ Good -- per-chat isolation in place for future multi-user |
| Conversational recipe entry only | Simplest entry method, no URL scraping or vision pipeline needed | ✓ Good -- natural and flexible, agent handles varied input well |
| Simple daily prep reminder over full proactive system | Morning summary much simpler than event-driven scheduling, still solves core problem | ✓ Good -- poller-based system with DB persistence works well |
| Claude as reasoning engine (not continuous) | Called on-demand via thin orchestrator, not running 24/7 -- cost-effective and architecturally clean | ✓ Good -- prompt caching reduces costs, agent reasoning is the product |
| Knowledge as agent context, not feature database | Store knowledge as rich text the agent retrieves and reasons over. No normalized ingredient tables, no purpose-built query features. Agent decides what to look up. | ✓ Good -- FTS5 + BM25 ranking enables flexible retrieval, agent reasons effectively |
| Node.js + TypeScript + grammY + SQLite | Research recommended this stack: grammY for Telegram webhooks, SQLite for zero-infra persistence, Drizzle for type-safe queries | ✓ Good -- stable, fast development, factory pattern + DI worked well |
| Railway for hosting | Supports webhooks, persistent volumes (SQLite), cron jobs, simple deploys | — Pending (not yet deployed) |
| HTML parse mode over MarkdownV2 | Only 3 characters to escape vs 20+. Eliminates most common Telegram formatting bugs. | ✓ Good -- eliminated formatting issues completely |
| Async webhook processing | Acknowledge Telegram immediately, process via queue. Claude takes 3-15s, Telegram times out at ~10s. | ✓ Good -- fire-and-forget with debounce queue works reliably |
| Prompt caching from day one | 90% cost reduction on stable system prompt content. Minimum 1024 tokens for Sonnet. | ✓ Good -- cache_control ephemeral on system prompt from Phase 2 |
| Factory functions over singletons | All services created via createXxx() factories with dependency injection | ✓ Good -- testable, composable, consistent across all 10 phases |
| FTS5 with BM25 ranking for knowledge search | Two-pass search (summaries → full content) within token budget | ✓ Good -- weighted ranking (title 10x, summary 5x) provides relevant results |
| Tool error resilience (try/catch with is_error) | Tool call exceptions return error to Claude instead of crashing pipeline | ✓ Good -- added in Phase 10, prevents pipeline crashes |
| Hybrid bot+Mini App model | Bot stays primary conversation interface, Mini Apps for visual tasks (grocery, recipes, meal plan) | ✓ Good -- natural division: bot for input, Mini App for visual browsing |
| initData HMAC-SHA256 auth | Telegram's standard auth for Mini Apps, validated server-side with 1-hour expiry | ✓ Good -- secure, standard pattern |
| React+Vite SPA served from Express | Single server serves both API and static Mini App files, no separate frontend deploy | ✓ Good -- simplified deployment, single process |
| Polling sync (8s) over WebSockets | Simpler than WebSocket for Telegram WebView context, acceptable latency for grocery list | ✓ Good -- avoids WebSocket complexity, 8s acceptable for shopping |
| FTS5 two-step query (bm25 + GROUP BY) | SQLite bm25() incompatible with GROUP BY in any context; separate matching from aggregation | ✓ Good -- solved after CTE approach failed, clean separation |
| Duplicated constants across server/client | No shared imports across Vite/Node build boundary; duplicate SECTION_ORDER, date utils | ⚠️ Revisit -- tech debt, consider shared package if more constants emerge |

| Timezone-aware date pipeline | Resolve timezone once at pipeline entry from reminder_settings, thread through all date consumers | ✓ Good -- eliminates timezone bugs across all date operations |
| Recipe time parsing for reminder adjustment | Parse prep+cook time from recipe content, adjust start_cooking reminder timing | ✓ Good -- robust multi-format parsing with graceful fallback |
| Confirmation-first implicit recipe detection | Offer to save recipe, wait for user approval -- avoids unwanted saves from casual food mentions | ✓ Good -- balances proactiveness with user control |
| Immediate implicit preference capture | Save preferences without asking -- dietary restrictions/allergies are safety-critical | ✓ Good -- reduces missed preferences, brief acknowledgment keeps conversation flowing |
| Builder function for dynamic prompt sections | Prompt sections needing runtime config (miniAppUrl) use builder functions instead of const strings | ✓ Good -- enables conditional content without breaking static sections |
| In-place recipe modifications over separate variation cards | Recipe tweaks update existing card; interchangeable ingredients as inline Variations section | ✓ Good -- keeps recipe list clean, avoids card proliferation |
| Mandatory store preference search before grocery generation | System prompt requires search_knowledge for store preferences before any list generation | ✓ Good -- ensures lists respect user's store assignments |
| Overflow menu for destructive grocery actions | Done Shopping MainButton replaced with three-dot overflow menu + confirmation dialog | ✓ Good -- two-step confirmation prevents accidental list clearing |
| Optional onDelete prop for shared detail components | RecipeDetail used by both Recipes and MealPlan pages; onDelete optional so delete only appears where appropriate | ✓ Good -- avoids breaking MealPlan page, clean conditional rendering |
| Cascading delete with manual cooking_history cleanup | cooking_history has no ON DELETE CASCADE FK; delete manually before knowledge_items (which cascades tags + FTS5) | ✓ Good -- ensures complete cleanup without orphaned records |
| Directive onboarding recipe prompting with soft target | Ask for 3-5 go-to meals with concrete questions and first meal plan motivation, gentle encouragement but no hard gate | ✓ Good -- balances directiveness with user comfort |
| PRAGMA user_version for migration tracking | Single integer stored in SQLite header, no migrations table needed, inspectable via CLI | ✓ Good -- ~50 LOC runner, simpler than table-based approaches |
| Tool-level dedup with skip_dedup bypass | Dedup happens in tool handler (not Claude reasoning), returns match info for Claude to present conversationally, skip_dedup param for explicit override | ✓ Good -- keeps dedup deterministic, UX flexible |
| Centralized message module with pickRandom variants | All bot-initiated messages in src/bot/messages.ts, each with 3-5 Sous-personality variants, random selection at runtime | ✓ Good -- single source of truth, natural variation, easy to extend |

| Migration 001 sqlite_master guard for fresh installs | Migrations targeting tables created by init functions must check table existence first -- skip if table doesn't exist, init function handles fresh DBs | ✓ Good -- pattern reusable for future migrations that ALTER init-created tables |

---
*Last updated: 2026-02-21 after v1.5 milestone start (Agent Hardening & Polish)*
