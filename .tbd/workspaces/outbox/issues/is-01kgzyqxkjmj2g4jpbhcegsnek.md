---
created_at: 2026-02-09T01:02:34.609Z
dependencies:
  - target: is-01kgzyrbcf260b1791a043ccpv
    type: blocks
  - target: is-01kgzyretysjtans3brggwcqcj
    type: blocks
id: is-01kgzyqxkjmj2g4jpbhcegsnek
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Bump format f03->f04 with migration function"
type: is
updated_at: 2026-02-09T01:33:31.039Z
version: 4
---
Bump CURRENT_FORMAT from f03 to f04 in tbd-format.ts. Add FORMAT_HISTORY entry for f04 describing prefix-based sources, lookup_path removal. Implement migrate_f03_to_f04(): remove lookup_path, convert verbose files: entries to concise sources: array using isDefaultFileEntry() heuristic (source === 'internal:' + dest → default). Add convertFilesToSources() helper and getDefaultSources(). Add to migrateToLatest() chain and describeMigration(). Tests: default config migration (config becomes shorter), custom file override preservation, f04 rejection on older version. Depends on 0a.2 warnings field.
