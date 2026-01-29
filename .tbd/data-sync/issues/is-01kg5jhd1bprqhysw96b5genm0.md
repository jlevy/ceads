---
created_at: 2026-01-29T19:09:02.890Z
dependencies:
  - target: is-01kg5jhdhcp6k12e48vxvpcvtz
    type: blocks
id: is-01kg5jhd1bprqhysw96b5genm0
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 2: Update sync command with --issues/--docs flags"
type: is
updated_at: 2026-01-29T19:09:21.196Z
version: 2
---
Update sync.ts to:
- Add --issues and --docs flags
- Validate mutually exclusive flag combinations
- Call syncDocsWithDefaults() when syncing docs
- Update output to show both issue and doc results
- Update --status to show both statuses
