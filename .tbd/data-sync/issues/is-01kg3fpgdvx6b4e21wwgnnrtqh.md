---
created_at: 2026-01-28T23:40:55.610Z
dependencies:
  - target: is-01kg3fpmwcq4y6y7wa7yvzd8p3
    type: blocks
id: is-01kg3fpgdvx6b4e21wwgnnrtqh
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 1
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: open
title: Update resolveDataSyncDir() to throw WorktreeMissingError
type: is
updated_at: 2026-01-28T23:41:04.724Z
version: 2
---
Fix Bug 3: resolveDataSyncDir() silently falls back to .tbd/data-sync/ when worktree missing. Change to throw WorktreeMissingError in production. Add options { allowFallback?: boolean; repair?: boolean } per spec. Only allow fallback in test mode. Location: packages/tbd/src/lib/paths.ts:225-246
