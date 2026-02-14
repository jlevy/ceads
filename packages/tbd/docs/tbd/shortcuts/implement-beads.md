---
title: Implement Beads
description: Implement beads from a spec, following TDD and project rules
category: planning
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Run `tbd guidelines --list` to see available guidelines, then review relevant ones
   for implementing this spec.
   In particular run `tbd guidelines general-tdd-guidelines` to understand project and
   testing rules.

2. IMPORTANT: **Track all work with beads using tbd.** Use `tbd create` to create beads,
   `tbd ready` to find work, and `tbd close` when done.

3. Implement beads specified by the user, highest priority first.
   If the user did not specify which beads, check all open beads with `tbd ready`.
   - Beads are usually linked to specs so be sure to find specs that are relevant (for
     that bead or an umbrella bead) for each if possible and review those specs.
   - Follow `tbd shortcut precommit-process` and `tbd sync` changes after each bead.

4. Repeat this for all beads where you know how to fix them.
   If unsure about a bead, let the user know at the end of all work which beads had
   problems.
