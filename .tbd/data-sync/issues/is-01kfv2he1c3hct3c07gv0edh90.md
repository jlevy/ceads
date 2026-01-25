---
close_reason: null
closed_at: 2026-01-25T17:29:33.911Z
created_at: 2026-01-25T17:17:02.362Z
dependencies: []
id: is-01kfv2he1c3hct3c07gv0edh90
kind: epic
labels: []
priority: 2
status: closed
title: Implement gitignore-utils library
type: is
updated_at: 2026-01-25T17:29:33.911Z
version: 2
---
Create reusable utility library for idempotent .gitignore editing with atomic writes.

Spec: docs/project/specs/active/plan-2026-01-25-gitignore-utils-library.md

Goals:
- Detection function: hasGitignorePattern()
- Edit function: ensureGitignorePatterns()
- Refactor init.ts and setup.ts to use new lib
- Full unit test coverage
