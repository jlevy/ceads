---
created_at: 2026-02-09T01:35:00.878Z
dependencies:
  - target: is-01kh00jd80wve8jdkxn4r16vcx
    type: blocks
id: is-01kh00ka8f786r7zxdgpg8sav1
kind: task
labels: []
parent_id: is-01kh00hr6eq3p16ebr73y7cxk1
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Implement AmbiguousLookupError with clear messaging
type: is
updated_at: 2026-02-09T01:35:30.009Z
version: 2
---
Create AmbiguousLookupError class for when unqualified name matches docs in multiple sources. Error message: 'typescript-rules matches docs in multiple sources: spec:typescript-rules (spec/guidelines/typescript-rules.md), myorg:typescript-rules (myorg/guidelines/typescript-rules.md). Use a qualified name: tbd guidelines spec:typescript-rules'. Tests for error formatting with 2 and 3+ matches.
