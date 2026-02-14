---
created_at: 2026-02-09T00:40:41.209Z
dependencies:
  - target: is-01kgzxfy6t76xrk1mybbg5jger
    type: blocks
id: is-01kgzxftzt59ardkfx9k3wj145
kind: task
labels: []
parent_id: is-01kgzxe3p3qc7m2zxz0ga530vy
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "REFACTOR: Remove duplicate code from shortcut.ts after migration"
type: is
updated_at: 2026-02-09T01:51:03.452Z
version: 4
---
TDD Step 3 (Refactor): Delete all duplicated code from shortcut.ts that now lives in DocCommandHandler: extractFallbackText(), printWrappedDescription(), wrapAtWord(), handleList() (use base), handleNoQuery() (use base), handleQuery() (use base). The shortcut.ts file should shrink from ~380 lines to ~80-100 lines. Tests must still pass.
