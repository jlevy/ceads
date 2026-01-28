---
created_at: 2026-01-28T23:39:28.264Z
dependencies:
  - target: is-01kg3fm8whz13k1ty2st7461m0
    type: blocks
  - target: is-01kg3fmdq487gz2pqxm9vv0gp1
    type: blocks
  - target: is-01kg3fncaavct0k7x902gmk078
    type: blocks
id: is-01kg3fkv48kzhzq6e86z0hm3p0
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Enhance checkWorktreeHealth() to detect prunable state
type: is
updated_at: 2026-01-28T23:40:29.967Z
version: 4
---
Update checkWorktreeHealth() in git.ts to detect prunable worktree state via 'git worktree list --porcelain'. Return status: 'valid' | 'missing' | 'prunable' | 'corrupted'. Current implementation only checks exists/valid. Location: packages/tbd/src/file/git.ts:682-729
