---
title: New Architecture Doc
description: Create an architecture document for a system or component design
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Clarify the architecture scope with the user:
   - What system or component are we designing?
   - Is this a new design or documenting existing architecture?
   - What level of detail is needed?

2. Review existing architecture docs in docs/project/architecture/ if available.
   Also review any related specs in docs/project/specs/active/.

3. Create the architecture document using the template:
   ```
   tbd template architecture-doc > docs/project/architecture/arch-YYYY-MM-DD-component-name.md
   ```
   (Fill in the date and an appropriate component name.)

4. If documenting existing architecture, review the codebase to ensure accuracy.
   If designing new architecture, iterate with the user on the design.

5. Summarize the architecture and ask the user to review.
