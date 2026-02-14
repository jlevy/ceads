---
created_at: 2026-02-09T01:02:52.253Z
dependencies:
  - target: is-01kgzyrj4rhv2kjncymrzf01br
    type: blocks
id: is-01kgzyretysjtans3brggwcqcj
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Implement doc cache clearing on migration or source config change
type: is
updated_at: 2026-02-09T01:33:37.814Z
version: 3
---
Implement doc cache clearing on migration or source config change. getSourcesHash() computes SHA256 of sources array, stores in .tbd/docs/.sources-hash. On f03→f04 migration or hash mismatch: rm -rf .tbd/docs/, trigger fresh sync, write new hash. Safe because .tbd/docs/ is gitignored and regenerable. Add to migrateToLatest() flow and syncDocsWithDefaults(). Tests: verify cache cleared on format change, cleared on source add/remove, NOT cleared when sources unchanged.
