# Phase 56: Database Operation Test Coverage - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Review and improve test coverage of major database operations, with particular focus on memory deduplication. Add tests for critical DB paths that are currently untested.

</domain>

<decisions>
## Implementation Decisions

### Priority areas
- Memory dedup pipeline (save_memory with FTS5 dedup threshold check) — no existing tests
- Memory CRUD operations (save, delete, search via FTS5)
- Knowledge item dedup (existing tests in tool-handler-dedup.test.ts — review coverage)
- Application settings read/write
- Meal plan CRUD operations

### Test approach
- Use Vitest with in-memory SQLite for DB tests
- Follow existing test patterns (see tests/ directory structure mirroring src/)
- Focus on business logic correctness, not ORM plumbing

### Claude's Discretion
- Which specific operations to prioritize based on code audit
- Test file organization (new files vs. extending existing)
- Whether to add integration-style tests or pure unit tests
- Edge cases to cover (concurrent writes, FTS5 ranking thresholds, etc.)

</decisions>

<specifics>
## Specific Ideas

- Memory FTS5 dedup is the highest priority — this is new in Phase 49 and has a threshold (rank < 5.0) that should be tested
- Existing test files: 16 test files covering AI tools, pipeline, knowledge FTS, reminders, etc.
- No existing tests for memory repository or dedup pipeline

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/knowledge/fts.test.ts` — pattern for testing FTS5 search operations
- `tests/ai/tool-handler-dedup.test.ts` — pattern for testing dedup logic
- `tests/db/migrations.test.ts` — pattern for testing DB schema operations

### Established Patterns
- Vitest framework with `.js` extensions in imports
- `vi.useFakeTimers()` for time-dependent tests
- Tests mirror src/ directory structure

### Integration Points
- `src/memory/repository.ts` — memory CRUD + FTS5 dedup
- `src/knowledge/repository.ts` — knowledge item operations
- `src/db/schema.ts` — Drizzle schema definitions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 56-database-operation-test-coverage*
*Context gathered: 2026-03-06*
