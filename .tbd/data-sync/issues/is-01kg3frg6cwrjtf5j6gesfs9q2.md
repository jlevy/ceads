---
created_at: 2026-01-28T23:42:00.907Z
dependencies: []
id: is-01kg3frg6cwrjtf5j6gesfs9q2
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Update init/setup to verify worktree after creation
type: is
updated_at: 2026-01-28T23:42:00.907Z
version: 1
---
Update setup.ts and init.ts to call checkWorktreeHealth() after worktree creation and report error if creation failed. Prevents silent failures during initialization. Location: packages/tbd/src/cli/commands/setup.ts, init.ts
