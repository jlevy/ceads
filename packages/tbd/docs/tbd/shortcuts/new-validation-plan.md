---
title: New Validation Plan
description: Create a validation/test plan showing what's tested and what remains
category: planning
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Create a validation plan documenting completed and remaining validation work.

This serves as both a testing checklist and a summary for PR reviewers, showing:
- What’s been tested (automated + manual)
- What still needs attention
- What requires user/reviewer judgment

## Steps

1. **Identify scope**: Review the feature/change being validated
   - Check relevant specs in `docs/project/specs/active/` if available
   - Understand all components and behaviors that need validation

2. **Audit automated test coverage**: Search the codebase for existing tests
   - Find unit tests covering the feature
   - Find integration/e2e tests
   - Note specific test files and what they cover

3. **Review manual testing already done**: Recall any manual verification performed
   - Commands run and their outputs
   - Behaviors observed and confirmed working
   - Edge cases already exercised

4. **Create the validation plan** with these sections (pre-fill completed items):

   ```markdown
   # Validation Plan: [Feature Name]
   
   ## Overview
   Brief description of what's being validated and the scope of changes.
   
   ## 1. Automated Test Coverage
   Tests that run in CI and cover this feature. Mark as done with [x].
   
   - [x] `tests/foo.test.ts` - covers X, Y, Z
   - [x] `tests/bar.test.ts` - covers edge case A
   - [ ] Missing: no tests for error handling in component B
   
   ## 2. Manual Testing - Completed by Agent
   Validation already performed during development. Pre-fill with specifics.
   
   - [x] Ran `command --flag` and verified output shows expected behavior
   - [x] Tested error case by providing invalid input, got appropriate error
   - [x] Confirmed file is created in correct location with expected format
   
   ## 3. Manual Testing - Remaining
   Additional manual testing the agent or user should perform.
   
   - [ ] Test with large input files (performance)
   - [ ] Test concurrent access scenario
   - [ ] Verify behavior when network is unavailable
   
   ## 4. User Validation Required
   Things that need human judgment or access the agent doesn't have.
   
   - [ ] Review UX/visual output for clarity and correctness
   - [ ] Confirm workflow matches user expectations
   - [ ] Validate against real production data if applicable
   - [ ] Approve any destructive or irreversible operations
   
   ## 5. Open Questions & Risks
   Uncertainties, edge cases not fully explored, or areas needing discussion.
   (Write "None" if no open questions.)
   
   - Any assumptions made during implementation
   - Known limitations or incomplete handling
   - Areas where behavior may be surprising
   
   ## 6. Migration & Rollback
   (Write "N/A" if simple change with no migration/rollback concerns.)
   
   - **Migration**: Steps needed to deploy (data migrations, config changes, etc.)
   - **Rollback**: How to revert if issues are found after deployment
   ```

5. **Ask user** where to save the plan:
   - In the PR description
   - As a document in `docs/project/specs/active/`
   - Both

6. **Summarize** what’s validated vs what remains for the user to review.
