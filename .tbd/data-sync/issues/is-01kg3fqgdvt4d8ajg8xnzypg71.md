---
created_at: 2026-01-28T23:41:28.378Z
dependencies:
  - target: is-01kg3fqmvn9pzrvyjf5jt758hh
    type: blocks
id: is-01kg3fqgdvt4d8ajg8xnzypg71
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Add confirmation prompt for destructive repair operations
type: is
updated_at: 2026-01-28T23:41:42.296Z
version: 2
---
Add confirmation prompt before: deleting wrong-location data after migration, pruning worktree entries. Use existing CLI prompt patterns. Skip prompt with --yes flag. Location: packages/tbd/src/cli/commands/doctor.ts, sync.ts
