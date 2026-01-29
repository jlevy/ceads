---
close_reason: Added migrateDataToWorktree() function to git.ts. Backs up data, copies issues/mappings from wrong location to worktree, commits in worktree, optionally removes source data.
closed_at: 2026-01-29T01:09:22.605Z
created_at: 2026-01-28T23:41:23.663Z
dependencies:
  - target: is-01kg3fqgdvt4d8ajg8xnzypg71
    type: blocks
  - target: is-01kg3fqmvn9pzrvyjf5jt758hh
    type: blocks
id: is-01kg3fqbtg9y7a9w730n7hh4sa
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Implement migrateDataToWorktree() function
type: is
updated_at: 2026-01-29T01:09:22.605Z
version: 5
---
Add migrateDataToWorktree() for repos with data in wrong location. Per spec: (1) backup to Attic/, (2) copy issues/mappings from .tbd/data-sync/ to worktree, (3) commit in worktree, (4) optionally remove wrong location data. Location: packages/tbd/src/file/git.ts
