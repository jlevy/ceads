---
created_at: 2026-01-28T23:39:42.352Z
dependencies:
  - target: is-01kg3fmsr4tvm52tb3xc3kyf1a
    type: blocks
id: is-01kg3fm8whz13k1ty2st7461m0
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Add checkSyncConsistency() function
type: is
updated_at: 2026-01-28T23:40:29.624Z
version: 2
---
Add checkSyncConsistency() to git.ts per spec. Returns { worktreeHead, localHead, remoteHead, worktreeMatchesLocal, localAhead, localBehind }. Compares worktree HEAD with local branch and tracks ahead/behind counts vs remote. Location: packages/tbd/src/file/git.ts
