---
title: TypeScript Monorepo Patterns
description: Modern patterns for TypeScript monorepo architecture
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# TypeScript Monorepo Patterns

## Recommended Stack

- **pnpm workspaces** for dependency management
- **tsdown** for building ESM/CJS dual outputs with TypeScript declarations
- **Changesets** for versioning and release automation
- **publint** for validating package publishability
- **lefthook** for fast local git hooks

## Key Principles

### Package Structure

- Use `packages/` directory from day one, even with a single package
- Structure for splitting: organize internal code (`core/`, `cli/`, `adapters/`)
- Scope package names: use `@org/package-name` format

### Build Configuration

- Use `moduleResolution: "Bundler"` with tsdown
- Configure dual format output (ESM `.js` and CJS `.cjs`)
- Generate separate declaration files for ESM (`.d.ts`) and CJS (`.d.cts`)

### Subpath Exports

Always define subpath exports in package.json:

```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./cli": { ... }
  }
}
```

### Script Patterns

- `format` / `format:check`: Auto-format vs verify formatting
- `lint` / `lint:check`: Lint with fix vs verify only
- `build`: Run format then lint:check before building

### Pre-commit Hooks (lefthook)

Target 2-5 seconds total:
- Format staged files with Prettier (auto-stage fixed)
- Lint staged files with ESLint caching (auto-stage fixed)
- Type check with incremental mode

### CLI Development

Use the dual-script pattern:
- `cli-name`: Runs source via tsx (development)
- `cli-name:bin`: Runs built binary (verification)

## Best Practices

1. Types first in exports (always put `"types"` before `"default"`)
2. Optional peer deps for integrations (don’t force SDK dependencies)
3. Validate with publint before every release
4. Lock tooling versions in `packageManager` field
5. Keep root package.json private
6. Run CLI from source during development (no stale builds)
