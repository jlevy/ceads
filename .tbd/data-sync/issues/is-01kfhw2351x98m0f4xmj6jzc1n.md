---
created_at: 2026-01-22T03:30:38.368Z
dependencies:
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw2351x98m0f4xmj6jzc1n
kind: task
labels: []
priority: 1
status: open
title: Update tbd setup to copy built-in docs
type: is
updated_at: 2026-01-23T02:40:01.832Z
version: 3
---
Update tbd setup command to copy built-in system and standard docs to .tbd/docs/shortcuts/{system,standard}/ using atomically library for safe file writes. Add version comment (<!-- tbd-version: X.Y.Z -->) for upgrade detection.
