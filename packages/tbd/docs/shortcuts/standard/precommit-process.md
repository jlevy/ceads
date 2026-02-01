---
title: Pre-Commit Process
description: Full pre-commit checklist including spec sync, code review, and testing
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

This process must be followed before committing code!

Create a to-do list with the following items then perform all of them:

1. **Confirm spec is in sync:**

   If the work has been done using a feature spec or bugfix spec (typically in
   docs/project/specs/active/) review and make any updates to the spec to be sure it is
   current with respect to the current code.

   Add any status updates to the spec to include accomplished tasks and remaining tasks,
   if any.

2. **Code review:**

   Run `tbd shortcut review-code` with scope **Uncommitted changes**.

   This performs a comprehensive review using all general and language-specific
   guidelines. Fix any issues found before proceeding.

   Additional rules to check (if applicable):
   - For Convex projects: `tbd guidelines convex-rules`
   - For backward compatibility concerns: `tbd guidelines backward-compatibility-rules`

3. **Unit testing and integration testing:**

   BE SURE YOU RUN ALL TESTS (npm run precommit) as this includes codegen, formatting,
   linting, unit tests and integration tests.

   Read docs/development.md for additional background on test workflows.

   After any significant changes, ALWAYS run the precommit check:

   ```
   npm run precommit  # Runs: codegen, format, lint, test:unit, test:integration
   ```

   This will generate code, auto-format, lint, and run unit and integration tests.

   Then YOU MUST FIX all issues found.

4. **Review spec once more:**

   Make any updates to the spec based on the fixes or issues discovered during review
   and testing.

5. **Summarize and commit:** Summarize what was done and write a clear commit message.
   Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
   `chore`, `plan`, `research`, `ops`, `process`. Scope is optional—only add when it
   resolves an important ambiguity.
   (See `tbd guidelines commit-conventions` for details.)
   If all checks pass, commit directly.
   Only ask the user if there are unresolved problems.
