---
created_at: 2026-01-28T23:42:05.369Z
dependencies: []
id: is-01kg3frmht6x09yzt08ddm20ys
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 3
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Add warning in resolveDataSyncDir test mode fallback
type: is
updated_at: 2026-01-28T23:42:05.369Z
version: 1
---
When resolveDataSyncDir({ allowFallback: true }) falls back to direct path, emit debug-level warning. Helps detect unintended fallback usage. Location: packages/tbd/src/lib/paths.ts
