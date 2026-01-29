---
close_reason: Fixed getSyncStatus() to check worktree status instead of main branch. Changed git status to run with -C worktreePath to check uncommitted changes in the correct location.
closed_at: 2026-01-29T00:59:19.312Z
created_at: 2026-01-28T23:40:40.768Z
dependencies:
  - target: is-01kg3fp6pz0jzfff1bvdfbw0fs
    type: blocks
id: is-01kg3fp1y0e265fsk8whx2zgv4
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Update getSyncStatus() to check worktree, not main branch
type: is
updated_at: 2026-01-29T00:59:19.312Z
version: 4
---
Fix Bug 2: getSyncStatus() at sync.ts:140 runs 'git status --porcelain DATA_SYNC_DIR' on main branch where data-sync is gitignored. Change to check files in worktree path via resolveDataSyncDir(). Location: packages/tbd/src/cli/commands/sync.ts:128-218
