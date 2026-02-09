# Feature Research

**Domain:** Conversational AI Meal Planning Assistant (Telegram Bot)
**Researched:** 2026-02-05
**Confidence:** MEDIUM-HIGH (based on cross-referencing multiple competitor apps, user reviews, and industry analysis)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Recipe storage and retrieval** | Every meal planning tool stores recipes. Users need a "recipe box" they can search. Without it, the tool is just a chatbot with no memory. | MEDIUM | Conversational entry is our twist, but retrieval must be fast and reliable. Must handle "show me the stromboli recipe" instantly. Paprika, Plan to Eat, Samsung Food all treat this as foundational. |
| **Recipe search by attribute** | Users expect to find recipes by ingredient ("what can I make with chicken?"), cuisine, time, or tag. Supercook, Paprika, and every competitor offer this. | MEDIUM | In a conversational interface, this becomes natural language queries rather than filters. The LLM handles this well, but the underlying data must be rich enough to support it. |
| **Weekly meal plan creation** | The core value proposition of every meal planning app. Ollie, Plan to Eat, Eat This Much, Samsung Food all center on this. Users will not adopt a meal planning tool that cannot plan a week. | MEDIUM | Conversational approach (describe your week, get a plan) is differentiated, but the output -- a visible weekly plan -- is table stakes. |
| **Grocery list generation from meal plan** | Automatic shopping list from planned meals is the #1 most-expected feature after planning itself. Every competitor does this. CNN, Fitia, and Plan to Eat reviews all call it essential. | MEDIUM | Must aggregate ingredients across meals, merge duplicates, and handle quantities correctly. This is where most apps struggle with accuracy. |
| **Grocery list that can be checked off** | Users expect to check items as they shop. AnyList, Bring!, and every grocery app does this. Without it, users will export to a separate app. | LOW | Telegram's built-in UI is limited for this. Inline keyboard buttons or a structured message could work for v1. Mini Apps (deferred) would be the real solution. |
| **Dietary restrictions and allergies** | Every competitor handles allergies and dietary restrictions. Partner's shellfish allergy in the spec is exactly this use case. Users trust the tool less if it might suggest something dangerous. | LOW | In conversational mode, this is just memory -- "partner is allergic to shellfish" stored and always respected. Low complexity because the LLM naturally excludes when instructed. |
| **Serving size awareness** | Recipes serve different counts. Users expect the tool to know who is eating and adjust. Paprika and Samsung Food both offer serving scaling. | LOW | For a single household with a consistent count (2 adults + infant), this is simpler. The LLM can reason about portions naturally. |
| **Conversational recipe entry** | For THIS product specifically, telling the bot a recipe in natural language is how recipes enter the system. This is the primary input method. Without it, the product has no content. | HIGH | Must handle messy, informal descriptions ("you know, that chicken thing where you marinate it overnight in yogurt and spices"). Requires robust parsing and confirmation flow. |
| **Preference memory** | Users expect the system to remember stated preferences across sessions. "I want to use my sous vide more" should stick. Every AI meal planner that claims personalization does this. Ollie, Copilot, and FoodiePrep all advertise learning. | MEDIUM | Requires persistent storage of preferences and reliable retrieval during planning. Not just session memory -- cross-conversation memory. |
| **Multi-store shopping awareness** | The target user shops at Kroger (primary) and Costco (bulk). Users who shop at multiple stores expect list splitting. This was cited as a common complaint when apps only support one store. | MEDIUM | Must understand which items are bulk/Costco purchases vs. weekly/Kroger. Can learn this over time from user corrections. |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected from competitors, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Conversational-first interface (no GUI forms)** | Every competitor is a traditional app with screens, buttons, calendars, and drag-and-drop. This product is entirely conversational. The spec says "No forms. No settings screens." This is fundamentally different from Ollie, Plan to Eat, Paprika, Samsung Food -- all of which are GUI apps. | HIGH | The entire UX paradigm is different. It is simultaneously a strength (frictionless, natural) and a risk (discoverability, complex information display). Telegram as the shell helps -- messaging is native. |
| **Recipe "brain" with accumulated learning** | No competitor remembers that YOUR version of butter chicken takes 70 minutes, not 45. No competitor remembers that you prefer jasmine rice over brown with Thai dishes. This is the core value from the spec: "the system remembers everything about your meals and reasons over that knowledge." | HIGH | This requires persistent per-recipe annotations (actual times, what worked, what didn't, substitutions you liked) and reliable retrieval during planning. This is architecturally hard -- Claude must have access to the right context at the right time. |
| **Post-meal feedback loop** | "How was the butter chicken tonight?" No meal planning app does this. Apps are abandoned after the grocery list is generated. This closes the loop -- feedback improves future plans. | LOW | Simple to implement (a scheduled message asking how dinner went), but the value compounds over time as the system accumulates cooking intelligence. The challenge is not being annoying. |
| **Pivot assistance (plan-goes-wrong recovery)** | "The chicken burned. What can I make instead?" No competitor handles this. Traditional apps are static plans. They do not help when reality deviates. The spec explicitly calls this out as a capability. | LOW | This is actually low complexity because it is just the LLM doing what it does best -- reasoning about constraints in real time. The key is that the system knows what is in your kitchen and your preferences, making suggestions relevant. |
| **Proactive prep reminders driven by recipe reasoning** | MealBoard and Meal Timer offer manual prep reminders. No competitor automatically reads a recipe, identifies that chicken needs defrosting, calculates timing based on YOUR dinner time, and sends an unsolicited reminder. This is the "reaches into your life" principle. | HIGH | Requires: (1) recipe analysis to identify prep-ahead steps, (2) timing calculation relative to dinner time, (3) scheduled notification delivery. Deferred from v1 per spec ("full proactive reminders" are out of scope), but a simplified version (daily prep summary) is in scope. |
| **Natural language preference changes** | "Actually, dinner is usually at 6:30 now" instead of finding a settings screen. Every competitor has a settings page. This product has a conversation. | LOW | The LLM naturally handles this. The complexity is in reliably persisting the change and overriding the previous value. |
| **Contextual grocery annotations** | "chicken thighs -- for butter chicken, needs defrosting" on the grocery list. No competitor annotates list items with their purpose and prep requirements. This helps the shopper (especially the partner who did not plan the meals) understand why each item is needed. | LOW | Low complexity to generate (the LLM knows which recipe needs each ingredient), high user value (the partner shopping independently can understand the list). |
| **Cooking history and "what haven't we made lately"** | The system tracks when you last made each recipe and surfaces forgotten favorites. Plan to Eat and Paprika let you rate recipes, but none proactively say "You haven't made that Thai basil chicken in 3 months and you rated it highly." | MEDIUM | Requires date-stamped cooking history per recipe and a retrieval mechanism during planning that weights recency. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Comprehensive nutritional tracking / calorie counting** | Users equate meal planning with diet tracking. Eat This Much, Fitia, and Strongr Fastr all center on macros and calories. | Fundamentally changes the product from "cooking partner" to "diet app." Adds massive complexity (nutritional databases, accuracy requirements, liability concerns). The target user is a home cook who loves cooking, not someone counting calories. Also, AI calorie estimates are unreliable -- nutritionists have warned against trusting AI for precise nutritional guidance. | If asked, provide rough nutritional context conversationally ("this is a rich, heavy meal" vs. "this is pretty light") but do not track or optimize for macros. |
| **Massive recipe database / recipe discovery** | Samsung Food offers 240,000 recipes. Users expect to browse and discover. | This product is about YOUR recipes, not a catalog. A huge database creates a paradox of choice, dilutes personalization, and shifts the value from "knows your cooking" to "generic recipe search" which Google already does better. | The system should suggest recipes from your own collection and occasionally suggest new ideas conversationally, but not be a recipe browser. |
| **URL recipe import / web scraping** | Plan to Eat, Paprika, Samsung Food, and RecipeOne all import from URLs. Users expect "save this recipe from the web." | Explicitly out of scope for v1 per spec. Web scraping is fragile (sites change HTML), legally gray (copyright), and technically complex (parsing hundreds of recipe formats). Also fights the conversational model -- pasting a URL is not a conversation. | For v1, the user describes the recipe conversationally. The bot can ask clarifying questions. In future versions, URL import could be added as a convenience, but should still result in a conversational confirmation ("I found a recipe for Thai basil chicken. It calls for 2 lbs chicken thigh, fish sauce, Thai basil... Does that match what you want?"). |
| **Photo/image recipe capture** | Users want to photograph a recipe card or cookbook page and have it digitized. Ollie and some competitors offer fridge photo analysis. | Out of scope for v1 per spec. Image processing adds significant complexity (OCR, parsing handwritten text, dealing with partial images). Also requires multimodal API calls that increase cost. | Conversational entry. If someone has a recipe card, they can read it to the bot ("It's a chicken soup -- 2 lbs chicken, carrots, celery..."). |
| **Real-time cooking mode / step-by-step guidance** | Samsung Food+ offers "Smart Cooking Mode" with hands-free, step-by-step guidance. Users imagine talking to the bot while cooking. | Requires voice interaction (out of scope), real-time responsiveness (Telegram message latency is too high for cooking), and screen-always-on behavior (not available in Telegram). Also a fundamentally different interaction pattern from planning. | The bot can answer questions about a recipe at any time ("what temp for the oven again?"), but does not try to be a step-by-step cooking companion. |
| **Automated grocery delivery integration** | Ollie integrates with Instacart, Walmart, and Amazon Fresh. Users want one-tap ordering. | Massive integration complexity (OAuth, store APIs, availability matching, price differences). The target user shops in-person at Kroger and Costco. Delivery integration serves a different user profile. | Generate a clean, organized grocery list. Let the user take it to the store. If they want to use Instacart, they can manually transfer -- but do not build the integration. |
| **Social features / recipe sharing with friends** | Plan to Eat has friend connections. Samsung Food has recipe communities. | Social features are a different product. They require user management, privacy controls, content moderation, and viral growth mechanics. For a personal/household tool, social adds noise. | The bot serves one household. If someone wants to share a recipe, they can copy/paste the text the bot provides. |
| **Budget tracking / price optimization** | Users want to plan meals within a budget. Research shows AI is "not very good about staying within a budget." | Requires real-time price data per store, which changes constantly and is not reliably available via API. Adds enormous complexity for marginal value. The target user's constraint is time, not money. | If the user mentions budget constraints, the bot can suggest generally cheaper meals, but does not track prices or optimize spend. |
| **Complex multi-household / multi-user management** | Users in shared living want per-person preferences. The spec mentions partner access. | Multi-user is explicitly out of scope for v1. It adds authentication complexity, permission models, conflict resolution ("I want tacos but my partner wants sushi"), and data model complexity. | For v1, the bot serves one user (the primary cook). The partner benefits through shared grocery lists (future) and being fed good meals. |

## Feature Dependencies

```
[Conversational Recipe Entry]
    |
    v
[Recipe Storage] -----> [Recipe Search/Retrieval]
    |                         |
    v                         v
[Weekly Meal Planning] -----> [Grocery List Generation]
    |                              |
    v                              v
[Preference Memory] ---------> [Multi-Store List Splitting]
    |
    v
[Cooking History Tracking]
    |
    v
[Post-Meal Feedback Loop] -----> [Recipe Brain / Accumulated Learning]
    |
    v
[Daily Prep Reminder (simplified)]
    |
    v (future)
[Full Proactive Reminders (event-driven, time-calculated)]
```

### Dependency Notes

- **Recipe Storage requires Conversational Entry:** Without a way to enter recipes, there is nothing to store. Entry is the bootstrap problem.
- **Meal Planning requires Recipe Storage:** Cannot plan meals from recipes you have not entered. This means early usage requires a "seeding" phase where the user enters enough recipes to plan a week.
- **Grocery List requires Meal Plan:** The list is generated from what was planned. Without a plan, it is just a generic shopping list (not our product).
- **Recipe Brain requires Feedback Loop:** The "brain" gets smarter from post-meal feedback. Without the feedback mechanism, learning stalls after initial entry.
- **Prep Reminders require Meal Plan + Recipe Content:** Must know what is being cooked, when, and what it requires to calculate reminder timing.
- **Preference Memory is orthogonal:** It enhances everything (planning, suggestions, reminders) but does not block any single feature. Can be added incrementally.
- **Multi-Store Splitting requires Grocery List + Preference Memory:** Must know the list and which store the user buys each category from.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate the core value proposition of "a cooking partner with perfect memory."

- [ ] **Conversational recipe entry** -- The primary way recipes enter the system. Without this, no content exists.
- [ ] **Recipe storage and retrieval** -- Must persist recipes across conversations and retrieve them on demand.
- [ ] **Basic recipe search** -- "What chicken recipes do I have?" "Show me quick weeknight meals."
- [ ] **Weekly meal plan generation** -- The core planning loop: describe your week, get a plan, adjust through conversation.
- [ ] **Grocery list generation** -- From the meal plan, produce a consolidated ingredient list.
- [ ] **Preference memory** -- Remember dietary restrictions, dinner time, cooking goals, store preferences across conversations.
- [ ] **Cooking history tracking** -- Record what was cooked and when, for future planning context.
- [ ] **Post-meal feedback (optional check-in)** -- "How was dinner?" to accumulate cooking intelligence.
- [ ] **Pivot assistance** -- On-demand help when plans change. This is just the LLM being helpful with context.
- [ ] **Daily prep reminder (simplified)** -- A daily message summarizing what is planned and any prep needed. Not event-driven, not time-calculated -- just a daily summary.

### Add After Validation (v1.x)

Features to add once core is working and the user is actively using the system weekly.

- [ ] **Multi-store grocery list splitting** -- Trigger: user complains about having to mentally split the list between Kroger and Costco.
- [ ] **Recipe annotations and accumulated learning** -- Trigger: enough feedback has accumulated that the system can meaningfully use it (actual prep times, substitution preferences).
- [ ] **Contextual grocery annotations** -- Trigger: partner starts shopping independently and needs context on list items.
- [ ] **"What haven't we made lately" suggestions** -- Trigger: enough cooking history exists (8+ weeks) to surface forgotten favorites.
- [ ] **Smarter prep reminders (time-aware)** -- Trigger: simplified reminders prove valuable but miss timing nuances (defrost the night before vs. morning of).

### Future Consideration (v2+)

Features to defer until the product is validated and the user wants more.

- [ ] **URL recipe import** -- Convenience feature, not core to conversational model.
- [ ] **Photo/image recipe capture** -- Requires multimodal API, adds cost and complexity.
- [ ] **Full proactive reminders (event-driven, time-calculated)** -- Requires scheduling infrastructure, calendar awareness.
- [ ] **Mini Apps (Telegram rich UI)** -- For grocery list checking, recipe display, week plan view.
- [ ] **Multi-user / partner access** -- Shared household with both partners interacting.
- [ ] **Voice interaction / cooking mode** -- Different interaction paradigm entirely.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Conversational recipe entry | HIGH | HIGH | P1 |
| Recipe storage and retrieval | HIGH | MEDIUM | P1 |
| Weekly meal plan generation | HIGH | MEDIUM | P1 |
| Grocery list generation | HIGH | MEDIUM | P1 |
| Preference memory | HIGH | MEDIUM | P1 |
| Basic recipe search | MEDIUM | LOW | P1 |
| Cooking history tracking | MEDIUM | LOW | P1 |
| Post-meal feedback loop | MEDIUM | LOW | P1 |
| Pivot assistance | MEDIUM | LOW | P1 |
| Daily prep reminder (simplified) | MEDIUM | LOW | P1 |
| Multi-store list splitting | MEDIUM | MEDIUM | P2 |
| Contextual grocery annotations | MEDIUM | LOW | P2 |
| Recipe brain (accumulated learning) | HIGH | HIGH | P2 |
| "Haven't made lately" suggestions | MEDIUM | LOW | P2 |
| Time-aware prep reminders | MEDIUM | HIGH | P2 |
| URL recipe import | MEDIUM | MEDIUM | P3 |
| Photo recipe capture | LOW | HIGH | P3 |
| Full proactive reminders | HIGH | HIGH | P3 |
| Mini Apps (rich UI) | MEDIUM | HIGH | P3 |
| Multi-user access | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Ollie | Plan to Eat | Paprika | Samsung Food | ChatGPT (manual) | **Our Approach** |
|---------|-------|-------------|---------|--------------|-------------------|------------------|
| Recipe entry | App forms, URL import | URL import, manual form, photo | URL import, manual form | URL import, browse catalog | User types prompts each session | **Conversational -- tell the bot your recipe in natural language** |
| Recipe storage | App database | Cloud sync | Cloud sync per platform | Cloud account | None (no memory) | **Persistent storage, retrieved via conversation** |
| Meal planning | AI-generated weekly plans, tap to swap | Drag-and-drop calendar | Drag-and-drop calendar | AI-generated, drag-and-drop | Generated per session, no persistence | **Conversational -- describe your week, get a plan, adjust by talking** |
| Grocery list | Auto-generated, Instacart/Walmart integration | Auto-generated, organized | Auto-generated, cross-device | Auto-generated, delivery integration | Generated but often inaccurate | **Auto-generated, store-section organized, annotated with recipe context** |
| Personalization | Learns family preferences, allergens | Manual tags and categories | Manual categories, ratings | AI recommendations from preferences | Restate preferences every session | **Persistent preference memory -- learns through conversation, never forgets** |
| Cooking feedback | None | Recipe ratings/notes (manual) | Recipe ratings (manual) | None | None | **Post-meal check-in, automatic annotation of recipes with real-world data** |
| Prep reminders | None | None | Timers during cooking | None (Smart Cooking Mode is step-by-step) | None | **Daily prep summary, future: intelligent time-based reminders** |
| Pivot/recovery | None | None | None | None | Can help if you re-prompt | **Built-in -- system knows your kitchen and preferences for instant alternatives** |
| Platform | Native iOS/Android app | Native app + web | Native app (per platform, paid each) | Native app + web | Web/app (separate tool) | **Telegram bot -- no app to install, works on all platforms** |
| Pricing | Subscription ($9.99/mo) | Subscription ($5.95/mo or $49/yr) | One-time purchase ($4.99/platform) | Free + Samsung Food+ subscription | ChatGPT subscription ($20/mo) | **Personal project, no pricing concerns for v1** |

### Competitive Gaps We Exploit

1. **No competitor closes the cooking feedback loop.** Every app stops at "plan and shop." None asks "how was dinner?" and uses the answer to improve future plans.
2. **No competitor has true preference memory through conversation.** Ollie learns from taps and ratings. ChatGPT forgets between sessions. We remember through natural conversation.
3. **No competitor offers pivot assistance.** Plans are static. When reality deviates, users are on their own.
4. **No competitor provides prep reminders driven by recipe understanding.** MealBoard has manual reminder setup. Nobody reads the recipe and figures out what needs doing ahead of time.
5. **No competitor annotates grocery lists with recipe context.** "Why am I buying Thai basil?" -- no app answers this on the list itself.

### Competitive Risks

1. **Ollie is well-funded and moving fast.** Their AI capabilities are improving. They could add conversational features.
2. **ChatGPT with memory (Projects feature) could replicate our core value** if users are disciplined about prompting. Our advantage is that we make it effortless -- the system asks, you answer, it remembers.
3. **Telegram as a platform is a constraint.** No rich UI means grocery list management is inferior to native apps until Mini Apps are built.

## Sources

- [Ollie AI - Family Meal Planner](https://ollie.ai/) (competitor analysis, feature set) - MEDIUM confidence
- [Plan to Eat - Meal Planner](https://www.plantoeat.com/) (competitor analysis, user reviews) - MEDIUM confidence
- [Paprika Recipe Manager](https://www.paprikaapp.com/) (competitor analysis, feature set) - MEDIUM confidence
- [Samsung Food](https://samsungfood.com/) (competitor analysis, feature set) - MEDIUM confidence
- [CNN Underscored - Best Meal Planning Apps 2026](https://www.cnn.com/cnn-underscored/reviews/best-meal-planning-apps) (industry overview) - MEDIUM confidence
- [Fitia - Top Meal Planning Apps with Grocery Lists 2026](https://fitia.app/learn/article/7-meal-planning-apps-smart-grocery-lists-us/) (feature comparison) - MEDIUM confidence
- [WDP Technologies - Meal Planning App Development Guide](https://www.wdptechnologies.com/meal-planning-app-development/) (table stakes features) - MEDIUM confidence
- [Zazz - Top 8 Features of Meal Planning Apps](https://www.zazz.io/blog/top-8-features-of-highly-profiting-meal-planning-apps) (industry features) - LOW confidence
- [PlanEatAI - ChatGPT Meal Planning 2026](https://planeatai.com/blog/using-chatgpt-for-meal-planning-updated-prompts-2026) (AI limitations) - MEDIUM confidence
- [Men's Health - ChatGPT Meal Plan](https://www.menshealth.com/nutrition/a64505299/chatgpt-meal-plan-ai/) (AI meal planning problems) - MEDIUM confidence
- [Delish - ChatGPT Meal Plan Review](https://www.delish.com/food-news/a64236165/ai-chatgpt-meal-plan-grocery-list/) (grocery list accuracy issues) - MEDIUM confidence
- [Washington Post - Ollie and AI Meal Planning Apps](https://www.washingtonpost.com/technology/2025/08/21/ai-meal-planning-home-apps/) (industry trend) - HIGH confidence
- [AnyList](https://www.anylist.com/) (collaborative grocery list features) - MEDIUM confidence
- [Bring! - Collaborative Shopping](https://www.getbring.com/en/features/collaborative) (shared list features) - MEDIUM confidence
- [Masterofcode - Chatbot Statistics 2026](https://masterofcode.com/blog/chatbot-statistics) (engagement data) - MEDIUM confidence

---
*Feature research for: Conversational AI Meal Planning Assistant*
*Researched: 2026-02-05*
