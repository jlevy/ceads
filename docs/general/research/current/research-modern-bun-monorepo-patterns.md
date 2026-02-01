# Research Brief: Modern Bun Monorepo Architecture Patterns

**Last Updated**: 2026-01-27

**Status**: Complete

**Related**:

- [Bun Workspaces Documentation](https://bun.sh/docs/install/workspaces)

- [Bunup Documentation](https://bunup.dev/)

- [Changesets Documentation](https://github.com/changesets/changesets)

- [Biome Documentation](https://biomejs.dev/)

- [Companion: Modern TypeScript pnpm Monorepo Patterns](./research-modern-typescript-monorepo-patterns.md)

* * *

## Updating This Document

### Last Researched Versions

| Tool / Package | Version | Check For Updates |
| --- | --- | --- |
| **Bun** | 1.3.5 | [bun.sh/blog](https://bun.sh/blog) — Runtime, bundler, package manager, test runner. Acquired by Anthropic (Dec 2025). |
| **TypeScript** | ^5.9.3 | [github.com/microsoft/TypeScript/releases](https://github.com/microsoft/TypeScript/releases) — 5.9 adds `import defer`, `--module node20`. TS 6.0/7.0 expected early 2026. |
| **Bunup** | ^0.16.0 | [npmjs.com/package/bunup](https://www.npmjs.com/package/bunup) — Build tool for TS libs. Rapid iteration (0.16.20 latest). |
| **Biome** | ^2.3.0 | [biomejs.dev](https://biomejs.dev/) — Formatter + linter. v2.0 added plugins and type-aware linting; 2.3.x is latest stable. |
| **@changesets/cli** | ^2.29.0 | [github.com/changesets/changesets/releases](https://github.com/changesets/changesets/releases) — 2.29.8 latest. No native Bun support yet. |
| **publint** | ^0.3.0 | [npmjs.com/package/publint](https://www.npmjs.com/package/publint) — 0.3.16 latest |
| **actions/checkout** | v6 | [github.com/actions/checkout/releases](https://github.com/actions/checkout/releases) |
| **oven-sh/setup-bun** | v2 | [github.com/oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) — Verified on GitHub Marketplace |
| **lefthook** | ^2.0.0 | [github.com/evilmartians/lefthook/releases](https://github.com/evilmartians/lefthook/releases) — 2.0.15 latest |
| **npm-check-updates** | ^19.0.0 | [npmjs.com/package/npm-check-updates](https://www.npmjs.com/package/npm-check-updates) |

### Reminders When Updating

1. **Check each version** in the table above using the linked release pages

2. **Update the table** with new versions and any relevant notes

3. **Search and update code examples** — version numbers appear in:

   - GitHub Actions workflows (CI and Release sections)

   - `bunup.config.ts` examples

   - `tsconfig.base.json` examples

   - `package.json` examples (`devDependencies`)

   - Appendices (complete examples)

4. **Verify compatibility** — check that tools still work together

5. **Update the “Last Updated” date** at the top of the document

6. **Review “Open Research Questions”** section for any resolved items

* * *

## Executive Summary

This research brief provides a comprehensive guide for setting up a modern TypeScript
monorepo using the **Bun ecosystem** end-to-end — Bun as runtime, package manager,
bundler (via Bunup), and test runner.
It serves as a direct comparison to the companion document on pnpm-based monorepos,
covering the same architectural scope but using Bun-native tooling wherever possible.

The recommended stack uses **Bun workspaces** for dependency management, **Bunup** for
building ESM/CJS dual outputs with TypeScript declarations, **Changesets** (with Bun
workarounds) for versioning and release automation, **Biome** for formatting and
linting, **publint** for package validation, and **lefthook** for git hooks.
The architecture also covers Bun’s unique capability for **compiling standalone
executables** — a native binary distribution path unavailable in the pnpm ecosystem.

**Research Questions**:

1. Can the Bun ecosystem fully replace pnpm + Node.js + tsdown for a TypeScript
   monorepo?

2. How does complexity compare between a full-Bun and full-pnpm monorepo setup?

3. What are the trade-offs in ecosystem maturity, tooling gaps, and CI/CD support?

4. What unique capabilities does Bun offer that pnpm-based setups cannot?

* * *

## Research Methodology

### Approach

Research was conducted through official Bun documentation, web searches for current best
practices (2025–2026), analysis of real-world Bun monorepo implementations, evaluation
of Bunup and Biome documentation, and direct comparison with the companion pnpm monorepo
research stock.

### Sources

- Official documentation (Bun, Bunup, Biome, TypeScript, Changesets)

- Developer blog posts and migration guides

- GitHub discussions and issue threads

- Benchmark data and comparison articles

- Real-world Bun monorepo implementations

* * *

## Research Findings

### 1. Package Manager & Workspace Structure

#### Bun Workspaces

**Status**: Recommended (with caveats)

**Details**:

- Bun provides built-in workspace support via the `workspaces` field in `package.json`

- Dramatically faster installs than pnpm, npm, or yarn (often 2–10x)

- Uses `bun.lock` (text-based JSONC lockfile, default since Bun 1.2) for diffable,
  deterministic resolution.
  The older binary `bun.lockb` is deprecated.

- Supports `workspace:*` protocol for inter-package references

- Does not use a content-addressable store like pnpm — installs are flat in
  `node_modules`

- Missing some pnpm features: no `pnpm deploy`, less strict `node_modules` (phantom
  dependencies possible)

- **Notable**: Bun was acquired by Anthropic in December 2025. Bun now powers Claude
  Code, Claude Agent SDK, and other Anthropic AI tooling, signaling strong ongoing
  investment and maintenance.

**Assessment**: Bun workspaces are functional and fast, but less strict than pnpm.
The text-based `bun.lock` format (since Bun 1.2) resolves the earlier diffability
concern. The lack of content-addressable storage means higher disk usage in large
monorepos.
For projects prioritizing speed over strictness, Bun workspaces are excellent.
For projects requiring hermetic dependency isolation, pnpm remains superior.

**Key Configuration** (root `package.json`):

```json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Adding dependencies to specific workspaces**:

```bash
# Use --cwd to target a specific workspace
bun add express --cwd packages/server

# Or from the workspace directory
cd packages/server && bun add express
```

**References**:

- [Bun Workspaces](https://bun.sh/docs/install/workspaces)

- [Guide to Monorepo Setup: NPM, Yarn, Pnpm & Bun Workspaces](https://jsdev.space/mastering-monorepos/)

* * *

#### Monorepo Structure Strategy

**Status**: Recommended

**Details**:

The same “start mono, stay sane” approach from the pnpm research applies here.
Place packages in `packages/` from day one, even with a single package.

**Recommended Directory Structure**:

```
project-root/
  .changeset/
    config.json
    README.md
  .github/
    workflows/
      ci.yml
      release.yml
  packages/
    package-name/
      src/
        core/           # Future: package-name-core
        cli/            # Future: package-name-cli
        adapters/       # Future: package-name-adapters
        bin.ts
        index.ts
      package.json
      tsconfig.json
      bunup.config.ts
  biome.json
  bun.lock
  lefthook.yml
  package.json
  tsconfig.base.json
```

**Key differences from pnpm structure**:

| File | pnpm Monorepo | Bun Monorepo |
| --- | --- | --- |
| Lockfile | `pnpm-lock.yaml` | `bun.lock` (text JSONC, diffable) |
| Workspace config | `pnpm-workspace.yaml` | `workspaces` in `package.json` |
| Package manager config | `.npmrc` | `bunfig.toml` (optional) |
| Lint/format config | `.prettierrc` + `eslint.config.js` | `biome.json` (single file) |
| Build config | `tsdown.config.ts` | `bunup.config.ts` |

**Assessment**: The directory structure is nearly identical.
Bun consolidates configuration into fewer files (no separate workspace config, single
`biome.json` instead of Prettier + ESLint configs).

* * *

### 2. TypeScript Configuration

#### Base Configuration

**Status**: Recommended

**Details**:

TypeScript configuration for Bun monorepos is nearly identical to pnpm monorepos.
The main difference is that Bun natively executes TypeScript, so the configuration
primarily serves IDE support, type checking, and declaration generation.

**`tsconfig.base.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "isolatedDeclarations": true
  }
}
```

**Package-level `tsconfig.json`**:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "noEmit": true
  },
  "include": ["src"]
}
```

**Key difference**: `isolatedDeclarations: true` is strongly recommended for Bun
projects because Bunup’s DTS generation is dramatically faster when this is enabled (it
avoids invoking the full TypeScript compiler).

**Assessment**: Nearly identical to the pnpm setup.
The addition of `isolatedDeclarations` and `bun-types` are the only differences.
Using `moduleResolution: "Bundler"` is appropriate since Bunup handles the final output.

**References**:

- [Bun TypeScript Documentation](https://bun.sh/docs/typescript)

- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)

* * *

#### Bun-Specific TypeScript Features

**Status**: Informational

**Details**:

Bun supports a `"bun"` export condition in `package.json` that allows consumers running
Bun to directly import TypeScript source files, bypassing compiled output entirely:

```json
{
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }
  }
}
```

This means during development within the monorepo, Bun can consume TypeScript directly
without a build step — a significant DX advantage over Node.js-based setups.

**Assessment**: This is a unique Bun advantage.
During local development, packages can be consumed without building.
Published packages still need compiled output for Node.js consumers.

* * *

### 3. Build Tooling

#### Bunup

**Status**: Strongly Recommended

**Details**:

Bunup is the modern build tool for TypeScript libraries, powered by Bun’s native
bundler. It is the Bun-ecosystem analog to tsdown in the pnpm ecosystem.

Key advantages:

- **Extremely fast**: ~37ms builds vs multi-second builds with tsdown/tsup

- **Dual format output**: Generates both ESM (`.js`) and CJS (`.cjs`)

- **TypeScript declarations**: Built-in `.d.ts` and `.d.cts` generation (much faster
  with `isolatedDeclarations`)

- **Multi-entry support**: Build multiple entry points in one config

- **Workspace support**: `defineWorkspace()` for monorepo builds with incremental
  rebuilds

- **Auto-exports**: Automatically generates and updates `package.json` `exports` field

- **Compile support**: Can produce standalone executables via `bun --compile`

- **Rapid iteration**: Bunup is under active development (0.16.x as of Jan 2026), with
  frequent releases. Pin to a specific minor version for stability.

**Configuration (`bunup.config.ts`)**:

```typescript
import { defineConfig } from 'bunup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: 'linked',
  banner: '"use strict";',
});
```

**Workspace configuration (`bunup.config.ts` at root)**:

```typescript
import { defineWorkspace } from 'bunup';

export default defineWorkspace([
  {
    name: 'core',
    root: 'packages/core',
    config: {
      entry: ['src/index.ts'],
      format: ['esm', 'cjs'],
      dts: true,
    },
  },
  {
    name: 'cli',
    root: 'packages/cli',
    config: {
      entry: ['src/index.ts', 'src/bin.ts'],
      format: ['esm'],
      dts: true,
    },
  },
]);
```

**Comparison with tsdown**:

| Criteria | Bunup | tsdown |
| --- | --- | --- |
| Build speed | ~37ms | ~200ms–1s |
| Runtime dependency | Bun | Node.js |
| DTS generation | Built-in (fast with isolatedDeclarations) | Built-in |
| Auto-exports | Yes (generates `exports` field) | No |
| Workspace mode | Built-in `defineWorkspace()` | No (use pnpm -r) |
| Plugin ecosystem | Growing (Bun plugins) | Rolldown/Rollup/Vite |
| Maturity | Newer (2025) | More established |
| Standalone executables | Yes (`compile: true`) | No |

**Assessment**: Bunup is the clear choice for Bun-native projects.
The auto-exports feature eliminates a common source of configuration errors.
The workspace mode provides monorepo-aware builds that tsdown does not offer natively.

**References**:

- [Bunup Documentation](https://bunup.dev/)

- [Building a TypeScript Library in 2026 with Bunup](https://dev.to/arshadyaseen/building-a-typescript-library-in-2026-with-bunup-3bmg)

* * *

### 4. Package Exports & Dual Module Support

#### Subpath Exports

**Status**: Essential

**Details**:

Package exports work identically to the pnpm setup.
The key difference is that Bunup can **auto-generate** the exports field, reducing
manual configuration errors.

**With Bunup auto-exports** (`bunup.config.ts`):

```typescript
import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  exports: true, // Auto-generates package.json exports
});
```

This auto-generates:

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    }
  }
}
```

**Manual configuration** (if not using auto-exports):

Identical to the pnpm research — use the same `exports` structure with `"types"` before
`"default"` in each condition block.

**Bun export condition**: Optionally add a `"bun"` condition pointing to TypeScript
source for Bun consumers:

```json
{
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

**Assessment**: Bunup’s auto-exports feature is a significant DX improvement over manual
exports configuration.
It eliminates a common class of publishing errors.

**References**:

- [Bunup Exports Configuration](https://bunup.dev/)

- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)

* * *

### 5. Optional Peer Dependencies

**Status**: Recommended

**Details**:

This pattern is identical to the pnpm ecosystem approach.
Bun handles peer dependencies the same way as npm/pnpm.

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ai": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "@modelcontextprotocol/sdk": { "optional": true },
    "ai": { "optional": true }
  }
}
```

**Assessment**: No differences from the pnpm approach.
Works identically in Bun.

* * *

### 6. Package Validation

#### publint

**Status**: Essential

**Details**:

publint works identically in the Bun ecosystem.
Run it via Bun:

```bash
bunx publint
```

**Integration**:

```json
{
  "scripts": {
    "publint": "bunx publint",
    "prepack": "bun run build"
  }
}
```

**Assessment**: No changes needed from the pnpm approach.
publint is runtime-agnostic.

* * *

### 7. Versioning & Release Automation

#### Changesets (with Bun Workarounds)

**Status**: Recommended (with workarounds)

**Details**:

Changesets is the de facto standard for monorepo versioning, but it has known issues
with Bun workspaces.
The key problem is that `changeset version` does not resolve `workspace:*` references to
actual version numbers, which breaks published packages.

**Setup**:

```bash
bun add -d @changesets/cli @changesets/changelog-github
bunx changeset init
```

**`.changeset/config.json`**: Identical to the pnpm setup:

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/changelog-github",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

**Critical workaround scripts**:

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version && bun update",
    "release": "bun run build && bunx publint && bun run publish-packages",
    "publish-packages": "for dir in packages/*; do (cd \"$dir\" && bun publish || true); done && changeset tag"
  }
}
```

**Why `bun update` after `changeset version`**: When Changesets updates version numbers
in `package.json` files, the `workspace:*` references in the lockfile become stale.
Running `bun update` regenerates the lockfile with resolved versions.

**Why `bun publish` per package**: The standard `changeset publish` uses npm under the
hood. Using `bun publish` directly for each package ensures proper Bun compatibility and
workspace reference resolution.

**Comparison with pnpm Changesets workflow**:

| Aspect | pnpm | Bun |
| --- | --- | --- |
| Setup | Works out of the box | Requires workarounds |
| Version command | `changeset version` | `changeset version && bun update` |
| Publish command | `changeset publish` | Custom per-package loop with `bun publish` |
| GitHub Action | `changesets/action` works directly | Needs custom publish step |
| Workspace resolution | Automatic | Requires `bun update` fixup |

**Assessment**: Changesets works with Bun but requires workarounds.
This is the most significant friction point in the Bun ecosystem compared to pnpm.
Monitor for native Bun support in Changesets or a Bun-native alternative.

**References**:

- [Setting up Changesets with Bun Workspaces](https://ianm.com/posts/2025-08-18-setting-up-changesets-with-bun-workspaces)

- [Changesets GitHub repository](https://github.com/changesets/changesets)

* * *

#### Dynamic Git-Based Versioning

**Status**: Recommended for dev builds

**Details**:

The git-based versioning pattern from the pnpm research works identically with Bun.
The only difference is the dev script uses `bun` instead of `tsx`:

**Dev Script** (`package.json`):

```json
{
  "scripts": {
    "dev": "PROJECT_DEV_VERSION=$(bun scripts/git-version.mjs) bun src/cli/bin.ts"
  }
}
```

**Key advantage**: Bun executes TypeScript directly, so there is no need for `tsx`. The
`scripts/git-version.mjs` script works unchanged since it uses only Node.js built-in
modules which Bun supports.

**Assessment**: Identical pattern, simpler execution.
No `tsx` dependency needed.

* * *

### 8. Testing

#### Bun Test Runner

**Status**: Recommended (with caveats)

**Details**:

Bun ships with a built-in test runner that is API-compatible with Jest/Vitest.
It is extremely fast — roughly 2x faster than Node’s built-in test runner and
significantly faster than Jest or Vitest.

**Key features**:

- Zero-config: works out of the box with TypeScript

- Jest-compatible API (`describe`, `it`, `expect`, `mock`, etc.)

- Watch mode with HMR (re-runs only affected tests)

- Snapshot testing

- Code coverage (built-in, `--coverage`)

- Lifecycle hooks (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`)

**Running tests**:

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test --coverage         # With coverage
bun test --timeout 10000    # Custom timeout
```

**Test file patterns**: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, or files
in `__tests__/` directories.

**Example test**:

```typescript
import { describe, it, expect, mock } from 'bun:test';
import { processData } from '../src/index.ts';

describe('processData', () => {
  it('handles valid input', () => {
    expect(processData({ key: 'value' })).toEqual({ key: 'VALUE' });
  });

  it('throws on invalid input', () => {
    expect(() => processData(null)).toThrow('Invalid input');
  });
});
```

**Known limitations**:

- Tests are not isolated by default (side effects can leak between suites)

- Less mature IDE integration than Vitest

- No browser mode, benchmarking, type testing, or sharding (features Vitest has)

**Fake timers** (added in Bun v1.3.4, Dec 2025):

Bun’s test runner now supports Jest-compatible fake timers via `jest.useFakeTimers()`,
`jest.advanceTimersByTime(ms)`, and `jest.useRealTimers()`. This was previously a major
gap. The system time mock (`setSystemTime` from `bun:test`) has been available longer.
Bun v1.3.6 added further compatibility fixes for `@testing-library/react` fake timer
detection.

**Comparison with Vitest / Node test runner**:

| Criteria | Bun test | Vitest | Node test runner |
| --- | --- | --- | --- |
| Speed | Fastest | Fast | Fast |
| Setup | Zero-config | Requires install + config | Zero-config (Node 20+) |
| TypeScript | Native | Via Vite transform | Via `--experimental-strip-types` or tsx |
| API | Jest-compatible | Jest-compatible | Node-native API |
| Watch mode | HMR-based | HMR-based | File-system based |
| Isolation | No isolation | Isolated by default | Isolated |
| Fake timers | Jest-compatible (v1.3.4+) | Full support | Full support |
| Coverage | Built-in | Built-in (c8/v8) | Built-in (Node 20+) |
| IDE support | Basic | Excellent (VS Code) | Moderate |
| Ecosystem | Growing | Mature | Node-native |

**Assessment**: With fake timers added in Bun v1.3.4, the main remaining gap is test
isolation and advanced features (browser mode, sharding).
Use `bun test` for most Bun-native projects.
For projects requiring test isolation or cross-runtime compatibility, Vitest remains the
safer choice.

**References**:

- [Bun Test Runner](https://bun.sh/docs/cli/test)

- [Comparing Test Frameworks: Jest vs Vitest vs Bun](https://dev.to/kcsujeet/your-tests-are-slow-you-need-to-migrate-to-bun-9hh)

- [Node Test Runner vs Bun Test Runner](https://dev.to/boscodomingo/node-test-runner-vs-bun-test-runner-with-typescript-and-esm-44ih)

* * *

### 9. Code Formatting & Linting

#### Biome

**Status**: Recommended

**Details**:

Biome is an all-in-one formatter and linter written in Rust.
It replaces both Prettier and ESLint with a single tool, aligning well with the Bun
ecosystem’s philosophy of consolidation and speed.

**Key advantages**:

- **10–25x faster** than ESLint + Prettier combined

- **Single configuration file** (`biome.json`) instead of `.prettierrc` +
  `eslint.config.js`

- **Single binary** instead of 127+ npm packages

- **97% Prettier-compatible** formatting

- **300+ lint rules** including type-aware linting (v2.0+, without requiring `tsc`)

- **Built-in migration** from ESLint and Prettier configs

- **v2.3.x** (latest as of Jan 2026) adds nursery rules for floating promises
  (`noFloatingPromises`), duplicate HTML attributes, JSX prop binding, and more

**Installation**:

```bash
bun add -d @biomejs/biome
```

**`biome.json`**:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      }
    }
  },
  "files": {
    "ignore": ["dist", "node_modules", ".changeset"]
  }
}
```

**Scripts**:

```json
{
  "scripts": {
    "format": "biome format --write .",
    "format:check": "biome format .",
    "lint": "biome lint --write .",
    "lint:check": "biome lint .",
    "check": "biome check --write .",
    "check:ci": "biome check ."
  }
}
```

**Biome `check` vs separate commands**: `biome check` runs both formatting and linting
in a single pass, which is faster than running them separately.
Use `check` for local development and `check:ci` (without `--write`) for CI.

**Comparison with Prettier + ESLint**:

| Criteria | Biome | Prettier + ESLint |
| --- | --- | --- |
| Speed | 10–25x faster | Baseline |
| Config files | 1 (`biome.json`) | 2–4 files |
| npm packages | 1 | 5–10+ (with plugins) |
| Type-aware linting | v2.0+ (plugin) | ESLint + typescript-eslint |
| Language support | JS/TS/JSON/CSS | Broader (HTML, Markdown, SCSS, etc.) |
| Plugin ecosystem | Growing (v2.0) | Mature (decade of plugins) |
| IDE support | Good (VS Code, JetBrains) | Excellent |
| Prettier compatibility | 97% | 100% (is Prettier) |

**Known limitations**:

- Does not format HTML, Markdown, or SCSS (use Prettier alongside if needed)

- Younger plugin ecosystem than ESLint

- Missing some specialized ESLint plugins (security, accessibility)

**Assessment**: Biome is the natural choice for a full-Bun ecosystem.
It provides the same quality guarantees as Prettier + ESLint with dramatically less
configuration and better performance.
For projects that need HTML/Markdown formatting or specialized ESLint plugins, a hybrid
approach (Biome + targeted Prettier/ESLint) is viable.

**References**:

- [Biome Documentation](https://biomejs.dev/)

- [Biome vs ESLint + Prettier: The 2025 Linting Revolution](https://medium.com/better-dev-nextjs-react/biome-vs-eslint-prettier-the-2025-linting-revolution-you-need-to-know-about-ec01c5d5b6c8)

- [Migrating from Prettier and ESLint to BiomeJS](https://blog.appsignal.com/2025/05/07/migrating-a-javascript-project-from-prettier-and-eslint-to-biomejs.html)

* * *

### 10. CI/CD Configuration

#### GitHub Actions: CI Workflow

**Status**: Recommended

**`.github/workflows/ci.yml`**:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile

      - run: bun run check:ci
      - run: bun run build
      - run: bunx publint
      - run: bun test
```

**Key differences from pnpm CI**:

| Aspect | pnpm CI | Bun CI |
| --- | --- | --- |
| Setup action | `pnpm/action-setup@v4` + `actions/setup-node@v6` | `oven-sh/setup-bun@v2` (one action) |
| Install | `pnpm install --frozen-lockfile` | `bun install --frozen-lockfile` |
| Lockfile | `pnpm-lock.yaml` (YAML) | `bun.lock` (JSONC, text-based since Bun 1.2) |
| Lint + format | Separate `format:check` + `lint:check` | Single `biome check` |
| Node.js setup | Required | Not required (Bun includes runtime) |

**Assessment**: Bun CI is simpler — one setup action instead of two, and a single check
command instead of separate format and lint steps.
The text-based `bun.lock` (since Bun 1.2) is diffable in PRs, on par with
`pnpm-lock.yaml`.

**References**:

- [Bun CI/CD Guide](https://bun.sh/docs/guides/runtime/cicd)

- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun)

* * *

#### GitHub Actions: Release Workflow

**Status**: Recommended

**`.github/workflows/release.yml`**:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          version: bun run version-packages
          publish: bun run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Important**: The `version` command must be `bun run version-packages` (which includes
the `bun update` fixup), not just `changeset version`. The `publish` command uses the
custom per-package publish script.

**Assessment**: Slightly more complex than the pnpm release workflow due to the
Changesets workarounds, but functionally equivalent.

* * *

### 11. Git Hooks & Local Validation

#### Lefthook with Biome

**Status**: Recommended

**Details**:

Lefthook works identically in the Bun ecosystem.
The main change is replacing Prettier + ESLint commands with Biome.

**Installation**:

```bash
bun add -d lefthook
bunx lefthook install
```

**`lefthook.yml`**:

```yaml
pre-commit:
  parallel: true

  commands:
    # Format + lint with Biome (~200ms)
    check:
      glob: '*.{js,ts,tsx,json}'
      run: bunx biome check --write {staged_files}
      stage_fixed: true
      priority: 1

    # Type check (~2s)
    typecheck:
      glob: '*.{ts,tsx}'
      run: bunx tsc --noEmit --incremental
      priority: 2

pre-push:
  commands:
    verify-tests:
      run: |
        COMMIT_HASH=$(git rev-parse HEAD)
        CACHE_DIR="node_modules/.test-cache"
        CACHE_FILE="$CACHE_DIR/$COMMIT_HASH"

        if ! git diff --quiet || ! git diff --cached --quiet; then
          bun test
          exit $?
        fi

        if [ -f "$CACHE_FILE" ]; then
          exit 0
        fi

        bun test

        if [ $? -eq 0 ]; then
          mkdir -p "$CACHE_DIR"
          touch "$CACHE_FILE"
        else
          exit 1
        fi
```

**Key advantage**: Using `biome check` in pre-commit combines formatting and linting
into a single command, reducing hook complexity from 2–3 commands to 1.

**Assessment**: Simpler and faster hooks than the pnpm equivalent thanks to Biome’s
unified check command.

* * *

### 12. Standalone Executable Compilation

#### Bun Compile

**Status**: Unique Capability

**Details**:

Bun can compile TypeScript/JavaScript into standalone executables that include the Bun
runtime. This is a capability not available in the pnpm/Node.js ecosystem without
third-party tools like `pkg` (deprecated) or `vercel/pkg`.

**Basic usage**:

```bash
bun build --compile ./src/bin.ts --outfile myapp
```

**Cross-compilation**:

```bash
# Build for Linux x64 from any platform
bun build --compile --target=bun-linux-x64 ./src/bin.ts --outfile myapp

# Build for Windows
bun build --compile --target=bun-windows-x64 ./src/bin.ts --outfile myapp.exe

# Build for macOS ARM
bun build --compile --target=bun-darwin-arm64 ./src/bin.ts --outfile myapp
```

**Via Bunup config**:

```typescript
import { defineConfig } from 'bunup';

export default defineConfig({
  entry: 'src/bin.ts',
  compile: true, // Compile for current platform
});

// Or cross-compile:
export default defineConfig({
  entry: 'src/bin.ts',
  compile: {
    target: 'bun-linux-x64',
    outfile: './bin/myapp',
  },
});
```

**Embedding assets**:

```typescript
// Files can be embedded directly into the binary
const config = await Bun.file(import.meta.dir + '/config.json').text();
```

**Available targets**:

| Target | Architecture |
| --- | --- |
| `bun-linux-x64` | Linux x86_64 |
| `bun-linux-arm64` | Linux ARM64 |
| `bun-darwin-x64` | macOS Intel |
| `bun-darwin-arm64` | macOS Apple Silicon |
| `bun-windows-x64` | Windows x86_64 |

**Optimization flags**:

```bash
# Reduce startup time (not binary size) with bytecode pre-compilation
bun build --compile --bytecode --minify ./src/bin.ts --outfile myapp

# Minify source to reduce embedded code size
bun build --compile --minify --sourcemap ./src/bin.ts --outfile myapp
```

**Known limitations**:

- Binary size starts at ~50–100MB (includes Bun runtime).
  This is an open issue ([#5854](https://github.com/oven-sh/bun/issues/5854)).

- Embedded directory support is beta-quality

- The executable is Bun-runtime-specific (not a true native binary like Go/Rust)

**Comparison with other distribution methods**:

| Method | Size | Runtime needed | Cross-platform | Speed |
| --- | --- | --- | --- | --- |
| npm publish | Small (~KB) | Node.js or Bun | Yes | Startup depends on runtime |
| `bun --compile` | ~50–100MB | None | Cross-compile | Fast startup |
| Go binary | ~10–20MB | None | Cross-compile | Fast startup |
| Rust binary | ~5–15MB | None | Cross-compile | Fast startup |

**Assessment**: Bun’s compile feature is valuable for distributing CLI tools to users
who don’t have Node.js or Bun installed.
The binary size is the main downside.
This is a unique advantage that the pnpm ecosystem does not offer natively.

**References**:

- [Bun Single-file Executables](https://bun.sh/docs/bundler/executables)

- [Bunup Compile Documentation](https://bunup.dev/docs/advanced/compile.html)

- [Bun Cross-Compilation](https://developer.mamezou-tech.com/en/blogs/2024/05/20/bun-cross-compile/)

* * *

### 13. Dependency Upgrade Management

**Status**: Recommended

**Details**:

npm-check-updates (`ncu`) works with Bun.
The main difference is using `bun install` instead of `pnpm install` after updates.

**Root `package.json` scripts**:

```json
{
  "scripts": {
    "upgrade:check": "bunx npm-check-updates --format group",
    "upgrade": "bunx npm-check-updates --target minor -u && bun install && bun test",
    "upgrade:major": "bunx npm-check-updates --target latest --interactive --format group"
  }
}
```

**Assessment**: Identical workflow.
`bunx` replaces `npx`.

* * *

### 14. CLI Development Workflow

#### Running CLI from Source

**Status**: Strongly Recommended

**Details**:

Bun natively executes TypeScript, eliminating the need for `tsx` entirely.

**The dual-script pattern** (simplified vs pnpm):

```json
{
  "scripts": {
    "cli-name": "bun packages/package-name/src/cli/bin.ts",
    "cli-name:bin": "bun packages/package-name/dist/bin.js"
  }
}
```

**Comparison with pnpm approach**:

| Aspect | pnpm (tsx) | Bun |
| --- | --- | --- |
| Dev command | `tsx packages/pkg/src/cli/bin.ts` | `bun packages/pkg/src/cli/bin.ts` |
| Extra dependency | `tsx` (~4.21.0) | None (built-in) |
| TypeScript support | Via esbuild transform | Native |
| Startup time | ~50ms | ~5ms |

**Assessment**: Bun eliminates the `tsx` dependency entirely.
One fewer devDependency, faster startup, simpler scripts.

* * *

### 15. Private Package Distribution

**Status**: Same as pnpm

**Details**:

Distribution options are identical:

1. **GitHub Packages** (recommended for teams)

2. **Direct GitHub install**: `bun add github:org/repo` — Bun has limited support for
   monorepo subdirectory installs (lagging behind pnpm)

3. **Local linking**: `bun link` works similarly to `pnpm link`

**Bun-specific option**: Standalone executables via `bun --compile` provide an
additional distribution path that bypasses package registries entirely.

* * *

### 16. Library/CLI Hybrid Packages

**Status**: Same as pnpm

**Details**:

The Node-free core pattern from the pnpm research applies identically.
Keep `node:` imports out of core library code and isolated to CLI-specific modules.

The only addition for Bun projects: you may also want to avoid Bun-specific APIs
(`Bun.file()`, `Bun.serve()`, etc.)
in core library code if the library needs to work in Node.js environments.

* * *

## Comparative Analysis

### Full-Stack Tooling Comparison

| Concern | pnpm Monorepo | Bun Monorepo |
| --- | --- | --- |
| **Package manager** | pnpm | Bun |
| **Runtime** | Node.js | Bun |
| **Build tool** | tsdown | Bunup |
| **Test runner** | Node test / Vitest | bun test |
| **Formatter** | Prettier | Biome |
| **Linter** | ESLint | Biome |
| **Git hooks** | Lefthook | Lefthook |
| **Versioning** | Changesets | Changesets (with workarounds) |
| **Validation** | publint | publint |
| **Dev execution** | tsx | Bun (native TS) |
| **Native binaries** | N/A | bun --compile |
| **CI setup** | 2 actions (pnpm + node) | 1 action (setup-bun) |

### Complexity Comparison

| Aspect | pnpm | Bun | Winner |
| --- | --- | --- | --- |
| **Config file count** | 6–8 | 4–5 | Bun |
| **devDependencies** | 10–15 | 5–8 | Bun |
| **Setup actions (CI)** | 2 | 1 | Bun |
| **Lint + format config** | 2–4 files | 1 file | Bun |
| **Build config** | Equivalent | Equivalent | Tie |
| **Changesets workflow** | Works natively | Requires workarounds | pnpm |
| **Dependency isolation** | Strict (content-addressable) | Loose (flat node_modules) | pnpm |
| **Lockfile diffability** | YAML (diffable) | JSONC (diffable since Bun 1.2) | Tie |
| **Ecosystem maturity** | Very mature | Growing rapidly (Anthropic backing) | pnpm |
| **Test runner maturity** | Vitest (mature) | bun test (fake timers added, isolation gap) | pnpm |

### Speed Comparison

| Operation | pnpm + Node.js | Bun | Improvement |
| --- | --- | --- | --- |
| Package install | Baseline | 2–10x faster | Bun |
| Build (tsdown vs Bunup) | ~200ms–1s | ~37ms | 5–25x (Bun) |
| Test execution | Baseline | ~2x faster | Bun |
| Lint + format | ~3–5s | ~200ms | 10–25x (Biome) |
| CI total | Baseline | Significantly faster | Bun |
| Dev server startup | ~50ms (tsx) | ~5ms | 10x (Bun) |

* * *

## Best Practices

1. **Use Bun workspaces** with `"workspaces"` in root `package.json`. Use `--cwd` to
   target specific workspaces when adding dependencies.

2. **Enable `isolatedDeclarations`** in `tsconfig.base.json` for dramatically faster DTS
   generation with Bunup.

3. **Use Bunup’s auto-exports** (`exports: true`) to keep `package.json` exports
   synchronized with build output.

4. **Use Biome for formatting + linting** via a single `biome.json`. Use `biome check`
   for combined format + lint in one pass.

5. **Add `bun update` after `changeset version`** to fix workspace reference resolution
   in the lockfile.

6. **Use `bun publish` per package** instead of `changeset publish` to ensure proper
   workspace resolution.

7. **Run CLI from source with `bun`** directly — no need for `tsx` or any TypeScript
   execution wrapper.

8. **Consider `bun --compile`** for distributing CLI tools as standalone executables,
   especially for users who don’t have Node.js or Bun installed.

9. **Use `bun test`** for testing — fake timers are now supported (v1.3.4+). Switch to
   Vitest only if you need test isolation, browser mode, or sharding.

10. **Keep the root `package.json` private** with `"private": true` and only workspace
    tooling.

11. **Scope your package names** with `@org/package-name` for GitHub Packages
    compatibility.

12. **Validate before publish** with `publint` in CI and before every release.

13. **Use lefthook** for git hooks with `biome check` in pre-commit (single command
    replaces separate format + lint hooks).

14. **Add the `"bun"` export condition** to let Bun consumers import TypeScript source
    directly, bypassing compiled output.

15. **Use dynamic git-based versioning** for dev builds — the pattern works identically
    with Bun, and `bun` replaces `tsx` for script execution.

* * *

## Open Research Questions

1. **Changesets Bun support**: As of Jan 2026, Changesets still has no native Bun
   workspace support. The `workspace:*` resolution issue remains open
   ([#1468](https://github.com/changesets/changesets/issues/1468),
   [oven-sh/bun#16074](https://github.com/oven-sh/bun/issues/16074)). The workaround
   (`bun update` after `changeset version`, per-package `bun publish`) remains
   necessary. Monitor for a Bun-native alternative.

2. ~~**Bun test runner: fake timers**~~: **RESOLVED** in Bun v1.3.4 (Dec 2025).
   Jest-compatible fake timers are now supported.
   Remaining gaps: test isolation, browser mode, sharding.

3. ~~**Bun lockfile format**~~: **RESOLVED** in Bun 1.2. The text-based `bun.lock`
   (JSONC format) is now the default.
   It is diffable in code review and supported by GitHub rendering.
   The binary `bun.lockb` is deprecated.

4. **Biome plugin ecosystem**: Biome v2.0+ introduced plugins and type-aware linting
   without `tsc`. As of v2.3.x, the rule set continues growing (300+ rules,
   `noFloatingPromises` in nursery).
   Monitor for parity with security and accessibility ESLint plugins.
   Custom ESLint rules remain a reason to keep ESLint (see craft-agents-oss case study
   in Appendix G).

5. **Bun workspace strictness**: Bun still uses flat `node_modules` (no
   content-addressable store).
   Phantom dependencies remain possible.
   Monitor for improvements.

6. **`bun --compile` binary size**: Standalone executables still start at ~50–100MB
   (includes Bun runtime).
   No significant size reductions announced.
   The open issue ([#5854](https://github.com/oven-sh/bun/issues/5854)) remains tracked.
   The `--minify` and `--bytecode` flags help with startup time but not binary size.

7. **TypeScript 6.0/7.0**: TypeScript 6.0 is a “bridge” release; TypeScript 7.0 (Go
   rewrite) promises 10x faster builds.
   Both expected early 2026. May change the DTS generation landscape for Bunup and
   tsdown.

8. **Bunup maturity**: Bunup is iterating rapidly (0.16.x as of Jan 2026, up from 0.4.x
   a few months earlier).
   The API surface (`defineConfig`, `defineWorkspace`, `exports`, `compile`) appears
   stable, but pin versions carefully.

9. **Bun + Anthropic**: Bun was acquired by Anthropic (Dec 2025) and now powers Claude
   Code and Claude Agent SDK. This signals strong continued investment but also a shift
   toward AI-tooling use cases.
   Monitor whether the broader open-source community continues to benefit equally.

* * *

## Recommendations

### Summary

For projects that prioritize **speed and simplicity**, the full-Bun ecosystem provides a
compelling alternative to the pnpm stack.
Fewer configuration files, fewer dependencies, faster builds, and native TypeScript
execution reduce overall complexity.

For projects that prioritize **ecosystem maturity and strictness**, the pnpm stack
remains the safer choice, particularly due to pnpm’s strict dependency isolation,
Changesets’ native support, ESLint’s mature plugin ecosystem, and Vitest’s comprehensive
testing features.

### When to Choose the Bun Ecosystem

- New projects without legacy Node.js dependencies

- Projects that value speed and simplicity over ecosystem maturity

- CLI tools that could benefit from standalone executable distribution

- Teams comfortable with occasional workarounds for younger tooling

- Projects where the Bun runtime will be the primary execution environment

### When to Stay with pnpm

- Projects with strict dependency isolation requirements

- Projects requiring mature ESLint plugins (security, accessibility, custom rules)

- Projects needing advanced testing features (test isolation, browser mode, sharding)

- Projects that must support Node.js as the primary runtime

### Recommended Approach (Full-Bun)

1. **Initialize workspace** with Bun and packages in `packages/`

2. **Configure Bunup** for dual ESM/CJS output with auto-exports

3. **Enable `isolatedDeclarations`** in TypeScript config

4. **Set up Biome** for formatting and linting

5. **Add Changesets** with the Bun workaround scripts

6. **Configure lefthook** with `biome check` in pre-commit

7. **Set up CI** with `oven-sh/setup-bun@v2`

8. **Configure release workflow** with custom publish scripts

9. **Validate with publint** before every release

10. **Optionally configure `bun --compile`** for standalone executable distribution

* * *

## References

### Official Documentation

- [Bun Documentation](https://bun.sh/docs)

- [Bun Workspaces](https://bun.sh/docs/install/workspaces)

- [Bun TypeScript](https://bun.sh/docs/typescript)

- [Bun Test Runner](https://bun.sh/docs/cli/test)

- [Bun Bundler](https://bun.sh/docs/bundler)

- [Bun Single-file Executables](https://bun.sh/docs/bundler/executables)

- [Bunup Documentation](https://bunup.dev/)

- [Biome Documentation](https://biomejs.dev/)

- [Changesets GitHub](https://github.com/changesets/changesets)

- [publint Documentation](https://publint.dev/docs/)

### Guides & Articles

- [Building a TypeScript Library in 2026 with Bunup](https://dev.to/arshadyaseen/building-a-typescript-library-in-2026-with-bunup-3bmg)

- [Setting up Changesets with Bun Workspaces](https://ianm.com/posts/2025-08-18-setting-up-changesets-with-bun-workspaces)

- [Monorepo with Bun](https://dev.to/vikkio88/monorepo-with-bun-474n)

- [Guide to Monorepo Setup: NPM, Yarn, Pnpm & Bun Workspaces](https://jsdev.space/mastering-monorepos/)

- [Setting up a Bun Workspace](https://medium.com/@oluijks/setting-up-a-bun-workspace-23543df61e52)

- [Biome vs ESLint + Prettier](https://medium.com/better-dev-nextjs-react/biome-vs-eslint-prettier-the-2025-linting-revolution-you-need-to-know-about-ec01c5d5b6c8)

- [Migrating from Prettier and ESLint to BiomeJS](https://blog.appsignal.com/2025/05/07/migrating-a-javascript-project-from-prettier-and-eslint-to-biomejs.html)

- [CommonJS is not going away (Bun Blog)](https://bun.sh/blog/commonjs-is-not-going-away)

- [Bun’s New Text-Based Lockfile](https://bun.com/blog/bun-lock-text-lockfile)

- [Fake Timers in Bun Test](https://js2brain.com/blog/fake-timers-in-bun-test/)

- [Bun v1.3.4 Release (Fake Timers)](https://bun.com/blog/bun-v1.3.4)

- [Bun Cross-Compilation](https://developer.mamezou-tech.com/en/blogs/2024/05/20/bun-cross-compile/)

- [Bun Joins Anthropic](https://www.infoq.com/news/2026/01/bun-v3-1-release/)

### GitHub Actions

- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun)

- [changesets/action](https://github.com/changesets/action)

* * *

## Appendices

### Appendix A: Complete Package package.json Example

```json
{
  "name": "@scope/package-name",
  "version": "0.1.0",
  "description": "Package description",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "bun": "./src/cli/index.ts",
      "import": {
        "types": "./dist/cli.d.ts",
        "default": "./dist/cli.js"
      },
      "require": {
        "types": "./dist/cli.d.cts",
        "default": "./dist/cli.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "bin": {
    "package-name": "./dist/bin.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "bunup",
    "dev": "bunup --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "bun test",
    "publint": "bunx publint",
    "prepack": "bun run build"
  },
  "dependencies": {},
  "peerDependencies": {
    "optional-sdk": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "optional-sdk": { "optional": true }
  },
  "devDependencies": {
    "bun-types": "latest",
    "bunup": "^0.16.0",
    "typescript": "^5.9.0"
  }
}
```

### Appendix B: Root package.json Example

```json
{
  "name": "project-workspace",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "bunup",
    "typecheck": "tsc -b",
    "test": "bun test",
    "publint": "bunx publint",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "lint": "biome lint --write .",
    "lint:check": "biome lint .",
    "check": "biome check --write .",
    "check:ci": "biome check .",
    "prepare": "lefthook install",
    "changeset": "changeset",
    "version-packages": "changeset version && bun update",
    "release": "bun run build && bunx publint && bun run publish-packages",
    "publish-packages": "for dir in packages/*; do (cd \"$dir\" && bun publish || true); done && changeset tag",
    "upgrade:check": "bunx npm-check-updates --format group",
    "upgrade": "bunx npm-check-updates --target minor -u && bun install && bun test",
    "upgrade:major": "bunx npm-check-updates --target latest --interactive --format group"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.0",
    "@changesets/cli": "^2.29.0",
    "@changesets/changelog-github": "^0.5.0",
    "lefthook": "^2.0.0",
    "publint": "^0.3.0",
    "typescript": "^5.9.0"
  }
}
```

### Appendix C: Complete biome.json Example

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConfusingVoidType": "error"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn",
        "useImportType": "error"
      },
      "complexity": {
        "noForEach": "warn"
      },
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  },
  "overrides": [
    {
      "include": ["**/*.test.ts", "**/*.spec.ts", "**/tests/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    },
    {
      "include": ["**/scripts/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ],
  "files": {
    "ignore": [
      "dist",
      "node_modules",
      ".changeset",
      "bun.lock",
      "coverage"
    ]
  }
}
```

### Appendix D: Complete bunup.config.ts Example

```typescript
// bunup.config.ts (workspace root)
import { defineWorkspace } from 'bunup';

export default defineWorkspace([
  {
    name: 'core',
    root: 'packages/core',
    config: {
      entry: ['src/index.ts'],
      format: ['esm', 'cjs'],
      dts: true,
      clean: true,
      sourcemap: 'linked',
      exports: true,
    },
  },
  {
    name: 'cli',
    root: 'packages/cli',
    config: [
      {
        name: 'library',
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        clean: true,
        exports: true,
      },
      {
        name: 'binary',
        entry: ['src/bin.ts'],
        format: ['esm'],
        banner: '"#!/usr/bin/env bun";',
      },
    ],
  },
]);
```

**Single-package config** (`packages/core/bunup.config.ts`):

```typescript
import { defineConfig } from 'bunup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: 'linked',
  exports: true,
  define: {
    __VERSION__: JSON.stringify(process.env.PROJECT_VERSION ?? 'development'),
  },
});
```

### Appendix E: Complete lefthook.yml Example

```yaml
# lefthook.yml
# Git hooks for code quality (Bun + Biome edition)
# Pre-commit: Fast checks with auto-fix (target: <1 second)
# Pre-push: Full test validation with caching

pre-commit:
  parallel: true

  commands:
    # Format + lint with Biome (~200ms for staged files)
    check:
      glob: '*.{js,ts,tsx,json,css}'
      run: bunx biome check --write {staged_files}
      stage_fixed: true
      priority: 1

    # Type check with incremental mode (~2s)
    typecheck:
      glob: '*.{ts,tsx}'
      run: bunx tsc --noEmit --incremental
      priority: 2

pre-push:
  commands:
    verify-tests:
      run: |
        COMMIT_HASH=$(git rev-parse HEAD)
        CACHE_DIR="node_modules/.test-cache"
        CACHE_FILE="$CACHE_DIR/$COMMIT_HASH"

        # Check for uncommitted changes
        if ! git diff --quiet || ! git diff --cached --quiet; then
          bun test
          exit $?
        fi

        # Check cache
        if [ -f "$CACHE_FILE" ]; then
          SHORT_HASH=$(echo "$COMMIT_HASH" | cut -c1-8)
          echo "Tests already passed for commit $SHORT_HASH"
          exit 0
        fi

        # Run tests
        bun test

        # Cache on success
        if [ $? -eq 0 ]; then
          mkdir -p "$CACHE_DIR"
          touch "$CACHE_FILE"
          exit 0
        else
          echo "Tests failed - push blocked"
          echo "Bypass with: git push --no-verify"
          exit 1
        fi
```

### Appendix F: Standalone Executable Build Example

```typescript
// bunup.config.ts for CLI with standalone executable
import { defineConfig } from 'bunup';

export default defineConfig([
  // Standard library build
  {
    name: 'library',
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    exports: true,
  },
  // Standalone executable
  {
    name: 'standalone',
    entry: 'src/bin.ts',
    compile: {
      target: 'bun-linux-x64',
      outfile: './bin/myapp-linux',
    },
  },
]);
```

**Multi-platform build script** (`package.json`):

```json
{
  "scripts": {
    "build:binary": "bun run build:binary:linux && bun run build:binary:mac && bun run build:binary:windows",
    "build:binary:linux": "bun build --compile --target=bun-linux-x64 src/bin.ts --outfile bin/myapp-linux",
    "build:binary:mac": "bun build --compile --target=bun-darwin-arm64 src/bin.ts --outfile bin/myapp-darwin",
    "build:binary:windows": "bun build --compile --target=bun-windows-x64 src/bin.ts --outfile bin/myapp.exe"
  }
}
```

### Appendix G: Case Study — craft-agents-oss (Real-World Bun Monorepo)

**Repository**:
[lukilabs/craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) (Apache 2.0,
Electron desktop app for AI agent interactions)

This appendix documents how a real-world, production Bun monorepo is structured.
It serves as a concrete reference implementation for the patterns described in this
research.

#### Structure Overview

```
craft-agents-oss/
├── apps/
│   ├── electron/          # Electron desktop app (primary product)
│   └── viewer/            # Web viewer for sessions
├── packages/
│   ├── core/              # Types and core utilities (no deps)
│   ├── shared/            # Business logic (agent, auth, config, MCP)
│   └── ui/                # React UI components
├── scripts/               # Bun build/dev scripts (TypeScript)
├── biome.json             # (not present — uses ESLint)
├── bunfig.toml            # Minimal: preload only
├── bun.lock               # Text lockfile (JSONC, default since Bun 1.2)
├── package.json           # Root workspace config
└── tsconfig.json          # Root TypeScript config
```

**Workspace configuration** (root `package.json`):

```json
{
  "name": "craft-agent",
  "version": "0.2.34",
  "type": "module",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*",
    "!apps/online-docs"
  ]
}
```

#### Key Patterns Worth Adopting

**1. Source-Level Exports (No Build Step for Internal Consumption)**

All internal packages export TypeScript source directly — no `dist/` directory:

```json
// packages/shared/package.json — 27 subpath exports
{
  "exports": {
    ".": "./src/index.ts",
    "./agent": "./src/agent/index.ts",
    "./auth": "./src/auth/index.ts",
    "./config": "./src/config/index.ts",
    "./mcp": "./src/mcp/index.ts",
    "./sessions": "./src/sessions/index.ts",
    // ... 21 more subpaths
  }
}
```

This works because Bun natively imports TypeScript.
Apps consume packages directly from source, eliminating build-watch complexity for local
development.
Published packages would need compiled output for Node.js consumers, but for
internal-only packages this is ideal.

**2. TypeScript Build Scripts (No Shell Scripts)**

All build orchestration is in TypeScript, executed directly by Bun:

```json
{
  "scripts": {
    "electron:build:main": "bun run scripts/electron-build-main.ts",
    "electron:build:preload": "bun run scripts/electron-build-preload.ts",
    "electron:build:renderer": "bun run scripts/electron-build-renderer.ts",
    "electron:dev": "bun run scripts/electron-dev.ts"
  }
}
```

This eliminates platform-specific shell script issues and provides type safety for build
logic.

**3. Hybrid Build Architecture**

Uses esbuild for Node.js targets (Electron main/preload), Vite for browser targets
(renderer, viewer), and TypeScript for type checking only (`noEmit: true`). Bun serves
as the orchestrator but does not replace specialized build tools.

**4. Global Preload via bunfig.toml**

```toml
# bunfig.toml
preload = ["./packages/shared/src/network-interceptor.ts"]
```

Preloads a network interceptor for API error capture and MCP schema injection across all
Bun processes. This is a Bun-unique pattern for cross-cutting concerns.

**5. Single-Source Version Management**

Version lives in one TypeScript constant (`packages/shared/src/version/app-version.ts`),
synced to all `package.json` files via `bun run scripts/sync-version.ts`. Avoids
Changesets entirely for a private monorepo that distributes as a single Electron app.

**6. Custom ESLint Rules for Architectural Constraints**

Instead of Biome, this project uses ESLint with 4 custom rules:

- `no-direct-navigation-state` — enforces navigation state abstraction
- `no-localstorage` — prevents browser localStorage usage (Bun incompatible)
- `no-direct-platform-check` — enforces platform detection abstraction
- `no-hardcoded-path-separator` — enforces cross-platform paths

This demonstrates that ESLint’s custom rule ecosystem remains valuable for
domain-specific architectural constraints that Biome cannot yet replicate.

**7. Inter-Package Dependencies (Workspace Protocol)**

```
apps/electron → @craft-agent/core, shared, ui (workspace:*)
apps/viewer   → @craft-agent/core, ui (workspace:*)
packages/shared → @craft-agent/core (workspace:*)
packages/ui     → @craft-agent/core (workspace:*)
packages/core   → (no internal deps)
```

Clean dependency graph with `core` as the leaf package.

#### What This Repo Does NOT Have

- **No Bunup**: Uses esbuild + Vite directly (hybrid approach)
- **No Biome**: Uses ESLint (needed custom rules)
- **No Changesets**: Single-version private app, manual sync script
- **No CI/CD workflows**: No `.github/workflows/` directory
- **No publint**: Not publishing to npm
- **No git hooks**: No lefthook, husky, or pre-commit
- **No tests**: No test files found in the codebase
- **No `bun --compile`**: Ships Bun binary in vendor/ directory via electron-builder

#### Lessons for Published Library Monorepos

This project optimizes for a different use case (private Electron app) than a published
npm library monorepo.
Key takeaways:

| craft-agents-oss Pattern | Adaptation for Published Library |
| --- | --- |
| Source-level exports | Add `"bun"` condition + compiled dist for Node.js consumers |
| esbuild + Vite build | Use Bunup for library/CLI packages |
| Manual version sync | Use Changesets with Bun workarounds |
| No CI | Add GitHub Actions with `oven-sh/setup-bun@v2` |
| ESLint with custom rules | Use Biome unless custom rules needed |
| No tests | Add `bun test` suite |
| No publint | Add publint validation |
| No git hooks | Add lefthook with `biome check` |

The source-level exports pattern and TypeScript build scripts are directly applicable.
The hybrid esbuild/Vite approach is more relevant for Electron/full-stack apps than for
pure library packages where Bunup would be simpler.
