# Validation Plan: Codebase Cleanup and Organization Review

**Date:** 2026-01-19 **Branch:** `claude/codebase-cleanup-review-7Lf9C` **Commit:**
`0e51d3d`

## Summary

Systematic codebase cleanup following
`docs/general/agent-shortcuts/shortcut-code-cleanup-all.md` guidelines.
Primary focus on file naming consistency (kebab-case) and duplicate code/type
consolidation.

## Changes Made

### 1. File Naming Consistency (kebab-case)

Renamed all camelCase source files to kebab-case for consistency:

| Old Name | New Name |
| --- | --- |
| `baseCommand.ts` | `base-command.ts` |
| `dataContext.ts` | `data-context.ts` |
| `issueFormat.ts` | `issue-format.ts` |
| `treeView.ts` | `tree-view.ts` |
| `idMapping.ts` | `id-mapping.ts` |
| `syncSummary.ts` | `sync-summary.ts` |
| `markdownUtils.ts` | `markdown-utils.ts` |
| `timeUtils.ts` | `time-utils.ts` |

Plus corresponding test files:
- `issueFormat.test.ts` → `issue-format.test.ts`
- `syncSummary.test.ts` → `sync-summary.test.ts`
- `treeView.test.ts` → `tree-view.test.ts`

### 2. Duplicate Types Consolidated

- **LocalState**: Removed duplicate interface from `search.ts`, now imports from
  `types.ts`
- **AtticEntry**: Removed duplicate interface from `attic.ts`, now imports from
  `types.ts`
- **DocSection**: Created shared type in `types.ts` for `Section` interface used by both
  `design.ts` and `docs.ts`

### 3. Schema Consistency Fix

Updated `AtticEntrySchema` in `schemas.ts`:
- Made `field` required (was `.optional()`)
- Made `lost_value` type `z.string()` (was `z.unknown()`)

This matches the actual usage in `attic.ts` where these fields are always present.

### 4. Duplicate Code Eliminated

Created shared `pathExists()` utility in `utils/file-utils.ts`:
- Removed duplicate private `pathExists()` method from `SetupBeadsHandler` class
- Removed duplicate private `pathExists()` method from `SetupAutoHandler` class

## Manual Validation Steps

### Pre-merge Checklist

- [x] All 407 tests pass (`pnpm test`)
- [x] TypeScript compilation succeeds (`pnpm typecheck`)
- [x] ESLint passes with no warnings (`pnpm lint:check`)
- [x] Prettier formatting applied (`pnpm format`)
- [x] Pre-commit hooks pass
- [x] Pre-push hooks pass

### Functional Validation

1. **File imports work correctly:**
   ```bash
   # Build succeeds with new file names
   pnpm build
   ```

2. **CLI commands work:**
   ```bash
   # Test basic commands still function
   tbd --help
   tbd list
   tbd stats
   ```

3. **Attic functionality (schema change):**
   ```bash
   # Attic commands should work with updated AtticEntry type
   tbd attic list
   ```

4. **Setup commands (pathExists refactor):**
   ```bash
   # Setup auto-detection still works
   tbd setup auto --dry-run
   ```

## Risk Assessment

**Low Risk:**
- File renames are straightforward refactoring with comprehensive test coverage
- Type consolidation reduces duplication without changing behavior
- Schema fix aligns types with existing code behavior

**No Breaking Changes:**
- All exports maintained
- No API changes
- Internal refactoring only

## CI Validation

CI should validate:
- TypeScript compilation
- ESLint
- Prettier formatting
- All 407 tests pass
