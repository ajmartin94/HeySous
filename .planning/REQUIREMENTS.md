# Requirements: HeySous

**Defined:** 2026-02-21
**Core Value:** The recipe brain -- an AI agent that remembers everything about your meals and reasons over that knowledge to help you plan.

## v1.5 Requirements

Requirements for v1.5 Agent Hardening & Polish. Sourced from comprehensive 3-agent audit of the Sous AI agent implementation.

### Security & Input Validation

- [x] **SEC-01**: System enforces per-household message rate limits and daily token cost budgets
- [x] **SEC-02**: User-controlled text (display names, preferences) is sanitized before system prompt injection
- [x] **SEC-03**: Tool handler inputs are bounds-validated (string length, array size, number ranges)
- [x] **SEC-04**: Incoming user messages are rejected above a configurable length threshold

### Resilience

- [x] **RES-01**: Anthropic API 429 errors trigger exponential backoff with jitter instead of blind retry
- [x] **RES-02**: Concurrent meal plan modifications cannot silently overwrite each other (race condition fix)
- [x] **RES-03**: Context window overflow is detected before API call and triggers graceful degradation
- [x] **RES-04**: Claude is informed when conversation history has been truncated

### Performance & Cost

- [x] **PERF-01**: Preference loading uses a single query instead of N+1 pattern
- [x] **PERF-02**: Static system prompt instructions are separated from dynamic context for effective prompt caching
- [x] **PERF-03**: Token estimation uses accurate counting instead of 4 chars/token heuristic
- [x] **PERF-04**: Claude responses stream to Telegram for lower perceived latency

### Prompt Quality

- [x] **PROMPT-01**: import_from_url tool description matches system prompt (no conflicting instructions)
- [x] **PROMPT-02**: Preference capture includes explicit durability signals for save vs. skip decisions
- [x] **PROMPT-03**: Recipe ID format [recipe #ID] is explicitly documented for plan modification
- [x] **PROMPT-04**: Dinner time sync requirement is cross-referenced in reminder prompt section
- [x] **PROMPT-05**: All Claude interactions share a unified Sous persona definition
- [x] **PROMPT-06**: Knowledge deduplication searches content beyond title-only matching

### Observability

- [x] **OBS-01**: Every tool call is logged with name, duration, household_id, and success/error status
- [x] **OBS-02**: Tool error messages are sanitized before returning to Claude (no internal details leaked)
- [x] **OBS-03**: MODEL_PRICING includes entries for Sonnet and Opus with unknown-model fallback

### Data Integrity

- [x] **DATA-01**: Extracted recipes are validated for required fields (title, ingredients, instructions) before save

### Configuration

- [x] **CFG-01**: Conversation session boundary is configurable (not hardcoded 4 hours)

### UI/UX

- [x] **UX-01**: Mini App offers theme selection, font size adjustment, and improved tag contrast
- [ ] **UX-02**: Admin dashboard shows activity feed, usage stats, cost trends, and feedback overview

### Documentation

- [ ] **DOCS-01**: Help page update is part of the release checklist and reflects current features

## Future Requirements

None deferred -- all audit findings scoped into v1.5.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full observability platform (Grafana/Datadog) | Logging + DB tracking sufficient for current scale |
| Redis-based rate limiting | In-memory or SQLite sufficient for single-process architecture |
| WebSocket real-time sync | Polling model works, streaming is for Claude responses only |
| Automated penetration testing | Manual audit covered security; automated testing deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 36 | Complete |
| SEC-02 | Phase 33 | Complete |
| SEC-03 | Phase 33 | Complete |
| SEC-04 | Phase 33 | Complete |
| RES-01 | Phase 35 | Complete |
| RES-02 | Phase 35 | Complete |
| RES-03 | Phase 35 | Complete |
| RES-04 | Phase 35 | Complete |
| PERF-01 | Phase 36 | Complete |
| PERF-02 | Phase 32 | Complete |
| PERF-03 | Phase 36 | Complete |
| PERF-04 | Phase 37 | Complete |
| PROMPT-01 | Phase 32 | Complete |
| PROMPT-02 | Phase 32 | Complete |
| PROMPT-03 | Phase 32 | Complete |
| PROMPT-04 | Phase 32 | Complete |
| PROMPT-05 | Phase 32 | Complete |
| PROMPT-06 | Phase 36 | Complete |
| OBS-01 | Phase 34 | Complete |
| OBS-02 | Phase 34 | Complete |
| OBS-03 | Phase 34 | Complete |
| DATA-01 | Phase 34 | Complete |
| CFG-01 | Phase 36 | Complete |
| UX-01 | Phase 38 | Complete |
| UX-02 | Phase 39 | Pending |
| DOCS-01 | Phase 38 | Pending |

**Coverage:**
- v1.5 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation (phases 32-39)*
