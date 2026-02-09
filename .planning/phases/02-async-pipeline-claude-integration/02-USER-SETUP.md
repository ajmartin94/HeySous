# Phase 2: User Setup Required

**Generated:** 2026-02-06
**Phase:** 02-async-pipeline-claude-integration
**Status:** Incomplete

Complete these items for Claude AI integration to function. Claude automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `ANTHROPIC_API_KEY` | console.anthropic.com -> API Keys -> Create Key | `.env` |

## Account Setup

- [ ] **Create Anthropic account** (if needed)
  - URL: https://console.anthropic.com/
  - Skip if: Already have Anthropic account with API access

## Verification

After completing setup:

```bash
# Check env var is set
grep ANTHROPIC_API_KEY .env

# Verify the key works (quick test)
npx tsx -e "
import Anthropic from '@anthropic-ai/sdk';
const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const r = await c.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Say hi' }] });
console.log('API key works:', r.content[0].type === 'text' ? 'YES' : 'NO');
"
```

Expected: API key is set and the test returns "API key works: YES".

---

**Once all items complete:** Mark status as "Complete" at top of file.
