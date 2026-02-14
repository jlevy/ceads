---
created_at: 2026-02-09T01:02:45.184Z
dependencies:
  - target: is-01kgzyrbcf260b1791a043ccpv
    type: blocks
id: is-01kgzyr7y128s080n05fpnm9de
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Restructure bundled docs to prefix-based layout (sys/, tbd/)
type: is
updated_at: 2026-02-09T01:33:17.512Z
version: 3
---
Restructure packages/tbd/docs/ from current layout (shortcuts/system/, shortcuts/standard/, guidelines/, templates/) to prefix-based layout (sys/shortcuts/, tbd/shortcuts/, tbd/guidelines/). sys/ gets system shortcuts (skill.md, skill-brief.md, shortcut-explanation.md, hidden). tbd/ gets all 29 standard shortcuts and tbd-specific guidelines (tbd-sync-troubleshooting.md). Update all import paths and references. Update generateDefaultDocCacheConfig() to scan new structure. Verify all existing tests pass with new paths.
