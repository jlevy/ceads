---
title: New QA Playbook
description: Create a QA test playbook for manual validation workflows
category: testing
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Check for existing QA playbooks (*.qa.md) in tests/qa/ or similar locations to
   understand the testing patterns used in this project.

2. Ask the user for key details:
   - What feature/workflow is being tested?
   - What are the critical validation points?
   - Estimated test duration?
   - Any special prerequisites (data, environment, API keys)?

3. Create the QA playbook using the template:
   ```
   tbd template qa-playbook > tests/qa/[test-name].qa.md
   ```
   (Use a descriptive test name like “batch-research”, “api-integration”, etc.)

4. Fill in the QA playbook based on the user’s requirements:

   **Structure rules:**
   - **Status table**: Track phases with ✅/❌/⏳ for multi-session testing
   - **Phases**: Break into logical test phases (setup, execution, validation, cleanup)
   - **Commands**: Include exact commands in code blocks with expected output
   - **Verification checklists**: Use `[ ]` for manual checks, not just “run and hope”
   - **Troubleshooting**: Add debug hints at each phase, not just at the end
   - **Success criteria**: Final checklist before marking PASSED

   **Content rules:**
   - Show what success looks like (expected output, not just “it works”)
   - Include both positive checks (what should happen) and negative checks (what
     shouldn’t)
   - Add per-section troubleshooting for common failures
   - List related docs (specs, architecture, other QA playbooks)

5. After creating the QA playbook, optionally create a tracking bead:
   ```
   tbd create "Validate [feature] with QA playbook" --type task --priority P1
   ```
   And link it to the playbook file:
   ```
   tbd update <id> --spec tests/qa/[test-name].qa.md
   ```

6. Remind the user:
   - QA playbooks are living documents - update status table as testing progresses
   - Mark phases ✅/❌ in the status table after each run
   - Add test results with dates in the “Test Results” section
   - Archive or update playbooks when they become stale
