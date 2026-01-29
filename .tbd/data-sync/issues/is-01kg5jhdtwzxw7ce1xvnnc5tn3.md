---
created_at: 2026-01-29T19:09:03.708Z
dependencies:
  - target: is-01kg5jhee3nrrtkqa80h52p1d8
    type: blocks
id: is-01kg5jhdtwzxw7ce1xvnnc5tn3
kind: task
labels: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
priority: 2
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
status: open
title: "Phase 5: Update setup command to use shared function"
type: is
updated_at: 2026-01-29T19:09:22.124Z
version: 2
---
Update setup.ts to:
- Replace inline doc sync logic with syncDocsWithDefaults()
- Remove duplicate doc sync code
- Ensure setup still works correctly
