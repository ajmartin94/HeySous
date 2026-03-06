---
name: release
description: Walk through the full HeySous release process for a milestone. Use this skill whenever the user says "release", "ship it", "cut a release", "deploy to prod", "create a release", "tag a version", or otherwise indicates they want to publish a milestone to production. Also trigger when the user has just completed a milestone and asks "what's next" in the context of shipping.
---

# Release Process

Interactive walkthrough for shipping a HeySous milestone to production. Each step checks prerequisites before proceeding and waits for user confirmation.

The release process has two phases: **preparation** (steps 1-4, done on the milestone branch) and **shipping** (steps 5-7, involves merging and tagging).

## Step 1: Verify milestone completion

Check that the GSD milestone is complete:

```bash
# Check for incomplete plans
ls .planning/phases/*/*.md 2>/dev/null | grep PLAN | while read plan; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "INCOMPLETE: $plan"
done
```

If incomplete plans exist, tell the user and suggest `/gsd:execute-phase` for the relevant phase. Do not proceed until all plans have summaries.

If the user hasn't run `/gsd:complete-milestone` yet, suggest it now. This archives the milestone and prepares the branch for merge.

## Step 2: Review pending todos

Read all files in `.planning/todos/pending/`:

```bash
ls .planning/todos/pending/*.md 2>/dev/null
```

For each todo, present it to the user and ask:
- **Close** — already done or no longer relevant (delete the file)
- **Fold** — should be a requirement in the next milestone (note it for later)
- **Keep** — still pending, leave it alone

Present todos in a numbered list so the user can batch their decisions (e.g., "close 1, 3, 5; fold 2; keep 4").

## Step 3: Write release notes

Read `src/notifications/release-notes.ts` to see the existing format and version numbers.

Determine the new version number from the milestone branch name (e.g., `gsd/v1.6-...` → `"1.6.0"`).

Gather what was built by reading the milestone's phase summaries:
```bash
ls .planning/phases/*/*.md 2>/dev/null | grep SUMMARY
```

Draft release notes in Sous's conversational voice following the existing pattern:
- Opening line that's warm and personal
- Bulleted feature list using `<b>` tags for feature names
- Closing call-to-action

Present the draft to the user for approval. On approval, add the entry to `RELEASE_NOTES` in `src/notifications/release-notes.ts`. The key is the version string (e.g., `"1.6.0"`), the value is the HTML string using the `.join("\n")` array pattern.

Release notes auto-deliver once per household via the `notifications` / `notification_deliveries` tables — `seedNotifications()` handles insertion on startup. No manual notification step needed.

## Step 4: Update help docs (if needed)

Read `src/bot/handlers/help.ts` and the Mini App help page. If new user-facing features were added that aren't covered in help, suggest updates. If help is already current, confirm and move on.

## Step 5: Create PR

This is the shipping boundary — confirm with the user before proceeding.

```bash
# Show what will be in the PR
git log main..HEAD --oneline
```

Create a PR from the milestone branch to `main`:
```bash
gh pr create --base main --title "v1.X: [milestone name]" --body "..."
```

The PR body should include a summary of phases completed and key features. Remind the user: **squash-merge manually** — do not merge from the CLI.

Wait for the user to confirm they've merged the PR before proceeding.

## Step 6: Tag the release

After the user confirms the PR is merged:

```bash
git checkout main && git pull
git tag v1.X
git push origin v1.X
```

Confirm the tag was pushed successfully.

## Step 7: Deploy

Remind the user to deploy. On startup, `seedNotifications()` will insert the new release notes and users will see them on next interaction.

Present a final summary:
- Version released
- Features shipped
- Todos folded into next milestone (if any)
- Release notes version key

Suggest next steps: `/gsd:new-milestone` to start the next cycle.
