---
created_at: 2026-02-09T01:36:55.862Z
dependencies: []
id: is-01kh00pthqe72f5qbsxj7c0y6y
kind: task
labels: []
parent_id: is-01kh00nprzwe2hx8t0qbatyvqb
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Update doc-add.ts for prefix-based storage
type: is
updated_at: 2026-02-09T01:36:55.862Z
version: 1
---
Update addDoc() to write --add files to docs_cache.files as overrides (highest precedence, bypass prefix system). Change destination from shortcuts/custom/foo.md to flat {type}/foo.md. files: entries are written directly to .tbd/docs/{path} outside prefix directories. Update getDocTypeSubdir() to return flat type directory. Tests: verify --add writes to files section, verify precedence over source-provided docs with same name.
