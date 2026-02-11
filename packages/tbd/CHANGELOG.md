# get-tbd

## 0.1.19

### Patch Changes

- 4586df7: Bug fixes: prevent .tbd root detection from finding spurious .tbd/ in
  subdirectories, make baseDir required in path functions to prevent subdirectory bugs,
  show relative paths in uninstall preview output, and fix tryscript test expectations
  for config output format.

## 0.1.18

### Patch Changes

- 0feb918: Bug fixes and stability improvements: YAML duplicate key handling after merge
  conflicts, sync debug log branch fix, beads import priority mapping, EPIPE pager
  handling, improved error cause chains, workspace save/import progress logging, and
  test stability fixes.

## 0.1.17

### Patch Changes

- 3f1a09c: Add interactive markdown rendering with pagination for doc commands
  (guidelines, shortcuts, templates) and improve YAML frontmatter styling with syntax
  highlighting.

## 0.1.16

### Patch Changes

- 78d4671: Bug fixes and improvements including doctor remote count fix, init git root
  resolution, JSON mode options suppression, streamlined sync outbox workflow, and
  updated default no-args behavior.

## 0.1.15

### Patch Changes

- 6062050: Documentation consolidation: new shortcuts directory, comprehensive
  TypeScript monorepo and CLI guidelines, and updated README with new shortcuts and
  guidelines.

## 0.1.14

### Patch Changes

- 65b691f: Two-tier prefix validation with --force override, YAML handling improvements
  with Zod validation, and various bug fixes.

## 0.1.13

### Patch Changes

- Workspace sync feature, child bead ordering hints, unified review-code shortcut, and
  various improvements.

## 0.1.12

### Patch Changes

- 1509909: Bug fixes for sync reliability, stats output redesign, and documentation
  improvements.

## 0.1.11

### Patch Changes

- Terminal design system, shortcut improvements, and bug fixes

## 0.1.10

### Patch Changes

- c2cff07: Fix detached HEAD worktree handling for users upgrading from older tbd
  versions. Auto-repairs worktrees that were created before the detached HEAD
  improvement, ensuring sync operations preserve the working directory correctly.

## 0.1.9

### Patch Changes

- 2809883: Worktree robustness improvements, setup bug fixes, and documentation updates.
  Key changes include automatic worktree detection and repair, graceful handling of
  already-migrated data, bypassing parent repo hooks in worktree commits, improved
  .gitignore management on upgrade, and simplified agent integration documentation.

## 0.1.8

### Patch Changes

- Rename npm package from tbd-git to get-tbd, add --specs flag for tbd list, fix
  project-local hook installation, and improve setup git root resolution

## 0.1.7

### Patch Changes

- Inherit spec_path from parent beads, automatic gh CLI setup via SessionStart hook, and
  various bug fixes

## 0.1.6

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.
- cc830b5: Spec linking feature with `--spec` options for create/list commands,
  configurable doc cache with auto-sync, and various bug fixes.

## 0.1.5

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.

## 0.1.4

### Patch Changes

- Fix subdirectory support, enforce atomic writes for data integrity, and add
  relationship types documentation.

## 0.1.3

### Patch Changes

- Fix build to ensure clean version numbers by syncing documentation files before
  release.

## 0.1.2

### Patch Changes

- Bug fixes, CLI improvements, and documentation updates including redesigned
  status/stats/doctor commands, improved error handling with proper exit codes, and test
  infrastructure improvements.

## 0.1.1

### Patch Changes

- Fix flaky performance test and clarify publishing documentation
