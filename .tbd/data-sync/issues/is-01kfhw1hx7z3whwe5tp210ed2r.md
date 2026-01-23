---
created_at: 2026-01-22T03:30:20.710Z
dependencies:
  - target: is-01kfhw1ynx7qg6d5bfzsx8g557
    type: blocks
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw1hx7z3whwe5tp210ed2r
kind: task
labels: []
priority: 1
status: open
title: Implement path resolution utility
type: is
updated_at: 2026-01-23T02:40:01.280Z
version: 4
---
Implement resolveDocPath() utility in paths.ts for consistent path handling: relative paths resolved from tbd root (parent of .tbd/), absolute paths used as-is, ~/ paths expanded to user home directory.
