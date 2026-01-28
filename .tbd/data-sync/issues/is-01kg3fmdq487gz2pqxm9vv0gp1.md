---
created_at: 2026-01-28T23:39:47.299Z
dependencies: []
id: is-01kg3fmdq487gz2pqxm9vv0gp1
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: "Doctor: Enhanced worktree health check with prunable detection"
type: is
updated_at: 2026-01-28T23:39:47.299Z
version: 1
---
Update doctor.ts checkWorktree() to use enhanced checkWorktreeHealth() that detects prunable state. Report error for missing/prunable/corrupted worktree instead of returning 'not created yet' as OK. Location: packages/tbd/src/cli/commands/doctor.ts:494-512
