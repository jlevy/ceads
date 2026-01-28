---
created_at: 2026-01-28T23:39:59.620Z
dependencies: []
id: is-01kg3fmsr4tvm52tb3xc3kyf1a
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Doctor: Add sync consistency check"
type: is
updated_at: 2026-01-28T23:39:59.620Z
version: 1
---
Add checkSyncConsistency() to doctor.ts. Only runs if worktree is healthy. Checks: worktree HEAD matches local branch, local ahead/behind counts. Reports errors/info as appropriate. Location: packages/tbd/src/cli/commands/doctor.ts
