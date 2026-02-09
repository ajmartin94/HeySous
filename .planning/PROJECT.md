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

### Active

See REQUIREMENTS.md for v1.1 detailed requirements.

- Telegram Mini App infrastructure (auth, API layer, shared React components)
- Grocery list Mini App (checkable list, store sections, real-time sync with bot)
- Weekly meal plan Mini App (calendar view, recipe details, meal swapping)
- Recipe browser Mini App (search, recipe cards, full recipe view)

### Out of Scope

- ~~Mini Apps (Telegram rich UI)~~ — **Promoted to v1.1 Active scope**
- URL recipe import -- conversational entry sufficient for v1
- Photo/image recipe capture -- requires vision pipeline, defer
- Multi-user / partner access -- solo user first, shared household later
- Voice interaction / cooking mode -- future capability
- Monetization / paid features -- personal dogfooding first
- Nutritional tracking / calorie counting -- changes product from cooking partner to diet app
- Recipe catalog / discovery database -- this is YOUR recipes, not a browsable catalog
- Grocery delivery integration -- user shops in-person at Kroger/Costco

## Context

- **Current state:** v1.0 shipped with 8,263 LOC TypeScript across 10 phases and 30 plans in 5 days
- **Tech stack:** Node.js 22, TypeScript (ESM), grammY, better-sqlite3/Drizzle, Anthropic SDK, Pino, Express
- **Primary user:** Home cook who loves cooking, time-constrained on weekdays, more flexible weekends
- **Household:** Partner + 9-month-old. Partner collaboration deferred to v2.
- **Dinner target:** 6pm daily
- **Shopping:** Kroger (primary), Costco (bulk)
- **Devices:** Apple ecosystem (iPhone, iPad) -- Telegram works cross-platform
- **First-run flow:** User seeds 10-15 rotating recipes before planning first week
- **Next step:** v1.1 Mini Apps milestone — add visual UI layer to existing bot
- **Mini App model:** Hybrid — bot stays primary, Mini Apps open from chat buttons for visual tasks
- **Frontend:** React inside Telegram Web Apps (TWA), served by existing Express server

## Constraints

- **Platform**: Telegram Bot API -- conversation-first, push notifications via Telegram
- **AI**: Claude as the reasoning engine -- called on-demand, not running continuously
- **Architecture**: Thin backend orchestrator -- handles webhooks, storage, scheduling; Claude reasons on demand
- **Language/Framework**: Node.js 22 + TypeScript + grammY (Telegram) + @anthropic-ai/sdk (Claude)
- **Hosting**: Railway (webhook handling, persistent volume for SQLite, cron jobs)
- **Knowledge storage**: SQLite via better-sqlite3 + Drizzle ORM -- agent retrieves relevant context per request within a token budget (~4K tokens), not full dump
- **Interface**: Hybrid -- bot conversation primary, Telegram Mini Apps for visual interactions (v1.1)
- **Users**: Single user for v1

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

## Current Milestone: v1.1 Mini Apps

**Goal:** Add Telegram Mini App visual UIs for the three key interactions — grocery lists, weekly meal plan, and recipe browser — while keeping the bot as the primary conversational interface.

**Target features:**
- Mini App infrastructure (TWA auth, API endpoints, React scaffold, shared components)
- Grocery list Mini App (checkable items, store sections, sync with bot state)
- Weekly meal plan Mini App (calendar/grid view, recipe details, meal navigation)
- Recipe browser Mini App (search, recipe cards, full recipe detail view)

---
*Last updated: 2026-02-09 after v1.1 milestone start*
