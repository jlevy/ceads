---
title: Agent Handoff
description: Generate a concise handoff prompt for another coding agent to continue work
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Generate a high-signal handoff prompt for the next agent.
Focus on what’s specific and non-obvious.
The next agent has access to tbd and will orient themselves.

## Before Handoff

**IMPORTANT**: Always run `tbd sync` before generating the handoff to ensure all issue
updates are pushed to the remote.
The next agent needs the latest issue state.

## What to Include

- **Task**: One line on what we’re doing
- **Spec**: Path to active spec + relevant sections
- **Beads**: tbd issue ID(s), status, dependencies, synced?
- **Branch**: Current branch, base branch (if not main), pushed to remote?
- **PR**: Filed/not filed, URL, CI status, up to date with branch?
- **Git**: Uncommitted changes, files modified
- **Context**: Current work state, challenges encountered, approaches being taken
- **References**: Similar code or patterns in the codebase
- **Setup**: Only non-obvious setup the next agent wouldn’t already know

## What to Skip

- Generic instructions the agent would figure out
- tbd usage (it self-documents)
- Obvious next steps derivable from the spec
- Boilerplate sections with no content

## Example

```
Task: Implement standalone CLI distribution for dxterm-cli.

Spec: plan-2026-01-26-dxterm-local-research-tools.md - "Phase 4: Standalone CLI" section.

Beads: ar-hzhw (in progress), ar-j3k9 (blocked by ar-hzhw) - synced

Branch: feature/standalone-cli-42Xk (from main), pushed to origin

PR: #127 https://github.com/org/repo/pull/127 - CI failing, 2 commits behind branch

Git: Uncommitted changes in packages/dxterm-cli/src/

Context: @arena/reports exports FORMS_DIR (filesystem path), preventing standalone npm
publishing. Adding codegen to embed form strings at build time, following the
@arena/llm-pricing pattern. Codegen script is done; now updating form-registry.ts
to use getFormContent() instead of readFile().

References: packages/llm-pricing/ - see scripts/generate-llms-data.ts and src/_generated/

Setup: Run `pnpm install` after pulling (new dependencies added).
```
