---
created_at: 2026-02-09T01:36:52.307Z
dependencies:
  - target: is-01kh00pkpydj4jb8sfep3r0v7s
    type: blocks
  - target: is-01kh00pthqe72f5qbsxj7c0y6y
    type: blocks
  - target: is-01kh00q1719mv8qg6aznscyx1t
    type: blocks
id: is-01kh00pq2ms8emj422bbe7xmtw
kind: task
labels: []
parent_id: is-01kh00nprzwe2hx8t0qbatyvqb
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Simplify doc commands to derive paths from doc-types registry
type: is
updated_at: 2026-02-09T01:37:22.904Z
version: 4
---
Create getDocPaths(sources, docType, docsDir) utility that derives search paths from sources array and doc-types registry instead of hardcoded DEFAULT_*_PATHS constants. Update DocCommandHandler to use getDocPaths(). Update guidelines.ts, template.ts, shortcut.ts to pass docType from registry. Remove DEFAULT_SHORTCUT_PATHS, DEFAULT_GUIDELINES_PATHS, DEFAULT_TEMPLATE_PATHS from paths.ts. Add DEFAULT_REFERENCE_PATHS temporarily if needed for migration.
