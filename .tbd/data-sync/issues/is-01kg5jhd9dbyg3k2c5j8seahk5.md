---
created_at: 2026-01-29T19:09:03.148Z
dependencies:
  - target: is-01kg5jhee3nrrtkqa80h52p1d8
    type: blocks
id: is-01kg5jhd9dbyg3k2c5j8seahk5
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 3: Update auto-sync in DocCache to merge defaults"
type: is
updated_at: 2026-01-29T19:09:22.004Z
version: 2
---
Update doc-cache.ts checkAutoSync() to:
- Use syncDocsWithDefaults() instead of direct DocSync
- Ensure auto-sync merges defaults (picks up new bundled docs)
- Unit tests for auto-sync behavior
