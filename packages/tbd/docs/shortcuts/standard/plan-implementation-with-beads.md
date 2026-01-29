---
title: Plan Implementation with Beads
description: Create implementation issues (beads) from a feature planning spec
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Break a plan spec (or other work) into implementation issues.

## Prerequisites

Identify the spec (docs/project/specs/active/plan-YYYY-MM-DD-*.md).
If unclear, ask the user if they want you to create a spec first using
`tbd shortcut new-plan-spec` or to just go off current context.

## Process

1. Create a top-level issue referencing the spec:
   ```bash
   tbd create "Implement [feature]" --spec plan-YYYY-MM-DD-feature.md
   ```

2. Review the spec and existing code, then create child issues for each implementation
   step. Track dependencies between issues with `tbd dep add`.

3. Summarize the issue breakdown.
   When ready to implement, use `tbd shortcut implement-beads`.
