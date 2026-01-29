---
close_reason: Updated commitWorktreeChanges() and fullSync() to use this.tbdRoot instead of process.cwd() for consistent path resolution. Also updated getSyncStatus() to use tbdRoot.
closed_at: 2026-01-29T01:00:42.340Z
created_at: 2026-01-28T23:40:45.663Z
dependencies:
  - target: is-01kg3fpbntr05bzbj2q6cyrnsz
    type: blocks
id: is-01kg3fp6pz0jzfff1bvdfbw0fs
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Update commitWorktreeChanges() to use dataSyncDir consistently
type: is
updated_at: 2026-01-29T01:00:42.341Z
version: 4
---
Fix Bug 1: commitWorktreeChanges() uses hardcoded join(process.cwd(), WORKTREE_DIR) at line 273. Should derive worktree path from this.dataSyncDir. Same issue in fullSync() at line 427. Location: packages/tbd/src/cli/commands/sync.ts:272-308, 423-594
