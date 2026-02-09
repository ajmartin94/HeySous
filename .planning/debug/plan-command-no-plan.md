---
status: diagnosed
trigger: "/plan command says no plan exists despite user just creating one through conversation"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - System prompt tells Claude to propose a plan and iterate, but never instructs it to call save_meal_plan after the user approves or during the initial proposal. Claude generates the plan as text only.
test: Traced full flow from system prompt -> tool definitions -> tool handler -> repository -> /plan handler query
expecting: Mismatch between conversational plan creation and database persistence
next_action: Report root cause

## Symptoms

expected: After user asks bot to "plan my dinners for this week" and gets a meal plan, /plan should show that plan
actual: /plan says user hasn't planned yet
errors: None (just wrong behavior)
reproduction: 1) Ask bot to plan dinners 2) Get meal plan response 3) Send /plan 4) See "no plan" message
started: Unknown

## Eliminated

- hypothesis: /plan command queries wrong table or wrong date
  evidence: /plan handler (src/bot/handlers/plan.ts) queries meal_plans JOIN meal_plan_entries WHERE chat_id AND week_start_date via raw SQLite, using the same getWeekStartDate() function. The query is correct.
  timestamp: 2026-02-09T00:00:30Z

- hypothesis: save_meal_plan tool handler doesn't actually persist data
  evidence: Tool handler (src/ai/tool-handler.ts:195-230) correctly calls planRepository.savePlan() which does proper INSERT operations via Drizzle ORM. The repository code (src/planning/repository.ts) is sound.
  timestamp: 2026-02-09T00:00:40Z

- hypothesis: Tool wiring is broken (tools not passed to Claude)
  evidence: Pipeline processor (src/pipeline/processor.ts:195) concatenates all tool sets including PLAN_TOOLS into allTools array and passes them to sendMessageWithTools. Tool handler is created with planRepository injected. Wiring is correct.
  timestamp: 2026-02-09T00:00:50Z

## Evidence

- timestamp: 2026-02-09T00:00:30Z
  checked: System prompt meal planning instructions (src/ai/system-prompt.ts lines 51-113)
  found: The CREATING A PLAN section says "Propose a full Monday-Sunday dinner plan in one message" but NEVER says "then call save_meal_plan to persist it". The USING PLAN TOOLS section documents save_meal_plan usage but only as a reference, not as a workflow step.
  implication: Claude is instructed to propose a plan (text output) but not to save it. The save_meal_plan tool exists and works, but Claude is never told to call it as part of plan creation flow.

- timestamp: 2026-02-09T00:00:35Z
  checked: System prompt ADJUSTING PLANS section
  found: Says "Apply changes IMMEDIATELY without confirmation" and "No finalize step -- plans are living objects, always open for changes" but does not say to call save_meal_plan when applying changes either.
  implication: The instructions treat plans as conversational objects, not database objects. There is no step in the documented workflow that transitions from "proposed plan" to "saved plan".

- timestamp: 2026-02-09T00:00:40Z
  checked: USING PLAN TOOLS section specifically
  found: "save_meal_plan: Always send the COMPLETE plan (all entries), not just changes. The tool replaces all entries for that week." This documents HOW to use the tool, but there is no instruction anywhere that says WHEN to use it (e.g., "after proposing a plan, immediately save it using save_meal_plan").
  implication: The tool documentation tells Claude the API contract but not the workflow trigger. Claude can use save_meal_plan but has no instruction telling it to do so proactively.

- timestamp: 2026-02-09T00:00:45Z
  checked: /plan command handler (src/bot/handlers/plan.ts)
  found: Uses raw SQLite query against meal_plans + meal_plan_entries tables, filtering by chat_id and week_start_date from getWeekStartDate(). Returns "No meal plan for this week yet!" when entries.length === 0.
  implication: The /plan command only sees plans that were persisted via save_meal_plan tool. If Claude never calls save_meal_plan, the database has no rows, and /plan correctly reports no plan exists.

- timestamp: 2026-02-09T00:00:50Z
  checked: Full pipeline flow (src/pipeline/processor.ts)
  found: Tools are properly wired. planRepository is passed to both the tool handler and used for getActivePlans context. The sendMessageWithTools loop supports up to 10 iterations of tool calls.
  implication: The infrastructure for saving plans is fully functional. The gap is purely in the system prompt instructions -- Claude is never told to call save_meal_plan as part of plan creation.

## Resolution

root_cause: The system prompt (src/ai/system-prompt.ts, MEAL_PLANNING_PROMPT constant, lines 51-113) instructs Claude to "Propose a full Monday-Sunday dinner plan in one message" but never instructs it to call save_meal_plan to persist the plan to the database. The CREATING A PLAN workflow has no save step. The ADJUSTING PLANS section similarly lacks a save step. The USING PLAN TOOLS section documents save_meal_plan's API contract but not WHEN to call it. As a result, Claude generates meal plans as text responses without persisting them. The /plan command (src/bot/handlers/plan.ts) queries the meal_plans database table, which is empty because save_meal_plan was never called.
fix:
verification:
files_changed: []
