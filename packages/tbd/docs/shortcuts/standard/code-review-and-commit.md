---
title: Commit Code
description: Run pre-commit checks, review changes, and commit code
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Follow the `tbd shortcut precommit-process` steps to review and run pre-commit
   checks.

2. If there are problems, ask for guidance.
   Otherwise, commit directly.
   Do NOT ask the user for permission to commit unless there are problems.
   Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
   `chore`, `plan`, `research`, `ops`, `process`. Scope is optional—only add when it
   resolves an important ambiguity.
   (See `tbd guidelines commit-conventions` for details.)

3. If commit is successful, push to remote:
   - Run: `git push`

4. If there is a PR already filed for this branch, update the PR description and **wait
   for CI to pass**:
   - **GitHub CLI setup** (if issues, run `tbd shortcut setup-github-cli`):
     ```
     REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
     ```
   - Check for PR: `gh pr view --repo $REPO --json number,url 2>/dev/null`
   - If PR exists, update it with current changes summary
   - Inform the user you are waiting for CI
   - Run: `gh pr checks --repo $REPO --watch 2>&1`
   - **IMPORTANT**: The `--watch` flag blocks until ALL checks complete.
     Do NOT see “passing” in early output and move on—wait for the **final summary**
     showing all checks passed.
   - If CI fails: analyze the failure, fix the issue, commit and push, then restart the
     CI watch.
   - Only proceed when you see all checks have passed.
   - Confirm to the user that CI has passed.
