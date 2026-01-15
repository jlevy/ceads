# Development Guide

This document covers development setup and workflows for tbd-cli.

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

### Building

```bash
# Build all packages
pnpm build

# Watch mode for development
pnpm --filter tbd-cli dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm --filter tbd-cli test:watch
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
│   └── tbd-cli/           # Main CLI package
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

See [tbd-design-v3.md](project/architecture/current/tbd-design-v3.md) for the full
design document.

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
