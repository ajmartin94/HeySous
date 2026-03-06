# AI / Sous Agent

The AI agent powering HeySous is referred to as "Sous" in all project discussion, to avoid confusion with Claude (the model used in Claude Code). The underlying model is Claude, but the product-facing identity is Sous.

## Adding a Sous tool

1. Add tool definition to `src/ai/tools.ts`
2. Add handler case in `src/ai/tool-handler.ts`
3. Add tool to `allTools` array in `src/pipeline/processor.ts`
4. Add behavioral instructions to `src/ai/system-prompt.ts`

## Key files

- `tools.ts` — Tool definitions (JSON schema for each tool)
- `tool-handler.ts` — Tool execution logic, dedup pipelines, validation
- `system-prompt.ts` — Dynamic system prompt builder with memory injection
- `client.ts` — Anthropic SDK client wrapper
