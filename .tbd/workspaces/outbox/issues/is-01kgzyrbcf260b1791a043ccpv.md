---
created_at: 2026-02-09T01:02:48.717Z
dependencies:
  - target: is-01kgzyretysjtans3brggwcqcj
    type: blocks
  - target: is-01kgzyrj4rhv2kjncymrzf01br
    type: blocks
id: is-01kgzyrbcf260b1791a043ccpv
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Rewrite DocSync for prefix-based storage and source-based sync
type: is
updated_at: 2026-02-09T01:33:34.451Z
version: 4
---
Rewrite syncDocsWithDefaults() in doc-sync.ts for source-based sync. For each source in config.docs_cache.sources: internal sources scan bundled docs at packages/tbd/docs/{prefix}/{type}/, repo sources use RepoCache.ensureRepo() + scanDocs(). Copy files to .tbd/docs/{prefix}/{type}/{name}.md. Apply files: overrides last (highest precedence). Write sources hash to .tbd/docs/.sources-hash for change detection. resolveSourcesToDocs() returns flat Record<string, string> for existing DocSync compatibility. Integration tests with mock sources.
