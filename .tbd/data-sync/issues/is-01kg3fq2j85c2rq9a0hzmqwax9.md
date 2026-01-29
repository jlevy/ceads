---
close_reason: Added --fix flag to tbd sync command. When worktree is unhealthy and --fix is provided, attempts repair by pruning stale entries and reinitializing worktree.
closed_at: 2026-01-29T01:04:54.030Z
created_at: 2026-01-28T23:41:14.183Z
dependencies:
  - target: is-01kg3fq74xtepfgcjyfh6kx67z
    type: blocks
id: is-01kg3fq2j85c2rq9a0hzmqwax9
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Add --fix flag to tbd sync
type: is
updated_at: 2026-01-29T01:04:54.031Z
version: 4
---
Add --fix option to sync command. When worktree is unhealthy and --fix is provided, attempt repair before syncing. Call repairWorktree() which prunes stale entries and recreates worktree. Location: packages/tbd/src/cli/commands/sync.ts:597-606
