## What’s Changed

### Features

- **Terminal design system**: Unified section renderers for consistent CLI output across
  all commands
- **New shortcuts**: Added `agent-handoff` and `new-shortcut` templates; renamed
  `new-implementation-beads-from-spec` to `plan-implementation-with-beads` for clarity

### Fixes

- **npm global bin path detection**: Fixed tbd auto-install and session hook to
  correctly detect npm global bin path across different environments
- **Stats command output**: Restored `Summary:` heading in stats command output
- **Windows test timeout**: Added explicit timeout for Windows performance test

### Refactoring

- Standardized shortcut title formatting using frontmatter
- Restored full content in shortcuts with redundant headers removed

### Documentation

- Added unified sync command spec
- Added golden output tests for orientation commands and terminal design system

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.10...v0.1.11
