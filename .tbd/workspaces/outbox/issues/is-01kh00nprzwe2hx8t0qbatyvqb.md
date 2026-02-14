---
child_order_hints:
  - is-01kh00pkpydj4jb8sfep3r0v7s
  - is-01kh00pq2ms8emj422bbe7xmtw
  - is-01kh00pthqe72f5qbsxj7c0y6y
  - is-01kh00pxxjrme57t7831vsf6yh
  - is-01kh00q1719mv8qg6aznscyx1t
created_at: 2026-02-09T01:36:19.230Z
dependencies:
  - target: is-01kh00r1v5stt6jeww4x7bq1pz
    type: blocks
  - target: is-01kh00tjaz5n4x0jdeqzgbnaq8
    type: blocks
id: is-01kh00nprzwe2hx8t0qbatyvqb
kind: task
labels: []
parent_id: is-01kgzyh3ph1pfngcvyab02nhe9
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "Phase 3: New Reference Type and CLI"
type: is
updated_at: 2026-02-09T01:43:35.495Z
version: 8
---
Add reference as fourth doc type. Create tbd reference command following DocCommandHandler pattern. Simplify existing commands (shortcut, guidelines, template) to use doc-types registry for path derivation. Remove hardcoded path constants from paths.ts. Add tbd doctor checks for repo cache health. Update doc-add.ts for prefix-based storage.
