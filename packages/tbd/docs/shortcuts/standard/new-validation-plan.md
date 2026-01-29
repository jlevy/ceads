---
title: New Validation Plan
description: Create a validation/test plan for a feature or change
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Validation Plan

We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the feature or change that needs a validation plan:
   - Review the relevant spec in docs/project/specs/active/ if available
   - Understand the scope of changes

2. Create a validation plan with these sections:

   ## Overview

   Brief description of what’s being validated.

   ## Automated Testing

   - [ ] Unit tests cover new functionality
   - [ ] Integration tests cover component interactions
   - [ ] Edge cases have test coverage

   ## Manual Testing Checklist

   List specific scenarios to manually verify:
   - [ ] Happy path scenarios
   - [ ] Error handling scenarios
   - [ ] Edge cases and boundary conditions

   ## Performance Considerations

   - [ ] No performance regressions
   - [ ] Load testing if applicable

   ## Rollback Plan

   How to revert if issues are found in production.

3. Ask the user where to save the validation plan:
   - In the PR description (use `tbd shortcut create-or-update-pr-with-validation-plan`)
   - As a separate document in docs/project/specs/active/
   - Both

4. Create the validation plan in the chosen location(s).
