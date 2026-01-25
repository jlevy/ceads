---
close_reason: "Fixed: Removed old .tbd/cache/ and .tbd/sync-worktree/ paths, these are now in .tbd/.gitignore"
closed_at: 2026-01-25T17:01:22.000Z
created_at: 2026-01-25T17:00:26.358Z
dependencies: []
id: is-01kfv1k1bqa0j7mnvzqeg0sjxf
kind: task
labels:
  - bug
priority: 2
status: closed
title: "[PR#25] Update root .gitignore to use current .tbd/ paths"
type: is
updated_at: 2026-01-25T17:01:22.001Z
version: 2
---
The root .gitignore has old paths: .tbd/cache/ and .tbd/sync-worktree/. These should be updated to current paths: .tbd/docs/, .tbd/state.yml, .tbd/data-sync-worktree/
