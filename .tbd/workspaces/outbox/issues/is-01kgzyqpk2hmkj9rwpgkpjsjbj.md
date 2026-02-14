---
created_at: 2026-02-09T01:02:27.424Z
dependencies:
  - target: is-01kgzyr7y128s080n05fpnm9de
    type: blocks
id: is-01kgzyqpk2hmkj9rwpgkpjsjbj
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Create doc-types.ts registry with unit tests"
type: is
updated_at: 2026-02-09T01:33:10.860Z
version: 3
---
Create src/lib/doc-types.ts with DOC_TYPES registry as single source of truth for doc types (shortcut, guideline, template, reference). Include DocTypeName type, inferDocType() for path-to-type mapping, and getDocTypeDirectories() helper. Write unit tests covering: registry entries, type inference from various path formats ({prefix}/{type}/{name}.md and flat paths), and directory name listing. TDD: write tests first, then implement to pass.
