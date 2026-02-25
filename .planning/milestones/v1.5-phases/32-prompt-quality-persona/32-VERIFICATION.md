---
phase: 32-prompt-quality-persona
verified: 2026-02-21T10:45:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 32: Prompt Quality & Persona Verification Report

**Phase Goal:** Sous speaks with one consistent voice across all interactions, prompt instructions are clear and non-contradictory, and the system prompt is structured for effective prompt caching
**Verified:** 2026-02-21T10:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All Claude interactions (chat, onboarding, feedback detection) use the same Sous persona definition from a single source | VERIFIED | `SOUS_PERSONA` exported from `system-prompt.ts` (line 14), imported and used by `sender.ts` (lines 12, 64, 75); feedback extractor intentionally excluded and documented |
| 2 | The `import_from_url` tool description and system prompt give consistent instructions about URL recipe import behavior | VERIFIED | `tools.ts` line 111-112: "call save_knowledge immediately in the same turn -- do not wait for a separate confirmation step"; no "wait for confirmation" text found anywhere in `src/` |
| 3 | System prompt explicitly documents recipe ID format for plan modifications, preference save-vs-skip durability signals, and dinner time cross-reference in reminders section | VERIFIED | `system-prompt.ts` line 146: `RECIPE ID FORMAT IN PLAN CONTEXT`; line 620: `DURABILITY SIGNALS (save vs. skip):`; line 278: `DINNER TIME SYNC:` within `REMINDER_PROMPT` |
| 4 | Static system prompt content is separated from dynamic household context so the Anthropic API can cache the stable prefix across requests | VERIFIED | `buildStaticPrompt()` (line 691) and `buildDynamicContext()` (line 721) exported separately; `claude-client.ts` lines 28, 36: `cache_control: { type: "ephemeral" }` on static block only; processor wires both at lines 275-287 |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ai/system-prompt.ts` | Unified persona constant, instruction gap fixes, `buildStaticPrompt`, `buildDynamicContext` | VERIFIED | Contains `SOUS_PERSONA` (line 14), `DURABILITY SIGNALS` (line 620), `RECIPE ID FORMAT` (line 146), `DINNER TIME SYNC` (line 278), `buildStaticPrompt` (line 691), `DynamicContextParams` interface (line 699), `buildDynamicContext` (line 721), `buildSystemPrompt` backward-compat wrapper (line 765) |
| `src/ai/tools.ts` | Fixed `import_from_url` description matching system prompt | VERIFIED | Lines 107-112: description says "call save_knowledge immediately in the same turn -- do not wait for a separate confirmation step" |
| `src/ai/claude-client.ts` | Two-block system parameter with `cache_control` on static block only | VERIFIED | `SystemPromptInput` type (line 14), `buildSystemBlocks()` helper (line 22), `cache_control: { type: "ephemeral" }` on static block (line 28, 36); dynamic block has no `cache_control` (lines 39-41) |
| `src/pipeline/processor.ts` | Imports `buildStaticPrompt` and `buildDynamicContext`, passes `{ static, dynamic }` | VERIFIED | Line 46: imports both functions; lines 275-287: builds both and passes as `{ static: staticPrompt, dynamic: dynamicContext }` |
| `src/reminders/sender.ts` | Uses `SOUS_PERSONA` for reminder and prep alert system prompts | VERIFIED | Line 12: `import { SOUS_PERSONA } from "../ai/system-prompt.js"`; lines 64 and 75: both `REMINDER_SYSTEM_PROMPT` and `PREP_ALERT_SYSTEM_PROMPT` use `${SOUS_PERSONA}` |
| `src/feedback/extractor.ts` | Intentionally persona-free with clarifying comment | VERIFIED | Lines 31-33: explicit comment "Focused system prompt for feedback extraction -- intentionally no Sous persona. This is a structured JSON extraction task, not a conversational interaction. The SOUS_PERSONA constant is NOT used here by design." |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ai/system-prompt.ts` | `src/reminders/sender.ts` | `SOUS_PERSONA` export consumed by reminder system prompts | WIRED | `sender.ts` imports `SOUS_PERSONA` (line 12) and uses it in both `REMINDER_SYSTEM_PROMPT` (line 64) and `PREP_ALERT_SYSTEM_PROMPT` (line 75) |
| `src/ai/tools.ts` | `src/ai/system-prompt.ts` | `import_from_url` description aligns with RECIPE IMPORT section | WIRED | Both say auto-save immediately without waiting for confirmation; no contradiction found |
| `src/pipeline/processor.ts` | `src/ai/system-prompt.ts` | Imports `buildStaticPrompt` and `buildDynamicContext` | WIRED | Line 46: `import { buildStaticPrompt, buildDynamicContext } from "../ai/system-prompt.js"` |
| `src/pipeline/processor.ts` | `src/ai/claude-client.ts` | Passes `{ static, dynamic }` to `sendMessageWithTools` | WIRED | Line 287: `const systemPrompt: SystemPromptInput = { static: staticPrompt, dynamic: dynamicContext }` passed to `sendMessageWithTools` at line 312 |
| `src/ai/claude-client.ts` | Anthropic API | `cache_control` on static block only | WIRED | `buildSystemBlocks()`: static block gets `cache_control: { type: "ephemeral" }` (line 28, 36); dynamic block has no `cache_control` (lines 39-41) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROMPT-01 | 32-01 | `import_from_url` tool description matches system prompt (no conflicting instructions) | SATISFIED | `tools.ts` says "immediately...do not wait"; `system-prompt.ts` RECIPE IMPORT section says "IMMEDIATELY in the same response"; old "wait for confirmation" text absent from entire `src/` |
| PROMPT-02 | 32-01 | Preference capture includes explicit durability signals for save vs. skip decisions | SATISFIED | `system-prompt.ts` line 620-624: `DURABILITY SIGNALS (save vs. skip)` section with SAVE/SKIP rules and "next month" test |
| PROMPT-03 | 32-01 | Recipe ID format `[recipe #ID]` is explicitly documented for plan modification | SATISFIED | `system-prompt.ts` lines 146-149: `RECIPE ID FORMAT IN PLAN CONTEXT` section in `MEAL_PLANNING_PROMPT` |
| PROMPT-04 | 32-01 | Dinner time sync requirement is cross-referenced in reminder prompt section | SATISFIED | `system-prompt.ts` lines 278-281: `DINNER TIME SYNC` section in `REMINDER_PROMPT` explaining the reminder fires at `dinner_time` and preference sync handles updates |
| PROMPT-05 | 32-01 | All Claude interactions share a unified Sous persona definition | SATISFIED | Single `SOUS_PERSONA` constant in `system-prompt.ts` used by chat (via `buildStaticPrompt`), reminders (sender.ts), prep alerts (sender.ts); extractor intentionally excluded and documented |
| PERF-02 | 32-02 | Static system prompt instructions are separated from dynamic context for effective prompt caching | SATISFIED | `buildStaticPrompt()` + `buildDynamicContext()` split; two-block system parameter with `cache_control` on static block; processor passes both separately |

