---
title: New Plan Spec
description: Create a new feature planning specification document
category: planning
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Review docs/project/specs/active/ to see the list of recent feature specs, feature
   plans, and implementation spec docs.

2. Create the spec file using the template:
   ```
   tbd template plan-spec > docs/project/specs/active/plan-YYYY-MM-DD-feature-name.md
   ```
   (Fill in the date and an appropriate feature name.)

3. Begin to fill in the new feature plan doc based on the user’s instructions, stopping
   and asking for clarifications as soon as you need them.

   Rules:

   - You may break work into a few phases (phases) if it helps with incremental testing.
     But **use as few phases as possible.** If it is straightforward, use one phase.

   - NEVER GIVE TIME FRAMES IN PLANS, like “4-6 hours” or “1 week”.
     Work will be done in one day.

4. After completing the spec, link beads to it using the `--spec` flag:
   ```
   tbd create "Implement feature X" --spec docs/project/specs/active/plan-YYYY-MM-DD-feature-name.md
   ```
   Or use just the filename for brevity:
   ```
   tbd create "Implement feature X" --spec plan-YYYY-MM-DD-feature-name.md
   ```
   You can also update an existing bead to link it to a spec:
   ```
   tbd update <id> --spec plan-YYYY-MM-DD-feature-name.md
   ```
   To clear a spec link: `tbd update <id> --spec ""`

5. To list beads linked to a spec, use `tbd list --spec` (see `tbd list --help` for
   details on filtering and path matching).
