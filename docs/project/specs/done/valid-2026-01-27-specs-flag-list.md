# Feature Validation: --specs Flag for tbd list

## Purpose

Validation spec for the `--specs` flag on `tbd list`, which groups beads by their linked
spec, plus the supporting `comparison-chain` utility and deterministic sort fixes.

**Feature Plan:** plan-2026-01-27-specs-flag-list.md

## Automated Validation (Testing Performed)

### Unit Testing

- **comparison-chain.test.ts** (3 tests): Validates the `comparisonChain` utility with
  multi-field nullsLast sorting, numeric field sorting, and manual ordering.

### Integration and End-to-End Testing

- **specs-flag.test.ts** (8 vitest e2e tests): Full end-to-end tests covering:
  - `--specs` groups issues by spec with correct headers and counts
  - `--specs --pretty` renders tree view within each spec group
  - `--specs --all` includes closed issues in the grouped output
  - `--specs --status` filter works with grouping
  - Issues with no spec appear under “(No spec)” section
  - All specs show when no `--spec` filter is applied
  - Default `tbd list` (no `--specs`) is unchanged

- **cli-list-specs.tryscript.md** (10 tryscript golden tests): CLI golden session tests
  covering:
  - Basic `--specs` grouping (table view)
  - `--specs --all` includes closed issues
  - `--specs --status=closed` filter
  - Default list without `--specs` is unchanged
  - `--specs` with no matching issues
  - `--specs` with only unlinked issues
  - `--specs --pretty` tree view within spec groups
  - `--specs --pretty` across all groups (auth, search, no spec)
  - All tests use unique priorities for fully deterministic sort order

- **Deterministic sort enforcement**: The `ready`, `stale`, and `blocked` commands now
  use `comparisonChain` with secondary sort by ID, matching the pattern in `list`.
  Existing test suites (675+ tests) all pass, confirming no regressions.

## Manual Testing Needed

The following manual validation should be performed on a real repository with beads
linked to specs:

1. **Basic --specs output**: Run `tbd list --specs` and verify:
   - Beads are grouped under `Spec: path/to/spec-name.md (count)` headers
   - Unlinked beads appear under `(No spec) (count)` at the end
   - Counts in headers are correct
   - Groups appear in priority order (highest-priority bead determines group order)

2. **Pretty tree view**: Run `tbd list --specs --pretty` and verify:
   - Parent-child relationships display correctly with box-drawing characters within
     each spec group
   - Standalone beads in the same spec group are not incorrectly nested

3. **Filter combinations**: Run the following and verify correct output:
   - `tbd list --specs --all` — closed beads appear in their spec groups
   - `tbd list --specs --status=open` — only open beads shown, grouped by spec
   - `tbd list --specs --type=task` — only tasks shown, grouped by spec
   - `tbd list --specs --spec docs/project/specs/active/plan-*.md` — single spec filter
     combined with `--specs` flag

4. **Long format**: Run `tbd list --specs --long` and verify descriptions render
   correctly within spec groups.

5. **Visual styling**: Confirm that spec headers use bold formatting for the spec name
   and dim formatting for the count.

6. **No regressions**: Run `tbd list` (without `--specs`) and confirm output is
   identical to previous behavior.
