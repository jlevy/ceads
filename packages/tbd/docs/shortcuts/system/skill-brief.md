---
title: tbd Workflow (Brief)
description: Condensed tbd workflow guide for agents
---
**`tbd` helps humans and agents ship code with greater speed, quality, and discipline.**

1. **Issue Tracking**: Git-native tasks/bugs.
   Never lose work across sessions.
2. **Spec-Driven Workflows**: Plan features → break into issues → implement
   systematically.
3. **Shortcuts**: Pre-built processes for commits, PRs, reviews.
4. **Guidelines**: Best practices for TypeScript, Python, testing.

## Core Commands

```bash
tbd ready              # Find work ready to start
tbd show <id>          # View issue details
tbd create "title"     # Create new issue
tbd close <id>         # Mark complete
tbd sync               # Sync with remote
```

## Quick Actions

| Need | Command |
| --- | --- |
| Found a bug | `tbd create "..." --type=bug` |
| Plan a feature | `tbd shortcut new-plan-spec` |
| Commit code | `tbd shortcut commit-code` |
| Create a PR | `tbd shortcut create-or-update-pr-simple` |
| TypeScript review | `tbd guidelines typescript-rules` |

## Session Protocol

**Before ending ANY session:**

1. Commit and push: `git add . && git commit && git push`
2. Watch CI: `gh pr checks <PR> --watch 2>&1`
3. Update issues: `tbd close <id> --reason="..."`
4. Sync: `tbd sync`
5. Confirm CI passed before declaring “done”
