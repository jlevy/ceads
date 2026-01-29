---
title: New Implementation Beads from Spec
description: Create implementation issues (beads) from a feature planning spec
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Implementation Beads from Spec

We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Make sure it’s clear what plan spec will be used for this implementation.
   The user should provide it and you should find it in docs/project/specs/active/ with
   a plan- prefix (e.g., plan-YYYY-MM-DD-\*.md).
   If isn’t clear, stop and ask!

2. Create a new top-level issue for this work using `tbd create`, referencing the spec.
   Reference any other related specs or docs too.

3. Then using all the context you now have, begin to plan the implementation step by
   step, step by step, reviewing existing code carefully as you go and creating issues
   with `tbd create`. Always double-check all referenced code fits with the spec code
   you write. Be sure to track dependencies between issues correctly.

4. Summarize what you have done and ask the user to review and if you should begin
   implementation using `tbd shortcut implement-beads`.
