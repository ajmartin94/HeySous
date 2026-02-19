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

### Active

- [ ] Implicit recipe card creation (Sous proactively recognizes recipes without explicit commands)
- [ ] Implicit preference detection (Sous saves preferences from natural conversation)
- [ ] Improved pantry check response (Mini App link or conversational walk-through)
- [ ] Recipe variation handling (modify existing vs create new card)
- [ ] Delete button on recipe cards in Mini App
- [ ] Tag click filtering in recipe browser
- [ ] Remove "done shopping" button from grocery lists
- [ ] Fix intermittent date bugs in meal plans
- [ ] Fix start_cooking reminder to account for prep time
- [ ] Grocery store preferences saved and used in list generation
- [ ] Onboarding pushes users to add existing recipes first

### Out of Scope

- URL recipe import -- conversational entry sufficient for now
- Photo/image recipe capture -- requires vision pipeline, defer
- Voice interaction / cooking mode -- future capability
- Monetization / paid features -- personal dogfooding first
- Nutritional tracking / calorie counting -- changes product from cooking partner to diet app
- Recipe catalog / discovery database -- this is YOUR recipes, not a browsable catalog
- Grocery delivery integration -- user shops in-person at Kroger/Costco
- Bot update notification system -- deferred to future milestone
- Data migration framework -- deferred to future milestone
- Web search + picture analysis for byo-recipe -- deferred to future milestone

## Context

- **Current state:** v1.2 shipped with invite-gated access, onboarding, household sharing, and feedback. 19 phases across 3 milestones.
- **Tech stack:** Node.js 22, TypeScript (ESM), grammY, better-sqlite3/Drizzle, Anthropic SDK, Pino, Express, React+Vite (Mini App SPA), @telegram-apps SDK
- **Primary user:** Home cook who loves cooking, time-constrained on weekdays, more flexible weekends
- **Household:** Partner + 9-month-old. Partner now has access via invite system (v1.2).
- **Dinner target:** 6pm daily
- **Shopping:** Kroger (primary), Costco (bulk)
- **Devices:** Apple ecosystem (iPhone, iPad) -- Telegram works cross-platform
- **First-run flow:** Onboarding guides new users through preferences → tour → seed recipes (v1.2)
- **Mini App model:** Hybrid — bot stays primary, Mini Apps open from chat buttons for visual tasks
- **Frontend:** React+Vite SPA inside Telegram Web Apps, served by existing Express server at /app/*
- **Real usage feedback:** Sous requires too-explicit language for recipe saves and preference captures. Dates intermittently wrong. Grocery store preferences not factored into lists. Onboarding could be more directive about getting existing recipes in first.
- **Next step:** v1.3 AI Polish & UX

## Current Milestone: v1.3 AI Polish & UX

**Goal:** Make Sous smarter and more natural through implicit behavior detection, fix UX rough edges from real usage, and improve the onboarding recipe seeding flow.

**Target features:**
- Implicit recipe card creation (no explicit "save this recipe" needed)
- Implicit preference detection from natural conversation
- Smarter pantry check response with Mini App grocery list link
- Recipe variation handling (modify vs new card)
- Mini App UX: delete recipe cards, tag click filtering, remove done shopping button
- Bug fixes: intermittent date issues, prep time in start_cooking reminders
- Grocery store preferences in list generation
- Onboarding refinement: push existing recipes first

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

---
*Last updated: 2026-02-19 after v1.3 milestone start*
