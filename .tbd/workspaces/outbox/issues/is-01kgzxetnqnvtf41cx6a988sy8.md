---
created_at: 2026-02-09T00:40:08.118Z
dependencies:
  - target: is-01kgzxfmfss9zfpj5abhgm2whz
    type: blocks
id: is-01kgzxetnqnvtf41cx6a988sy8
kind: task
labels: []
parent_id: is-01kgzxe3p3qc7m2zxz0ga530vy
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED: Write characterization tests for shortcut command current behavior"
type: is
updated_at: 2026-02-09T01:51:03.431Z
version: 4
---
TDD Step 1: Write characterization tests capturing exact current behavior before refactoring. Tests should cover: (1) --list output format and content, (2) exact name lookup, (3) fuzzy search with score thresholds, (4) --category filtering, (5) --add mode, (6) --refresh backward compat, (7) no-query fallback showing shortcut-explanation.md, (8) SHORTCUT_AGENT_HEADER prepended to output, (9) shadowed entry display, (10) JSON output mode. Use existing doc-cache.test.ts and doc-sync.test.ts patterns. These tests must all pass against current code before any refactoring begins.
