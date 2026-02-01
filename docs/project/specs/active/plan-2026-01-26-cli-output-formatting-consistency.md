# Plan Spec: CLI Output Formatting Consistency

**Date:** 2026-01-26 **Author:** Claude **Status:** Draft

## Overview

This spec addresses inconsistencies in CLI output formatting across tbd commands.
While the CLI Output Design System spec (`plan-2026-01-17-cli-output-design-system.md`)
defines comprehensive guidelines, the actual implementation uses multiple different
formatting patterns.
This spec identifies all inconsistencies and provides a plan to systematize output
formatting through shared utility functions.

## Goals

- Identify all heading and section formatting patterns currently in use
- Define a consistent heading hierarchy system
- Create shared formatting functions for headings and sections
- Update all commands to use consistent formatting
- Add golden tests to prevent regression

## Non-Goals

- Changing the overall CLI output design system (covered by separate spec)
- Modifying JSON output format
- Changing color semantics (already well-defined)

## Background

### Current State: Heading Format Inventory

A review of CLI outputs reveals **5 different heading patterns**:

| Pattern | Example | Used In |
| --- | --- | --- |
| Box style | `=== HEADING ===` | prime (INSTALLATION, PROJECT STATUS), docs --all |
| All caps | `HEADING` | doctor, status, setup (WHAT'S NEXT) |
| Title with colon | `Heading:` | docs --all sections, stats |
| Markdown H2 | `## Heading` | prime skill content, prime --brief |
| Process label | `Heading...` | setup progress |

### Specific Inconsistencies Found

**1. Section Headings**

| Command | Current Format | Example |
| --- | --- | --- |
| `tbd prime` | `=== ALL CAPS ===` | `=== INSTALLATION ===` |
| `tbd doctor` | `ALL CAPS` (no decoration) | `REPOSITORY`, `STATISTICS` |
| `tbd status` | `ALL CAPS` (no decoration) | `INTEGRATIONS` |
| `tbd setup` | `ALL CAPS` (no decoration) | `WHAT'S NEXT` |
| `tbd docs --all` | `=== Title Case ===` then `Title:` | `=== tbd Documentation ===` |
| `tbd stats` | `Title:` | `Summary:`, `By status:` |
| `tbd prime` content | `## Title` (markdown) | `## Core Workflow` |

**2. Subsection Headings**

| Command | Current Format | Example |
| --- | --- | --- |
| `tbd docs --all` | `Title Case:` | `Getting Started:`, `Templates:` |
| `tbd setup` | `Title Case...` | `Checking repository...`, `Configuring integrations...` |
| `tbd doctor` | Mixed | Section names inconsistent |

**3. Progress/Process Labels**

| Command | Current Format | Notes |
| --- | --- | --- |
| `tbd setup` | `Action...` | `Initializing with prefix "test"...` |
| `tbd sync` | `Action...` | `Syncing with remote...` |

## Design

### Proposed Heading Hierarchy

Based on the design system spec and current usage, standardize to **3 heading levels**:

```
Level 1 (Major Section): === HEADING ===
  - All caps, surrounded by ===
  - Used for top-level sections in multi-section output
  - Examples: INSTALLATION, PROJECT STATUS, REPOSITORY

Level 2 (Subsection): Heading:
  - Title case with colon
  - Used for subsections within a major section
  - Examples: Getting Started:, Summary:, By status:

Level 3 (Inline Label): Label: value
  - Used for key-value pairs
  - Examples: Repository: tbd, Remote: origin
```

### Proposed Formatting Functions

Add to `packages/tbd/src/cli/lib/output.ts`:

```typescript
// Heading level 1: === HEADING ===
heading(text: string): void {
  const colors = this.getColors();
  console.log(colors.bold(`=== ${text.toUpperCase()} ===`));
}

// Heading level 2: Heading:
subheading(text: string): void {
  const colors = this.getColors();
  console.log(colors.bold(`${text}:`));
}

// Progress label: Action...
progress(text: string): void {
  const colors = this.getColors();
  console.log(`${text}...`);
}
```

### Migration Rules

1. **Replace `=== HEADING ===` with `output.heading()`** in:
   - `prime.ts` (INSTALLATION, PROJECT STATUS)
   - `docs.ts` (tbd Documentation Resources)

2. **Replace `HEADING` (no decoration) with `output.heading()`** in:
   - `doctor.ts` (REPOSITORY, STATISTICS, INTEGRATIONS, HEALTH CHECKS)
   - `status.ts` (INTEGRATIONS)
   - `setup.ts` (WHAT’S NEXT)

3. **Replace `Title:` with `output.subheading()`** in:
   - `docs.ts` (Getting Started, Workflows, etc.)
   - `stats.ts` (Summary, By status, etc.)

4. **Keep markdown `## Heading` as-is** for:
   - Content rendered from markdown files (prime skill content)
   - These are data, not structural headings

## Implementation Plan

### Phase 1: Add Formatting Functions

- [ ] Add `heading()` method to OutputManager
- [ ] Add `subheading()` method to OutputManager
- [ ] Add `progress()` method to OutputManager
- [ ] Add unit tests for new methods

### Phase 2: Migrate Commands

Each command update is a separate sub-task:

**prime.ts**
- [ ] Replace manual `=== INSTALLATION ===` with `output.heading('INSTALLATION')`
- [ ] Replace manual `=== PROJECT STATUS ===` with `output.heading('PROJECT STATUS')`
- [ ] Replace manual `=== NOT INITIALIZED ===` with `output.heading('NOT INITIALIZED')`

**doctor.ts**
- [ ] Replace `REPOSITORY` with `output.heading('REPOSITORY')`
- [ ] Replace `STATISTICS` with `output.heading('STATISTICS')`
- [ ] Replace `INTEGRATIONS` with `output.heading('INTEGRATIONS')`
- [ ] Replace `HEALTH CHECKS` with `output.heading('HEALTH CHECKS')`

**status.ts**
- [ ] Replace `INTEGRATIONS` with `output.heading('INTEGRATIONS')`

**setup.ts**
- [ ] Replace `WHAT'S NEXT` with `output.heading("WHAT'S NEXT")`
- [ ] Standardize progress labels to use `output.progress()`

**docs.ts**
- [ ] Replace `=== tbd Documentation ===` with
  `output.heading('TBD DOCUMENTATION RESOURCES')`
- [ ] Replace section labels with `output.subheading()`

**stats.ts**
- [ ] Replace `Summary:` with `output.subheading('Summary')`
- [ ] Replace `By status:`, `By kind:`, `By priority:` with `output.subheading()`

### Phase 3: Update Golden Tests

- [ ] Update `golden-output.test.ts` snapshots to reflect new consistent formatting
- [ ] Add tests for heading/subheading formatting functions

## Testing Strategy

1. **Unit tests** for new OutputManager methods
2. **Golden tests** capture exact output format
3. **Integration tests** verify commands produce expected output

## Open Questions

1. Should markdown content (`## Heading`) also be converted to use consistent functions,
   or keep as-is since it’s rendered content?

   **Recommendation:** Keep markdown as-is - it’s data content, not CLI structure.

2. Should we add a `sectionSeparator()` method for consistent blank line handling?

   **Recommendation:** Yes, add `output.blank()` for explicit blank lines.

## References

- [CLI Output Design System Spec](plan-2026-01-17-cli-output-design-system.md)
- [OutputManager](packages/tbd/src/cli/lib/output.ts)
- [Golden Tests](packages/tbd/tests/golden-output.test.ts)
