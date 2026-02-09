# Development Guide

This document covers development setup and workflows for `get-tbd` (the tbd CLI).

## Prerequisites

- Node.js >= 20
- pnpm (will be installed automatically via corepack)

## Setup

```bash
# Enable corepack (includes pnpm)
corepack enable

# Install dependencies
pnpm install

# Install git hooks
pnpm prepare
```

## Development Workflow

### Running the CLI from source

During development, run the CLI directly from TypeScript source (no build needed):

```bash
pnpm tbd --help
pnpm tbd list
pnpm tbd create "My issue" -t bug
```

### Running the built CLI

To test the production build:

```bash
pnpm build
pnpm tbd:bin --help
```

### Testing new shortcuts, guidelines, or templates

**Important**: When adding new documentation files (shortcuts, guidelines, templates) to
`packages/tbd/docs/`, you must test with the **local build**, not the globally installed
`tbd`.

The globally installed `tbd` has its own bundled docs from the published npm package.
Running `tbd setup --auto` with the global installation won’t include your new files.

```bash
# 1. Add your new file to packages/tbd/docs/tbd/shortcuts/my-shortcut.md

# 2. Build to bundle the new file into dist/docs/
pnpm build

# 3. Run setup with the LOCAL build (from repo root)
node packages/tbd/dist/bin.mjs setup --auto

# 4. Verify the file was copied to .tbd/docs/
ls .tbd/docs/tbd/shortcuts/my-shortcut.md

# 5. Test the shortcut with the local build
node packages/tbd/dist/bin.mjs shortcut my-shortcut
```

**Never manually create files in `.tbd/docs/`**—always add them to `packages/tbd/docs/`
and let `setup --auto` copy them.
This ensures the setup process works correctly for users.

### Testing the packaged installation

To test the CLI exactly as users would install it from npm:

```bash
# Build, pack, and install globally (like npm install -g get-tbd)
pnpm test:install

# Test the installed binary
tbd --help

# Uninstall when done
pnpm test:uninstall
```

This creates an npm tarball and installs from it, validating the full package structure.

### Building

```bash
# Build all packages
pnpm build

# Watch mode for development
pnpm --filter get-tbd dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm --filter get-tbd test:watch
```

### Formatting and Linting

```bash
# Format code (auto-fix)
pnpm format

# Check formatting (CI)
pnpm format:check

# Lint with auto-fix
pnpm lint

# Lint check only (CI)
pnpm lint:check

# Type check
pnpm typecheck
```

### Validating Package

```bash
# Validate package.json exports
pnpm publint
```

## Git Hooks

Git hooks are managed by lefthook and run automatically:

- **pre-commit**: Format, lint, and typecheck staged files
- **pre-push**: Run tests

To skip hooks (emergency only):

```bash
git commit --no-verify
git push --no-verify
```

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Format

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation for the product or main codebase (not process docs)
- `process`: Documentation or tooling changes to agent or human development processes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

### Examples

```
feat: Add support for custom labels

fix: Handle empty issue list gracefully

docs: Update CLI usage examples

process: Add TDD guidelines for agent workflows

test: Add golden tests for sync command

chore: Update dependencies
```

### Notes

- **No scope by default**: Don’t include a scope like `fix(tbd):` for the main codebase.
  Only use a scope when it provides key disambiguation or clarification (e.g.,
  `fix(parser):` vs `fix(cli):` when the distinction matters).
- Keep the first line under 72 characters
- Use imperative mood ("Add feature" not “Added feature”)

## Creating Releases

