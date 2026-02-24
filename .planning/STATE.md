# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.
**Current focus:** v1.5 Agent Hardening & Polish -- Phase 39: Admin Dashboard

## Current Position

Phase: 39 of 40 (Admin Dashboard)
Plan: 2 of 2 in current phase
Status: Phase 39 Complete
Last activity: 2026-02-24 -- Completed 39-02 admin dashboard frontend

Progress: [========================================] 97% (86/88 plans complete through Phase 39-02)

## Performance Metrics

**v1.0-v1.4 Cumulative:**
- Total plans completed: 66
- Total execution time: ~234 min across 5 milestones
- Average: ~3.5 min/plan

## Accumulated Context

### Decisions

All decisions documented in PROJECT.md Key Decisions table.
- Phase 33-03: Hardcoded 4,000 char limit on combined debounced content, rejected before DB persistence
- [Phase 33]: Dual-layer sanitization: sanitizeAndLog in processor for logging + sanitizeForPrompt in system prompt builder as defense-in-depth safety net
- Phase 33-02: Validation returns JSON with is_error:true flag; per-item array validation reports specific index for Claude self-correction
- Phase 34-01: Tool inputs logged on error always, on success only with LOG_TOOL_INPUTS=true; sanitizeToolError strips stack traces, file paths, SQL via regex
- Phase 34-02: Haiku pricing as _fallback for unknown models; recipe validation checks Ingredients:/Steps: headers with content patterns; incomplete_recipe flag for Claude self-correction
- Phase 35-02: Optimistic locking via version columns on stateful tables; conflict returns structured JSON with is_error:true and conflict:true; householdId as updatedBy
- [Phase 35]: retryWithBackoff internal to claude-client; only 429 errors retried; thinking-longer message sent once on first retry only
- Phase 35-03: wasTruncated distinguishes budget trimming from session gaps; 80% threshold for proactive trimming; conversation_note XML tag for invisible truncation notice
- Phase 36-01: Budget check before DB save -- exhausted budget means message not persisted; midnight boundary via Intl.DateTimeFormat offset; daily limit messages out-of-character per user decision
- Phase 36-02: Self-join knowledge_tags (filter vs fetch aliases) for single-query preference loading; byte-length / 3.3 for token estimation replacing 4-chars heuristic
- Phase 36-03: Content-aware dedup with 85% Jaccard threshold; ingredient overlap for recipes, word-level similarity for preferences; content-weighted BM25 search
- Phase 37-01: Plain text parse_mode during streaming, HTML only on final edit; 300ms edit interval; short replies as fresh messages; onText fires every iteration
- Phase 37-02: Remove 30s timeout timer for streaming; non-streaming fallback on placeholder failure; finalize with marker-stripped clean text; partial text saved on stream error
- Phase 38-01: Override Telegram --tg-theme-* and --tgui--* CSS variables per theme so existing component CSS works unchanged; default Dark theme with Small font size
- Phase 38-02: Dark tag text #a3d4a2 (~5:1 contrast), light #2d5a2c (~7:1); help page organized by workflow with Try: examples in Sous voice; font sizes use CSS var() for setting responsiveness
- Phase 39-01: Admin guard uses config.adminUserIds inline check (no DB lookup); activity feed uses separate queries per event type merged in JS rather than UNION ALL
- Phase 39-02: Admin Hub section rendered outside loading conditional for immediate visibility; SVG BarChart uses viewBox-based responsive sizing; budget line computed as weighted cost-per-token projection

### Pending Todos

26 pending todos in `.planning/todos/pending/`. All scoped into v1.5 requirements.

### Blockers/Concerns

None.

### Roadmap Evolution

5 milestones shipped: v1.0 (10 phases), v1.1 (4 phases), v1.2 (5 phases), v1.3 (5 phases), v1.4 (7 phases).
v1.5 planned: 9 phases (32-40), 26 requirements mapped.
Total: 40 phases across 6 milestones.
- Phase 40 added: Reminder Resilience & Recipe Time Extraction (45min fallback, plan-recipe linking guard, structured time metadata)

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 39-02-PLAN.md
Next action: Execute Phase 40 (Reminder Resilience & Recipe Time Extraction)
Resume file: .planning/phases/39-admin-dashboard/39-02-SUMMARY.md
