---
title: Merge Upstream
description: Merge origin/main into current branch with conflict resolution
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Merge upstream changes from origin/main into the current branch.

## Steps

1. **Check state**: Run `git status` and `git fetch --all`
   - If uncommitted changes exist, ask user whether to commit first

2. **Review upstream changes**: Check commits on origin/main since branch diverged
   - `git log HEAD..origin/main --oneline`

3. **Review local changes**: Check commits on this branch since diverging
   - `git log origin/main..HEAD --oneline`
   - `git diff origin/main...HEAD --stat`

4. **Evaluate conflicts**: Identify likely logical or structural conflicts before
   merging

5. **Merge**: Run `git merge origin/main`
   - Resolve all conflicts carefully with full context
   - For each conflict, understand both sides before choosing resolution

6. **Verify**: Run formatting, linting, and tests
   - Fix any issues introduced by the merge
   - Commit the merge result
