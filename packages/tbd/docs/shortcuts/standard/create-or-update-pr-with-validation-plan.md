---
title: Create or Update PR with Validation Plan
description: Create or update a pull request with a detailed test/validation plan
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Check if a PR already exists for this branch using `gh pr view`. If it does, you’ll
   be updating it. If not, you’ll create one.

2. Review all commits on this branch since it diverged from main:
   - Run `git log main..HEAD --oneline` to see commits
   - Run `git diff main...HEAD` to see all changes
   - Review any related specs in docs/project/specs/active/

3. Write a PR title and description with these sections.
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

4. Create or update the PR:
   - If creating: `gh pr create --title "..." --body "..."`
   - If updating: `gh pr edit --title "..." --body "..."`

5. Report the PR URL to the user and summarize the validation plan.
