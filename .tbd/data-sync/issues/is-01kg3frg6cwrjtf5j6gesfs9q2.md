---
close_reason: Added checkWorktreeHealth() verification after worktree creation in init.ts and setup.ts. Both commands now warn if worktree creation succeeded but verification fails, pointing users to 'tbd doctor' for diagnosis.
closed_at: 2026-01-29T01:18:36.885Z
created_at: 2026-01-28T23:42:00.907Z
dependencies: []
id: is-01kg3frg6cwrjtf5j6gesfs9q2
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: Update init/setup to verify worktree after creation
type: is
updated_at: 2026-01-29T01:18:36.886Z
version: 3
---
Update setup.ts and init.ts to call checkWorktreeHealth() after worktree creation and report error if creation failed. Prevents silent failures during initialization. Location: packages/tbd/src/cli/commands/setup.ts, init.ts
