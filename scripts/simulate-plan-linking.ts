/**
 * One-off simulation: Verify Claude links recipes to meal plans.
 *
 * Calls the real Anthropic API with the production system prompt and tool
 * definitions, using a mock tool handler that returns seeded recipe data.
 * Asserts that Claude calls search_knowledge before save_meal_plan and
 * includes valid knowledge_item_id values.
 *
 * Usage: npx tsx scripts/simulate-plan-linking.ts
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../src/ai/system-prompt.js";
import { KNOWLEDGE_TOOLS, PLAN_TOOLS } from "../src/ai/tools.js";

// ── Seed data (matches real production recipes) ──────────────────────

const SEED_RECIPES = [
  {
    id: 31,
    title: "Fish Tacos",
    summary: "Crispy fish tacos with lime crema and pickled onions",
    tags: ["recipe", "cuisine:mexican", "protein:fish"],
  },
  {
    id: 28,
    title: "Sheet Pan Roasted Vegetables with Greens",
    summary: "Seasonal vegetables roasted with herbs and olive oil",
    tags: ["recipe", "protein:vegetarian"],
  },
  {
    id: 29,
    title: "Stir-Fried Napa Cabbage with Shiitake and Potatoes",
    summary: "Quick stir-fry with napa cabbage, shiitake mushrooms, and crispy potatoes",
    tags: ["recipe", "cuisine:asian", "protein:vegetarian"],
  },
  {
    id: 36,
    title: "Buddha Bowls with Roasted Root Vegetables",
    summary: "Nourishing bowls with roasted root vegetables, grains, and tahini dressing",
    tags: ["recipe", "protein:vegetarian"],
  },
  {
    id: 15,
    title: "Chicken Parmesan",
    summary: "Classic breaded chicken with marinara and melted mozzarella",
    tags: ["recipe", "cuisine:italian", "protein:chicken"],
  },
];

const VALID_IDS = new Set(SEED_RECIPES.map((r) => r.id));

// ── Mock tool handler ────────────────────────────────────────────────

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

const toolCalls: ToolCall[] = [];

function mockToolHandler(
  name: string,
  input: Record<string, unknown>,
): string {
  toolCalls.push({ name, input });

  switch (name) {
    case "search_knowledge": {
      const query = ((input.query as string) ?? "").toLowerCase();
      const matches = SEED_RECIPES.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.summary.toLowerCase().includes(query) ||
          r.tags.some((t) => t.includes(query)),
      );
      const results = matches.length > 0 ? matches : SEED_RECIPES;
      return JSON.stringify({
        message: `${results.length} results found, 500 tokens used`,
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
          relevance: 1.0,
          tags: r.tags,
        })),
      });
    }

    case "get_knowledge_item": {
      const recipe = SEED_RECIPES.find((r) => r.id === input.id);
      if (!recipe) return JSON.stringify({ error: "Not found" });
      return JSON.stringify({
        id: recipe.id,
        title: recipe.title,
        summary: recipe.summary,
        content: `Full recipe content for ${recipe.title}...`,
        source: "user",
        tags: recipe.tags,
      });
    }

    case "save_meal_plan": {
      const entries = (input.entries as any[]).map((e: any, i: number) => ({
        day: e.day,
        dayName: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ][e.day],
        mealType: e.meal_type ?? "dinner",
        recipeName: e.recipe_name,
        knowledgeItemId: e.knowledge_item_id ?? null,
      }));
      return JSON.stringify({
        message: `Saved plan for week of ${input.week_start_date}`,
        plan: { id: 1, weekStartDate: input.week_start_date, entries },
      });
    }

    case "get_meal_plan":
      return JSON.stringify({ message: "No plan found for this week" });

    case "get_cooking_history":
      return JSON.stringify({ history: [] });

    default:
      return JSON.stringify({ error: `Unhandled tool: ${name}` });
  }
}

// ── Multi-turn conversation runner ───────────────────────────────────

async function runConversation(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  tools: Anthropic.Tool[],
  userMessages: string[],
  maxIterationsPerTurn: number = 5,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const messages: Anthropic.MessageParam[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let lastText = "";

  for (const userMsg of userMessages) {
    messages.push({ role: "user", content: userMsg });
    console.log(`  User: "${userMsg}"`);

    for (let iter = 0; iter < maxIterationsPerTurn; iter++) {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: [{ type: "text", text: systemPrompt }],
        messages,
        tools,
      });

      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;

      // Extract text from this response
      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (textBlocks) lastText = textBlocks;

      // Handle tool use
      const toolBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (toolBlocks.length === 0 || response.stop_reason === "end_turn") {
        // Turn complete — append assistant response and break to next user message
        messages.push({ role: "assistant", content: response.content });
        break;
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = toolBlocks.map(
        (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: mockToolHandler(
            block.name,
            block.input as Record<string, unknown>,
          ),
        }),
      );

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }

  return { text: lastText, inputTokens: totalInput, outputTokens: totalOutput };
}

// ── Run simulation ───────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set in .env");
    process.exit(1);
  }

  const model = "claude-haiku-4-5-20251001";
  console.log(`Using model: ${model}\n`);

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 60_000 });
  const systemPrompt = buildSystemPrompt();
  const tools = [...KNOWLEDGE_TOOLS, ...PLAN_TOOLS] as Anthropic.Tool[];

  console.log("Running multi-turn conversation...\n");

  const response = await runConversation(client, model, systemPrompt, tools, [
    "Plan meals for next week. Check what recipes we have saved and use those.",
    "Looks great, save it!",
  ]);

  // ── Print results ──────────────────────────────────────────────────

  console.log("─── Tool Call Sequence ───");
  for (const [i, call] of toolCalls.entries()) {
    console.log(`  ${i + 1}. ${call.name}`);
  }
  console.log();

  const savePlanCall = toolCalls.find((c) => c.name === "save_meal_plan");
  if (savePlanCall) {
    console.log("─── save_meal_plan Input ───");
    console.log(JSON.stringify(savePlanCall.input, null, 2));
    console.log();
  }

  console.log(`─── Claude's Response ───`);
  console.log(response.text.slice(0, 500));
  console.log();

  // ── Assertions ─────────────────────────────────────────────────────

  const results: Array<{ name: string; pass: boolean; detail: string }> = [];

  // 1. Called search_knowledge
  const searchIndex = toolCalls.findIndex(
    (c) => c.name === "search_knowledge",
  );
  results.push({
    name: "Claude called search_knowledge",
    pass: searchIndex >= 0,
    detail: searchIndex >= 0 ? `at position ${searchIndex + 1}` : "not called",
  });

  // 2. Called save_meal_plan
  const saveIndex = toolCalls.findIndex((c) => c.name === "save_meal_plan");
  results.push({
    name: "Claude called save_meal_plan",
    pass: saveIndex >= 0,
    detail: saveIndex >= 0 ? `at position ${saveIndex + 1}` : "not called",
  });

  // 3. search before save
  results.push({
    name: "search_knowledge called before save_meal_plan",
    pass: searchIndex >= 0 && saveIndex >= 0 && searchIndex < saveIndex,
    detail:
      searchIndex >= 0 && saveIndex >= 0
        ? `search@${searchIndex + 1} save@${saveIndex + 1}`
        : "missing calls",
  });

  // 4. At least some entries have knowledge_item_id
  let linkedCount = 0;
  let totalEntries = 0;
  if (savePlanCall) {
    const entries = savePlanCall.input.entries as any[];
    totalEntries = entries.length;
    linkedCount = entries.filter(
      (e: any) => e.knowledge_item_id != null,
    ).length;
  }
  results.push({
    name: "Some entries have knowledge_item_id",
    pass: linkedCount > 0,
    detail: `${linkedCount}/${totalEntries} entries linked`,
  });

  // 5. All knowledge_item_ids are valid (no hallucinated IDs)
  let allValid = true;
  const invalidIds: number[] = [];
  if (savePlanCall) {
    const entries = savePlanCall.input.entries as any[];
    for (const e of entries) {
      if (e.knowledge_item_id != null && !VALID_IDS.has(e.knowledge_item_id)) {
        allValid = false;
        invalidIds.push(e.knowledge_item_id);
      }
    }
  }
  results.push({
    name: "All knowledge_item_ids match seed data",
    pass: allValid,
    detail: allValid ? "all valid" : `invalid IDs: ${invalidIds.join(", ")}`,
  });

  // ── Print assertion results ────────────────────────────────────────

  console.log("─── Assertions ───");
  let allPassed = true;
  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  ${icon}: ${r.name} (${r.detail})`);
    if (!r.pass) allPassed = false;
  }
  console.log();

  console.log(
    `Token usage: ${response.inputTokens} input, ${response.outputTokens} output`,
  );

  if (!allPassed) {
    console.error("\nSimulation FAILED — some assertions did not pass.");
    process.exit(1);
  }

  console.log("\nSimulation PASSED — all assertions passed.");
}

main().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
