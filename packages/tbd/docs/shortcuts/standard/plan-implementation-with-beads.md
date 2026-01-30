---
title: Plan Implementation with Beads
description: Create implementation beads from a feature planning spec
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Break a plan spec (or other work) into implementation beads.

## Prerequisites

Identify the spec (docs/project/specs/active/plan-YYYY-MM-DD-*.md).
If unclear, ask the user if they want you to create a spec first using
`tbd shortcut new-plan-spec` or to just go off current context.

## Process

1. **Create a top-level epic** referencing the spec:

   ```bash
   tbd create "Spec: [feature or task]" --type=epic --spec plan-YYYY-MM-DD-feature.md
   ```

2. **Create child beads** for each implementation step, all under the epic:

   ```bash
   tbd create "Step 1: ..." --parent=<epic-id>
   tbd create "Step 2: ..." --parent=<epic-id>
   ```

   - Ensure the spec has accurate context for the work, and reference details from the
     spec in beads as needed.

3. **Add blocker dependencies** where beads must be completed in sequence:

   ```bash
   tbd dep add <bead> <depends-on>  # bead is blocked by depends-on
   ```

   Use blocker dependencies when one bead cannot start until another is complete (e.g.,
   “implement API” blocks “write integration tests”).

4. **Summarize the bead breakdown** for the user.
   If the user has already asked you to implement the beads too, use
   `tbd shortcut implement-beads`. Otherwise confirm with the user if you should use
   this shortcut next.

## Dependency Types

- **Parent/Child** (`--parent`): Hierarchical grouping.
  All implementation beads should be children of the epic.
  Children inherit context from their parent.

- **Blocker** (`tbd dep add`): Sequential ordering.
  A bead cannot start until its blockers are complete.
  Use for tasks that genuinely depend on prior work.
