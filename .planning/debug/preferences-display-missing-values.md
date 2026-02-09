---
status: resolved
trigger: "/preferences shows vague labels instead of actual preference values; egg allergy not shown"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes identified
test: Code trace complete
expecting: N/A
next_action: Report findings

## Symptoms

expected: /preferences shows actual values like "6pm" next to preference names, and egg allergy appears in list
actual: Only vague titles like "Dinner Time Preference" shown under "Household" tag; egg allergy absent entirely
errors: None (no crash, just wrong display)
reproduction: Set preference "dinner at 6pm", state egg allergy, then run /preferences
started: Since initial implementation (Phase 05)

## Eliminated

(none needed -- root causes found on first investigation pass)

## Evidence

- timestamp: 2026-02-09
  checked: formatPreferenceLine() in src/bot/handlers/preferences.ts line 76-91
  found: Line 90 returns `- ${pref.title}${markerSuffix}` -- ONLY uses pref.title, completely ignores pref.summary
  implication: ROOT CAUSE #1 -- summary field (which contains actual value like "Prefers dinner at 6pm") is retrieved from DB but never rendered

- timestamp: 2026-02-09
  checked: PreferenceSummary interface in src/knowledge/preferences.ts line 7-12
  found: Interface includes both title and summary fields; getPreferenceSummaries() queries both from DB
  implication: Data is available, just not used in display

- timestamp: 2026-02-09
  checked: groupPreferences() in src/bot/handlers/preferences.ts lines 44-62
  found: Priority order is subject:household > pref:dietary > pref:schedule > cooking tags > other
  implication: ROOT CAUSE #2 -- "dinner at 6pm" has both subject:household and pref:schedule tags. subject:household wins priority, so it lands in Household group instead of Schedule. An egg allergy tagged subject:household + pref:dietary would also land in Household, not Dietary.

- timestamp: 2026-02-09
  checked: Egg allergy missing from /preferences entirely
  found: getPreferenceSummaries() filters on kt.tag = 'preference'. If Claude's save_knowledge call omitted the 'preference' tag for the allergy item, it would not appear at all.
  implication: The allergy not appearing is likely an AI tagging issue -- Claude may have tagged it with severity:allergy and pref:dietary but missed the required 'preference' base tag. This is a soft failure mode since correct tagging depends on the LLM following system prompt instructions.

- timestamp: 2026-02-09
  checked: save_knowledge tool description in src/ai/tools.ts lines 54-91
  found: Description says "For preferences, tags should include: 'preference', plus domain tags..." -- the 'preference' tag is critical but only specified in prose, not enforced in code
  implication: No code-level guarantee that preference items get the 'preference' tag. Entirely depends on Claude following instructions.

## Resolution

root_cause: |
  TWO ROOT CAUSES:

  1. DISPLAY BUG (definite): formatPreferenceLine() at src/bot/handlers/preferences.ts:90 only renders
     pref.title (e.g., "Dinner Time Preference") and ignores pref.summary (e.g., "Prefers dinner at 6pm").
     The summary is fetched from the database but never included in the output string.

  2. MISSING ALLERGY (probable): The egg allergy likely wasn't tagged with the base 'preference' tag
     by Claude when saving via save_knowledge. The getPreferenceSummaries() query at
     src/knowledge/preferences.ts:37 filters strictly on kt.tag = 'preference'. If that tag is missing,
     the item exists in the knowledge base but is invisible to /preferences. There is no code-level
     enforcement that preference items include the 'preference' tag.

  SECONDARY ISSUE: The groupPreferences() priority (line 47-62) checks subject:household before
  pref:dietary, so a preference tagged with both (common for household meal timing) gets classified
  as "Household" rather than "Schedule", which is confusing but not the primary bug.

fix: (not applied -- research only)
verification: (not applied -- research only)
files_changed: []
