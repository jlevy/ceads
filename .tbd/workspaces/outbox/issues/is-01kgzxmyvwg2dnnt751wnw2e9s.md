---
created_at: 2026-02-09T00:43:29.019Z
dependencies: []
id: is-01kgzxmyvwg2dnnt751wnw2e9s
kind: task
labels: []
parent_id: is-01kgzxkyye3gaxrebyyqzh21w7
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "REFACTOR: Remove hardcoded skip names, use hidden field exclusively"
type: is
updated_at: 2026-02-09T01:51:03.510Z
version: 3
---
Once hidden field is working: remove hardcoded skip names array from generateShortcutDirectory() (skill, skill-brief, shortcut-explanation). These docs should be marked hidden when loaded from system source instead. Verify existing tests still pass. Note: keep backward compat during transition period - only remove hardcoded names once all callers set hidden properly.
