---
title: Shortcut System Explanation
description: How tbd shortcuts work for agents
---
Shortcuts are reusable instructions for common tasks.
Give a name or description and tbd will find the matching shortcut and output its
instructions.

## How to Use

1. **Find by name**: `tbd shortcut new-plan-spec` (exact match)
2. **Find by description**: `tbd shortcut "create a plan"` (fuzzy match)
3. **List all**: `tbd shortcut --list`
4. **Follow the instructions**: The shortcut content tells you what to do

## What Shortcuts Contain

Each shortcut is a markdown document with step-by-step instructions.
These may include:
- Creating issues with `tbd create`
- Running other shortcuts via `tbd shortcut <name>`
- File operations and git workflows
- Prompts for gathering information from the user

## Example Workflow

User: “I want to create a new research brief”

Agent:
1. Runs `tbd shortcut new-research-brief`
2. Follows the instructions in the output
3. The instructions may say to create an issue, copy a template, etc.

## Shortcut Locations

Shortcuts are loaded from directories in the doc path (searched in order):

- `.tbd/docs/shortcuts/system/` - Core system docs (skill.md, etc.)
- `.tbd/docs/shortcuts/standard/` - Standard workflow shortcuts

Directories earlier in the doc path take precedence.
If you add a shortcut with the same name in an earlier directory, it will take
precedence over a same-named shortcut in a later directory.

## Creating Custom Shortcuts

1. Create a markdown file in `.tbd/docs/shortcuts/standard/` or a custom directory
2. Add YAML frontmatter with `title` and `description` for searchability
3. Write your instructions in the body

Example:
```markdown
---
title: My Custom Workflow
description: Do something specific to my project
---

Instructions here...
```
