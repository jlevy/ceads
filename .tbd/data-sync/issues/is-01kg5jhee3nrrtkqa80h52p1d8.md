---
created_at: 2026-01-29T19:09:04.323Z
dependencies: []
id: is-01kg5jhee3nrrtkqa80h52p1d8
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 3
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 7: Testing for unified sync"
type: is
updated_at: 2026-01-29T19:09:04.323Z
version: 1
---
Add tests:
- Unit tests for syncDocsWithDefaults()
- Unit tests for auto-prune behavior
- Integration test: tbd sync syncs both
- Integration test: tbd sync --issues only syncs issues
- Integration test: tbd sync --docs only syncs docs
- Integration test: new bundled docs appear after upgrade simulation
- Integration test: stale internals are pruned
- Verify tbd docs --refresh returns command not found
