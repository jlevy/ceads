---
close_reason: "Added --fix support to doctor.ts: checkWorktree() calls repairWorktree() for prunable/corrupted status; checkDataLocation() calls migrateDataToWorktree() for issues in wrong path."
closed_at: 2026-01-29T01:12:04.663Z
created_at: 2026-01-28T23:41:32.915Z
dependencies:
  - target: is-01kg3fqs9tj6bc9dkx4dej91xk
    type: blocks
id: is-01kg3fqmvn9pzrvyjf5jt758hh
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: "Doctor --fix: Implement repair actions"
type: is
updated_at: 2026-01-29T01:12:04.664Z
version: 4
---
Implement repair actions in doctor.ts when --fix is provided: (1) repair unhealthy worktree via repairWorktree(), (2) migrate data from wrong location via migrateDataToWorktree(), (3) prune stale worktree entries. Output progress for each step. Location: packages/tbd/src/cli/commands/doctor.ts
