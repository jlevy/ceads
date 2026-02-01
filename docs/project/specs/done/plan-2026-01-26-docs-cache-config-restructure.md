# Plan Spec: Docs Cache Config Restructure

**Date:** 2026-01-26 **Author:** Claude **Status:** Complete

## Overview

Restructure the documentation cache configuration to be more consistent and organized.
Currently we have two separate config keys (`doc_cache:` and `docs:`) that are related
but inconsistently structured.
This spec consolidates them into a single, clearer `docs_cache:` configuration block.

## Goals

- Consolidate related config into a single `docs_cache:` key
- Make the config structure more intuitive with `files:` and `lookup_path:` subkeys
- Ensure backward compatibility via format migration
- Add documentation for all new settings
- Verify `.tbd/docs/` is properly gitignored since it’s auto-synced

## Non-Goals

- Changing the actual sync behavior (already implemented)
- Adding new features beyond restructuring

## Background

The current config structure has two related keys:

```yaml
# Current structure
doc_cache:                    # Maps destination -> source
  shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md

docs:                         # Search paths
  paths:
    - .tbd/docs/shortcuts/system
    - .tbd/docs/shortcuts/standard
```

This is confusing because:
1. `doc_cache` and `docs` are very similar names with different purposes
2. The relationship between them isn’t clear
3. The structure is inconsistent (one is a flat map, one is nested)

## Design

### New Config Structure

```yaml
# New structure - consolidated under docs_cache:
docs_cache:
  # Files to sync: maps destination paths to source locations
  # Sources can be:
  #   - internal: prefix for bundled docs (e.g., "internal:shortcuts/standard/code-review-and-commit.md")
  #   - Full URL for external docs (e.g., "https://raw.githubusercontent.com/org/repo/main/file.md")
  files:
    shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
    shortcuts/standard/precommit-process.md: internal:shortcuts/standard/precommit-process.md
    # Custom external docs:
    # shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/shortcuts/my-shortcut.md

  # Search paths for doc lookup (like shell $PATH)
  # Earlier paths take precedence when names conflict
  lookup_path:
    - .tbd/docs/shortcuts/system
    - .tbd/docs/shortcuts/standard
```

### Migration Path

- Format version `f02` (current) supports old structure
- Format version `f03` uses new structure
- Migration converts `doc_cache:` + `docs:` to `docs_cache: { files:, lookup_path: }`

### Tracked Issues

**Epic:** `tbd-4k8h` - Docs cache config restructure

| ID | Phase | Type | Priority | Description |
| --- | --- | --- | --- | --- |
| `tbd-sudy` | 1 | task | P2 | Update schema to new docs_cache structure |
| `tbd-6jzv` | 1 | task | P2 | Implement f02 -> f03 migration |
| `tbd-g5ho` | 2 | task | P2 | Update DocSync to use new config structure |
| `tbd-e3mv` | 2 | task | P2 | Update DocCache to use new lookup_path |
| `tbd-j4c8` | 2 | task | P2 | Update setup.ts to generate new config format |
| `tbd-3vxq` | 3 | task | P3 | Update all documentation |
| `tbd-15hy` | 3 | task | P3 | Verify .tbd/docs/ is in .tbd/.gitignore |
| `tbd-pdkb` | 3 | task | P3 | Add tests for migration |

## Implementation Plan

### Phase 1: Schema and Migration

- [x] Update `schemas.ts` with new `DocsCache` schema structure
- [x] Add `f03` to format history in `tbd-format.ts`
- [x] Implement `migrate_f02_to_f03()` function
- [x] Remove old `docs:` key from schema (migrated to `docs_cache.lookup_path`)
- [x] Remove old `doc_cache:` key from schema (migrated to `docs_cache.files`)

### Phase 2: Code Updates

- [x] Update `DocSync` to read from `docs_cache.files` instead of `doc_cache`
- [x] Update `DocCache` to read from `docs_cache.lookup_path` instead of `docs.paths`
- [x] Update `setup.ts` to generate new config format
- [x] Update `docs.ts` command to use new structure
- [x] Update config.ts helpers and comments

### Phase 3: Documentation and Cleanup

- [x] Update inline config comments to document new structure
- [x] Update SKILL.md if it references config structure
- [x] Verify `.tbd/docs/` is in `.tbd/.gitignore` with appropriate comment
- [x] Add tests for f02 -> f03 migration
- [x] Update any error messages that reference old config keys

## Schema Changes

```typescript
// Old (separate keys):
docs: z.object({
  paths: z.array(z.string()).default([...]),
}).default({ paths: [...] }),
doc_cache: DocCacheConfigSchema.optional(),

// New (consolidated):
docs_cache: z.object({
  files: z.record(z.string(), z.string()).optional(),
  lookup_path: z.array(z.string()).default([
    '.tbd/docs/shortcuts/system',
    '.tbd/docs/shortcuts/standard',
  ]),
}).default({
  lookup_path: ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard'],
}),
```

## Testing Strategy

1. **Migration tests**: Verify f02 -> f03 migration correctly transforms config
2. **Round-trip tests**: Write new config, read back, verify structure
3. **Integration tests**: Verify doc sync still works with new structure
4. **Backward compat**: Verify old repos migrate cleanly on first access

## Gitignore Requirements

The `.tbd/.gitignore` should include `docs/` to ensure the synced docs directory is not
tracked in git. This is important because:

1. The docs directory is regenerated from config on sync
2. Different team members may have different sync states
3. Avoiding git noise from auto-synced files

Verify this entry exists with appropriate comment:
```
# Synced documentation cache (regenerated by tbd docs --refresh)
docs/
```

## Open Questions

None currently - straightforward restructure.

## References

- [plan-2026-01-26-configurable-doc-cache-sync.md](plan-2026-01-26-configurable-doc-cache-sync.md)
  \- Original doc cache implementation
