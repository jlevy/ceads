---
title: Clean Up All Code
description: Full cleanup cycle including duplicate removal, dead code, and code quality improvements
category: cleanup
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Shortcut: Clean Up Code

## Instructions

Run full format/typecheck/lint/test cycle and review code following
`tbd shortcut precommit-process`.

Create a single epic bead for “Cleanup: full cycle YYYY-MM-DD” (with today’s date).
For each of the following tasks create a child bead of the epic bead.
Name all tasks with a “Cleanup: ” title to make them easy to spot.
In each bead put the isntructions for that item and a reminder to do a full precommit
cycle afterwords, fixing all build or test issues.

## Cleanup Tasks

1. **Duplicate types**: Review the code for any types that you have defined and find if
   there are any duplicates and remove or consolidate them.

2. **Duplicate components**: Review the recent changes for duplicate components where we
   can reuse.

3. **Duplicate code**: Review the code base for any duplicate code and refactor it to
   reduce duplication.

4. **Dead code**: Review the code base for any dead code and remove it.
   If the code might be unusually useful, put a TODO comment explaining.

5. **Use of `any` types**: Review types and use actual types over `any`.

   - Don’t create explicit TypeScript interfaces with `any` types—either use proper
     types from your data sources or let TypeScript infer types automatically.

   - Look for interfaces where most/all properties are `any`—delete them and use
     inferred return types or properly type each property from its source.

6. **Avoid optional fields, parameters, and types**: Optionals are easy to proliferate
   and usually better to remove:

   - Remove optional fields on types and optional function parameters whenever possible.
     They are error prone as they can be dropped during refactors, leading to subtle
     bugs. Prefer explicit nullable parameters.

   - In particular, strongly *avoid optional booleans*, as they invariably cause
     confusions or are ambigous.
     Prefer simple booleans.

   - Review types and eliminate use of optional types as possible so we don’t spread
     state checks throughout the codebase.

7. **Remove trivial tests**: Follow `tbd shortcut code-cleanup-tests`.

8. **Update docstrings**: Follow `tbd shortcut code-cleanup-docstrings`.

9. **Consolidate constants and settings**: Determine what files hold shared settings
   (such as `settings.ts` or similar).
   Identify any hard-coded constants in the codebase that are not in these files, and
   add constants or settings as appropriate.
   If there is no shared settings file, create it in a reasonable location such as the
   top of the package and call it `settings.ts`.

10. **Review function signatures**: Review that parameters to functions are clean and as
    simple as possible. Find any functions/components with parameters that are not
    necessary or left over from previous refactors, and remove them.

11. **Clean up debugging code**: Check for any stray scripts or tests or other code that
    was created in process of debugging that should not be in the production system.
    Remove it.

12. **Guard early, normalize once** Handle all optional/conditional logic at the top of
    a function. Use early returns for invalid states, or normalize inputs once into a
    guaranteed shape. After that point, code must be straight-line—no repeated
    conditionals.

13. **Review query performance**: Look at all database queries and review.
    Look for and fix:

    - N+1 queries to be more efficient where possible and carefully test any refactors

    - Replace `for` loops with sequential `await` with `Promise.all` for parallel
      execution

    - Batch database queries instead of individual fetches in loops

    - Consolidate nested sequential queries into single `Promise.all` call
