---
title: Design Docs Comprehensive Review
description: Review and update all tbd documentation to reflect enhanced value proposition
---
# Feature: Design Docs Comprehensive Review

**Date:** 2026-01-26 **Author:** Claude **Status:** Draft

## Overview

Comprehensively review and update all tbd documentation to reflect the enhanced value
proposition now that tbd covers not just issue tracking, but also spec-driven workflows,
coding guidelines, and shortcuts for disciplined agent-based development.

## Goals

- Ensure consistency across all documentation (README, design docs, skill files)
- Update messaging to reflect tbd's four core capabilities (issue tracking, guidelines,
  spec-driven workflows, shortcuts)
- Explain the synergy between issue tracking and workflows/guidelines/templates for
  high-quality agent-based coding
- Improve clarity on how shortcuts, guidelines, and templates work together

## Non-Goals

- Adding new functionality to tbd CLI
- Changing the underlying architecture
- Creating new shortcuts or guidelines (only documenting existing ones)

## Background

The original tbd documentation focused primarily on issue tracking as a Beads alternative.
However, tbd now provides a comprehensive workflow system including:

1. **Issue Tracking**: Track tasks, bugs, and features as lightweight "beads" stored in git
2. **Coding Guidelines**: A library of best practices for TypeScript, Python, testing, etc.
3. **Spec-Driven Workflows**: Write planning specs, break into issues, implement systematically
4. **Convenience Shortcuts**: Pre-built processes for common tasks

The documentation needs to reflect this expanded scope and explain how these capabilities
work together to enable disciplined, high-quality agent-based coding.

## Design

### Approach

Review all documentation files systematically and update them to:
- Use consistent terminology and structure
- Emphasize the four core capabilities equally
- Explain the workflow synergy (issue tracking + specs + guidelines + shortcuts)
- Ensure accurate command examples and tables

### Documents to Review

1. **README.md** - Main project introduction
2. **packages/tbd/docs/tbd-design.md** - Technical design specification
3. **packages/tbd/docs/shortcuts/system/skill.md** - Agent skill file
4. **packages/tbd/docs/shortcuts/system/skill-brief.md** - Brief skill file
5. **docs/docs-overview.md** - Documentation layout overview
6. **All shortcut files** - For consistency
7. **All guideline files** - For consistency

## Implementation Plan

### Phase 1: Document Analysis and Planning

- [ ] Read and analyze all documentation for current state
- [ ] Identify inconsistencies and gaps
- [ ] Create issues for each document update task

### Phase 2: Core Documentation Updates

- [ ] Update README.md with enhanced value proposition messaging
- [ ] Update tbd-design.md introduction section
- [ ] Update skill.md to better explain workflows
- [ ] Update skill-brief.md for consistency
- [ ] Update docs-overview.md

### Phase 3: Validation

- [ ] Review all changes for consistency
- [ ] Ensure command examples are accurate
- [ ] Validate shortcut and guideline lists match actual files
- [ ] Create PR with validation plan

## Testing Strategy

- Visual review of all updated documentation
- Verify all command examples work correctly
- Check all shortcut and guideline names are accurate
- Ensure consistent terminology across all docs

## Rollout Plan

Single PR with all documentation updates, reviewed before merge.

## Open Questions

- None at this time

## References

- README.md
- packages/tbd/docs/tbd-design.md
- packages/tbd/docs/shortcuts/system/skill.md
- docs/docs-overview.md

## Reminder

Before completing this work, file a complete PR with a validation plan per the
`tbd shortcut create-or-update-pr-with-validation-plan` shortcut.
