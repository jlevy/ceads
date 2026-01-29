---
title: New Implementation Beads from Spec
description: Create implementation issues (beads) from a feature planning spec
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Implementation Beads from Spec

Break a plan spec into implementation issues.

## Prerequisites

Identify the spec (docs/project/specs/active/plan-YYYY-MM-DD-*.md).
If unclear, ask.

## Process

1. Create a top-level issue referencing the spec:
   ```bash
   tbd create "Implement [feature]" --spec plan-YYYY-MM-DD-feature.md
   ```

2. Review the spec and existing code, then create child issues for each implementation
   step. Track dependencies between issues with `tbd dep add`.

3. Summarize the issue breakdown.
   When ready to implement, use `tbd shortcut implement-beads`.
