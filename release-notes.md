## What’s Changed

### Features

- **Workspace sync feature**: New commands for managing local workspace backups:
  - `tbd save` to export issues to workspace directories (supports `--updates-only` and
    `--outbox`)
  - `tbd workspace list` to show saved workspaces with issue counts by status
  - `tbd import --workspace` to restore from workspace backups
  - Workspace save suggested on sync push failures as safety net
- **Child bead ordering hints**: New `child_order` field allows explicit ordering of
  child beads; priority-based ordering preserved in tree views
- **Unified review-code shortcut**: Single shortcut supporting three scopes (uncommitted
  changes, branch work, GitHub PR) with language-specific guideline loading
- **Review-github-pr shortcut**: Dedicated shortcut for GitHub PR reviews with follow-up
  actions (commenting, CI checks, fix bead creation)
- **Forward compatibility check**: Older tbd versions now error clearly when
  encountering newer config format versions instead of silently stripping unknown fields
- **Workspace issue counts**: `tbd workspace list` displays
  open/in_progress/closed/total counts per workspace

### Fixes

- **Git maxBuffer overflow**: Increased buffer from 1MB to 50MB to prevent sync failures
  on large repos
- **Workspace mappings filtering**: Save now correctly includes only mappings for saved
  issues
- **Priority ordering in tree view**: Child beads maintain priority-based ordering when
  no explicit hints provided
- **Tryscript test output formatting**: Updated help output column widths and test
  expectations

### Refactoring

- **Branded types for IDs**: Added InternalId and DisplayId branded types for type-safe
  ID handling
- **Standardized gh CLI setup**: Consistent GitHub CLI configuration pattern across all
  shortcuts
- **Removed redundant re-exports**: Cleaned up backward compatibility aliases that were
  no longer needed

### Documentation

- **Golden testing guidelines**: Improved clarity with “Two Implementation Strategies”
  section and tryscript quick reference
- **README cleanup**: Removed duplicate sections, fixed typos, improved quick start
- **Editorial rules**: Expanded from 4 to 6 rules with consistent formatting
- **Code review shortcuts**: Documented three review scopes and auto-loaded guidelines
  in README

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.12...v0.1.13
