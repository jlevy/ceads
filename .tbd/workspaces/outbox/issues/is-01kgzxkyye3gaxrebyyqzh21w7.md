---
child_order_hints:
  - is-01kgzxmr6nf5s2pb631jnmeht8
  - is-01kgzxmvh2m0atzzcererq1j72
  - is-01kgzxmyvwg2dnnt751wnw2e9s
created_at: 2026-02-09T00:42:56.333Z
dependencies: []
id: is-01kgzxkyye3gaxrebyyqzh21w7
kind: task
labels: []
parent_id: is-01kgzxcx31b6kjdd9v8r3gt5e3
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "0a.3: Update generateShortcutDirectory() for hidden source support"
type: is
updated_at: 2026-02-09T01:51:03.488Z
version: 6
---
generateShortcutDirectory() in doc-cache.ts currently hardcodes skip names (skill, skill-brief, shortcut-explanation). The prefix system introduces hidden sources that should be excluded generically. Add hidden?: boolean to CachedDoc, populate from source config, filter by doc.hidden. Keep hardcoded names as fallback during transition.
