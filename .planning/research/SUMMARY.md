# Project Research Summary

**Project:** Meal Planning Assistant (Telegram Bot)
**Domain:** Conversational AI / Personal Productivity / Food & Cooking
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This is a conversational AI meal planning assistant delivered as a Telegram bot, powered by Claude API. Unlike traditional meal planning apps with screens and buttons, this product is entirely conversational - users tell the bot about recipes, describe their week, and get meal plans and grocery lists through natural conversation. The differentiator is persistent memory: the system accumulates knowledge about the user's recipes, preferences, cooking habits, and timing realities, creating a "cooking partner" that gets smarter over time.

The recommended approach is a webhook-based Telegram bot using Node.js 22, TypeScript, grammY framework, and Claude Sonnet 4.5 API, with SQLite for persistent storage via Drizzle ORM. The architecture follows a retrieval-before-generation pattern: before each Claude API call, relevant knowledge is retrieved from the database and injected into context (bounded to 4-6K tokens) rather than sending everything. This keeps costs predictable and prevents context window overflow. Reminders are stored in the database and delivered via a polling system to survive process restarts - critical for the spec's "zero missed defrost reminders" requirement.

The key risks are unbounded context growth (leading to runaway costs), hallucinated recipes (causing incorrect grocery lists), and missed reminders due to in-memory scheduling. All three are prevented through architectural decisions made in Phase 1 (Foundation): retrieval-based context injection, explicit "no hallucination" system prompts with verified recipe injection, and database-backed reminder polling. If these patterns are established from day one, the system scales gracefully. If deferred as "optimizations for later," they require rewrites.

## Key Findings

### Recommended Stack

