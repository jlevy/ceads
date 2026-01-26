## What’s Changed

### Features

- **Agent orientation system**: Complete implementation of `tbd prime` for agent
  self-orientation with dynamic status output
- **Update command options**: Added `--title` and `--from-file` options for `tbd update`
- **DocCache and shortcuts**: New shortcut system for quick access to guidelines and
  templates via `tbd shortcut`
- **Separate doc commands**: Guidelines and templates exposed as top-level
  `tbd guideline` and `tbd template` commands
- **Agent instruction headers**: Doc output now includes agent instruction headers
- **gitignore-utils library**: Idempotent .gitignore editing for setup commands

### Fixes

- Fixed generated SKILL.md and AGENTS.md to be flowmark-compatible
- Fixed DO NOT EDIT marker placement after YAML frontmatter
- Fixed `--status closed` filter to properly return closed issues
- Fixed prefix auto-detection removed, now requires explicit `--prefix` flag
- Fixed tryscript tests for new command options and version patterns
- Fixed CLI tests for Windows compatibility and environment-independent matching

### Refactoring

- Removed Cursor rules in favor of AGENTS.md
- Consolidated shortcut naming to use “beads” consistently
- Removed legacy commands for clean upgrade path
- Streamlined init/setup design with unified entry point

### Documentation

- Added research on skills vs meta-skill architecture
- Enhanced README with agent orientation and self-documenting CLI guidance
- Added comprehensive relationship types documentation (§2.7)
- Added typescript-cli-tool-rules guideline

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.4...v0.1.5