All 6 requirements for this phase are marked complete in REQUIREMENTS.md and verified in code.

### Anti-Patterns Found

None found. No TODOs, FIXMEs, placeholder returns, or empty implementations detected in modified files.

### Human Verification Required

None required for this phase. All changes are prompt instruction text and code structure changes that are fully verifiable by static analysis.

However, prompt quality improvements (voice consistency, instruction clarity) would benefit from qualitative testing:

1. **Test:** Send a URL to the bot and observe whether it auto-saves without waiting for confirmation
   **Expected:** Bot calls `import_from_url` then `save_knowledge` in a single turn, presents the saved recipe
   **Why human:** Requires live bot interaction with the Anthropic API

2. **Test:** Tell the bot "I'm not feeling chicken tonight" and verify it does NOT save a preference
   **Expected:** Bot acknowledges conversationally but does not call `save_knowledge`
   **Why human:** Requires live bot interaction to observe tool call behavior

3. **Test:** Check reminder messages to confirm they sound like Sous (warm, casual, cooking-nerd voice)
   **Expected:** Reminder text matches the persona in SOUS_PERSONA (enthusiastic, not corporate)
   **Why human:** Voice quality is a subjective assessment

---

## Summary

Phase 32 fully achieved its goal. The codebase evidence is unambiguous:

**Plan 32-01 (Persona unification + instruction gaps):**
- `SOUS_PERSONA` is a single exported constant used by all Claude interaction points
- `import_from_url` conflict resolved -- tool description and system prompt both say "immediately, same turn"
- Three instruction gaps filled: `DURABILITY SIGNALS` (preference save/skip), `RECIPE ID FORMAT IN PLAN CONTEXT` (plan modifications), `DINNER TIME SYNC` in reminders section
- Feedback extractor correctly excluded from persona with explicit documentation

**Plan 32-02 (Prompt caching structure):**
- `buildStaticPrompt()` and `buildDynamicContext()` cleanly separated
- `buildSystemPrompt()` backward-compatible wrapper preserved
- Claude client accepts `SystemPromptInput` union type (string or `{ static, dynamic }`)
- `buildSystemBlocks()` applies `cache_control: { type: "ephemeral" }` to static block only
- Processor wires both parts correctly

TypeScript check: passes with no errors. Test suite: 152 tests pass across 12 test files.

---

_Verified: 2026-02-21T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
