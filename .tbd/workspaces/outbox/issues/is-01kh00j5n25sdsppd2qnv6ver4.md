---
created_at: 2026-02-09T01:34:23.393Z
dependencies:
  - target: is-01kh00jd80wve8jdkxn4r16vcx
    type: blocks
id: is-01kh00j5n25sdsppd2qnv6ver4
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Implement parseQualifiedName() utility with tests"
type: is
updated_at: 2026-02-09T01:35:26.500Z
version: 2
---
Create parseQualifiedName(name: string): { prefix?: string; baseName: string } utility. Parse 'spec:typescript-rules' → { prefix: 'spec', baseName: 'typescript-rules' }. Unqualified 'typescript-rules' → { baseName: 'typescript-rules' }. Handle edge cases: no colon, colon at start, multiple colons. TDD: write tests first covering all cases, then implement.
