---
created_at: 2026-01-28T23:40:45.663Z
dependencies:
  - target: is-01kg3fpbntr05bzbj2q6cyrnsz
    type: blocks
id: is-01kg3fp6pz0jzfff1bvdfbw0fs
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Update commitWorktreeChanges() to use dataSyncDir consistently
type: is
updated_at: 2026-01-28T23:41:04.389Z
version: 2
---
Fix Bug 1: commitWorktreeChanges() uses hardcoded join(process.cwd(), WORKTREE_DIR) at line 273. Should derive worktree path from this.dataSyncDir. Same issue in fullSync() at line 427. Location: packages/tbd/src/cli/commands/sync.ts:272-308, 423-594
