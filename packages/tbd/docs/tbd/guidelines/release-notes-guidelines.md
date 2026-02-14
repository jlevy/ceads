---
title: Release Notes Guidelines
description: Guidelines for writing clear, accurate release notes
---
# Release Notes Guidelines

Write release notes that are accurate, scannable, and useful to users deciding whether
to upgrade.

## Structure

Use these sections in order (omit empty sections):

```markdown
## What's Changed

### Features
- New capabilities users can now do

### Fixes
- Bug fixes and corrections

### Refactoring
- Internal improvements (only if user-visible impact)

### Documentation
- Doc improvements (only notable ones)

**Full commit history**: [link to compare]
```

## Core Principle: Describe the Delta

**Think in terms of two points in time:**

1. The state of the application at the previous release
2. The state of the application at this release

Release notes describe the **aggregate difference** between these two states.
Don’t recap individual commits or intermediate changes - describe what’s different now
compared to before.

**Example:** If a feature was added and then bug-fixed before release, don’t list the
bug fix separately.
Describe the feature as it now works (the complete, working version).

## Writing Principles

### 1. Consolidate Related Changes

Group sub-features, fixes, and improvements with their parent feature rather than
listing them separately.
If a bug fix is for a feature added in the same release, incorporate it into the feature
description.

**Bad:**

```markdown
### Features
- **Workspace sync**: New tbd save command
- **Workspace list**: Show saved workspaces

### Fixes
- **Workspace mappings**: Save now filters mappings correctly
```

**Good:**

```markdown
### Features
- **Workspace sync feature**: New commands for managing local workspace backups:
  - `tbd save` to export issues (filters mappings correctly)
  - `tbd workspace list` to show saved workspaces with counts
```

### 2. Write From the User’s Perspective

Describe capabilities users now have, not implementation details.
A user reading the notes should understand what they can do differently after upgrading.

### 3. Be Specific About Impact

Include the user-facing impact, not just the implementation detail.

**Bad:**

> Increased git maxBuffer

**Good:**

> Git maxBuffer overflow: Increased buffer from 1MB to 50MB to prevent sync failures on
> large repos

### 4. Use Consistent Formatting

- Bold the feature/fix name
- Use bullet points for sub-items
- Include command names in backticks
- Keep descriptions concise (1-2 lines)

### 5. Skip Internal-Only Changes

Don’t include:

- Test-only changes (unless they fix flaky tests users noticed)
- Pure refactoring with no user impact
- CI/tooling changes
- Minor doc typo fixes

## Review Checklist

Before finalizing release notes:

- [ ] Does each item describe the aggregate delta from the previous release?
- [ ] Are related changes (features + their fixes) consolidated under one heading?
- [ ] Would a user understand what’s different after upgrading?
- [ ] Are feature names/commands in consistent format?
- [ ] Are internal-only changes excluded?

## Example

```markdown
## What's Changed

### Features

- **Workspace sync feature**: New commands for managing local workspace backups:
  - `tbd save` to export issues to workspace directories (supports `--updates-only`)
  - `tbd workspace list` to show saved workspaces with issue counts
  - `tbd import --workspace` to restore from workspace backups
- **Child bead ordering**: New `child_order` field allows explicit ordering of child
  beads

### Fixes

- **Git maxBuffer overflow**: Increased buffer from 1MB to 50MB to prevent sync
  failures on large repos

**Full commit history**: https://github.com/org/repo/compare/v0.1.12...v0.1.13
```
