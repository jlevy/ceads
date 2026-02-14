---
created_at: 2026-02-09T00:43:22.196Z
dependencies:
  - target: is-01kgzxmvh2m0atzzcererq1j72
    type: blocks
id: is-01kgzxmr6nf5s2pb631jnmeht8
kind: task
labels: []
parent_id: is-01kgzxkyye3gaxrebyyqzh21w7
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED: Write tests for hidden doc filtering in generateShortcutDirectory()"
type: is
updated_at: 2026-02-09T01:51:03.496Z
version: 4
---
Write tests: (1) generateShortcutDirectory() excludes docs where hidden=true, (2) hidden docs not shown in --list output, (3) hidden docs still accessible via direct lookup (tbd shortcut skill), (4) Backward compat: existing hardcoded skip names still work when hidden is undefined. Add to doc-cache.test.ts.
