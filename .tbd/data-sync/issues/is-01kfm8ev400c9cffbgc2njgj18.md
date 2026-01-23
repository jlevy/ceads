---
created_at: 2026-01-23T01:45:47.903Z
dependencies:
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfm8ev400c9cffbgc2njgj18
kind: task
labels:
  - docs-review
  - internal
priority: 3
status: open
title: Verify shortcut command (internal) docs consistency
type: is
updated_at: 2026-01-23T02:40:02.599Z
version: 2
---
The shortcut command is a new internal command not exposed in main CLI help. Verify:
- Internal documentation/comments are accurate
- If it should be documented publicly in tbd-docs.md
- Options work as documented (--list, --all)
- Integration with DocCache and shortcuts system
