---
created_at: 2026-02-09T01:39:24.245Z
dependencies:
  - target: is-01kh00vj273rt2j0hkhx9r3egj
    type: blocks
id: is-01kh00vbepnwcryhwjx2n7jetb
kind: task
labels: []
parent_id: is-01kh00tjaz5n4x0jdeqzgbnaq8
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Run validation for all shortcuts and guidelines
type: is
updated_at: 2026-02-09T01:39:50.940Z
version: 2
---
Execute validate-docs.sh for shortcuts and guidelines. Compare: tbd shortcut --list output, each shortcut content, tbd guidelines --list, each guideline content. All outputs should match baseline or be documented as intentional improvements. Fix any unintentional differences found.
