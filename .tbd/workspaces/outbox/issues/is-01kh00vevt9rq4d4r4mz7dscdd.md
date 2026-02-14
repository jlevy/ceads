---
created_at: 2026-02-09T01:39:27.737Z
dependencies:
  - target: is-01kh00vj273rt2j0hkhx9r3egj
    type: blocks
id: is-01kh00vevt9rq4d4r4mz7dscdd
kind: task
labels: []
parent_id: is-01kh00tjaz5n4x0jdeqzgbnaq8
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Run validation for templates and test reference command
type: is
updated_at: 2026-02-09T01:39:54.343Z
version: 2
---
Execute validate-docs.sh for templates. Compare: tbd template --list, each template content. Test new tbd reference command: --list, exact lookup, fuzzy search. References have no baseline (new feature) — verify content is correct and complete. Document all intentional differences in validation report.
