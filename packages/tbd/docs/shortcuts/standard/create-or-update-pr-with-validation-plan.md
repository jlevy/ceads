---
title: Create or Update PR with Validation Plan
description: Create or update a pull request with a detailed test/validation plan
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Determine repository and branch info:
   - Get the current branch: `git rev-parse --abbrev-ref HEAD`
   - Extract the GitHub repo (OWNER/REPO) from the remote URL. The remote may be:
     - Standard GitHub URL: `https://github.com/OWNER/REPO.git` or
       `git@github.com:OWNER/REPO.git`
     - Proxy URL (Claude Code): `http://local_proxy@127.0.0.1:PORT/git/OWNER/REPO`
   - For proxy URLs, extract OWNER/REPO from the path after `/git/`
   - Store as `REPO=OWNER/REPO` and `BRANCH=current-branch-name`

2. Check if a PR already exists for this branch:
   - Run: `gh pr view $BRANCH --repo $REPO --json number,url 2>/dev/null`
   - If it returns JSON, a PR exists (you’ll update it).
     If it errors, you’ll create one.

3. Review all commits on this branch since it diverged from main:
   - Run `git log main..HEAD --oneline` to see commits
   - Run `git diff main...HEAD` to see all changes
   - Review any related specs in docs/project/specs/active/

4. Write a PR title and description with these sections:

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

   ## Related Issues

   Link any related tbd issues using their IDs.

5. Create or update the PR:
   - If creating:
     `gh pr create --repo $REPO --head $BRANCH --base main --title "..." --body "..."`
   - If updating: `gh pr edit $BRANCH --repo $REPO --title "..." --body "..."`

6. Report the PR URL to the user and summarize the validation plan.
