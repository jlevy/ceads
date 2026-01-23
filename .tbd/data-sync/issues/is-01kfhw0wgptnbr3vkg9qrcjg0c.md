---
close_reason: "Implemented: shortcut.ts has ShortcutHandler class with handleNoQuery() that shows shortcut-explanation.md or fallback help"
closed_at: 2026-01-23T02:43:45.131Z
created_at: 2026-01-22T03:29:58.805Z
dependencies:
  - target: is-01kfhw10femx3y9vr4srjx11c2
    type: blocks
  - target: is-01kfhw14rzpqp59p3rkem2720t
    type: blocks
  - target: is-01kfhw27gymrb8tzb15qrpw5g5
    type: blocks
  - target: is-01kfhw2c22c4wk7rby0npcd3cv
    type: blocks
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw0wgptnbr3vkg9qrcjg0c
kind: task
labels: []
priority: 1
status: closed
title: Create shortcut command with default action
type: is
updated_at: 2026-01-23T02:43:45.131Z
version: 8
---
Create packages/tbd/src/cli/commands/shortcut.ts. Use picocolors (aliased as pc) for terminal styling, OutputManager via createOutput() for proper stdout/stderr separation. Implement default action (no args): output shortcut-explanation.md content + command help. Register command in cli.ts.
