---
created_at: 2026-02-09T01:02:31.083Z
dependencies:
  - target: is-01kgzyr4fh728np85rprvp9s6e
    type: blocks
id: is-01kgzyqt5czjjjhvakcfpe5q81
kind: task
labels: []
parent_id: is-01kgzypm020x8n0jgadn5g3v7x
priority: 2
spec_path: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
status: open
title: "RED+GREEN: Create repo-url.ts utility with unit tests"
type: is
updated_at: 2026-02-09T01:33:07.596Z
version: 3
---
Create src/lib/repo-url.ts with NormalizedRepoUrl interface, normalizeRepoUrl() accepting all URL formats (short: github.com/org/repo, HTTPS, HTTPS+.git, SSH git@), repoUrlToSlug() for filesystem-safe cache paths (no @github/slugify dep — just replace / and : with -), and getCloneUrl() for git operations. Write comprehensive unit tests: all input formats, edge cases (trailing slashes, mixed case, special chars), round-trip determinism, invalid URL errors. TDD: tests first.
