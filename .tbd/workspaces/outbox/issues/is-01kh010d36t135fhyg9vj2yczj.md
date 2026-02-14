---
created_at: 2026-02-09T01:42:09.765Z
dependencies: []
id: is-01kh010d36t135fhyg9vj2yczj
kind: task
labels: []
parent_id: is-01kh00ywn96hz5rfvwm7bey6nw
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Release new tbd version with prefix-based sources
type: is
updated_at: 2026-02-09T01:42:09.765Z
version: 1
---
Prepare release: bump version in package.json, update CURRENT_FORMAT to f04, update FORMAT_HISTORY with correct introduced version. Run full test suite. Create release notes documenting: external repo sources, prefix-based namespacing, new tbd reference command, f03→f04 auto-migration. npm publish. Verify npx get-tbd@latest works with new sources.
