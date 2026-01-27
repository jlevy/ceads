## What’s Changed

### Features

- **Spec linking**: New `spec_path` field to associate beads with specification
  documents
- **Create with spec**: `tbd create --spec path/to/spec.md` links beads to specs at
  creation
- **List by spec**: `tbd list --spec path/to/spec.md` filters beads by associated spec
- **Configurable doc cache**: New `docs_cache` config for controlling doc sync behavior
- **Auto-sync verbosity**: Doc auto-sync now respects CLI verbosity settings
- **Incremental build**: Pre-push hook uses incremental build for faster development
- **Global install script**: New `ensure-tbd-cli.sh` script for reliable tbd
  installation

### Fixes

- Fixed shortcut name from `new-research-doc` to `new-research-brief`
- Fixed project-paths test for Windows cross-platform CI
- Fixed race condition in legacy cleanup on macOS
- Fixed macOS symlink path resolution using realpath in tests
- Fixed legacy cleanup moved to SetupAutoHandler for CI reliability
- Fixed SKILL.md generation for flowmark-compatible formatting
- Fixed format version from 0.2.0 to 0.1.5 in f02 spec

### Refactoring

- Simplified markdown-utils with single `parseMarkdown` function
- Consolidated doc_cache and docs config into unified `docs_cache`
- Streamlined global scripts and removed legacy redirect
- Consolidated tbd session script to ensure PATH persists

### Documentation

- Comprehensive revision of CLI as Agent Skill research
- Reorganized and improved Quick Reference tables
- Added dependency and status update examples

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.5...v0.1.6