The stack centers on TypeScript across the entire system for type safety from Telegram webhooks to Claude API calls to database schemas. Node.js 22 LTS provides a maintenance window until 2027 with the most mature ecosystem compatibility (particularly for better-sqlite3's native bindings).

**Core technologies:**
- **grammY 1.39.x**: Telegram bot framework - TypeScript-first, dominant in the ecosystem (1.2M weekly downloads vs Telegraf's 160K), explicit webhook timeout handling that aligns with async processing requirements
- **@anthropic-ai/sdk 0.73.x**: Official Claude API client - native TypeScript, built-in tool use with Zod integration, structured outputs, streaming support. No abstraction layers or wrappers needed
- **SQLite + better-sqlite3 12.6.x**: Database engine - zero-config, zero-server, embedded in process. WAL mode handles concurrent reads/writes. Perfect for single-user personal project. File-based backup is trivial
- **Drizzle ORM 0.45.x**: SQL-first ORM with transparent queries, native better-sqlite3 driver, full TypeScript inference. Lightweight alternative to Prisma's heavy abstraction
- **Zod 4.3.x**: Schema validation glue between all layers - validates Telegram payloads, defines Claude tools via betaZodTool, infers Drizzle schemas. Makes TypeScript types runtime-safe

**Critical compatibility note:** Zod 4 is a recent major release. The @anthropic-ai/sdk's betaZodTool helper was built for Zod 3. If incompatible at implementation time, pin Zod at 3.24.x until SDK updates. This is the highest-risk version dependency in the stack.

**Supporting libraries:**
- node-cron for reminder polling (sufficient for single-user; migrate to BullMQ + Redis only if scaling to multi-user)
- pino for structured JSON logging
- @grammyjs/conversations for multi-step dialogue flows

**Deployment:** Railway recommended for v1 (~$5-10/mo) - built-in cron jobs, persistent volumes for SQLite, automatic HTTPS, zero-config Node.js deploys, push from GitHub. Best developer experience for single-developer project.

### Expected Features

**Must have (table stakes):**
- **Conversational recipe entry** - primary way recipes enter the system; must handle messy, informal descriptions through multi-turn dialogue
- **Recipe storage and retrieval** - persistent "recipe box" searchable by attribute (ingredient, cuisine, time, tags)
- **Weekly meal plan generation** - the core value prop; conversational approach (describe your week, get a plan, adjust through dialogue) differentiates from drag-and-drop competitors
- **Grocery list generation** - automatic from meal plan with ingredient aggregation, duplicate merging, and quantity consolidation
- **Preference memory** - dietary restrictions, dinner time, cooking goals, store preferences persist across conversations and actively influence suggestions
- **Cooking history tracking** - when each recipe was last made, how many times made, for recency-based suggestions
- **Post-meal feedback loop** - optional check-ins ("How was dinner?") to accumulate real-world timing and adjustment data

**Should have (competitive advantage):**
- **Recipe "brain" with accumulated learning** - stores user's actual prep times vs recipe's stated times, preferred substitutions, what worked/didn't work. No competitor remembers YOUR version takes 70 minutes, not 45
- **Post-meal feedback loop** - closes the learning cycle; competitors stop at "plan and shop"
- **Pivot assistance** - "chicken burned, what instead?" Real-time help when plans deviate. Conversational interface makes this natural
- **Contextual grocery annotations** - "chicken thighs - for butter chicken, needs defrosting" helps partner shopping independently understand list purpose
- **Daily prep reminder (simplified)** - morning summary of today's meals and any prep needed. Not event-driven or time-calculated in v1, just a daily overview

**Defer (v2+):**
- URL recipe import (web scraping is fragile, legally gray, fights conversational model)
- Photo/image recipe capture (requires multimodal API, adds cost and complexity)
- Full proactive reminders with time-calculation (requires calendar awareness, event-driven scheduling infrastructure)
- Telegram Mini Apps for rich UI (grocery list checking, recipe display, week calendar view)
- Multi-user / partner access (authentication, permission models, conflict resolution)

**Anti-features (deliberately NOT building):**
- Calorie counting / comprehensive nutritional tracking (changes product from "cooking partner" to "diet app"; AI calorie estimates are unreliable)
- Massive recipe database / discovery (shifts value from "knows YOUR cooking" to "generic search" which Google does better)
- Real-time cooking mode / step-by-step guidance (requires voice interaction, screen-always-on, too high latency for Telegram)
- Automated grocery delivery integration (massive OAuth complexity; target user shops in-person at Kroger/Costco)

### Architecture Approach

The architecture follows a webhook-based async processing pattern with retrieval-before-generation for knowledge injection. Telegram delivers updates via webhook POST, the handler responds 200 immediately and enqueues the message, a worker retrieves relevant context from SQLite, builds the Claude prompt with injected knowledge (bounded to 4-6K tokens), calls the Claude API (3-15 seconds), formats and sends the reply via Telegram's sendMessage. This decouples webhook acknowledgment from slow Claude processing, preventing Telegram timeouts and message loss.

**Major components:**
1. **Webhook Handler** - receives Telegram updates, validates secret token, responds 200 immediately, enqueues for async processing. Never awaits Claude.
2. **Message Queue** - in-process async queue for v1 (p-queue or simple Promise chain); migrate to BullMQ + Redis only if scaling to multi-user
3. **Knowledge Retriever** - queries SQLite for relevant recipes, preferences, history based on user message; returns structured context within token budget. This is the critical anti-pattern prevention: retrieves selectively, never injects all knowledge.
4. **Claude Service** - builds prompts (system + injected context + conversation), calls messages.create(), tracks token usage per feature, implements prompt caching for system prompt (90% cost reduction on cached portion)
5. **Telegram Sender** - formats Claude output as HTML (not MarkdownV2 - fewer escaping issues), splits at 4096 character limit, sends with typing indicators
6. **Reminder Poller** - checks database every 60 seconds for due reminders, sends via Telegram, marks sent. Database-backed to survive restarts (critical for "zero missed defrost reminders" requirement)
7. **Conversation Manager** - maintains recent conversation window (last 10-20 turns), summarizes older turns, provides summary + recent turns to Claude (not full history)

**Data flow:** User message -> webhook -> queue -> retrieve context -> build prompt -> Claude API -> format -> send reply -> save turn -> extract side effects (reminders, preferences, recipe updates).

**Key pattern:** Retrieval-before-generation with selective context injection. Before every Claude call, query knowledge store for relevant items and inject only those. Never send all recipes, all preferences, all history. This keeps token costs bounded and prevents context window overflow as knowledge grows.

### Critical Pitfalls

1. **Unbounded context window growth destroys your budget** - Appending all recipes, preferences, and conversation history to every Claude call causes costs to explode ($100+/month for single user within weeks). Prevention: Separate long-term knowledge from conversation context, retrieve selectively (inject only 3-5 most relevant recipes per query), implement conversation summarization, set hard 4-6K token budget for injected context, use prompt caching for system prompt. Address in Phase 1 (Foundation) - retrofitting is a rewrite.

2. **Claude hallucinates recipe details, creating dangerous meals** - When retrieval fails or prompt doesn't distinguish "your stored recipe" from "general knowledge," Claude fabricates plausible-sounding recipes with wrong ingredients, quantities, or missing allergen info. Prevention: Always inject actual recipe text into prompt, use clear system prompt boundaries ("if recipe not in list, say you don't have it - do not make one up"), include metadata for user verification, test with adversarial queries. Address in Phase 1 (LLM integration).

3. **Scheduled reminders lost on process restart** - In-memory scheduling (setTimeout, node-cron) loses all reminders on deploy, crash, or reboot. This is the single most critical feature failure for the product. Prevention: Store all reminders in database with UTC target time, poll every 60 seconds for due reminders, on startup immediately check for missed reminders and send late with explanation. Address in Phase 2 (Reminders) but design as persistent from day one.

4. **Telegram webhook failures and missed messages** - Synchronous processing in webhook handler causes Claude's 3-15 second response time to exceed Telegram's timeout, resulting in retries, duplicate processing, and eventual message loss. Prevention: Acknowledge webhook with 200 within 1-2 seconds, process asynchronously via queue, send reply via separate sendMessage call, implement health monitoring via getWebhookInfo. Address in Phase 1 (Bot infrastructure).

5. **Telegram message length limits silently truncate responses** - Telegram has 4096 character limit per message. Claude easily generates 2000-5000+ characters for meal plans. Exceeding the limit returns 400 error and user sees nothing. Prevention: Implement message splitting utility from day one, split at paragraph breaks, constrain Claude output in system prompt. Address in Phase 1 (Bot foundation).

6. **MarkdownV2 formatting escaping hell** - Claude outputs standard Markdown; Telegram's MarkdownV2 requires escaping characters that aren't special in standard Markdown (`.`, `-`, `(`, `)`, `!`, etc.). Every unescaped character causes 400 error. Prevention: Use HTML parse mode instead (only `<`, `>`, `&` need escaping), build formatter that converts Claude output to simple HTML, have fallback to retry without parse mode. Address in Phase 1 (Bot foundation).

**Cost control pitfalls:**
- Not tracking token usage per feature (cannot optimize what you cannot measure)
- Using flagship model (Sonnet) for trivial tasks like classification (use Haiku for 10-15x cost reduction)
- Not using prompt caching for stable system prompt (90% savings on cached portion)
- Having Claude generate structured data expensively when application code could handle it (e.g., grocery list aggregation)

**Domain-specific pitfalls:**
- Recipe data quality varies wildly (scraped recipes have inconsistent units, missing times, vague instructions) - normalize at import time
- Grocery quantity aggregation is harder than it looks ("2 chicken breasts" + "1 lb chicken thighs" + "500g chicken" are different cuts, units, quantities) - use Claude for normalization at import, not generation
- Timing calculations require real-world knowledge (recipe says 30 min, user takes 70 min) - always prefer user-recorded actual times over recipe-stated times

## Implications for Roadmap

Based on research, suggested phase structure prioritizes establishing the correct architectural patterns before adding features. The three critical pitfalls (unbounded context, hallucinated recipes, lost reminders) are all prevented by architectural decisions that must be made in Phase 1. Deferring them as "optimizations" leads to rewrites.

### Phase 1: Foundation (Bot Infrastructure + LLM Integration)
**Rationale:** Must establish async webhook processing, retrieval-before-generation pattern, and HTML formatting before building features. These are architectural decisions that are expensive to retrofit.

**Delivers:** Working Telegram bot that receives messages, calls Claude with bounded context, and replies reliably. No knowledge system yet (Claude works from system prompt + immediate conversation only).

**Components built:**
- Database layer (SQLite, Drizzle schema, migrations)
- Telegram sender (HTML formatting, message splitting, typing indicators)
- Webhook handler (validate, respond 200, enqueue)
- Simple async queue (in-process for v1)
- Claude service (API client wrapper, prompt builder, cost tracking with feature tags)
- Basic worker (receive -> Claude -> reply pipeline)
- Conversation manager (track turns in database)

**Addresses pitfalls:**
- Webhook timeout/message loss (async processing from day one)
- Message truncation (splitting utility built before features)
- MarkdownV2 escaping (HTML parse mode chosen and implemented)

**Avoids:** Building features on a foundation that will require rewrite. This phase is "boring infrastructure" but it's the difference between a system that scales and one that collapses under its own weight.

**Research flag:** Standard patterns, well-documented. Skip deeper research.

---

### Phase 2: Knowledge System (Recipes + Preferences + Retrieval)
**Rationale:** With Foundation working, add the knowledge layer that makes this product differentiated. This phase implements the retrieval-before-generation pattern that prevents unbounded context growth.

**Delivers:** Bot remembers recipes and preferences, injects relevant knowledge into Claude calls, stays within token budget. User can add recipes conversationally, store preferences, and have them influence suggestions.

**Components built:**
- Recipe storage (CRUD, search by attribute, natural language retrieval)
- Preference storage (dietary restrictions, dinner time, cooking goals, store preferences)
- Knowledge retriever (query and inject relevant context within 4-6K token budget)
- Context builder (assemble prompt with system + retrieved knowledge + conversation)
- Update worker to use retriever before Claude calls

**Addresses pitfalls:**
- Unbounded context growth (retrieval pattern established, token budget enforced)
- Claude hallucination (actual recipe text injected, anti-hallucination system prompt)
- Preference enforcement (preferences actively retrieved and injected, not just stored)

**Uses stack:** Drizzle ORM for schema and queries, Zod for validation, SQLite FTS5 for recipe search

**Research flag:** Standard CRUD + retrieval patterns. Skip deeper research. Possible research during planning: recipe normalization strategies if quality issues emerge during implementation.

---

### Phase 3: Reminders (Database-Backed Scheduling)
**Rationale:** With knowledge system working, add the proactive reminder capability. Must be database-backed from day one to meet "zero missed reminders" requirement.

**Delivers:** System proactively sends reminders at scheduled times, survives process restarts, handles timezone correctly.

**Components built:**
- Reminder data layer (CRUD with UTC storage, timezone conversion)
- Reminder parser (extract reminder needs from Claude output)
- Reminder poller (check database every 60 seconds, send due reminders)
- Callback handler (done/snooze/remind later buttons)
- Update worker to parse Claude responses for reminder triggers

**Addresses pitfalls:**
- Lost reminders on restart (database-backed, polling system)
- Timezone handling (store UTC, convert to user timezone for display and scheduling)
- Missed reminders during downtime (startup check for past-due, send late with explanation)

**Implements:** Architecture's "Reminder Poller" component with persistent storage pattern

**Research flag:** Standard cron/polling pattern. Skip deeper research.

---

### Phase 4: Meal Planning + Grocery Lists
**Rationale:** With recipes, preferences, and reminders working, combine them into the core meal planning flow.

**Delivers:** User describes their week, Claude generates meal plan from stored recipes + preferences, automatically creates grocery list with aggregated ingredients, schedules prep reminders.

**Components built:**
- Meal plan data layer (weekly plans, status tracking)
- Meal plan prompts (inject preferences, cooking history, recipe options)
- Grocery list generation (aggregate ingredients, merge duplicates, handle quantities)
- Multi-turn planning conversation flow
- Integration: meal plan creation triggers reminder scheduling automatically

**Uses:** All Phase 2 knowledge retrieval, Phase 3 reminder scheduling
**Implements:** Architecture's "weekly meal plan generation" and "grocery list generation" features

**Addresses pitfalls:**
- Grocery quantity aggregation (use Claude for normalization, application code for aggregation)
- Context budget during planning (retrieval keeps context bounded even with complex plans)

**Research flag:** Possible research during planning - grocery list aggregation strategies if quantity/unit handling proves complex. Otherwise standard patterns.

---

### Phase 5: Feedback Loop (Post-Meal Learning)
**Rationale:** With core planning working, close the learning loop to accumulate cooking intelligence over time.

**Delivers:** System asks "How was dinner?" after meals, stores feedback, annotates recipes with actual times and user adjustments, surfaces this data in future planning.

**Components built:**
- Post-meal check-in scheduling (evening after meal)
- Feedback parser (extract timing corrections, recipe adjustments, preferences)
- Recipe annotation storage (actual prep times, substitutions, what worked/didn't)
- Update retriever to prioritize user-annotated data over recipe-stated data
- "Haven't made lately" suggestion logic (query cooking history)

**Addresses pitfalls:**
- Timing calculations using real-world knowledge (user's actual times preferred over recipe-stated)
- Recipe brain / accumulated learning (feedback loop operational)

**Research flag:** Skip deeper research. This is application logic on top of existing knowledge and conversation infrastructure.

---

### Phase 6: Polish + Cost Optimization
**Rationale:** With features complete, optimize costs and improve error handling.

**Delivers:** Lower per-interaction costs, better user experience on errors, visibility into cost drivers.

**Components built:**
- Model routing (Haiku for classification/extraction, Sonnet for reasoning/planning)
- Prompt caching tuning (optimize cache_control breakpoints)
- Conversation summarization (compress older turns, keep recent turns full)
- Error recovery (graceful Claude failures, Telegram retry handling, rate limit backoff)
- Cost tracking dashboard (query token_usage table by feature)
- Message deduplication (handle Telegram webhook retries)

**Addresses pitfalls:**
- Cost control (model routing, prompt caching, per-feature tracking)
- Error recovery (retries, fallbacks, user-visible status)

**Research flag:** Skip deeper research. Standard optimization patterns.

---

### Phase Ordering Rationale

**Why Phase 1 must come first:**
The three critical architectural decisions (async webhook processing, retrieval-based context, HTML formatting) must be made before features are built. Building features on a synchronous webhook handler or a "send everything to Claude" pattern leads to rewrites when costs explode or messages get lost. Foundation is boring but essential.

**Why Knowledge (Phase 2) before Reminders (Phase 3):**
Reminders reference recipes and preferences. "Defrost the chicken for butter chicken" requires recipe content to exist. The reminder system extracts timing from Claude's understanding of the recipe. Knowledge layer enables intelligent reminders.

**Why Meal Planning (Phase 4) after Knowledge + Reminders:**
Meal planning combines recipe retrieval + preference injection + grocery list generation + reminder scheduling. It's the integration of all previous systems. Building it earlier means rebuilding as dependencies mature.

**Why Feedback Loop (Phase 5) after Planning:**
Feedback annotates recipes with real-world data. Need recipes, plans, and cooking history in place before the feedback loop can improve them. This is the "getting smarter over time" promise, but it requires the foundation to get smart about.

**Why Polish (Phase 6) last:**
Cost optimization (model routing, prompt caching) and error recovery are refinements. They improve the experience but don't change functionality. Do them after features work, when you have real usage data to guide optimization.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Meal Planning):** Grocery quantity aggregation and unit normalization may need research if complexity exceeds initial estimates. Consider researching ingredient parsing libraries or Claude's structured output capabilities for normalized ingredient extraction.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Webhook processing, queue patterns, Claude API integration all well-documented
- **Phase 2 (Knowledge System):** Standard CRUD, retrieval, search patterns
- **Phase 3 (Reminders):** Standard polling/cron patterns with database persistence
- **Phase 5 (Feedback Loop):** Application logic on existing infrastructure
- **Phase 6 (Polish):** Standard optimization techniques

**Overall:** This is a well-trodden path (Telegram bot + LLM API + SQLite). The research completed provides HIGH confidence guidance. The main implementation challenge is discipline: following the architectural patterns (retrieval-before-generation, database-backed reminders, async webhook processing) from day one rather than deferring them as "future optimizations."

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified via official docs (grammY, Anthropic SDK, Drizzle, better-sqlite3). Version compatibility checked via npm. Only risk: Zod 4 compatibility with @anthropic-ai/sdk's betaZodTool - verify at implementation. |
| Features | MEDIUM-HIGH | Based on competitor analysis (Ollie, Plan to Eat, Paprika, Samsung Food) and user reviews from multiple sources. Table stakes features have HIGH confidence. Differentiators (feedback loop, pivot assistance) have MEDIUM confidence as they're novel - may need UX validation during implementation. |
| Architecture | HIGH | Core patterns (async webhook, retrieval-before-generation, database-backed reminders) verified via official Telegram Bot API docs, Anthropic docs, and established LLM application architecture. Project structure and component boundaries are standard Node.js patterns. |
| Pitfalls | MEDIUM | Based on training knowledge (Telegram bot development, LLM application patterns) but WebSearch/WebFetch were unavailable during research. Critical claims (webhook timeout behavior, MarkdownV2 escaping, context window limits, reminder loss on restart) should be spot-checked against current official docs before implementation. Domain-specific pitfalls (grocery aggregation, timing calculations) are inferred from meal planning app reviews. |

**Overall confidence:** HIGH

The stack, architecture, and feature recommendations are all grounded in official documentation and verified ecosystem data. The critical architectural patterns (async webhook, retrieval-before-generation, persistent reminders) are well-established best practices, not novel approaches. The main uncertainty is in domain-specific complexities (grocery quantity aggregation, recipe normalization) which may emerge during implementation but can be addressed incrementally.

### Gaps to Address

**Version compatibility:**
- **Zod 4.x with @anthropic-ai/sdk** - At project start, verify betaZodTool works with Zod 4. If incompatible, pin Zod at 3.24.x until SDK updates. This is the highest-risk dependency issue.

**Domain complexity unknowns:**
- **Grocery quantity aggregation** - Research identified this as harder than it looks. May need deeper exploration of ingredient normalization strategies during Phase 4 planning. Consider evaluating ingredient parsing libraries or Claude's structured output for normalized extraction.
- **Recipe data quality** - If users import recipes from URLs (deferred to v2 but may be requested early), quality normalization becomes critical. Have a strategy for handling inconsistent units, missing data, vague instructions.

**Cost modeling:**
- Research provides token-based cost estimates but actual costs depend on conversation patterns, prompt length, caching effectiveness. In first 2 weeks of Phase 1, instrument token usage heavily and validate cost assumptions. If costs exceed projections, prioritize Phase 6 (model routing, prompt caching) earlier.

**UX validation:**
- The conversational-first interface is the product's differentiator but also a risk (no competitor does this). Features like post-meal feedback loop and pivot assistance are novel. During Phase 2-5 implementation, watch for signs that conversational interface creates friction rather than reducing it. Be ready to add light structure (buttons, quick replies) if pure conversation proves too ambiguous.

**Timezone handling:**
- Reminders at "8am user time" require correct timezone handling. If user travels or changes timezone, reminders must adjust. This is solvable (store user timezone in profile, use for all time calculations) but needs explicit attention during Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- **STACK.md** - Verified stack recommendations via official docs (grammY site, Anthropic API docs, Drizzle docs, npm package pages). All package versions verified via `npm view` on 2026-02-05.
- **ARCHITECTURE.md** - Architectural patterns verified via Telegram Bot API official docs, grammY deployment guides, Anthropic prompt caching docs. Stevens AI assistant case study (SQLite-backed personal assistant) provided real-world validation.
- **Node.js LTS schedule** - Node 22 maintenance until 2027-04 verified via nodejs.org releases page.

### Secondary (MEDIUM confidence)
- **FEATURES.md** - Competitor analysis (Ollie, Plan to Eat, Paprika, Samsung Food) via company websites and feature pages. Industry analysis via CNN Underscored, Fitia, WDP Technologies. User reviews and complaints used to identify table stakes and anti-features.
- **PITFALLS.md** - Based on training knowledge covering Telegram Bot API docs, Anthropic Claude API docs, and established LLM application patterns. Critical claims should be spot-checked against current official docs before implementation decisions.

### Tertiary (LOW confidence)
- **Feature prioritization** - P1/P2/P3 assignments based on synthesis of competitor features, spec requirements, and architectural dependencies. User value assessments are inferred from reviews and competitor positioning, not direct user research.
- **Hosting cost estimates** - Railway/Fly.io pricing subject to change. $5-10/mo estimate based on published pricing as of research date.

### Research Limitations
PITFALLS.md research noted: "WebSearch and WebFetch were unavailable for live verification." All findings draw from training data. Confidence levels reflect this - critical architectural claims (webhook timeout behavior, message limits, API pricing) should be verified against current official documentation at implementation time.

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
