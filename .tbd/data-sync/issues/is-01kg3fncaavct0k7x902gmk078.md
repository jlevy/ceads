---
created_at: 2026-01-28T23:40:18.634Z
dependencies:
  - target: is-01kg3fngz2acc5gx2tatk24k1d
    type: blocks
id: is-01kg3fncaavct0k7x902gmk078
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Sync: Check worktree health before operations"
type: is
updated_at: 2026-01-28T23:40:30.111Z
version: 2
---
Update sync.ts run() to check worktree health at start. If unhealthy, throw clear error suggesting 'tbd doctor --fix'. Later phase will add --fix flag to sync. Must use enhanced checkWorktreeHealth() with prunable detection. Location: packages/tbd/src/cli/commands/sync.ts:54-87