We use [Changesets](https://github.com/changesets/changesets) for versioning.

### Adding a changeset

When making a change that should be included in a release:

```bash
pnpm changeset
```

Follow the prompts to describe your change and select the version bump type.

### Release process

1. Create a changeset with your PR
2. Merge PR to main
3. CI will create a “Version Packages” PR
4. Merge that PR to publish to npm and create a GitHub release

## Project Structure

```
tbd/
├── packages/
│   └── tbd/               # Main CLI package
│       ├── src/
│       │   ├── index.ts   # Library entry (node-free)
│       │   ├── cli/       # CLI-specific code
│       │   │   ├── bin.ts
│       │   │   ├── cli.ts
│       │   │   ├── commands/
│       │   │   └── lib/
│       │   ├── lib/       # Core library (schemas, types)
│       │   ├── file/      # File layer
│       │   └── git/       # Git layer
│       └── tests/
├── scripts/               # Development scripts
├── docs/                  # Documentation
├── .github/workflows/     # CI/CD
└── .changeset/            # Changesets config
```

## Architecture

See [tbd-design.md](tbd-design.md) for the full design document.

Key concepts:

- **File Layer**: Markdown + YAML front matter format
- **Git Layer**: Sync via dedicated `tbd-sync` branch
- **CLI Layer**: Commander.js with Beads-compatible commands

## CLI Patterns

The CLI follows patterns from
[research-modern-typescript-cli-patterns.md](general/research/current/research-modern-typescript-cli-patterns.md):

- Base Command pattern for shared functionality
- Dual output mode (text + JSON)
- OutputManager for consistent output handling
- Proper stdout/stderr separation

## Worktree Architecture

tbd uses a **hidden git worktree** to store issue data on the `tbd-sync` branch while
keeping the user’s working directory clean.
See [tbd-design.md §2.3](packages/tbd/docs/tbd-design.md#23-hidden-worktree-model) for
the full specification.

### Why Worktree?

- **Fast search**: ripgrep can search issues without git plumbing commands
- **Direct file access**: Read/write issues as regular files, no
  `git show`/`git cat-file`
- **Isolated from main**: Issues don’t pollute working directory or affect main branch
- **Conflict-free**: Detached HEAD avoids branch lock conflicts

### Path Conventions

```
.tbd/                               # Config directory (on main branch)
├── config.yml                      # Project configuration (tracked)
├── state.yml                       # Local state (gitignored)
├── .gitignore                      # Ignores worktree, docs, backups
├── docs/                           # Installed documentation
├── backups/                        # Local backups (corrupted worktrees, migrations)
└── data-sync-worktree/             # Hidden worktree (gitignored)
    └── .tbd/
        └── data-sync/              # Actual issue storage (on tbd-sync branch)
            ├── issues/
            ├── mappings/
            ├── attic/
            └── meta.yml
```

**CRITICAL**: Issues must be written to the **worktree path**
(`.tbd/data-sync-worktree/.tbd/data-sync/issues/`), NOT the direct path
(`.tbd/data-sync/issues/`). The direct path is gitignored and exists only for potential
future “simple mode” support.

### Key Source Files

- `packages/tbd/src/lib/paths.ts` - Path constants and `resolveDataSyncDir()`
- `packages/tbd/src/file/git.ts` - Worktree init/health/repair functions
- `packages/tbd/src/cli/commands/sync.ts` - Sync command with worktree checks
- `packages/tbd/src/cli/commands/doctor.ts` - Health checks and repair

### Worktree Health States

| State | Description | Fix |
| --- | --- | --- |
| `valid` | Worktree exists and has correct branch | None needed |
| `missing` | Worktree directory doesn't exist | `tbd doctor --fix` |
| `prunable` | Directory deleted but git tracks it | `tbd sync --fix` |
| `corrupted` | Missing .git file or wrong branch | `tbd doctor --fix` |

### Common Failure Modes

1. **Worktree deleted manually**: User or tool deletes `.tbd/data-sync-worktree/`. Git
   still tracks it (prunable state).
   Fix: `tbd sync --fix` or `tbd doctor --fix`.

2. **Data in wrong location**: Bug or old code writes to `.tbd/data-sync/` instead of
   worktree. Fix: `tbd doctor --fix` migrates data to worktree.

3. **Fresh clone**: Repo cloned but worktree not created.
   `tbd setup --auto` or first sync creates it.

4. **Git version mismatch**: Orphan worktree requires Git 2.42+. Check: `git --version`,
   update if needed.

### Debugging Tips

```bash
# Check worktree health
tbd doctor

# Verbose sync for debugging
tbd sync --debug

# List git worktrees
git worktree list

# Check what git thinks about the worktree
git worktree list --porcelain

# Manually prune stale worktree entries
git worktree prune

# Enable debug logging for path resolution
DEBUG=1 tbd sync
# or
TBD_DEBUG=1 tbd sync
```

### Testing Worktree Code

Run the worktree health tests:

```bash
npx vitest run tests/worktree-health.test.ts
```

Run the e2e worktree scenarios:

```bash
npx tryscript run tests/cli-sync-worktree-scenarios.tryscript.md
```
