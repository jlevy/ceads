---
close_reason: "Tests already exist in worktree-health.test.ts: resolveDataSyncDir returns worktree path when exists, returns direct path with allowFallback, throws WorktreeMissingError when fallback not allowed."
closed_at: 2026-01-29T01:02:01.804Z
created_at: 2026-01-28T23:41:00.171Z
dependencies:
  - target: is-01kg3fq2j85c2rq9a0hzmqwax9
    type: blocks
  - target: is-01kg3frmht6x09yzt08ddm20ys
    type: blocks
id: is-01kg3fpmwcq4y6y7wa7yvzd8p3
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: "Tests: Phase 2 path consistency"
type: is
updated_at: 2026-01-29T01:02:01.804Z
version: 5
---
Add tests: resolveDataSyncDir() returns worktree path in production, throws WorktreeMissingError when missing, allows fallback with { allowFallback: true }. Test getSyncStatus() checks correct path. Test commitWorktreeChanges() uses consistent paths.
