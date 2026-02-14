---
created_at: 2026-02-09T00:43:25.601Z
dependencies:
  - target: is-01kgzxmyvwg2dnnt751wnw2e9s
    type: blocks
id: is-01kgzxmvh2m0atzzcererq1j72
kind: task
labels: []
parent_id: is-01kgzxkyye3gaxrebyyqzh21w7
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "GREEN: Add hidden field to CachedDoc and filter in generateShortcutDirectory()"
type: is
updated_at: 2026-02-09T01:51:03.503Z
version: 4
---
Add hidden?: boolean to CachedDoc interface. In DocCache.loadDirectory(), accept optional hidden parameter and set on loaded docs. Update generateShortcutDirectory() to filter docs where hidden===true in addition to existing hardcoded names. Update buildTableRows() to accept and filter hidden docs. Tests must pass.
