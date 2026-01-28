---
close_reason: Added WorktreeMissingError, WorktreeCorruptedError, SyncBranchError classes to errors.ts
closed_at: 2026-01-28T23:54:43.081Z
created_at: 2026-01-28T23:39:21.989Z
dependencies:
  - target: is-01kg3fkv48kzhzq6e86z0hm3p0
    type: blocks
  - target: is-01kg3fpgdvx6b4e21wwgnnrtqh
    type: blocks
id: is-01kg3fkn069k8eam8debzxncq7
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Add WorktreeMissingError, WorktreeCorruptedError, SyncBranchError classes
type: is
updated_at: 2026-01-28T23:54:43.081Z
version: 5
---
Add error classes to errors.ts per spec design. WorktreeMissingError for missing worktree, WorktreeCorruptedError for invalid worktree, SyncBranchError for sync branch issues. Location: packages/tbd/src/cli/lib/errors.ts
