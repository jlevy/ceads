---
created_at: 2026-01-29T19:09:02.601Z
dependencies:
  - target: is-01kg5jhd1bprqhysw96b5genm0
    type: blocks
  - target: is-01kg5jhd9dbyg3k2c5j8seahk5
    type: blocks
  - target: is-01kg5jhdtwzxw7ce1xvnnc5tn3
    type: blocks
id: is-01kg5jhcrf73dwx67jm7xhsb5a
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 1: Extract shared syncDocsWithDefaults() function"
type: is
updated_at: 2026-01-29T19:09:21.425Z
version: 4
---
Create syncDocsWithDefaults() in doc-sync.ts with:
- Merge defaults from bundled docs
- pruneStaleInternals() helper to remove missing internal sources
- Config comparison and conditional write
- Unit tests for new functions
