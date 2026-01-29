---
title: New Validation Plan
description: Create a validation/test plan for a feature or change
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Validation Plan

Create a validation/test plan for a feature or change.

## Template

```markdown
## Overview
[What's being validated]

## Automated Testing
- [ ] Unit tests cover new functionality
- [ ] Integration tests cover component interactions
- [ ] Edge cases have test coverage

## Manual Testing
- [ ] Happy path scenarios
- [ ] Error handling scenarios
- [ ] Edge cases and boundary conditions

## Performance
- [ ] No performance regressions

## Rollback Plan
[How to revert if issues found]
```

## Where to Put It

- **PR description**: Use `tbd shortcut create-or-update-pr-with-validation-plan`
- **Standalone doc**: docs/project/specs/active/
