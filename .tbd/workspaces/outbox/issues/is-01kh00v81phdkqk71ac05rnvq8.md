---
created_at: 2026-02-09T01:39:20.756Z
dependencies:
  - target: is-01kh00vbepnwcryhwjx2n7jetb
    type: blocks
  - target: is-01kh00vevt9rq4d4r4mz7dscdd
    type: blocks
id: is-01kh00v81phdkqk71ac05rnvq8
kind: task
labels: []
parent_id: is-01kh00tjaz5n4x0jdeqzgbnaq8
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Create validate-docs.sh comparison script
type: is
updated_at: 2026-02-09T01:39:47.458Z
version: 3
---
Create validate-docs.sh script that compares output between released (npx --yes get-tbd@latest) and dev build (node packages/tbd/dist/bin.mjs). For each doc type: get --list --json, iterate names, compare output of exact lookup. Report MATCH/DIFF/NOT_FOUND for each. Use diff for showing differences. Expected intentional differences: references section is new, content improvements from tbd→Speculate copy, prefix info in --list.
