---
title: tbd Workflow (Brief)
description: Condensed tbd workflow guide for agents
---
**`tbd` helps humans and agents ship code with greater speed, quality, and discipline.**

1. **Beads**: Git-native issue tracking (tasks, bugs, features).
   Never lose work across sessions.
2. **Spec-Driven Workflows**: Plan features → break into beads → implement
   systematically.
3. **Shortcuts**: Reusable instruction templates for common workflows.
4. **Guidelines**: Coding rules and best practices.

## Core Commands

```bash
tbd ready              # Find beads ready to start
tbd show <id>          # View bead details
tbd create "title"     # Create new bead
tbd close <id>         # Mark complete
tbd sync               # Sync with remote
```

## Quick Actions

| Need | Command |
| --- | --- |
| Found a bug | `tbd create "..." --type=bug` |
| Plan a feature | `tbd shortcut new-plan-spec` |
| Commit code | `tbd shortcut code-review-and-commit` |
| Create a PR | `tbd shortcut create-or-update-pr-simple` |
| TypeScript review | `tbd guidelines typescript-rules` |

## Session Protocol

**Before ending ANY session:**

1. Commit and push: `git add . && git commit && git push`
2. Watch CI: `gh pr checks <PR> --watch 2>&1`
3. Update beads: `tbd close <id> --reason="..."`
4. Sync: `tbd sync`
5. Confirm CI passed before declaring “done”
