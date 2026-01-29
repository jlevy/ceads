---
close_reason: "Added e2e tryscript test cli-sync-worktree-scenarios.tryscript.md covering 17 test cases: fresh init (worktree created, issues in correct location), worktree deleted (sync --fix repairs), data in wrong location (doctor --fix migrates). Also fixed repairWorktree to prune for 'missing' status."
closed_at: 2026-01-29T01:25:26.266Z
created_at: 2026-01-28T23:42:15.240Z
dependencies: []
id: is-01kg3fry69b2azss39rm5zw2bf
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Add e2e tryscript test for sync worktree scenarios
type: is
updated_at: 2026-01-29T01:25:26.267Z
version: 3
---
Implement the e2e tryscript test from spec Appendix (test-sync-worktree-scenarios.sh). Tests all 5 scenarios: fresh init, fresh clone, worktree deleted, never initialized, never pushed. Uses local bare repo for isolation.
