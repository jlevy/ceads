---
close_reason: "Audited sync.ts: All WORKTREE_DIR usages now use join(this.tbdRoot, WORKTREE_DIR). DATA_SYNC_DIR usages in git show commands are correct (referencing paths on sync branch)."
closed_at: 2026-01-29T01:01:16.026Z
created_at: 2026-01-28T23:40:50.746Z
dependencies:
  - target: is-01kg3fpmwcq4y6y7wa7yvzd8p3
    type: blocks
id: is-01kg3fpbntr05bzbj2q6cyrnsz
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Audit sync.ts for hardcoded DATA_SYNC_DIR/WORKTREE_DIR usage
type: is
updated_at: 2026-01-29T01:01:16.026Z
version: 4
---
Review all sync operations for hardcoded WORKTREE_DIR or DATA_SYNC_DIR usage. All data paths MUST go through resolveDataSyncDir(). Only exception: worktree creation/repair in git.ts. Document findings and fix any remaining hardcoded paths. Location: packages/tbd/src/cli/commands/sync.ts
