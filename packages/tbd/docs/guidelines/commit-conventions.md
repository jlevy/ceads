---
title: Commit Conventions
description: Conventional Commits format with extensions for agentic workflows
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) with extensions for
agentic use cases, including use for content work and operational tasks in addition to
software development.

## Format

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- First line short, ideally 72 characters or less
- Use imperative mood ("Add feature" not “Added feature”)
- No scope by default; only use when disambiguation is needed (e.g., `fix(parser):`)
- For breaking changes: add `!` before `:` AND include `BREAKING CHANGE:` in the footer

## Types

Classic software development work:

- `feat`: New feature (improved software functionality)
- `fix`: Bug fix (corrected software functionality)
- `style`: Code formatting (no logic change)
- `refactor`: Code restructuring (no behavior change)
- `test`: Adding or updating tests
- `chore`: Software maintenance (deps, config, build, upgrades)
- `docs`: User-facing docs (README, API docs, guides, tutorials)

Agentic project work:

- `plan`: Internal design, plans, specs, architecture, requirements docs
- `research`: Internal research docs, notes, resources, reports
- `ops`: Operational tasks (issue tracking, syncing, publishing, maintenance)
- `process`: Changes to processes, methodology, conventions, policies

Commit types can drive automated versioning and changelogs.
See your project’s release process for specific rules.

The type indicates the *category of artifact* being changed.
Corrections within a category use that category’s type (e.g., fixing a typo in docs is
`docs:`, not `fix:`).

Note: `plan`, `research`, `ops`, and `process` are extensions for agentic development,
not part of the standard Conventional Commits spec.

**Key distinctions:** `docs` is for users; `plan` is design/specs for building;
`research` is internal learning/investigation; `ops` is operational work; `process` is
methodology.

## Examples

```
feat: Add support for custom labels
feat(parser): Add YAML front matter support
fix: Handle empty issue list gracefully
fix(api): Return 404 for missing resources
docs: Update CLI usage examples
docs: Fix typo in API reference
style: Format with prettier
refactor: Extract validation logic to separate module
test: Add golden tests for sync command
chore: Update dependencies
plan: Add design document for dependency resolution
research: Comparison of TypeScript monorepo build tools
research: A summary of SEO best practices in 2026
ops: Update issue status for auth feature
ops: Sync beads with remote
process: Add TDD guidelines for agent workflows
```
