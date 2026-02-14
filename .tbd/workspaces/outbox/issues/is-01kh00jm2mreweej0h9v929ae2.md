---
created_at: 2026-02-09T01:34:38.163Z
dependencies:
  - target: is-01kh00kkcad26zfrxa83nn9fmr
    type: blocks
id: is-01kh00jm2mreweej0h9v929ae2
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Update tbd setup --auto to configure default sources with prefixes
type: is
updated_at: 2026-02-09T01:35:43.748Z
version: 2
---
Update setup.ts to write default sources array: sys (internal, hidden, shortcuts), tbd (internal, shortcuts), spec (repo, github.com/jlevy/speculate, main, all types). Run migration if config is f03. Add repo-cache/ to .tbd/.gitignore. Call syncDocsWithDefaults() with new source-based logic. Test: fresh setup produces correct config.yml with sources array.
