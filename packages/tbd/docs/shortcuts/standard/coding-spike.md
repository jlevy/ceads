---
title: Coding Spike
description: Prototype to validate a spec through hands-on implementation
category: planning
author: Kam Leung with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

A **coding spike** is time-boxed exploration to validate technical assumptions through
implementation.
Write production-quality code to uncover real constraints, but treat this
as a learning exercise—the code may be discarded or revised.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Create a spike bead:
   ```bash
   tbd create "Spike: <what you're validating>" --type task
   ```

2. Understand the spec and identify technical questions that need answers.

3. Define spike scope: What’s the minimum implementation needed to learn?
   What will you explicitly NOT build?

4. Build production-quality prototypes:
   - Follow project conventions and include tests
   - Focus on uncertain approaches that need validation
   - Prioritize learning over feature completeness
   - Create child beads for distinct components if helpful

5. Capture learnings as you go—document in the spec given to you:
   - Spec gaps, ambiguities, or errors found
   - Complexity surprises (harder or easier than expected)
   - Better approaches or patterns discovered
   - New risks, dependencies, or performance concerns

6. Refine the specification with findings:
   - Clarify ambiguous sections
   - Correct technical details that proved wrong
   - Document discovered risks and update estimates

7. Decide on spike code: keep and refine, keep as reference, or discard.

8. Close the spike:
   ```bash
   tbd close <spike-bead-id> --reason "Spike complete: <outcome summary>"
   tbd sync
   ```

9. Report findings and recommend next steps.
