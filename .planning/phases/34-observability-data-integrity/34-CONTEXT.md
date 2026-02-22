# Phase 34: Observability & Data Integrity - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every tool call is traceable in logs with timing and outcome, error details never leak to the LLM, extracted recipes are validated before save, and model pricing covers current model IDs. This phase wraps validated tool handlers (from Phase 33) with logging, sanitizes errors for Claude, and adds recipe completeness checks.

</domain>

<decisions>
## Implementation Decisions

### Error communication
- Tools return descriptive errors to Claude (tool name, what failed, actionable context) so Sous can attempt intelligent retries
- If retries are exhausted and the error must reach the user, Claude receives only a generic sanitized message — zero implementation leakage (no stack traces, file paths, SQL, or tool names)
- Sous paraphrases the apology naturally each time (no canned template)
- Sous does NOT offer to retry or draw attention to the failure — just apologizes and moves on
- The retry mechanism itself is Phase 35 (Resilience); Phase 34 focuses on error sanitization at the boundary

### Log content & structure
- Structured tool call logs via Pino to stdout (no SQLite persistence, no new log destinations)
- Every tool call logged with: tool_name, duration_ms, household_id, success/error status
- Full tool input parameters logged on error only (not on success by default)
- Environment variable toggle (e.g., `LOG_TOOL_INPUTS=true`) to enable full input logging on success for temporary debugging
- User message content and recipe data may appear in logs — no PII stripping required (single-operator system)

### Recipe validation rules
- Required fields for ALL recipe saves (not just URL/photo imports): title, ingredients, instructions
- Ingredients threshold: any non-empty list is acceptable (no minimum count or specificity requirement)
- Validation applies at the tool handler level — every save_recipe call is checked regardless of source
- Rejection message to Claude includes specific missing fields so Sous can ask the user for them

### Validation feedback flow
- When a recipe is missing required fields, Sous asks the user to provide the missing information (e.g., "I got the title and ingredients but no instructions — can you describe how to make it?")
- After user provides info, Sous shows the combined recipe for confirmation before saving
- One round of gap-filling only — if still incomplete after one ask, save the partial recipe with a note that it's incomplete
- Partial recipes are saved (user can edit later via Mini App) rather than dropped entirely

### Claude's Discretion
- Exact log format and field names beyond the required ones
- Error sanitization implementation approach (middleware wrapper vs. per-handler)
- MODEL_PRICING fallback strategy for unknown model IDs
- How to mark partial recipes as incomplete in the data model

</decisions>

<specifics>
## Specific Ideas

- Error flow is two-tier: descriptive errors for Claude's internal retry logic, generic errors for user-facing messages
- "When we get to the point of sending a message to the user, we must avoid implementation leakage"
- Partial recipe saves should be clearly distinguished from complete ones so the user knows to revisit them

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-observability-data-integrity*
*Context gathered: 2026-02-21*
