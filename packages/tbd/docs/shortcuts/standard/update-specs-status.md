---
title: Update Specs Status
description: Review active specs and sync their status with tbd issues
category: planning
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Review all active specs and ensure tbd issues accurately reflect current progress.

## Steps

1. **List active specs**: Find all specs in `docs/project/specs/active/*.md`

2. **Ensure spec issues exist**: For each spec, verify there’s a parent issue tracking
   it.
   - Create if missing: `tbd create "Spec: <spec-title>" --type=epic`
   - Create child issues for phases/milestones as dependencies if needed (without
     “Spec:” prefix)

3. **Update issue status**: Review each spec against actual code/commits.
   - Use `gh` CLI to check recent commits and PRs if unclear
   - Update issues with `tbd update <id> --status <status>`
   - Close completed issues with `tbd close <id> --reason "..."`

4. **Move completed specs**: Move finished specs from `docs/project/specs/active/` to
   `docs/project/specs/done/`

5. **Sync**: Run `tbd sync` to push all changes
