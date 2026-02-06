# Meal Planning Assistant

## What This Is

A conversational AI assistant on Telegram that helps a home cook plan meals, manage grocery shopping, and improve over time. The bot is powered by Claude, remembers recipes and preferences through conversation, and reaches into your life with timely prep reminders. No forms, no settings screens — you talk to it like a partner who happens to have perfect memory.

## Core Value

The recipe brain — the system remembers everything about your meals (recipes, your actual prep times, what worked, what didn't) and reasons over that knowledge to help you plan. If this doesn't work, nothing else matters.

## Architectural Principle: Agent-First, Not Database-First

**This is an AI agent with a memory store, NOT a recipe database with a chatbot UI.**

The LLM is the product. It reasons, decides what to look up, and acts on what it finds. Capabilities emerge from the agent having good context and good reasoning — not from features being individually coded as database query paths.

**What this means concretely:**
- Knowledge (recipes, preferences, history) is stored as rich context the agent retrieves and reasons over — not as normalized tables with ingredient columns designed for specific query patterns
- "Search by ingredient" is not a feature. The agent understands "I have chicken in my freezer" and decides what to look up.
- General-purpose retrieval: the agent gets a query interface and decides what to search for. We don't build separate search-by-X features.
- Flexibility over structure. Ad-hoc information ("I have chicken in my freezer", "we're eating lighter this week") lives in conversation context. No inventory tables, no structured input forms.
- If a capability requires a purpose-built database feature rather than agent reasoning over stored knowledge, that's a red flag — question whether the architecture is right.

**Why this matters:** Previous attempts at this idea devolved into recipe catalog apps. The value is the agent's reasoning, not the data structure.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Conversational recipe entry — tell the bot about a recipe and it captures and stores it
- [ ] Recipe retrieval and knowledge — ask for any stored recipe; system remembers notes, actual times, feedback
- [ ] Weekly meal planning — generate a week of dinners based on your recipes, constraints, and preferences
- [ ] Grocery list generation — aggregate ingredients from the plan, checkable in chat, split by store (Kroger/Costco)
- [ ] Daily prep reminder — morning message summarizing what needs doing today (defrost, marinate, etc.)
- [ ] Time-aware prep reminders — specific timed reminders based on recipe analysis ("take chicken out at 8am")
- [ ] Post-meal feedback loop — bot offers to capture how dinner went, learnable feedback
- [ ] Preference learning — system accumulates knowledge from conversation (dinner time, stores, allergies, goals)
- [ ] Cooking history and "haven't made lately" — track what was cooked, surface forgotten favorites during planning
- [ ] General-purpose context retrieval — agent decides what knowledge to look up per conversation, not feature-specific queries

### Out of Scope

- Mini Apps (Telegram rich UI) — deferring to keep v1 simple, bot-only interface first
- URL recipe import — conversational entry sufficient for v1
- Photo/image recipe capture — requires vision pipeline, defer
- Multi-user / partner access — solo user first, shared household later
- Voice interaction / cooking mode — future capability
- Monetization / paid features — personal dogfooding first
- Pivot assistance as a separate feature — emergent from agent having good context, not a coded feature
- Nutritional tracking / calorie counting — changes product from cooking partner to diet app
- Recipe catalog / discovery database — this is YOUR recipes, not a browsable catalog
- Grocery delivery integration — user shops in-person at Kroger/Costco

## Context

- **Primary user:** Home cook who loves cooking, time-constrained on weekdays, more flexible weekends
- **Household:** Partner + 9-month-old. Partner collaboration deferred to v2.
- **Dinner target:** 6pm daily
- **Shopping:** Kroger (primary), Costco (bulk)
- **Devices:** Apple ecosystem (iPhone, iPad) — Telegram works cross-platform
- **First-run flow:** User seeds 10-15 rotating recipes before planning first week
- **Existing spec:** Detailed product spec exists in `meal-planning-assistant-spec-v2.md`

## Constraints

- **Platform**: Telegram Bot API — conversation-first, push notifications via Telegram
- **AI**: Claude as the reasoning engine — called on-demand, not running continuously
- **Architecture**: Thin backend orchestrator — handles webhooks, storage, scheduling; Claude reasons on demand
- **Language/Framework**: Node.js 22 + TypeScript + grammY (Telegram) + @anthropic-ai/sdk (Claude)
- **Hosting**: Railway (webhook handling, persistent volume for SQLite, cron jobs)
- **Knowledge storage**: SQLite via better-sqlite3 + Drizzle ORM — agent retrieves relevant context per request within a token budget (~4K tokens), not full dump
- **Interface**: Bot conversation only for v1 — no Mini Apps, no web UI
- **Users**: Single user for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram as platform | Conversational interface native and polished, push notifications reliable, Mini Apps available later, no app store process | — Pending |
| Bot-only v1 (no Mini Apps) | Reduces frontend complexity significantly, text-based lists workable for solo user | — Pending |
| Solo user first | Defer multi-user complexity, get core working for primary user | — Pending |
| Conversational recipe entry only | Simplest entry method, no URL scraping or vision pipeline needed | — Pending |
| Simple daily prep reminder over full proactive system | Morning summary much simpler than event-driven scheduling, still solves core problem | — Pending |
| Claude as reasoning engine (not continuous) | Called on-demand via thin orchestrator, not running 24/7 — cost-effective and architecturally clean | — Pending |
| Knowledge as agent context, not feature database | Store knowledge as rich text the agent retrieves and reasons over. No normalized ingredient tables, no purpose-built query features. Agent decides what to look up. Prevents devolution into recipe catalog app. | — Pending |
| Node.js + TypeScript + grammY + SQLite | Research recommended this stack: grammY for Telegram webhooks, SQLite for zero-infra persistence, Drizzle for type-safe queries | — Pending |
| Railway for hosting | Supports webhooks, persistent volumes (SQLite), cron jobs, simple deploys | — Pending |
| HTML parse mode over MarkdownV2 | Only 3 characters to escape vs 20+. Eliminates most common Telegram formatting bugs. | — Pending |
| Async webhook processing | Acknowledge Telegram immediately, process via queue. Claude takes 3-15s, Telegram times out at ~10s. | — Pending |
| Prompt caching from day one | 90% cost reduction on stable system prompt content. Minimum 1024 tokens for Sonnet. | — Pending |

---
*Last updated: 2026-02-05 after research + agent-first architecture decision*
