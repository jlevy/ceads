---
created_at: 2026-02-09T00:59:59.248Z
dependencies:
  - target: is-01kgzyk94y5tx9y93cpmdxsr8c
    type: blocks
id: is-01kgzyk5whe8q33z3zvqyq05bv
kind: task
labels: []
parent_id: is-01kgzyj5y0xm00qdqsgay4vfv9
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Restructure Speculate to flat doc type directories
type: is
updated_at: 2026-02-09T01:01:33.279Z
version: 4
---
Restructure Speculate on tbd branch for clean tbd-compatible layout. (1) Rename existing docs/ to old-docs/ (legacy, for owner review). (2) Create new top-level structure: guidelines/ (from agent-rules/ + agent-guidelines/), shortcuts/ (from agent-shortcuts/, strip shortcut- prefix), templates/ (from docs/project/), references/ (new). Clean {type}/{name}.md layout, no nesting. Structure should be as clean and organized as possible.
