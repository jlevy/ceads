---
title: Create or Update PR with Validation Plan
description: Create or update a pull request with a detailed test/validation plan
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo and branch:
     ```
     BRANCH=$(git rev-parse --abbrev-ref HEAD)
     REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
     ```
   - Use `--repo $REPO` on all gh commands (required for Claude Code Cloud)

2. Check if a PR already exists for this branch:
   - Run: `gh pr view $BRANCH --repo $REPO --json number,url 2>/dev/null`
   - If it returns JSON, a PR exists (you’ll update it).
     If it errors, you’ll create one.

3. Review all commits on this branch since it diverged from main:
   - Run `git log main..HEAD --oneline` to see commits
   - Run `git diff main...HEAD` to see all changes
   - Review any related specs in docs/project/specs/active/

4. Write a PR title and description with these sections.
   Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
   `chore`, `plan`, `research`, `ops`, `process`. Scope is optional—only add when it
   resolves an important ambiguity.
   (See `tbd guidelines commit-conventions` for details.)

   ## Summary

   Brief description of the changes (2-3 sentences).

   ## Changes

   Bulleted list of specific changes made.

   ## Test Plan

   Detailed validation checklist:
   - [ ] Unit tests pass (`npm test`)
   - [ ] Build succeeds (`npm run build`)
   - [ ] Manual testing steps (list specific scenarios to test)
   - [ ] Edge cases considered (list any)

   ## Related Beads

   Link any related beads using their IDs.

5. Create or update the PR:
   - If creating:
     `gh pr create --repo $REPO --head $BRANCH --base main --title "..." --body "..."`
   - If updating: `gh pr edit $BRANCH --repo $REPO --title "..." --body "..."`

6. Report the PR URL to the user, summarize the validation plan, and inform them you are
   now waiting for CI.

7. **Wait for CI to pass (CRITICAL):**
   - Run: `gh pr checks $BRANCH --repo $REPO --watch 2>&1`
   - **IMPORTANT**: The `--watch` flag blocks until ALL checks complete.
     Do NOT see “passing” in early output and move on—wait for the **final summary**
     showing all checks passed.
   - If CI fails: analyze the failure, fix the issue, commit and push the fix, then
     restart from this step.
   - Only proceed when you see all checks have passed in the final summary.

8. Confirm to the user that CI has passed and the PR is ready for review.
