---
title: Plan Spec - --specs Flag for tbd list
description: Add a --specs flag to tbd list that groups beads by their linked spec
---
# Feature: --specs Flag for tbd list

**Date:** 2026-01-27 **Author:** Claude **Status:** Implemented

## Overview

Add a `--specs` flag to the `tbd list` command that groups the listed beads by their
associated spec. Instead of a flat list, beads are organized under spec headers, with
unlinked beads collected at the end.
This flag is compatible with all existing list flags including `--pretty`, `--long`,
`--all`, `--status`, etc.

## Goals

- Allow users to see how their beads relate to specs at a glance
- Group beads by spec_path, showing spec filename/path as a section header
- Show beads with no spec in a separate “No spec” section at the end
- Maintain compatibility with all existing `tbd list` flags (`--pretty`, `--long`,
  `--all`, `--status`, `--type`, `--priority`, `--assignee`, `--label`, `--sort`, etc.)
- Ensure parent-child bead relationships display correctly within each spec group when
  using `--pretty`

## Non-Goals

- Changing the default `tbd list` output (no `--specs` flag = unchanged behavior)
- Adding spec metadata display (just the spec path as a header is sufficient)
- Modifying how specs are linked to beads (existing `spec_path` field is used as-is)

## Background

Beads can be linked to spec documents via the `spec_path` field.
Currently, `tbd list --spec <path>` filters beads to only show those linked to a
specific spec. However, there is no way to get an overview of all beads grouped by their
specs. This is useful when working on a project with multiple active specs to see
progress across all of them.

Parent beads often have specs, and child beads inherit the spec_path from their parent.
The grouping should naturally show parent beads and their children together under the
same spec header.

## Design

### Approach

When `--specs` is passed to `tbd list`:

1. Apply all existing filters (status, type, priority, etc.)
   as normal
2. Sort as normal
3. Group the resulting beads by their `spec_path` value
4. For each unique spec_path, render a section header (the spec filename or path)
5. Render the beads within that group using the existing format (table or `--pretty`
   tree)
6. After all spec groups, render beads with no `spec_path` under a “No spec” header
7. Show summary counts per spec group

### Components

- `packages/tbd/src/cli/commands/list.ts` - Add `--specs` flag, implement grouping logic
  in the output section
- `packages/tbd/src/cli/lib/tree-view.ts` - No changes needed; tree building works on
  any subset of beads
- `packages/tbd/src/cli/lib/issue-format.ts` - May add a spec group header formatter

### API Changes

New CLI option on `tbd list`:
```
--specs    Group output by linked spec
```

This is a display-only flag (like `--pretty` or `--long`). It does not affect filtering
or sorting, only how results are grouped in the output.

JSON output mode: When `--specs` is used with JSON output, the data structure should
include a `spec_path` field (already present in display issues) so consumers can group
as needed.

## Implementation Plan

### Phase 1: Core Implementation and Tests

- [x] Add `--specs` boolean option to ListOptions interface and commander definition
- [x] Implement spec grouping logic in the `run()` method output section
- [x] Extract spec display name from spec_path (e.g., just the filename)
- [x] Render spec group headers with formatting (bold/dim as appropriate)
- [x] Render “No spec” group for beads without spec_path
- [x] Ensure `--pretty` tree view works within each spec group (build separate trees per
  group)
- [x] Ensure `--long` descriptions work within spec groups
- [x] Add end-to-end session tests confirming:
  - `--specs` groups beads correctly
  - `--specs --pretty` shows tree view within groups
  - `--specs` combined with filters (--status, --all, etc.)
    works
  - Beads with no spec appear in the “No spec” section
- [ ] Manual testing on this repo to verify output consistency

## Testing Strategy

- End-to-end golden output tests in `packages/tbd/tests/golden-output.test.ts`:
  - Create beads with and without specs, including parent-child relationships
  - Test `tbd list --specs` output format
  - Test `tbd list --specs --pretty` output format
  - Test `tbd list --specs --all` includes closed beads grouped by spec
  - Test `tbd list --specs --status open` filters work with grouping
- Manual testing on this repo (which has many beads linked to specs) to confirm
  real-world output looks correct

## Rollout Plan

Standard release with the next version.
No migration needed since this is a new display-only flag.

## Open Questions

- Should the spec header show the full path or just the filename?
  Filename is more compact; full path is unambiguous.
  Could use filename with full path in `--long` mode.

## References

- Existing `--spec` filter: `packages/tbd/src/cli/commands/list.ts`
- Spec matching logic: `packages/tbd/src/lib/spec-matching.ts`
- Tree view: `packages/tbd/src/cli/lib/tree-view.ts`
- Issue formatting: `packages/tbd/src/cli/lib/issue-format.ts`
