---
created_at: 2026-02-03T06:31:26.834Z
dependencies:
  - target: is-01kgh3ebft6bxjvtfrgccpxawn
    type: blocks
id: is-01kgh35sbktnthef99q5grz5zp
kind: bug
labels: []
priority: 1
status: open
title: tbd doctor shows 0 issues when remote tbd-sync branch has data
type: is
updated_at: 2026-02-03T06:36:34.104Z
version: 3
---
## Problem

When running `tbd doctor` on a fresh clone where:
- The local `tbd-sync` branch doesn't exist
- But `origin/tbd-sync` exists with issues

The STATISTICS section shows:
```
Total: 0
Ready: 0
```

Even though the remote has 27+ (or 700+) issues.

## Root Cause

In `doctor.ts:63-77`:
- `resolveDataSyncDir()` falls back to `.tbd/data-sync/` when worktree is missing
- On fresh clone, this directory is empty
- `listIssues()` returns empty array
- Statistics calculated from empty array

The 'Clone status' warning catches this but the prominent statistics still show 0.

## Expected Behavior

When local has 0 issues but remote branch has data:
- Statistics should indicate: `Total: 0 local (X on remote - run 'tbd sync')`
- Or `doctor --fix` should auto-sync

## Steps to Reproduce

1. Clone a repo with tbd issues
2. Run `tbd doctor` (without running `tbd sync` first)
3. Observe Statistics shows Total: 0
