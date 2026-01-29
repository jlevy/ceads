---
title: Create or Update PR (Simple)
description: Create or update a pull request with a concise summary
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: Create or Update PR (Simple)

We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Check if a PR already exists for this branch using `gh pr view`. If it does, you’ll
   be updating it. If not, you’ll create one.

2. Review all commits on this branch since it diverged from main:
   - Run `git log main..HEAD --oneline` to see commits
   - Run `git diff main...HEAD` to see all changes

3. Write a PR title and description:
   - Title should be concise and describe the change (e.g., “Add user authentication”)
   - Description should have a brief summary of what changed and why

4. Create or update the PR:
   - If creating: `gh pr create --title "..." --body "..."`
   - If updating: `gh pr edit --title "..." --body "..."`

5. Report the PR URL to the user.
