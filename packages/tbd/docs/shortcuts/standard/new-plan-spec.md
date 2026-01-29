---
title: New Plan Spec
description: Create a new feature planning specification document
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Plan Spec

Create a feature planning spec in docs/project/specs/active/.

## Create the Spec

```bash
tbd template plan-spec > docs/project/specs/active/plan-YYYY-MM-DD-feature-name.md
```

Review existing specs in that directory for context and conventions.

## Rules

- **Minimize phases**: Use one phase if straightforward.
  Only split if it helps incremental testing.
- **No time estimates**: Never write “4-6 hours” or “1 week”.
  Just describe the work.

## Linking Issues

After completing the spec, link issues to it:

```bash
tbd create "Implement feature X" --spec plan-YYYY-MM-DD-feature-name.md
tbd update <id> --spec plan-YYYY-MM-DD-feature-name.md
tbd list --spec <pattern>  # Find issues linked to a spec
```
