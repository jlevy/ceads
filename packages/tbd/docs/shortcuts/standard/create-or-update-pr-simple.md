---
title: Create or Update PR (Simple)
description: Create or update a pull request with a concise summary
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Determine repository and branch info (**CRITICAL - do this first**):
   - Run: `BRANCH=$(git rev-parse --abbrev-ref HEAD)`
   - Run: `REMOTE_URL=$(git remote get-url origin)`
   - Extract OWNER/REPO from the remote URL. The sed command handles both formats:
     - Standard GitHub: `https://github.com/OWNER/REPO.git` or
       `git@github.com:OWNER/REPO`
     - Proxy URL (Claude Code Cloud): `http://...127.0.0.1:.../git/OWNER/REPO`
   - Run:
     `REPO=$(echo "$REMOTE_URL" | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Verify: `echo "REPO=$REPO BRANCH=$BRANCH"`

   **Why `--repo` is required:** The `gh` CLI needs to know which GitHub repository to
   target. Using `--repo $REPO` explicitly works in all environments:
   - Direct connections: Works (gh could auto-detect, but explicit is reliable)
   - Proxy connections (Claude Code Cloud): Required (gh cannot detect repo from proxy
     URL)

   Always use `--repo $REPO` on all gh commands for consistency and reliability.

2. Check if a PR already exists for this branch:
   - Run: `gh pr view $BRANCH --repo $REPO --json number,url 2>/dev/null`
   - If it returns JSON, a PR exists (you’ll update it).
     If it errors, you’ll create one.

3. Review all commits on this branch since it diverged from main:
   - Run `git log main..HEAD --oneline` to see commits
   - Run `git diff main...HEAD` to see all changes

4. Write a PR title and description:
   - Title should be concise and describe the change (e.g., “Add user authentication”)
   - Description should have a brief summary of what changed and why
   - If you’re changing an existing PR, update the title to be current
   - Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`,
     `test`, `chore`, `plan`, `research`, `ops`, `process`. Scope is optional—only add
     when it resolves an important ambiguity.
     (See `tbd guidelines commit-conventions` for details.)

5. Create or update the PR:
   - If creating:
     `gh pr create --repo $REPO --head $BRANCH --base main --title "..." --body "..."`
   - If updating: `gh pr edit $BRANCH --repo $REPO --title "..." --body "..."`

6. Report the PR URL to the user.
