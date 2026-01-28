---
created_at: 2026-01-28T23:40:23.393Z
dependencies:
  - target: is-01kg3fp1y0e265fsk8whx2zgv4
    type: blocks
id: is-01kg3fngz2acc5gx2tatk24k1d
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Tests: Phase 1 detection and error reporting"
type: is
updated_at: 2026-01-28T23:41:04.170Z
version: 2
---
Add unit tests for: checkWorktreeHealth() with various states, checkLocalBranchHealth(), checkRemoteBranchHealth(), checkSyncConsistency(). Add golden tests for doctor output with various issues. Add integration tests for sync error handling.
