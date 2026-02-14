---
created_at: 2026-02-09T00:44:42.662Z
dependencies:
  - target: is-01kgzxqa3x20eqdcrv4jdfncsj
    type: blocks
  - target: is-01kgzxqddjcngrpcyegkqm4bb2
    type: blocks
id: is-01kgzxq6s7wcczc1vrn9twsyf1
kind: task
labels: []
parent_id: is-01kgzxpbfpk8sf45cveezakydn
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Create tests/helpers/doc-test-utils.ts with temp doc dir helpers
type: is
updated_at: 2026-02-09T01:51:03.530Z
version: 5
---
Create packages/tbd/tests/helpers/doc-test-utils.ts with: (1) createTempDocsDir() - creates temp directory with doc structure matching .tbd/docs/, (2) populateTestDocs() - copies fixture docs into temp dir with optional customization, (3) createMockConfig() - generates test config.yml with docs_cache entries, (4) cleanupTempDir() - cleanup helper. Use vitest beforeEach/afterEach patterns.
