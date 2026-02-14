---
created_at: 2026-02-09T00:44:49.457Z
dependencies: []
id: is-01kgzxqddjcngrpcyegkqm4bb2
kind: task
labels: []
parent_id: is-01kgzxpbfpk8sf45cveezakydn
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Refactor existing doc-sync.test.ts and doc-cache.test.ts to use shared fixtures
type: is
updated_at: 2026-02-09T01:51:03.546Z
version: 3
---
Refactor existing doc-sync.test.ts and doc-cache.test.ts to use the new shared fixtures from test-docs/ and helpers from doc-test-utils.ts. Remove inline test doc creation where shared fixtures suffice. Verify all existing tests still pass after refactoring.
