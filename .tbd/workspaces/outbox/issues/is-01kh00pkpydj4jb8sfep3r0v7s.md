---
created_at: 2026-02-09T01:36:48.861Z
dependencies: []
id: is-01kh00pkpydj4jb8sfep3r0v7s
kind: task
labels: []
parent_id: is-01kh00nprzwe2hx8t0qbatyvqb
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Create tbd reference command (extends DocCommandHandler)
type: is
updated_at: 2026-02-09T01:36:48.861Z
version: 1
---
Create src/cli/commands/reference.ts following guidelines.ts pattern. ReferenceHandler extends DocCommandHandler with typeName='reference', typeNamePlural='references', docType='reference'. Same options: --list, --all, --add, --name, query argument. Register in cli.ts: program.addCommand(referenceCommand). Tests: --list, exact lookup, fuzzy search, --add, JSON output.
