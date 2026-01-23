---
close_reason: "Implemented: schemas.ts has docs.paths field with z.array(z.string()).default() for shortcut paths configuration"
closed_at: 2026-01-23T02:43:57.498Z
created_at: 2026-01-22T03:30:16.178Z
dependencies:
  - target: is-01kfhw1hx7z3whwe5tp210ed2r
    type: blocks
  - target: is-01kfhw2rn1rmt2wqsbbv1axx2v
    type: blocks
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw1dfjzj3jhw9nwkwyf03w
kind: task
labels: []
priority: 1
status: closed
title: Extend ConfigSchema with docs.paths field
type: is
updated_at: 2026-01-23T02:43:57.499Z
version: 5
---
Add docs.paths field to ConfigSchema in schemas.ts. Default to ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']. Support relative paths (from tbd root), absolute paths, and ~/home-relative paths.
