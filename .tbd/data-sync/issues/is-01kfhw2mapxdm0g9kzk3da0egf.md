---
created_at: 2026-01-22T03:30:55.957Z
dependencies:
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw2mapxdm0g9kzk3da0egf
kind: task
labels: []
priority: 2
status: open
title: Add golden tests for shortcut output formats
type: is
updated_at: 2026-01-23T02:40:02.389Z
version: 3
---
Create tests/cli/shortcut.golden.test.ts with golden tests capturing CLI output for: tbd shortcut --list, tbd shortcut <name>, tbd shortcut --list --all (with shadowed entries), and JSON output mode.
