---
created_at: 2026-01-29T19:09:03.403Z
dependencies:
  - target: is-01kg5jhe5v1zx94azhqn57bnzq
    type: blocks
  - target: is-01kg5jhee3nrrtkqa80h52p1d8
    type: blocks
id: is-01kg5jhdhcp6k12e48vxvpcvtz
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 4: Remove docs --refresh command"
type: is
updated_at: 2026-01-29T19:09:21.885Z
version: 3
---
Update docs.ts to:
- Remove --refresh option
- Remove --status option (moved to sync command)
- Remove handleRefresh() and handleStatus() methods
- Update help text
