---
name: tbd
description: >-
  Git-native issue tracking, coding guidelines, and workflow shortcuts for AI
  coding agents. Use when managing tasks, committing code, following engineering
  best practices, or planning features.
license: MIT
compatibility: Requires Node.js 18+ and git. Install CLI first: npm install -g get-tbd@latest
metadata:
  author: jlevy
  repository: https://github.com/jlevy/tbd
---
# tbd

**Git-native issue tracking, coding guidelines, and workflow shortcuts.**

tbd helps humans and agents ship code with greater speed, quality, and discipline.

## Prerequisites

Before using tbd commands, ensure the CLI is installed:

```bash
npm install -g get-tbd@latest
tbd setup --auto
```

If `tbd` is not available, install it first.
All commands below require the CLI.

## Capabilities

1. **Issue Tracking (Beads)**: Create, track, and close git-native issues.
   Track tasks, bugs, and features across sessions.
2. **Coding Guidelines**: 25+ engineering guidelines (TypeScript, Python, TDD, testing,
   monorepos) loaded on demand.
3. **Workflow Shortcuts**: Reusable instruction templates for code review, commits, PRs,
   planning, cleanup, and handoffs.
4. **Spec-Driven Planning**: Plan features, break into trackable beads, implement
   systematically.

## Core Commands

```bash
tbd ready              # Find work ready to start
tbd create "title"     # Create new issue
tbd close <id>         # Mark complete
tbd sync               # Sync with remote
tbd status             # Project status
```

## Key Shortcuts

| Command | Purpose |
| --- | --- |
| `tbd shortcut code-review-and-commit` | Pre-commit checks and commit |
| `tbd shortcut create-or-update-pr-simple` | Create or update a PR |
| `tbd shortcut new-plan-spec` | Plan a new feature |
| `tbd shortcut review-code` | Comprehensive code review |
| `tbd shortcut implement-beads` | Implement from a spec |
| `tbd shortcut merge-upstream` | Merge main into branch |
| `tbd shortcut agent-handoff` | Hand off to another agent |

Run `tbd shortcut --list` for all available shortcuts.

## Key Guidelines

| Command | Purpose |
| --- | --- |
| `tbd guidelines typescript-rules` | TypeScript best practices |
| `tbd guidelines python-rules` | Python best practices |
| `tbd guidelines general-tdd-guidelines` | Test-driven development |
| `tbd guidelines golden-testing-guidelines` | Snapshot/golden testing |
| `tbd guidelines general-coding-rules` | General coding rules |

Run `tbd guidelines --list` for all available guidelines.

## Session Protocol

Before ending any session:

1. Commit and push code
2. Watch CI: `gh pr checks <PR> --watch 2>&1`
3. Update issues: `tbd close <id>`
4. Sync: `tbd sync`
5. Confirm CI passed
