---
created_at: 2026-02-09T00:44:46.076Z
dependencies: []
id: is-01kgzxqa3x20eqdcrv4jdfncsj
kind: task
labels: []
parent_id: is-01kgzxpbfpk8sf45cveezakydn
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: Add helper for creating local bare git repos (for RepoCache tests)
type: is
updated_at: 2026-02-09T01:51:03.536Z
version: 3
---
Add createTestGitRepo() helper to doc-test-utils.ts: creates a local bare git repo using git init --bare, populates it with test markdown files, and returns the file:// URL. This enables RepoCache unit tests without network access. Include helper to add files and create commits in the test repo.
