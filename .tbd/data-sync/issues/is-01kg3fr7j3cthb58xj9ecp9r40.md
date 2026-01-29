---
close_reason: "Added 3 architectural tests verifying issues are written to worktree path: resolveDataSyncDir returns worktree path, issues written via resolved path exist in worktree not direct path, WorktreeMissingError thrown when fallback disabled"
closed_at: 2026-01-29T01:17:05.227Z
created_at: 2026-01-28T23:41:52.066Z
dependencies:
  - target: is-01kg3frbqa3wwzr0sbqpps1hxz
    type: blocks
id: is-01kg3fr7j3cthb58xj9ecp9r40
kind: task
labels: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
status: closed
title: "Add architectural test: issues written to worktree path"
type: is
updated_at: 2026-01-29T01:17:05.227Z
version: 4
---
Add test per spec that verifies: after tbd init + create, issues exist in .tbd/data-sync-worktree/.tbd/data-sync/issues/ and NOT in .tbd/data-sync/issues/. This prevents regression of the core bug.
