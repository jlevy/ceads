---
created_at: 2026-02-09T01:37:02.687Z
dependencies: []
id: is-01kh00q1719mv8qg6aznscyx1t
kind: task
labels: []
parent_id: is-01kh00nprzwe2hx8t0qbatyvqb
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Remove hardcoded path constants, unify with doc-types registry
type: is
updated_at: 2026-02-09T01:37:02.687Z
version: 1
---
Remove or deprecate DEFAULT_SHORTCUT_PATHS, DEFAULT_GUIDELINES_PATHS, DEFAULT_TEMPLATE_PATHS from paths.ts. Replace all usages with doc-types registry-derived paths. Ensure TBD_DOCS_DIR and other core constants remain. Clean up any dead code from paths.ts. Verify no references to old shortcuts/system/ or shortcuts/standard/ paths remain outside of migration code.
