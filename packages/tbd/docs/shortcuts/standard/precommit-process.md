---
title: Pre-Commit Process
description: Full pre-commit checklist including spec sync, code review, and testing
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: Pre-Commit Process

We track issues with tbd.
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

2. **Code style enforcement:**

   Before code is committed all changes must be reviewed and ensure they comply with the
   coding rules. Run `tbd guidelines --list` to see available guidelines.

3. **Code review:**

   Read all changes and ensure they follow best practices for modern TypeScript.
   Code should be clean, with brief and maintainable comments.

   You must review all outstanding changes that are not committed in the current repo.

   For background, read the project README.md and the package.json files.

   Make a checklist for this review based on the following list, then go through the
   checklist one step at a time.

   - Step 3.1: Ensure code follows general rules:

     - `tbd guidelines general-eng-assistant-rules`

     - `tbd guidelines general-coding-rules`

     - `tbd guidelines general-comment-rules`

     - `tbd guidelines general-style-rules`

     - `tbd guidelines general-testing-rules`

   - Step 3.2: Ensure code follows language-specific rules:
     - `tbd guidelines typescript-rules`

   - Step 3.3: Ensure code follows framework-specific rules (if applicable):
     - `tbd guidelines convex-rules`

   - Step 3.4: Ensure code follows backward-compatibility rules:
     - `tbd guidelines backward-compatibility-rules`

4. **Unit testing and integration testing:**

   BE SURE YOU RUN ALL TESTS (npm run precommit) as this includes codegen, formatting,
   linting, unit tests and integration tests.

   Read docs/development.md for additional background on test workflows.

   After any significant changes, ALWAYS run the precommit check:

   ```
   npm run precommit  # Runs: codegen, format, lint, test:unit, test:integration
   ```

   This will generate code, auto-format, lint, and run unit and integration tests.

   Then YOU MUST FIX all issues found.

5. **Review spec once more:**

   Make any updates to the spec based on the fixes or issues discovered during review
   and testing.

6. **Summarize and commit:** Summarize what was done and write a clear commit message
   following `tbd guidelines commit-conventions` (use conventional commits format with
   appropriate type). If all checks pass, commit directly.
   Only ask the user if there are unresolved issues or problems.
