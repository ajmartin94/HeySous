---
status: diagnosed
trigger: "Bot rejects cooking-related requests as off-topic. 'give me a numbered list of 3 cooking tips' gets redirected."
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:00:00Z
---

## Current Focus

hypothesis: The <boundaries> section in the system prompt uses an exhaustive allowlist that omits general cooking knowledge like tips, techniques, and advice
test: Read the exact boundary language and compare to the rejected request
expecting: The allowlist says "food, cooking, meal planning, recipes, ingredients, kitchen tips, and related topics" which SHOULD cover cooking tips but the redirect phrase "I only know my way around a kitchen" contradicts by implying a narrower scope
next_action: Return diagnosis

## Symptoms

expected: Bot answers "give me a numbered list of 3 cooking tips" with actual cooking tips
actual: Bot redirects user saying to only talk about kitchen-related things
errors: None (functional behavior, not crash)
reproduction: Send "give me a numbered list of 3 cooking tips" to the bot
started: Likely since system prompt was written

## Eliminated

(none needed -- root cause identified on first pass)

## Evidence

- timestamp: 2026-02-09T00:00:00Z
  checked: /workspace/src/ai/system-prompt.ts lines 324-329
  found: |
    The <boundaries> block reads:
    - "You ONLY discuss food, cooking, meal planning, recipes, ingredients, kitchen tips, and related topics"
    - Redirect phrase: "Ha, I only know my way around a kitchen! But I can help you figure out dinner if you want."
  implication: |
    The allowlist explicitly includes "cooking" and "kitchen tips" which should cover the request.
    However, the redirect phrase "I only know my way around a kitchen! But I can help you figure out dinner if you want"
    is problematic -- it narrows the bot's self-concept to just "figuring out dinner" rather than general
    cooking knowledge. The redirect steers toward dinner planning even when the user's request IS on-topic.

    The root issue is the redirect phrasing, not the allowlist itself. The redirect says
    "I can help you figure out dinner" which implies the bot's only purpose is dinner planning,
    causing the LLM to interpret a general cooking tips request as off-topic despite "cooking"
    being explicitly in the allowlist.

- timestamp: 2026-02-09T00:00:00Z
  checked: Overall system prompt structure
  found: |
    The system prompt is heavily weighted toward recipe management, meal planning, grocery lists,
    reminders, and feedback. There is no section for general cooking knowledge/tips/advice.
    Every domain section is task-oriented (save recipe, create plan, generate grocery list).
    The <personality> section says "You're a real cooking nerd who gets excited about techniques and flavors"
    but this is contradicted by the lack of any explicit encouragement to share general cooking knowledge.
  implication: |
    The LLM sees an overwhelmingly task-focused prompt and interprets its role narrowly as a
    task executor (meal plans, recipes, grocery lists) rather than a general cooking knowledge companion.
    A generic "give me cooking tips" request doesn't map to any task, so the LLM defaults to the
    boundary redirect.

## Resolution

root_cause: |
  Two compounding issues in /workspace/src/ai/system-prompt.ts:

  1. REDIRECT PHRASING (lines 326-327): The boundary redirect says "I only know my way around a kitchen!
     But I can help you figure out dinner if you want." This narrows the bot's self-concept to dinner planning.
     When the LLM evaluates whether "give me 3 cooking tips" is in-scope, the redirect's framing of
     "figure out dinner" makes general cooking advice seem off-topic, even though "cooking" and "kitchen tips"
     are in the allowlist.

  2. TASK-HEAVY PROMPT CONTEXT: The entire rest of the system prompt (recipe_management, meal_planning,
     grocery_list_management, reminder_management, preference_management, feedback_loop) is exclusively
     task-oriented. There is zero encouragement to share general cooking knowledge, techniques, tips,
     or advice outside of a specific task context. The LLM pattern-matches the user's request against
     its available "modes" and finds no match, triggering the boundary redirect.

  Issue #1 is the primary cause. Issue #2 amplifies it.

fix: (not applied -- research only)
verification: (not applicable)
files_changed: []
