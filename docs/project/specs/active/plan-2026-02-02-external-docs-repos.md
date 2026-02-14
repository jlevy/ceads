---
title: External Docs Repos
description: Pull shortcuts, guidelines, templates, and references from external git repositories
---
# Feature: External Docs Repos

**Date:** 2026-02-02 (last updated 2026-02-09, beads created for all phases)

**Status:** Draft

**Epic:** `tbd-mdwh` — 8 phase epics, 60+ leaf beads with full dependency chains

## Overview

Enable tbd to pull documentation (shortcuts, guidelines, templates, references) from
external git repositories, in addition to the current bundled internal docs.
This allows:

- Community-maintained docs that evolve independently of tbd releases
- Project-specific doc repos that can be shared across teams
- “Bleeding edge” guidelines that update more frequently than tbd npm releases
- Potential simplification by moving general-purpose docs out of the tbd codebase

## Goals

- Allow configuring external git repos as doc sources
- Allow configuring local directories within the repo as doc sources (always-fresh via
  stub pointers)
- Support selective sync (only certain folders/types from a repo)
- Maintain backward compatibility with existing `internal:` and URL sources
- Make sync work seamlessly with repo sources (checkout on first sync, pull on
  subsequent)
- Keep configuration simple and declarative

## Non-Goals

- Full-featured git client (complex merge conflict resolution, etc.)
- Support for private repos requiring complex auth (initially - may add later)
- Real-time sync or webhooks
- Bidirectional sync (external repos are read-only sources)

## Background

### Current State

The `docs_cache` system currently supports two source types:

1. **`internal:`** - Bundled docs shipped with tbd (in `packages/tbd/docs/`)
2. **URLs** - Direct HTTP/HTTPS links to raw files

The config in `.tbd/config.yml` maps destination paths to sources:

```yaml
docs_cache:
  files:
    guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
    shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
    # URL sources work but require per-file specification:
    shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/shortcuts/my-shortcut.md
```

### Problems with Current Approach

1. **URL sources require per-file enumeration** - Can’t say “all guidelines from this
   repo”
2. **No auto-discovery** - Adding a new guideline to an external repo requires config
   changes
3. **tbd-specific docs mixed with general docs** - Guidelines like `typescript-rules.md`
   are general, but shipped with tbd
4. **Updates tied to tbd releases** - New or improved guidelines require npm publish

### The Dependency Problem

Some docs reference tbd itself:

- **tbd-specific**: `code-review-and-commit.md` references
  `tbd shortcut precommit-process`
- **General**: `typescript-rules.md` has no tbd dependencies

This creates a design consideration: where should each type live?

**Option A: Categorize by dependency**

- tbd-specific docs remain `internal:`
- General docs move to external repo(s)

**Option B: Explicit dependency declaration**

- Docs declare dependencies in front matter: `requires: [tbd]`
- Sync validates dependencies

**Recommendation:** Option A is simpler and probably sufficient.
tbd-specific shortcuts naturally belong in the tbd codebase.
General guidelines can be externalized.

## Design

### Approach

Add a new source type: `repo:` sources that specify a git repository, branch/tag, and
path pattern. On sync:

1. Check out or update the repo (shallow clone to repo cache - see Cache Location)
2. Scan for matching docs based on path pattern
3. Sync matching files to `.tbd/docs/`

### Proposed Config Format

```yaml
docs_cache:
  # Sources in precedence order (earlier wins on collisions for unqualified lookups)
  sources:
    # System shortcuts (tbd internals, hidden from --list by default)
    - type: internal
      prefix: sys
      hidden: true
      paths:
        - shortcuts/

    # tbd-specific shortcuts (code-review-and-commit, implement-beads, etc.)
    - type: internal
      prefix: tbd
      paths:
        - shortcuts/

    # Speculate repo for general docs
    - type: repo
      prefix: spec
      url: github.com/jlevy/speculate
      ref: main
      paths:
        - shortcuts/
        - guidelines/
        - templates/
        - references/

    # Optional: additional project-specific or org-specific repos
    # - type: repo
    #   prefix: myorg
    #   url: github.com/myorg/coding-standards
    #   ref: main
    #   paths:
    #     - guidelines/
    #     - references/

    # Optional: local docs from within this repo (always-fresh via stub pointers)
    # - type: local
    #   prefix: local
    #   path: docs/tbd           # relative to repo root
    #   paths:
    #     - shortcuts/
    #     - guidelines/

  # Per-file overrides (highest precedence, applied after sources)
  # These bypass the prefix system - written directly to .tbd/docs/{path}
  files:
    guidelines/custom.md: https://example.com/custom.md
```

**Key design decisions:**

1. **Prefix-based namespacing**: Each source has a required `prefix` field that
   namespaces its content.
   This enables collision handling and explicit access.

2. **No `lookup_path` needed**: Source order IS the precedence for unqualified lookups.
   The prefix system replaces the old `shortcuts/system/` vs `shortcuts/standard/`
   split.

3. **Hidden sources**: Sources with `hidden: true` are excluded from `--list` output but
   still accessible via direct lookup or qualified names.

4. **Flat doc type directories**: Each source syncs `{type}/` directories (shortcuts,
   guidelines, templates, references).
   No nested subdirectories within types.

**Prefix rules:**

- Required for all sources (including internal)
- Must be unique across all sources
- Recommended: 2-8 lowercase alphanumeric characters
- Validated at config parse time

**Config explicitness:** The `ref` field is always written explicitly to config.yml for
clarity, even when using the default (`main`). This makes it clear which version is
being used without requiring knowledge of defaults.

**Ref format:** The `ref` field accepts any valid git ref:
- Branch name: `main`, `develop`, `feature/foo` (recommended)
- Tag: `v1.0.0`, `release-2024-01`
- Commit SHA: `a1b2c3d4` (short) or full 40-char SHA

Branches (especially `main`) are recommended so you get doc updates on each sync.

**URL format:** The `url` field accepts these formats (all normalized internally):
- `github.com/org/repo` - Short form (recommended for readability)
- `https://github.com/org/repo` - Full HTTPS URL
- `https://github.com/org/repo.git` - With `.git` suffix
- `git@github.com:org/repo.git` - SSH format (for private repos with SSH auth)

URL normalization and slugification is handled by a standalone utility (see
`src/lib/repo-url.ts` below) with comprehensive unit tests.

**Path patterns:** The `paths` array specifies doc type directories to sync.
All `.md` files within these directories are synced recursively:
- `guidelines/` - Syncs all `.md` files under `guidelines/`
- `shortcuts/` - Syncs all `.md` files under `shortcuts/`
- `references/` - Syncs all `.md` files under `references/`

Trailing slashes are optional but recommended for clarity.

### Format Version Compatibility

This feature adds a new `sources` field to `docs_cache`, which requires a format version
bump from `f03` to `f04`. This ensures:

1. **Older tbd versions** see the unknown format and error with “format ‘f04’ is from a
   newer tbd version” rather than silently stripping the `sources` field
2. **Migration path** is clear: f03 configs without `sources` continue to work unchanged
3. **Forward safety**: Users mixing tbd versions get explicit upgrade prompts

Changes to `tbd-format.ts`:

```typescript
f04: {
  introduced: '0.1.X',  // TBD - set when releasing
  description: 'Adds prefix-based external repo sources',
  changes: [
    'Added docs_cache.sources: array with prefix-namespaced doc sources',
    'Each source has required prefix field for namespacing',
    'Sources can be internal (bundled) or repo (git)',
    'Removed docs_cache.lookup_path: replaced by prefix system',
    'Removed shortcuts/system vs shortcuts/standard split',
    'Added references as new doc type',
  ],
  migration: 'Removes lookup_path if present, clears doc cache for fresh sync',
},
```

**Migration**: The migration function:
1. Updates `tbd_format: f03` → `tbd_format: f04`
2. Removes deprecated `lookup_path` if present
3. **Converts verbose `files:` to concise `sources:`** (see below)
4. Triggers doc cache clear for fresh sync

**Automatic config conversion:**

Most users have the default config with many `files:` entries like:
```yaml
docs_cache:
  files:
    guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
    shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
    # ... 50+ more entries
```

The migration automatically converts this to the new concise format:
```yaml
docs_cache:
  sources:
    - type: internal
      prefix: sys
      hidden: true
      paths: [shortcuts/]
    - type: internal
      prefix: tbd
      paths: [shortcuts/]
    - type: repo
      prefix: spec
      url: github.com/jlevy/speculate
      ref: main
      paths: [shortcuts/, guidelines/, templates/, references/]
```

**Conversion logic:**

1. Compute expected default `files:` entries (what `tbd setup --auto` would generate)
2. Compare actual `files:` entries to expected
3. If they match (or actual is subset of expected):
   - Remove `files:` section entirely
   - Add new `sources:` section with default sources
   - Log: “Migrated to new sources format (config simplified)”
4. If there are extra/custom entries:
   - Still add `sources:` section
   - Keep only the custom `files:` entries as overrides
   - Warn: “Preserved N custom file overrides in docs_cache.files”
5. If entries conflict with expected (same path, different source):
   - Keep custom entries in `files:`
   - Warn: “Found N customized entries - preserved as overrides”

This ensures:
- Default configs become much shorter (~~5 lines vs ~~60 lines)
- Custom configurations are preserved
- Users are informed of any preserved customizations

**Doc cache clearing during migration**: When migration occurs (or when sources
configuration changes significantly), the doc cache (`.tbd/docs/`) should be cleared
entirely and re-synced fresh.
This ensures:

1. **Stale files are removed** - Files from old sources that are no longer configured
2. **Precedence is respected** - Fresh sync applies correct source ordering
3. **No ghost files** - Manually added files in `.tbd/docs/` are cleaned up
4. **Clean state** - User gets predictable behavior matching their config

The migration or `tbd setup` should:

```typescript
// Detect source config changes by comparing hash of sources array
function getSourcesHash(config: TbdConfig): string {
  const sources = config.docs_cache?.sources ?? [];
  return createHash('sha256').update(JSON.stringify(sources)).digest('hex').slice(0, 8);
}

// Store hash in .tbd/docs/.sources-hash (gitignored with the rest of docs/)
const currentHash = getSourcesHash(config);
const storedHash = await readFile('.tbd/docs/.sources-hash', 'utf8').catch(() => null);
const sourcesConfigChanged = currentHash !== storedHash;

// During f03→f04 migration or source config changes:
if (formatChanged || sourcesConfigChanged) {
  // 1. Clear doc cache entirely
  await rm(join(tbdRoot, '.tbd/docs'), { recursive: true, force: true });

  // 2. Trigger fresh sync
  await syncDocsWithDefaults(tbdRoot, { quiet: false });

  // 3. Store new hash
  await writeFile('.tbd/docs/.sources-hash', currentHash);
}
```

This is safe because `.tbd/docs/` is gitignored and can always be regenerated from
sources.

### Migration Pattern: Version Bump with Deprecation

This migration bumps the format version and removes a deprecated field (`lookup_path`).
This pattern is needed when:

1. **Adding optional fields** that older versions would silently strip (Zod’s `strip()`)
2. **Removing deprecated fields** that are no longer used
3. **Forward compatibility protection** - older tbd versions must reject the new format

**Why format version bumps matter:**

Without bumping the format version, this scenario could occur:

1. User A runs tbd 0.2.0, adds `docs_cache.sources` to their config
2. User B (same repo) runs tbd 0.1.x, which doesn’t know about `sources`
3. Zod’s `strip()` silently removes the `sources` field when parsing
4. User B runs `tbd setup` or any config-writing operation
5. The `sources` config is lost - User A’s changes are silently destroyed

By bumping to f04, step 3 instead produces: “format ‘f04’ is from a newer tbd version.
Please upgrade: npm install -g get-tbd@latest”

**Implementation checklist:**

When adding a migration, update these locations in `tbd-format.ts`:

```typescript
// 1. Add to FORMAT_HISTORY (see entry above in "Format Version Compatibility")

// 2. Implement migration function
function migrate_f03_to_f04(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const warnings: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f04';
  changes.push('Updated tbd_format: f04');

  // Remove deprecated lookup_path
  if (migrated.docs_cache?.lookup_path) {
    delete migrated.docs_cache.lookup_path;
    changes.push('Removed deprecated lookup_path');
  }

  // Convert files: to sources:
  if (migrated.docs_cache?.files) {
    const { sources, customFiles, stats } = convertFilesToSources(migrated.docs_cache.files);

    // Add new sources array
    migrated.docs_cache.sources = sources;
    changes.push('Added docs_cache.sources with prefix-based config');

    if (Object.keys(customFiles).length === 0) {
      // All files matched defaults - remove files section entirely
      delete migrated.docs_cache.files;
      changes.push(`Removed ${stats.converted} default file entries (now handled by sources)`);
    } else {
      // Keep only custom overrides
      migrated.docs_cache.files = customFiles;
      changes.push(`Removed ${stats.converted} default file entries`);
      warnings.push(`Preserved ${stats.custom} custom file overrides in docs_cache.files`);
    }
  } else {
    // No files section - just add default sources
    migrated.docs_cache = migrated.docs_cache ?? {};
    migrated.docs_cache.sources = getDefaultSources();
    changes.push('Added default docs_cache.sources');
  }

  return {
    config: migrated,
    fromFormat: 'f03',
    toFormat: 'f04',
    changed: true,
    changes,
    warnings,
  };
}

// Helper: convert files entries to sources + identify custom overrides
function convertFilesToSources(files: Record<string, string>): {
  sources: DocsSource[];
  customFiles: Record<string, string>;
  stats: { converted: number; custom: number };
} {
  const expectedFiles = getExpectedDefaultFiles(); // What setup --auto generates
  const customFiles: Record<string, string> = {};
  let converted = 0;

  for (const [dest, source] of Object.entries(files)) {
    if (expectedFiles[dest] === source) {
      // Matches default - will be handled by sources
      converted++;
    } else {
      // Custom entry - preserve as override
      customFiles[dest] = source;
    }
  }

  return {
    sources: getDefaultSources(),
    customFiles,
    stats: { converted, custom: Object.keys(customFiles).length },
  };
}

// 3. Add to migrateToLatest() chain
if (currentFormat === 'f03') {
  const result = migrate_f03_to_f04(current);
  current = result.config;
  currentFormat = 'f04' as FormatVersion;
  allChanges.push(...result.changes);
}

// 4. Update CURRENT_FORMAT
export const CURRENT_FORMAT = 'f04';

// 5. Add to describeMigration()
if (current === 'f03') {
  descriptions.push('f03 → f04: Add external repo sources, remove lookup_path');
  current = 'f04';
}
```

**Testing migrations:**

```typescript
it('should migrate f03 to f04 with default files - config becomes shorter', () => {
  // Typical user config with many default file entries
  const oldConfig = {
    tbd_format: 'f03',
    tbd_version: '0.1.6',
    docs_cache: {
      files: {
        'guidelines/typescript-rules.md': 'internal:guidelines/typescript-rules.md',
        'guidelines/python-rules.md': 'internal:guidelines/python-rules.md',
        'shortcuts/standard/review-code.md': 'internal:shortcuts/standard/review-code.md',
        // ... many more default entries
      },
      lookup_path: ['.tbd/docs/shortcuts/system'],
    },
  };

  const result = migrateToLatest(oldConfig);

  expect(result.changed).toBe(true);
  expect(result.config.tbd_format).toBe('f04');
  // lookup_path removed
  expect(result.config.docs_cache.lookup_path).toBeUndefined();
  // files section removed (all were defaults)
  expect(result.config.docs_cache.files).toBeUndefined();
  // sources section added
  expect(result.config.docs_cache.sources).toHaveLength(3); // sys, tbd, spec
  expect(result.config.docs_cache.sources[0].prefix).toBe('sys');
  expect(result.config.docs_cache.sources[2].prefix).toBe('spec');
});

it('should preserve custom file overrides during migration', () => {
  const oldConfig = {
    tbd_format: 'f03',
    docs_cache: {
      files: {
        'guidelines/typescript-rules.md': 'internal:guidelines/typescript-rules.md',
        'guidelines/custom.md': 'https://example.com/my-custom.md',  // custom!
      },
    },
  };

  const result = migrateToLatest(oldConfig);

  // sources added
  expect(result.config.docs_cache.sources).toBeDefined();
  // custom file preserved, default removed
  expect(result.config.docs_cache.files).toEqual({
    'guidelines/custom.md': 'https://example.com/my-custom.md',
  });
  // warning about preserved custom entries
  expect(result.warnings).toContain('Preserved 1 custom file overrides in docs_cache.files');
});

it('should reject f04 config on older tbd version', () => {
  const futureConfig = { tbd_format: 'f04', /* ... */ };
  expect(isCompatibleFormat('f04')).toBe(false);
});
```

### Repo Structure Convention

External repos follow a simple, flat structure with doc type as the top-level directory:

```
repo-root/
  shortcuts/
    review-code.md
    create-pr-simple.md
  guidelines/
    typescript-rules.md
    python-rules.md
  templates/
    plan-spec.md
    research-brief.md
  references/
    convex-limits.md
    api-patterns.md
```

**Universal pattern:** `{type}/{name}.md`

All doc types follow the same pattern - no nested subdirectories within types.

**Doc types:**
- `shortcuts/` - Reusable instruction templates for common tasks
- `guidelines/` - Coding rules and best practices
- `templates/` - Document templates for specs, research, etc.
- `references/` - Reference documentation and API specs

**Front matter** is optional but recommended:

```yaml
---
title: My Shortcut
description: Does something useful
category: workflow
---
```

### Prefix-Based Namespacing and Collision Handling

Each source has a required `prefix` that namespaces its content.
This enables:

1. **Collision-safe storage**: All sources sync without overwriting each other
2. **Explicit access**: Use `prefix:name` syntax when needed
3. **Backward-compatible**: Unqualified names work when unique

**Storage structure:**

```
.tbd/docs/
  sys/                          # prefix: sys (system shortcuts)
    shortcuts/
      skill.md
      skill-brief.md
  tbd/                          # prefix: tbd (tbd-specific)
    shortcuts/
      code-review-and-commit.md
      implement-beads.md
  spec/                         # prefix: spec (speculate repo)
    shortcuts/
      review-code.md
    guidelines/
      typescript-rules.md
    templates/
      plan-spec.md
    references/
      convex-limits.md
  rpp/                          # prefix: rpp (rust-porting-playbook)
    references/
      rust-porting-guide.md
```

**Sync behavior:** Each source syncs to its own prefix directory.
No collisions at sync time - all sources coexist.

**Lookup behavior:**

| Query | Behavior |
| --- | --- |
| `typescript-rules` | Search all prefixes in config order, return if unique |
| `spec:typescript-rules` | Direct lookup in `spec/guidelines/typescript-rules.md` |
| Ambiguous name | Error: "Multiple matches: use `spec:name` or `rpp:name`" |

**Precedence for unqualified names:**

1. Explicit `files:` entries (highest precedence, bypass prefix system)
2. Earlier sources in `sources:` array (searched first)
3. Later sources in `sources:` array

When an unqualified name matches docs in multiple sources, it’s ambiguous and requires
explicit prefix qualification.

**Hidden sources:** Sources with `hidden: true` are:
- Excluded from `--list` output
- Still accessible via direct lookup or qualified names
- Useful for system/internal docs that users shouldn’t see in listings

**List output with prefixes:**

```
$ tbd guidelines --list
typescript-rules (spec)     TypeScript coding rules...
python-rules (spec)         Python coding rules...
rust-porting (rpp)          Rust porting guidelines...
```

When a name exists in multiple sources, the list shows the prefix for clarity.

### URL Normalization Utility

The `src/lib/repo-url.ts` module is a standalone utility for git URL handling with
comprehensive unit tests.
It provides:

```typescript
// Normalize any git URL format to canonical form
normalizeRepoUrl(url: string): NormalizedUrl
// Input: 'git@github.com:org/repo.git' | 'https://github.com/org/repo' | 'github.com/org/repo'
// Output: { host: 'github.com', owner: 'org', repo: 'repo', https: 'https://github.com/org/repo.git' }

// Convert normalized URL to filesystem-safe slug
repoUrlToSlug(url: string): string
// Input: 'github.com/jlevy/speculate'
// Output: 'github.com-jlevy-speculate' (uses @github/slugify)

// Get clone URL for git operations
getCloneUrl(url: string, preferSsh: boolean): string
// Returns HTTPS or SSH URL based on preference
```

**Unit tests** cover:
- All input URL formats (short, HTTPS, HTTPS+.git, SSH)
- Edge cases (trailing slashes, mixed case, special characters)
- Round-trip: `slugify(normalize(url))` is deterministic
- Invalid URLs produce clear errors

This utility is intentionally separate from the caching logic to enable reuse and
thorough testing.

### Checkout Strategy

**Why shallow clone (not worktree):**

tbd uses worktrees for the tbd-sync branch because that’s a branch of the **same** repo.
External doc repos are completely separate git repositories - you can’t worktree into a
different remote. Shallow clone is the correct approach for external repos.

**Primary: Git sparse checkout**

```bash
# In repo cache directory (e.g., .tbd/repo-cache/github.com-jlevy-speculate/)
git clone --depth 1 --filter=blob:none --sparse <url>
git sparse-checkout set <paths>
git pull  # on subsequent syncs
```

Advantages:

- Works with any git host (GitHub, GitLab, Bitbucket, self-hosted)
- Minimal storage (only needed paths via sparse checkout)
- Shallow clone (`--depth 1`) minimizes git history overhead
- Works offline after initial sync
- Proper versioning via any git ref (branch, tag, or commit SHA)

**Fallback: GitHub API (if git unavailable)**

Use `gh api` or raw HTTP to fetch directory listings and files.
Limited to GitHub repos.

### Cache Location

**Repo cache** (for git checkouts): `.tbd/repo-cache/` (gitignored)

```
.tbd/
  repo-cache/                        # Git checkouts (gitignored)
    github.com-jlevy-speculate/
      .git/                          # shallow clone
      shortcuts/                     # sparse checkout
      guidelines/
      templates/
      references/
    github.com-jlevy-rust-porting-playbook/
      .git/
      references/
```

The slug is derived from the normalized URL using the `@github/slugify` npm package:
`github.com/jlevy/speculate` → `github.com-jlevy-speculate`. This is more legible than a
hash and effectively guarantees uniqueness since it preserves the full path structure.

**Doc cache** (synced docs): `.tbd/docs/` (gitignored)

```
.tbd/
  docs/                              # Synced docs (gitignored)
    sys/shortcuts/                   # prefix: sys
    tbd/shortcuts/                   # prefix: tbd
    spec/shortcuts/                  # prefix: spec
    spec/guidelines/
    spec/templates/
    spec/references/
    rpp/references/                  # prefix: rpp
```

The doc cache uses prefix as the top-level directory, with doc type underneath.
This mirrors the config structure and makes the source of each doc clear.

The `tbd setup` command adds both `repo-cache/` and `docs/` to `.tbd/.gitignore`.

### Sync Workflow

`tbd sync --docs` (or auto-sync):

1. For each `type: repo` source:
   - Compute cache path from slugified normalized URL
   - If not cached: sparse clone with specified paths
   - If cached: `git fetch && git checkout <ref>`
   - Scan for `.md` files in directories matching path patterns
   - Add to sync manifest

2. For `type: internal` source:
   - Scan bundled docs (existing behavior)
   - Add to sync manifest

3. Apply explicit `files:` overrides (URL or internal sources)

4. Sync all files to `.tbd/docs/` (existing DocSync logic)

5. Update config with discovered files (for transparency)

### Doc Type Registry

A central registry defines all doc types, replacing scattered path constants:

```typescript
// lib/doc-types.ts - Single source of truth for doc types

export const DOC_TYPES = {
  shortcut: {
    directory: 'shortcuts',
    command: 'shortcut',
    singular: 'shortcut',
    plural: 'shortcuts',
    description: 'Reusable instruction templates for common tasks',
  },
  guideline: {
    directory: 'guidelines',
    command: 'guidelines',
    singular: 'guideline',
    plural: 'guidelines',
    description: 'Coding rules and best practices',
  },
  template: {
    directory: 'templates',
    command: 'template',
    singular: 'template',
    plural: 'templates',
    description: 'Document templates for specs and research',
  },
  reference: {
    directory: 'references',
    command: 'reference',
    singular: 'reference',
    plural: 'references',
    description: 'Reference documentation and API specs',
  },
} as const;

export type DocTypeName = keyof typeof DOC_TYPES;
```

**Benefits:**
- Single source of truth for doc type metadata
- Adding new types requires only registry entry + command file
- No more scattered path constants
- Type inference from directory name: `spec/guidelines/foo.md` → type is `guideline`

**Type inference:**

```typescript
function inferDocType(relativePath: string): DocTypeName | undefined {
  // Path: spec/guidelines/typescript-rules.md
  const segments = relativePath.split('/');
  const typeDir = segments[1];  // "guidelines"

  for (const [name, config] of Object.entries(DOC_TYPES)) {
    if (config.directory === typeDir) {
      return name as DocTypeName;
    }
  }
  return undefined;
}
```

### Source Schema

```typescript
// In schemas.ts
export const DocsSourceSchema = z.object({
  type: z.enum(['internal', 'repo', 'local']),
  prefix: z.string().min(1).max(16).regex(/^[a-z0-9-]+$/),
  url: z.string().optional(),           // Required for type: repo
  ref: z.string().optional(),            // Defaults to 'main' for repos
  path: z.string().optional(),           // Required for type: local (repo-root-relative dir)
  paths: z.array(z.string()),
  hidden: z.boolean().optional(),        // Exclude from --list
});

export const DocsCacheSchema = z.object({
  sources: z.array(DocsSourceSchema).optional(),
  files: z.record(z.string(), z.string()).optional(),
});
```

### Changes to Existing Code

**New files:**

- `src/lib/doc-types.ts` - Doc type registry (single source of truth)
- `src/lib/repo-url.ts` - URL normalization and slugification utility (standalone, with
  unit tests). Handles all URL formats → normalized form → slug for cache paths.
- `src/file/repo-cache.ts` - Git sparse checkout operations (uses `repo-url.ts`)

**Modified files:**

- `src/lib/tbd-format.ts` - Add f04 format version with migration
- `src/lib/schemas.ts` - Add `DocsSourceSchema`, update `DocsCacheSchema`
- `src/lib/paths.ts` - Simplify, derive paths from doc-types registry
- `src/file/doc-sync.ts` - Integrate repo sources, prefix-based storage
- `src/file/doc-cache.ts` - Add prefix parsing, ambiguity detection
- `src/cli/commands/sync.ts` - Handle repo checkout errors/progress
- `src/cli/commands/shortcut.ts` - Use doc-types registry
- `src/cli/commands/guidelines.ts` - Use doc-types registry
- `src/cli/commands/template.ts` - Use doc-types registry
- `src/cli/commands/reference.ts` - New command for references

### Error Handling

- **Network errors during checkout**: Warn and skip source, use cached version if
  available. If no cache exists, error with message explaining the source is unavailable.
- **Invalid repo URL**: Error at config parse time with examples of valid formats.
- **Missing ref**: After clone attempt fails, run `git ls-remote` to list available refs
  and suggest alternatives: “Ref ‘main’ not found.
  Available: master, v1.0, v2.0”
- **Auth required**: Error with suggestion to use `gh auth login` for HTTPS or configure
  SSH keys for `git@` URLs.
- **Source removed from config**: On next sync, files from removed sources are deleted
  (the sources hash change triggers a full cache clear and re-sync).
- **Repo permanently unavailable**: If a configured repo is deleted/renamed and no cache
  exists, sync fails with clear error.
  User must update config to remove or fix the source.

## Alternatives Considered

### Alternative 1: Only URL Sources (No Git)

Enhance URL sources to support directory listing via GitHub API.

**Pros:** No git dependency, simpler implementation

**Cons:** GitHub-only, rate limits, no versioning, requires enumeration

**Verdict:** Too limiting for the stated goals.

### Alternative 2: npm Package Dependencies

Publish guideline packs as npm packages, install as dependencies.

**Pros:** Familiar pattern, versioning via npm

**Cons:** Heavy for text files, requires npm publish workflow, version lag

**Verdict:** Overkill for documentation files.

### Alternative 3: Git Submodules

Use git submodules for external doc repos.

**Pros:** Native git versioning

**Cons:** Submodule UX is poor, requires user git knowledge, complicates tbd’s git usage

**Verdict:** Poor UX, conflicts with tbd’s sync model.

## Development Test Setup

For development and testing, we maintain local checkouts of test repos in `repos/`
(gitignored). A `sync-repos.sh` script at the repo root syncs these:

```bash
#!/bin/bash
# sync-repos.sh - Sync test repos for external docs development
#
# Usage: ./sync-repos.sh
#
# If you encounter git auth issues, ensure `gh auth login` has been run.
# The script will fall back to `gh repo clone` if git clone fails.

set -e
mkdir -p repos

clone_repo() {
  local repo=$1
  local dir=$2
  local branch=${3:-}

  if [ -d "$dir" ]; then
    echo "Updating $dir..."
    (cd "$dir" && git fetch && ${branch:+git checkout $branch &&} git pull)
  else
    echo "Cloning $repo to $dir..."
    if ! git clone "https://github.com/$repo" "$dir" 2>/dev/null; then
      echo "git clone failed, trying gh repo clone..."
      gh repo clone "$repo" "$dir"
    fi
    if [ -n "$branch" ]; then
      (cd "$dir" && git checkout "$branch")
    fi
  fi
}

# Primary test repo (will become default source)
clone_repo "jlevy/speculate" "repos/speculate" "tbd"

# Secondary test repo (validates multi-source functionality)
clone_repo "jlevy/rust-porting-playbook" "repos/rust-porting-playbook"

echo "Test repos synced to repos/"
```

**Test repos:**
- `jlevy/speculate` (branch: `tbd`) - Primary test target, will become default source
- `jlevy/rust-porting-playbook` - Secondary test target, validates multi-source config

Testing with two repos ensures the multi-source functionality works correctly.
Only Speculate ships as the default source.

## Implementation Plan

### Phase 0a: Prerequisite Fixes (Do First)

Fix code issues that should be resolved before starting external sources work.
These are independent of the external docs design and reduce risk during the main
phases.

#### 0a.1: Refactor `shortcut.ts` to use `DocCommandHandler` (Issue 1)

Eliminate ~280 lines of duplicated code.
Prerequisite for prefix-aware loading since the shared base class is where prefix logic
will be added.

**Beads** (TDD order, dependency chain):

| Bead | Description |
| --- | --- |
| `tbd-she8` | Parent: 0a.1 Refactor shortcut.ts to use DocCommandHandler |
| `tbd-0pwa` | RED: Write characterization tests for shortcut command current behavior |
| `tbd-fmxo` | GREEN: Migrate ShortcutHandler to extend DocCommandHandler (blocked by 0pwa) |
| `tbd-0fpx` | GREEN: Move shortcut-specific behavior to DocCommandHandler overrides (blocked by fmxo) |
| `tbd-4npn` | REFACTOR: Remove duplicate code from shortcut.ts (blocked by 0fpx) |
| `tbd-msj1` | VERIFY: Run full test suite, confirm no regressions (blocked by 4npn) |

**TDD approach:**

1. **Red**: Write characterization tests capturing exact current behavior (--list, exact
   lookup, fuzzy search, --category, --add, --refresh, no-query fallback, agent header,
   shadowed entries, JSON output)
2. **Green**: Migrate `ShortcutHandler` to extend `DocCommandHandler`, mapping
   `typeName='shortcut'`,
   `excludeFromList=['skill','skill-brief','shortcut-explanation']`,
   `noQueryDocName='shortcut-explanation'`
3. **Refactor**: Delete all duplicated methods (extractFallbackText,
   printWrappedDescription, wrapAtWord, handleList, handleNoQuery, handleQuery) — file
   shrinks from ~~380 → ~~80 lines
4. **Verify**: Full test suite passes, no regressions in guidelines/template commands

#### 0a.2: Add `warnings` field to `MigrationResult` (Issue 3)

The `MigrationResult` type in `tbd-format.ts` only has `changes: string[]`. The f03→f04
migration needs `warnings: string[]` for reporting preserved custom file overrides.

**Beads** (TDD order):

| Bead | Description |
| --- | --- |
| `tbd-di9c` | Parent: 0a.2 Add warnings field to MigrationResult |
| `tbd-aga3` | RED: Write test for MigrationResult warnings field |
| `tbd-lifm` | GREEN: Add warnings: string[] to interface and existing functions (blocked by aga3) |

#### 0a.3: Update `generateShortcutDirectory()` for `hidden` support (Issue 12)

Currently hardcodes skip names (`skill`, `skill-brief`, `shortcut-explanation`). The
prefix system introduces `hidden` sources that should be excluded generically.

**Beads** (TDD order):

| Bead | Description |
| --- | --- |
| `tbd-hrbz` | Parent: 0a.3 Update generateShortcutDirectory() for hidden support |
| `tbd-xfru` | RED: Write tests for hidden doc filtering in generateShortcutDirectory() |
| `tbd-kqic` | GREEN: Add hidden field to CachedDoc and filter (blocked by xfru) |
| `tbd-bal5` | REFACTOR: Remove hardcoded skip names, use hidden field (blocked by kqic) |

#### 0a.4: Establish test patterns for doc infrastructure (Issue 13)

Set up reusable test fixtures and helpers for doc tests before the main implementation.

**Beads** (dependency chain):

| Bead | Description |
| --- | --- |
| `tbd-0bed` | Parent: 0a.4 Establish shared test fixtures and helpers |
| `tbd-v0sk` | Create tests/fixtures/test-docs/ with sample docs for each type |
| `tbd-r34n` | Create tests/helpers/doc-test-utils.ts with temp doc dir helpers (blocked by v0sk) |
| `tbd-nszx` | Add helper for creating local bare git repos (blocked by r34n) |
| `tbd-3grz` | Refactor existing doc-sync/doc-cache tests to use shared fixtures (blocked by r34n) |

### Phase 0: Speculate Prep

Prepare Speculate repo with tbd-compatible structure on a `tbd` branch.
This enables end-to-end testing throughout development rather than a big-bang migration
at the end.

**Git auth note:** If the agent encounters git authentication issues when cloning or
pushing, use `gh repo clone` and `gh` commands instead of raw git.
Ensure `gh auth login` has been run in the environment.

**Speculate repo modifications (on `tbd` branch):**

- [ ] Clone `jlevy/speculate` to `repos/speculate` (use `gh repo clone` if auth issues)
- [ ] Create and checkout `tbd` branch
- [ ] Restructure to flat doc type directories:
  - `agent-rules/` + `agent-guidelines/` → `guidelines/`
  - `agent-shortcuts/` → `shortcuts/` (flat, no standard/ subdirectory)
  - templates → `templates/`
  - Add `references/` for reference docs
- [ ] Rename files: remove `shortcut-` prefix from shortcut filenames
- [ ] Update front matter to match tbd format (`title:`, `description:`, `category:`)
- [ ] Update shortcut references to use tbd syntax (`tbd shortcut <name>`)
- [ ] Copy improved docs from tbd → Speculate `tbd` branch (general guidelines,
  shortcuts, templates)
- [ ] Commit all changes with clear commit messages
- [ ] Push `tbd` branch to remote (do NOT merge to main yet)
- [ ] Verify branch is visible at https://github.com/jlevy/speculate/tree/tbd

**tbd repo setup:**

- [ ] Create `sync-repos.sh` script in tbd repo root
- [ ] Add `repos/` to `.gitignore`
- [ ] Update `docs/development.md` with test repo setup and testing workflows

This branch becomes the test target for all integration testing in subsequent phases.
The agent can iterate on the `tbd` branch as needed.

**Beads** (epic: `tbd-eikw`, parent: `tbd-mdwh`):

| Bead | Description |
| --- | --- |
| `tbd-eikw` | Parent: Phase 0 Speculate Prep |
| `tbd-ezsv` | Clone jlevy/speculate and create tbd branch |
| `tbd-xxj2` | Restructure Speculate to flat doc type directories (blocked by ezsv) |
| `tbd-fq7w` | Update Speculate front matter and shortcut references (blocked by xxj2) |
| `tbd-d6qq` | Copy improved docs from tbd to Speculate tbd branch (blocked by fq7w) |
| `tbd-yuz9` | Push Speculate tbd branch and verify (blocked by d6qq) |
| `tbd-1y1m` | Create sync-repos.sh script and add repos/ to .gitignore |

### Phase 1: Core Infrastructure

- [ ] Create `doc-types.ts` registry (single source of truth for doc types)
- [ ] Implement `repo-url.ts` utility (URL normalization, slugification) with unit tests
- [ ] Bump format version f03 → f04 in `tbd-format.ts`:
  - Add FORMAT_HISTORY entry
  - Update CURRENT_FORMAT
  - Add migration function that removes deprecated `lookup_path`
- [ ] Add `DocsSourceSchema` with prefix and repo type support to `schemas.ts`
- [ ] Update `DocsCacheSchema` to include optional `sources` array
- [ ] Implement `RepoCache` class for sparse checkouts (`repo-cache.ts`)
- [ ] Update `DocSync` for prefix-based storage (`{prefix}/{type}/{name}.md`)
- [ ] Clear `.tbd/docs/` during migration (fresh sync after format or source changes)
- [ ] **Integration checkpoint**: Test sync against Speculate `tbd` branch

**Beads** (epic: `tbd-5ybv`, parent: `tbd-mdwh`, blocked by Phase 0a):

| Bead | Description |
| --- | --- |
| `tbd-5ybv` | Parent: Phase 1 Core Infrastructure |
| `tbd-lvpg` | RED+GREEN: Create doc-types.ts registry with unit tests |
| `tbd-9cmd` | RED+GREEN: Create repo-url.ts utility with unit tests |
| `tbd-bfcu` | RED+GREEN: Bump format f03→f04 with migration (blocked by tbd-di9c) |
| `tbd-4nz6` | Add DocsSourceSchema and update DocsCacheSchema in schemas.ts |
| `tbd-dzo5` | RED+GREEN: Implement RepoCache class for sparse git checkouts (blocked by 9cmd) |
| `tbd-apb9` | Restructure bundled docs to prefix-based layout (blocked by lvpg) |
| `tbd-sfmk` | Rewrite DocSync for prefix-based storage and source-based sync (blocked by dzo5, apb9, 4nz6, bfcu) |
| `tbd-pswl` | Implement doc cache clearing on migration or source config change (blocked by sfmk, bfcu) |
| `tbd-wau7` | Integration checkpoint: test sync against Speculate tbd branch (blocked by sfmk, pswl) |

### Phase 2: Prefix System and Lookup

- [ ] Update `DocCache` for prefix-based lookup:
  - Parse `prefix:name` qualified syntax
  - Search all prefixes for unqualified names
  - Detect and error on ambiguous lookups
- [ ] Update `tbd setup` to configure default sources with prefixes
- [ ] Update `tbd setup` to add `repo-cache/` to `.tbd/.gitignore`
- [ ] Add `hidden` source support (exclude from `--list`)
- [ ] Update `--list` output to show prefix when relevant
- [ ] Add progress indicators for repo checkout
- [ ] Error handling and recovery
- [ ] **Integration checkpoint**: Full setup + sync cycle against Speculate `tbd` branch
- [ ] **Multi-source test**: Add `rust-porting-playbook` as secondary source

**Beads** (epic: `tbd-n3zb`, parent: `tbd-mdwh`, blocked by Phase 1):

| Bead | Description |
| --- | --- |
| `tbd-n3zb` | Parent: Phase 2 Prefix System and Lookup |
| `tbd-gr34` | RED+GREEN: Implement parseQualifiedName() utility with tests |
| `tbd-2hip` | Implement AmbiguousLookupError with clear messaging |
| `tbd-b1j3` | RED+GREEN: Update DocCache for prefix-based loading and lookup (blocked by gr34, 2hip) |
| `tbd-pj5q` | Update tbd setup --auto to configure default sources with prefixes (blocked by b1j3) |
| `tbd-u182` | Update --list output to show prefix when relevant (blocked by b1j3) |
| `tbd-4onm` | Add progress indicators and error handling for repo checkout (blocked by b1j3) |
| `tbd-0c4o` | Integration checkpoint: full setup + sync + multi-source test (blocked by pj5q, u182, 4onm) |

### Phase 3: New Reference Type and CLI

- [ ] Add `reference` to DOC_TYPES registry
- [ ] Create `tbd reference` command (follows same pattern as guidelines/template)
- [ ] Update doc command handler to use doc-types registry
- [ ] Simplify existing commands (shortcut, guidelines, template) to use registry
- [ ] Remove hardcoded path constants from `paths.ts`
- [ ] Add `tbd doctor` checks for repo cache health

**Beads** (epic: `tbd-qhmo`, parent: `tbd-mdwh`, blocked by Phase 2):

| Bead | Description |
| --- | --- |
| `tbd-qhmo` | Parent: Phase 3 New Reference Type and CLI |
| `tbd-d8eo` | Simplify doc commands to derive paths from doc-types registry |
| `tbd-wylj` | Create tbd reference command (extends DocCommandHandler) (blocked by d8eo) |
| `tbd-c1cd` | Update doc-add.ts for prefix-based storage (blocked by d8eo) |
| `tbd-f5qd` | Remove hardcoded path constants, unify with doc-types registry (blocked by d8eo) |
| `tbd-fzf1` | Add tbd doctor checks for repo cache health |

### Phase 3b: Documentation Update

Update all tbd documentation to reflect the new architecture:

- [ ] Update `docs/development.md` with new doc structure
- [ ] Update `docs/docs-overview.md` with prefix system
- [ ] Update skill.md with new `tbd reference` command
- [ ] Update skill-brief.md shortcut/guideline directory info
- [ ] Review and update all shortcuts that reference doc paths
- [ ] Update README if it references doc structure
- [ ] Add migration guide for users with custom doc configs

**Beads** (epic: `tbd-rq6q`, parent: `tbd-mdwh`, blocked by Phase 3):

| Bead | Description |
| --- | --- |
| `tbd-rq6q` | Parent: Phase 3b Documentation Update |
| `tbd-ax39` | Update docs/development.md with external doc sources and test setup |
| `tbd-iarz` | Update docs/docs-overview.md with prefix system |
| `tbd-s72z` | Update skill.md and skill-brief.md with tbd reference command (blocked by iarz) |
| `tbd-l4ov` | Audit and update shortcuts that reference doc paths |
| `tbd-5m15` | Add migration guide for users with custom doc configs (blocked by iarz) |

### Phase 4: Validation

Verify that the refactored system produces identical output to the current release.

- [ ] Create validation script that compares output of every shortcut, guideline, and
  template between:
  - `npx --yes get-tbd@latest shortcut <name>` (baseline)
  - Local dev build with Speculate source (test)
- [ ] Run validation for all shortcuts: `tbd shortcut --list` → compare each
- [ ] Run validation for all guidelines: `tbd guidelines --list` → compare each
- [ ] Run validation for all templates: `tbd template --list` → compare each
- [ ] Test new `tbd reference` command
- [ ] Document any intentional differences (e.g., improved content from tbd)
- [ ] Fix any unintentional differences

**Beads** (epic: `tbd-pxis`, parent: `tbd-mdwh`, blocked by Phases 3 and 3b):

| Bead | Description |
| --- | --- |
| `tbd-pxis` | Parent: Phase 4 Validation |
| `tbd-t7yt` | Create validate-docs.sh comparison script |
| `tbd-ycnl` | Run validation for all shortcuts and guidelines (blocked by t7yt) |
| `tbd-sek7` | Run validation for templates and test reference command (blocked by t7yt) |
| `tbd-8txy` | Fix unintentional differences and document intentional ones (blocked by ycnl, sek7) |

### Phase 4b: Fresh Install End-to-End Test

Final validation with a clean environment to ensure the full user experience works.

- [ ] Create a fresh test directory (outside tbd repo)
- [ ] Run `npx --yes get-tbd@latest setup --auto --prefix=test`
- [ ] Verify default sources sync correctly with prefixes
- [ ] Manually add `rust-porting-playbook` as an additional source:
  ```yaml
  docs_cache:
    sources:
      - type: internal
        prefix: sys
        hidden: true
        paths: [shortcuts/]
      - type: internal
        prefix: tbd
        paths: [shortcuts/]
      - type: repo
        prefix: spec
        url: github.com/jlevy/speculate
        ref: tbd
        paths: [shortcuts/, guidelines/, templates/, references/]
      - type: repo
        prefix: rpp
        url: github.com/jlevy/rust-porting-playbook
        ref: main
        paths: [references/]
  ```
- [ ] Run `tbd sync --docs` and verify all sources sync to correct prefix directories
- [ ] Test unqualified lookup: `tbd guidelines typescript-rules`
- [ ] Test qualified lookup: `tbd guidelines spec:typescript-rules`
- [ ] Test ambiguity detection (if applicable)
- [ ] Verify `--list` shows prefixes appropriately
- [ ] Clean up test directory

**Beads** (epic: `tbd-4xj8`, parent: `tbd-mdwh`, blocked by Phase 4):

| Bead | Description |
| --- | --- |
| `tbd-4xj8` | Parent: Phase 4b Fresh Install End-to-End Test |
| `tbd-9bwo` | Fresh install: setup --auto with default sources |
| `tbd-7lus` | Fresh install: add secondary source and test multi-source (blocked by 9bwo) |
| `tbd-c7xq` | Fresh install: test qualified and unqualified lookups (blocked by 7lus) |

### Phase 5: Speculate Migration (Finalize)

Once validation passes, finalize the migration.

Make `jlevy/speculate` the upstream repo for general-purpose docs (guidelines, general
shortcuts, templates, references).
tbd becomes a consumer of Speculate docs via the external repo mechanism built in Phases
1-3.

#### Current State Comparison

**Speculate structure** (`docs/general/`):

```
docs/general/
  agent-rules/          # typescript-rules.md, python-rules.md, etc.
  agent-guidelines/     # general-tdd-guidelines.md, golden-testing-guidelines.md
  agent-shortcuts/      # shortcut-commit-code.md, shortcut-create-pr-simple.md
  agent-setup/          # github-cli-setup.md
  research/             # research briefs
docs/project/
  specs/                # Templates: template-plan-spec.md, etc.
  architecture/         # template-architecture.md
  research/             # template-research-brief.md
```

**tbd structure** (`packages/tbd/docs/`) - current:

```
guidelines/             # All rules + guidelines merged
shortcuts/
  standard/             # User-invocable shortcuts
  system/               # Internal system shortcuts
templates/              # plan-spec.md, research-brief.md, etc.
```

**tbd structure** - after migration (prefix-based):

```
# Bundled internal docs (type: internal sources)
sys/shortcuts/          # skill.md, skill-brief.md (hidden)
tbd/shortcuts/          # code-review-and-commit.md, implement-beads.md

# External docs synced from repos
spec/shortcuts/         # review-code.md, create-pr-simple.md
spec/guidelines/        # typescript-rules.md, python-rules.md
spec/templates/         # plan-spec.md, research-brief.md
spec/references/        # convex-limits.md, api-patterns.md
```

**Key differences (current state → will be resolved by migration):**

| Aspect | Speculate (current) | tbd (current) | After Migration |
| --- | --- | --- | --- |
| Front matter | Minimal | Rich (`title`, `description`, `category`) | Speculate adopts tbd format |
| Shortcut refs | `@shortcut-precommit-process.md` | `tbd shortcut precommit-process` | Speculate uses tbd syntax |
| Directory names | `agent-rules/`, `agent-shortcuts/` | `guidelines/`, `shortcuts/` | Flat: `{type}/{name}.md` |
| Subdirectories | None | `shortcuts/system/`, `shortcuts/standard/` | None (prefixes replace subdirs) |

#### Target State

Speculate becomes the canonical source for general docs.
tbd-specific docs remain in tbd with their own prefixes.

**Document classification by prefix:**

| Prefix | Source | Doc Types | Examples |
| --- | --- | --- | --- |
| `sys` | tbd internal | shortcuts | skill.md, skill-brief.md |
| `tbd` | tbd internal | shortcuts | code-review-and-commit, implement-beads |
| `spec` | Speculate repo | all types | typescript-rules, review-code, plan-spec |
| (user) | user repos | any | org-specific guidelines, references |

**Speculate repo changes:**

1. **Adopt flat structure**: `{type}/{name}.md` (no nested subdirectories)
2. **Adopt tbd’s front matter format**: `title:`, `description:`, `category:`
3. **Remove shortcut prefix** from filenames: `shortcut-commit-code.md` →
   `review-code.md`
4. **Use tbd-style references**: `tbd shortcut review-code`,
   `tbd guidelines typescript-rules`
5. **Add references/ directory** for reference docs

**tbd changes:**

1. **Restructure bundled docs** into prefix-based layout
2. **Remove general docs** that will come from Speculate
3. **Configure default sources** with `sys`, `tbd`, `spec` prefixes
4. **Add `tbd reference` command** for new doc type

#### Shortcut Reference Syntax

Speculate docs use tbd-specific syntax directly:

```markdown
Follow the `tbd shortcut precommit-process` steps...
See `tbd guidelines commit-conventions` for details.
See `tbd reference convex-limits` for API details.
```

This simplifies implementation (no translation layer needed) and assumes Speculate docs
are primarily consumed via tbd.

#### Finalization Tasks

> **Note:** Speculate restructuring is done in Phase 0 on the `tbd` branch.
> These tasks finalize the migration after validation passes.

- [ ] Audit all tbd docs: classify by prefix:
  - `sys`: system shortcuts (skill.md, skill-brief.md)
  - `tbd`: tbd-specific shortcuts (code-review-and-commit, implement-beads)
  - `spec`: general docs → move to Speculate
- [ ] Merge Speculate `tbd` branch → `main`
- [ ] Update tbd default config to use Speculate `main` (ref: main)
- [ ] Restructure `packages/tbd/docs/` to prefix-based layout
- [ ] Remove general docs that now come from Speculate
- [ ] Update Speculate README with flat `{type}/{name}.md` structure
- [ ] Release new tbd version with prefix-based sources

**Beads** (epic: `tbd-97fe`, parent: `tbd-mdwh`, blocked by Phase 4b):

| Bead | Description |
| --- | --- |
| `tbd-97fe` | Parent: Phase 5 Speculate Migration (Finalize) |
| `tbd-hcx4` | Audit all tbd docs and classify by prefix |
| `tbd-mxvr` | Merge Speculate tbd branch → main (blocked by hcx4) |
| `tbd-4r02` | Update tbd default config to use Speculate main (ref: main) (blocked by mxvr) |
| `tbd-d74a` | Remove general docs from tbd bundled set (now in Speculate) (blocked by 4r02) |
| `tbd-qrga` | Update Speculate README with flat doc structure (blocked by mxvr) |
| `tbd-mvi6` | Release new tbd version with prefix-based sources (blocked by d74a, qrga) |

#### Speculate CLI Future

Once tbd can pull docs from Speculate, the Speculate CLI’s main value is diminished.
Options:

1. **Deprecate**: Point users to tbd for full workflow tooling
2. **Simplify**: Keep only copier template functionality, remove doc management
3. **Maintain**: Keep both for users who want Speculate without tbd

**Recommendation:** Option 2 - Speculate CLI becomes a lightweight project scaffolding
tool (`speculate init`), while tbd handles all doc/shortcut/guideline management.

## Testing Strategy

**Unit tests:**
- `doc-types.ts` (registry, type inference from path)
- `repo-url.ts` (URL normalization, slugification - all formats, edge cases)
- Format migration f03 → f04 (verify lookup_path removal, version bump)
- `DocsSourceSchema` validation (prefix required, unique, valid format)
- `RepoCache` sparse checkout logic
- Prefix parsing (`spec:typescript-rules` → prefix=spec, name=typescript-rules)
- Ambiguity detection (same name in multiple prefixes)

**Integration tests:**
- Mock git repos (use `git init --bare` for test fixtures)
- Golden tests for config parsing with sources and prefixes
- Prefix-based storage: verify files land in `{prefix}/{type}/{name}.md`
- Forward compatibility test: verify `isCompatibleFormat('f04')` returns false on f03
- Multi-source test with multiple prefixes
- Hidden source test: verify excluded from `--list` but accessible

**End-to-end validation (Phase 4):**
- Test against Speculate `tbd` branch throughout development
- Validation script compares every shortcut/guideline/template/reference output
- Diff output must be empty or documented as intentional improvement

**Fresh install E2E test (Phase 4b):**
- Create fresh directory, run `npx --yes get-tbd@latest setup`
- Verify prefix directories created correctly
- Test unqualified lookup: `tbd guidelines typescript-rules`
- Test qualified lookup: `tbd guidelines spec:typescript-rules`
- Add secondary source, verify prefixes don’t collide

**Manual testing:**
- Real public repos (Speculate `tbd` branch as primary test target)
- Verify sync works offline after initial clone
- Verify error messages for common failure modes
- Test `tbd reference` command with new doc type

## Rollout Plan

**Top-level epic:** `tbd-mdwh` — Spec: External Docs Repos

**Phase 0a: Prerequisite Fixes** (`tbd-kzeh`)

1. Refactor shortcut.ts to use DocCommandHandler (TDD, beads tbd-she8 chain)
2. Add `warnings` field to `MigrationResult` (tbd-di9c)
3. Update `generateShortcutDirectory()` for `hidden` support (tbd-hrbz)
4. Establish shared test fixtures and helpers for doc infrastructure (tbd-0bed)

**Phase 0: Speculate Prep** (`tbd-eikw`, blocked by 0a)

5. Create Speculate `tbd` branch with flat `{type}/{name}.md` structure
6. This becomes the integration test target for all subsequent phases

**Phase 1: Core Infrastructure** (`tbd-5ybv`, blocked by 0a)

7. Implement doc-types registry, repo-url utility, format bump
8. Implement prefix-based storage and sync

**Phase 2: Prefix System and Lookup** (`tbd-n3zb`, blocked by Phase 1)

9. Implement qualified (`prefix:name`) and unqualified lookup
10. Add hidden source support
11. Test against Speculate `tbd` branch

**Phase 3: New Reference Type and CLI** (`tbd-qhmo`, blocked by Phase 2)

12. Add `tbd reference` command
13. Simplify existing commands to use doc-types registry

**Phase 3b: Documentation Update** (`tbd-rq6q`, blocked by Phase 3)

14. Update all tbd docs to reflect new architecture
15. Add migration guide for users

**Phase 4: Validation** (`tbd-pxis`, blocked by Phases 3 and 3b)

16. Run validation script comparing all output with `get-tbd@latest`
17. Document intentional differences, fix unintentional ones

**Phase 4b: Fresh Install E2E** (`tbd-4xj8`, blocked by Phase 4)

18. Fresh install test with prefix-based sources
19. Test qualified and unqualified lookups
20. All tests must pass before proceeding

**Phase 5: Speculate Migration (Finalize)** (`tbd-97fe`, blocked by Phase 4b)

21. Merge Speculate `tbd` → `main`
22. Update tbd default config to use Speculate `main`
23. Remove duplicated general docs from tbd bundled set
24. Release new tbd version

## Open Questions

1. ~~**Cache location:**~~ **Decided:** Per-project `.tbd/repo-cache/`, gitignored.

2. ~~**Auth for private repos:**~~ **Decided:** External - users manage git/ssh
   credentials.

3. ~~**Default source:**~~ **Decided:** `jlevy/speculate` is the default,
   auto-configured with prefix `spec`.

4. ~~**Version pinning UX:**~~ **Decided:** Default to `main` (always latest), always
   write `ref` explicitly to config.yml.
   Accepts any git ref (branch, tag, SHA). Branches recommended so you get updates on
   sync.

5. ~~**What happens when external docs conflict with internal?**~~ **Decided:**
   Prefix-based namespacing.
   Each source syncs to its own prefix directory.
   No collisions at sync time.
   Unqualified lookups search prefixes in config order; if multiple matches, require
   explicit `prefix:name` syntax.

6. ~~**Should external repos be able to declare dependencies on other repos?**~~
   **Decided:** No. Keep it simple - no inter-repo dependencies.

7. ~~**Speculate shortcut reference syntax:**~~ **Decided:** Use tbd-specific syntax
   (`tbd shortcut <name>`) directly.
   No translation needed.

8. ~~**Speculate directory structure:**~~ **Decided:** Flat structure with doc type as
   directory: `{type}/{name}.md`. No nested subdirectories.
   Prefixes replace the old `shortcuts/system/` vs `shortcuts/standard/` split.

9. ~~**Which docs are "general" vs "tbd-specific"?**~~ **Decided:** Separate by prefix:
   - `sys` prefix: system shortcuts (skill.md, hidden)
   - `tbd` prefix: tbd-specific shortcuts (code-review-and-commit, implement-beads)
   - `spec` prefix: general docs from Speculate (review-code, typescript-rules)

10. ~~**Name collision handling:**~~ **Decided:** Prefix-based namespacing.
    - All sources sync to their own `{prefix}/` directory
    - Unqualified lookup searches prefixes in order, returns if unique
    - Ambiguous names require `prefix:name` qualification
    - `hidden: true` sources excluded from `--list` but accessible via lookup

## Implemented: Source Management CLI

**CLI commands for managing sources** (implemented):

```bash
# Add a repo source with prefix
tbd source add github.com/org/guidelines --prefix myorg

# Add with specific ref and selective paths
tbd source add github.com/org/guidelines --prefix myorg --ref v2.0 --paths guidelines,references

# List configured sources with prefixes
tbd source list

# Remove a source by prefix
tbd source remove myorg
```

These commands:
- Require `--prefix` for new sources (validated: 1-16 lowercase alphanumeric + dashes)
- Validate prefix is unique (rejects duplicates)
- Default `ref` to `main` but always write it explicitly to config.yml
- Default `paths` to all doc type directories (shortcuts, guidelines, templates,
  references)
- Prevent removal of internal sources (only repo and local sources can be removed)
- 12 unit tests in `source.test.ts`

**Local source support** (designed, pending implementation — see “Design: Local Repo Doc
Sources” section above):
- `tbd source add docs/tbd --prefix local` — auto-detects local directories
- Uses stub pointer files for always-fresh content
- No re-sync needed after editing local docs

## Design: Local Repo Doc Sources (`type: local`)

### Motivation

A common use case: a project has its own shortcuts, guidelines, or templates checked
into its Git repo (e.g., at `docs/tbd/shortcuts/`). These should be managed just like
external repo sources — discoverable via `tbd shortcut --list`, accessible via
`tbd shortcut name` — but without any cloning or fetching.
The source is the current repo itself.

### Config Format

```yaml
docs_cache:
  sources:
    - type: local
      prefix: local            # user-chosen, 'local' as convention/default
      path: docs/tbd           # REQUIRED, relative to repo root
      paths: [shortcuts, guidelines, templates]
```

Key differences from `type: repo`:
- `path` (singular, required): the directory in the repo, always repo-root-relative
- No `url` or `ref` — those are repo-only
- `paths` (plural): which doc-type subdirs to scan (same as `repo` and `internal`)

### Stub Pointer Files (Always-Fresh Mechanism)

Instead of copying file content into `.tbd/docs/` (which would go stale), sync creates
**stub files** containing only YAML frontmatter that points back to the source:

```markdown
---
_source: local
_path: docs/tbd/shortcuts/my-shortcut.md
---
```

The stub lives at `.tbd/docs/local/shortcuts/my-shortcut.md` just like any other cached
doc. But instead of containing the actual content, it’s a pointer.
DocCache follows the pointer and reads the real file on every load.

**Why stubs (not symlinks, not copies):**

| Approach | Pros | Cons |
| --- | --- | --- |
| Copy on sync | Consistent with repo sources | Stale until next sync |
| Symlink | Always fresh, no duplication | Windows issues, git tracking weirdness |
| **Stub pointer** | **Always fresh, cross-platform, explicit** | Requires DocCache change |

Stubs are the best of both worlds: the `.tbd/docs/` directory structure is maintained
(consistent with repo/internal sources), but content is always read fresh from the
source file. No re-sync needed after editing local docs.

### DocCache Change

In `loadDirectory()`, after reading a file, check for the pointer:

```typescript
// In loadDirectory(), after reading raw content:
const frontmatter = this.parseFrontmatterData(content);

if (frontmatter?._source === 'local' && frontmatter._path) {
  // Follow the pointer — read the real file
  const tbdRoot = await findTbdRoot(this.baseDir);
  const realPath = join(tbdRoot, frontmatter._path);
  try {
    content = await readFile(realPath, 'utf-8');
  } catch {
    // Source file deleted — skip this doc with warning
    console.warn(`Local source missing: ${frontmatter._path}`);
    continue;
  }
}
```

This is the only DocCache change needed.
All other behavior (shadowing, qualified lookups, fuzzy search, `--list`) works
unchanged because the loaded `CachedDoc` has real content, real frontmatter from the
source file, and proper prefix/name fields.

### DocFrontmatter Extension

```typescript
export interface DocFrontmatter {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  // Internal pointer fields (stripped before exposing to users)
  _source?: string;   // 'local' for local source stubs
  _path?: string;     // repo-root-relative path to actual file
}
```

The `_` prefix convention signals internal/hidden metadata.
These fields are parsed but not displayed in `--list` output or shortcut directory
tables.

### Sync Behavior

In `resolveSourcesToDocs()`, for `type: local` sources:

```typescript
if (source.type === 'local') {
  // Scan {repoRoot}/{source.path}/{docTypeDir}/ for .md files
  for (const pathPattern of source.paths) {
    const scanDir = join(repoRoot, source.path, pathPattern);
    const files = await scanMdFiles(scanDir);
    for (const file of files) {
      const destPath = `${source.prefix}/${pathPattern}/${file}`;
      // Store as 'local:' source — DocSync writes a stub, not a copy
      result[destPath] = `local:${source.path}/${pathPattern}/${file}`;
    }
  }
}
```

`DocSync.parseSource()` gains a third source type:

```typescript
if (source.startsWith('local:')) {
  return { type: 'local', location: source.slice(6) };
}
```

For `type: 'local'`, `fetchContent()` returns the stub YAML frontmatter (not the actual
file content), because the real content is read at DocCache load time:

```typescript
if (source.type === 'local') {
  return `---\n_source: local\n_path: ${source.location}\n---\n`;
}
```

### CLI: `tbd source add` for Local Sources

```bash
# Auto-detected as local (resolves to existing directory):
tbd source add docs/tbd --prefix local

# With explicit paths filter:
tbd source add docs/tbd --prefix local --paths shortcuts,guidelines

# Still works for repos (existing behavior):
tbd source add github.com/acme/docs --prefix acme
```

**Auto-detection heuristic** in `source.ts`:
- Resolve the argument relative to repo root
- If it’s an existing directory → `type: local`
- Otherwise → `type: repo` (existing behavior)

**Validation when adding a local source:**
1. Resolve path relative to repo root (not cwd)
2. Verify directory exists
3. Verify it’s inside the repo (no `../../escape` — reject paths that resolve outside)
4. Normalize: strip leading `./`, ensure no trailing `/`
5. Store as repo-root-relative (e.g., `docs/tbd`, not `./docs/tbd`)

### Source List Display

```bash
$ tbd source list
sys [internal] (hidden)
  paths: shortcuts
tbd [internal]
  paths: shortcuts
local [local]
  path: docs/tbd
  paths: shortcuts, guidelines
```

The `[local]` label distinguishes from `[repo]` and `[internal]`.

### Removal Behavior

```bash
tbd source remove local
# → Removes source from config
# → Next sync removes stub files from .tbd/docs/local/
# → Source files in docs/tbd/ are untouched (they're part of the repo)
```

Only `repo` and `local` sources can be removed (same guard as existing: internal sources
are protected).

### Implementation Changes Summary

| File | Change |
| --- | --- |
| `schemas.ts` | Add `'local'` to type enum, add optional `path` field |
| `source.ts` | Auto-detect local vs repo, validate local path, display `[local]` |
| `doc-sync.ts` | Handle `local:` prefix in `parseSource()`, write stubs in `resolveSourcesToDocs()` |
| `doc-cache.ts` | Follow `_source`/`_path` pointers in `loadDirectory()` |
| `doc-types.ts` | No changes needed |
| `source.test.ts` | Tests for local source add/list/remove, path validation |
| `doc-sync.test.ts` | Tests for stub generation, local source resolution |
| `doc-cache.test.ts` | Tests for pointer following, missing source graceful degradation |

## Future Work

**Cross-prefix search** (not in initial implementation):

```bash
# Search across all prefixes
tbd search "typescript" --all-sources

# Show which prefixes have a given doc
tbd which typescript-rules
# → spec/guidelines/typescript-rules.md
```

**Prefix aliases** (not in initial implementation):

Allow shorter aliases for frequently used prefixes:
```yaml
sources:
  - type: repo
    prefix: speculate
    alias: s           # allows s:typescript-rules
```

**Additional doc types** (extensible via registry):

The DOC_TYPES registry makes adding new types straightforward:
- `examples/` - Code examples and snippets
- `recipes/` - Step-by-step guides for specific tasks
- `glossary/` - Term definitions

## Detailed Implementation Notes

This section provides code-level implementation details for each phase, derived from a
thorough review of the current codebase (as of 2026-02-08).

### Current Codebase Inventory

**Files that will be modified or serve as reference:**

| File | Role | Impact |
| --- | --- | --- |
| `src/lib/tbd-format.ts` | Format versioning, migration | Add f04, migration function |
| `src/lib/schemas.ts` | Zod schemas | Add `DocsSourceSchema`, update `DocsCacheSchema` |
| `src/lib/paths.ts` | Path constants | Simplify, derive from doc-types registry |
| `src/file/doc-sync.ts` | Sync docs from sources | Major rewrite for prefix-based sync, repo sources |
| `src/file/doc-cache.ts` | Cache + lookup | Major rewrite for prefix-aware recursive loading |
| `src/file/doc-add.ts` | `--add` URL handler | Update for prefix-based storage |
| `src/file/config.ts` | Config read/write | Update for new schema |
| `src/cli/commands/shortcut.ts` | Shortcut command | Migrate to DocCommandHandler or update paths |
| `src/cli/commands/guidelines.ts` | Guidelines command | Update paths to use registry |
| `src/cli/commands/template.ts` | Template command | Update paths to use registry |
| `src/cli/commands/sync.ts` | Sync command | Add repo checkout handling |
| `src/cli/commands/setup.ts` | Setup command | Configure default sources, add repo-cache gitignore |
| `src/cli/lib/doc-command-handler.ts` | Shared doc command base | Update for prefix-aware loading |

**New files to create:**

| File | Purpose |
| --- | --- |
| `src/lib/doc-types.ts` | Doc type registry (single source of truth) |
| `src/lib/repo-url.ts` | URL normalization and slugification |
| `src/file/repo-cache.ts` | Git sparse checkout operations |
| `src/cli/commands/reference.ts` | New `tbd reference` command |
| `tests/repo-url.test.ts` | Unit tests for URL utility |
| `tests/doc-types.test.ts` | Unit tests for doc type registry |

### Phase 0: Speculate Prep — Detailed Steps

**Precondition:** The Speculate repo at `github.com/jlevy/speculate` does NOT have a
`tbd` branch yet (confirmed 2026-02-08). It has branches: `main`, `tbd-sync`.

**Current Speculate structure** (confirmed from repo):

```
docs/general/
  agent-rules/            # 12 files (general-coding-rules.md, typescript-rules.md, etc.)
  agent-guidelines/       # 5 files (general-tdd-guidelines.md, golden-testing-guidelines.md, etc.)
  agent-shortcuts/        # 21+ files (shortcut-commit-code.md, shortcut-create-pr-simple.md, etc.)
  agent-setup/            # 2 files (github-cli-setup.md, shortcut-setup-beads.md)
```

**Restructuring plan for Speculate `tbd` branch:**

1. `agent-rules/` → `guidelines/` (12 files, rename)
2. `agent-guidelines/` → `guidelines/` (5 files, merge with above)
3. `agent-shortcuts/shortcut-*.md` → `shortcuts/*.md` (strip `shortcut-` prefix)
4. `agent-setup/github-cli-setup.md` → `shortcuts/setup-github-cli.md`
5. Create `templates/` from docs/project/ templates
6. Create `references/` for reference docs

**File mapping (Speculate old → new):**

| Old Path | New Path |
| --- | --- |
| `agent-rules/typescript-rules.md` | `guidelines/typescript-rules.md` |
| `agent-rules/python-rules.md` | `guidelines/python-rules.md` |
| `agent-rules/general-coding-rules.md` | `guidelines/general-coding-rules.md` |
| `agent-guidelines/general-tdd-guidelines.md` | `guidelines/general-tdd-guidelines.md` |
| `agent-shortcuts/shortcut-commit-code.md` | `shortcuts/review-code.md` (or similar) |
| `agent-setup/github-cli-setup.md` | `shortcuts/setup-github-cli.md` |

**Important:** Content from tbd’s bundled docs should be copied to Speculate `tbd`
branch for any general-purpose docs that are more up to date in tbd.
Compare file-by-file.

**tbd repo changes (in Phase 0):**

- Add `sync-repos.sh` to repo root
- Add `repos/` to root `.gitignore`
- Run `sync-repos.sh` to verify it works

### Phase 1: Core Infrastructure — Detailed Steps

#### Step 1.1: Create `src/lib/doc-types.ts`

```typescript
// Single source of truth for doc types
export const DOC_TYPES = {
  shortcut: {
    directory: 'shortcuts',
    command: 'shortcut',
    singular: 'shortcut',
    plural: 'shortcuts',
    description: 'Reusable instruction templates for common tasks',
  },
  guideline: {
    directory: 'guidelines',
    command: 'guidelines',
    singular: 'guideline',
    plural: 'guidelines',
    description: 'Coding rules and best practices',
  },
  template: {
    directory: 'templates',
    command: 'template',
    singular: 'template',
    plural: 'templates',
    description: 'Document templates for specs and research',
  },
  reference: {
    directory: 'references',
    command: 'reference',
    singular: 'reference',
    plural: 'references',
    description: 'Reference documentation and API specs',
  },
} as const;

export type DocTypeName = keyof typeof DOC_TYPES;

// Infer doc type from a path like "spec/guidelines/typescript-rules.md"
export function inferDocType(relativePath: string): DocTypeName | undefined {
  const segments = relativePath.split('/');
  // In prefix-based storage: {prefix}/{type-dir}/{name}.md
  // typeDir is segments[1] if prefix-based, or segments[0] if flat
  for (const [name, config] of Object.entries(DOC_TYPES)) {
    for (const segment of segments) {
      if (config.directory === segment) {
        return name as DocTypeName;
      }
    }
  }
  return undefined;
}

// Get all directory names from registry
export function getDocTypeDirectories(): string[] {
  return Object.values(DOC_TYPES).map((dt) => dt.directory);
}
```

#### Step 1.2: Create `src/lib/repo-url.ts`

**Note on slugification:** The spec mentions `@github/slugify` but this package is
designed for title → URL slug conversion.
For repo URL → filesystem slug, a simpler approach is better: replace `/` and `:` with
`-`, strip protocol.
This avoids an unnecessary dependency.

```typescript
export interface NormalizedRepoUrl {
  host: string;     // 'github.com'
  owner: string;    // 'jlevy'
  repo: string;     // 'speculate'
  https: string;    // 'https://github.com/jlevy/speculate.git'
  ssh: string;      // 'git@github.com:jlevy/speculate.git'
}

// Normalize any git URL format to canonical form
export function normalizeRepoUrl(url: string): NormalizedRepoUrl { ... }

// Convert URL to filesystem-safe slug
// 'github.com/jlevy/speculate' → 'github.com-jlevy-speculate'
export function repoUrlToSlug(url: string): string {
  const normalized = normalizeRepoUrl(url);
  return `${normalized.host}-${normalized.owner}-${normalized.repo}`;
}

// Get clone URL for git operations
export function getCloneUrl(url: string, preferSsh: boolean = false): string { ... }
```

**Test cases for `repo-url.test.ts`:**

- `github.com/org/repo` → normalized form
- `https://github.com/org/repo` → same normalized form
- `https://github.com/org/repo.git` → same
- `git@github.com:org/repo.git` → same
- Trailing slashes stripped
- Invalid URLs throw descriptive errors
- Round-trip: `slug(normalize(x))` is deterministic
- Special characters in repo names

#### Step 1.3: Update `src/lib/tbd-format.ts`

**Current state:** `CURRENT_FORMAT = 'f03'`, `RawConfig` type, `MigrationResult` type.

**Changes needed:**

1. Add `warnings: string[]` to `MigrationResult` interface (currently missing, but tests
   in spec expect it)
2. Add `f04` to `FORMAT_HISTORY`
3. Add `sources` to `RawConfig.docs_cache` type
4. Implement `migrate_f03_to_f04()`:
   - Remove `lookup_path` from `docs_cache`
   - Convert `files:` to `sources:` using `convertFilesToSources()`
   - See spec body for detailed algorithm
5. Add to `migrateToLatest()` chain
6. Update `CURRENT_FORMAT` to `'f04'`
7. Add to `describeMigration()`

**`getExpectedDefaultFiles()` implementation:** This function needs to return what
`generateDefaultDocCacheConfig()` in `doc-sync.ts` would produce.
It can:
- Call `generateDefaultDocCacheConfig()` directly (requires async), OR
- Hardcode the expected pattern: any `files` entry where `source === 'internal:' + dest`
  is a default entry. This is simpler and doesn’t require filesystem access.

**Recommended approach for identifying defaults:**

```typescript
function isDefaultFileEntry(dest: string, source: string): boolean {
  return source === `internal:${dest}`;
}
```

This avoids needing to enumerate bundled docs and correctly identifies any entry where
the destination path matches the internal source path (which is always true for
defaults).

#### Step 1.4: Update `src/lib/schemas.ts`

Add to existing schemas:

```typescript
export const DocsSourceSchema = z.object({
  type: z.enum(['internal', 'repo', 'local']),
  prefix: z.string().min(1).max(16).regex(/^[a-z0-9-]+$/),
  url: z.string().optional(),           // Required for type: repo
  ref: z.string().optional(),            // Defaults to 'main' for repos
  path: z.string().optional(),           // Required for type: local (repo-root-relative dir)
  paths: z.array(z.string()),
  hidden: z.boolean().optional(),
});

// Update DocsCacheSchema - keep backward compatibility during migration
export const DocsCacheSchema = z.object({
  sources: z.array(DocsSourceSchema).optional(),
  files: z.record(z.string(), z.string()).optional(),
  // REMOVED: lookup_path (replaced by prefix system)
  // Keep in schema for migration parsing but don't use
  lookup_path: z.array(z.string()).optional(),
});
```

**Important:** Since `ConfigSchema` uses Zod’s default `strip()` mode, removing
`lookup_path` from the schema would cause it to be silently stripped from existing f03
configs.
This is fine ONLY because the format version bump to f04 prevents older versions
from seeing the stripped field.
The migration explicitly removes it.

#### Step 1.5: Create `src/file/repo-cache.ts`

```typescript
export class RepoCache {
  private readonly cacheDir: string;  // .tbd/repo-cache/

  constructor(tbdRoot: string) {
    this.cacheDir = join(tbdRoot, '.tbd', 'repo-cache');
  }

  // Check out or update a repo
  async ensureRepo(url: string, ref: string, paths: string[]): Promise<string> {
    const slug = repoUrlToSlug(url);
    const repoDir = join(this.cacheDir, slug);

    if (await this.isCloned(repoDir)) {
      await this.updateRepo(repoDir, ref, paths);
    } else {
      await this.cloneRepo(url, repoDir, ref, paths);
    }

    return repoDir;
  }

  private async cloneRepo(url: string, dir: string, ref: string, paths: string[]): Promise<void> {
    const cloneUrl = getCloneUrl(url);
    await mkdir(dirname(dir), { recursive: true });

    // Shallow sparse clone
    await execGit(['clone', '--depth', '1', '--sparse', '--branch', ref, cloneUrl, dir]);

    // Set sparse checkout paths
    await execGit(['-C', dir, 'sparse-checkout', 'set', ...paths]);
  }

  private async updateRepo(dir: string, ref: string, paths: string[]): Promise<void> {
    // Update sparse checkout paths (in case config changed)
    await execGit(['-C', dir, 'sparse-checkout', 'set', ...paths]);

    // Fetch and checkout the ref
    await execGit(['-C', dir, 'fetch', '--depth', '1', 'origin', ref]);
    await execGit(['-C', dir, 'checkout', 'FETCH_HEAD']);
  }

  // Scan for .md files matching paths patterns
  async scanDocs(repoDir: string, paths: string[]): Promise<Map<string, string>> {
    const docs = new Map<string, string>();  // relativePath → absolutePath

    for (const pathPattern of paths) {
      const dir = join(repoDir, pathPattern.replace(/\/$/, ''));
      // Recursively find all .md files
      const files = await glob('**/*.md', { cwd: dir });
      for (const file of files) {
        const relativePath = join(pathPattern.replace(/\/$/, ''), file);
        docs.set(relativePath, join(dir, file));
      }
    }

    return docs;
  }
}
```

**Git execution:** Use `child_process.execFile` (not `exec`) for security.
Shell injection is not possible with `execFile` since arguments are passed as an array.

**Fallback when git fails:** If `git` is not available, try `gh repo clone` as fallback
(since gh CLI is typically available in agent environments).

#### Step 1.6: Update `src/file/doc-sync.ts`

Major changes needed:

1. **`syncDocsWithDefaults()` rewrite:** Currently this function:
   - Reads config
   - Generates defaults from bundled docs
   - Merges and prunes
   - Syncs files
   - Writes config

   New behavior:
   - Read config (now has `sources` array)
   - For each source, resolve docs (internal → scan bundled, repo → checkout + scan)
   - Copy files to `.tbd/docs/{prefix}/{type}/{name}.md`
   - Apply `files:` overrides last
   - Write sources hash for change detection

2. **`DocSync` class:** The constructor currently takes
   `config: Record<string, string>`. This needs to accept the new source-based config.
   Consider either:
   - (a) Expanding `DocSync` to handle sources directly, OR
   - (b) Resolving sources to a flat file map first, then passing to existing `DocSync`

   **Recommendation:** Option (b) for minimal disruption.
   Create a `resolveSourcesToDocs()` function that returns the same
   `Record<string, string>` format (dest → source), where source is either
   `internal:path` or a local file path from the repo cache.

3. **`generateDefaultDocCacheConfig()`:** This function becomes less important since
   defaults are now expressed as `sources`. It may still be needed for migration
   (`getExpectedDefaultFiles()`).

#### Step 1.7: Update `src/file/doc-cache.ts`

**Current behavior:** `DocCache` loads flat directories via `paths: string[]`. Each path
is a directory like `.tbd/docs/shortcuts/standard/`.

**New behavior:** `DocCache` needs to:
1. Accept prefix-based paths (scan `.tbd/docs/{prefix}/{type}/`)
2. Support `prefix:name` qualified lookups
3. Detect ambiguous unqualified lookups
4. Support `hidden` sources for excluding from `--list`

**Recommended approach:**

```typescript
// New constructor signature
constructor(
  private readonly docsDir: string,  // .tbd/docs/
  private readonly sources: DocsSource[],  // From config
  private readonly docType: DocTypeName,  // Which type to load
) {}

// Updated load: scan {prefix}/{type}/ for each source
async load(): Promise<void> {
  for (const source of this.sources) {
    const dir = join(this.docsDir, source.prefix, DOC_TYPES[this.docType].directory);
    await this.loadDirectory(dir, source.prefix, source.hidden);
  }
}

// Updated get: support prefix:name syntax
get(name: string): DocMatch | null {
  const { prefix, baseName } = parseQualifiedName(name);
  if (prefix) {
    // Direct lookup in specific prefix
    return this.docs.find(d => d.prefix === prefix && d.name === baseName) ?? null;
  }
  // Unqualified: search all, error if ambiguous
  const matches = this.docs.filter(d => d.name === baseName);
  if (matches.length > 1) {
    throw new AmbiguousLookupError(baseName, matches.map(m => m.prefix));
  }
  return matches[0] ?? null;
}
```

**New constructor signature:**

```typescript
// DocCache becomes general: accepts base dir, source names, and doc types
constructor(
  baseDir: string,            // e.g., '/project/.tbd/docs/'
  sourceNames: string[],      // e.g., ['sys', 'tbd', 'spec'] (precedence order)
  docTypes: string[],         // e.g., ['shortcuts'] for shortcut command
)

// Internally constructs paths:
// {baseDir}/{sourceName}/{docType}/ for each combination
// Scans in sourceNames order (earlier = higher precedence)
```

**Breaking change:** The `CachedDoc` interface needs a `prefix` field.

### Phase 2: Prefix System and Lookup — Detailed Steps

#### Step 2.1: Prefix parsing utility

```typescript
// In doc-cache.ts or a new utility
export function parseQualifiedName(name: string): { prefix?: string; baseName: string } {
  const colonIndex = name.indexOf(':');
  if (colonIndex > 0) {
    return {
      prefix: name.slice(0, colonIndex),
      baseName: name.slice(colonIndex + 1),
    };
  }
  return { baseName: name };
}
```

#### Step 2.2: Update `tbd setup --auto`

Current setup in `setup.ts` calls `syncDocsWithDefaults()` which generates the verbose
`files:` config. New setup should:

1. If config is f03 or has no `sources`: run migration (f03 → f04)
2. Write default `sources` array to config
3. Add `repo-cache/` to `.tbd/.gitignore`
4. Run `syncDocsWithDefaults()` with new source-based logic

**Default sources (written to config.yml):**

```yaml
docs_cache:
  sources:
    - type: internal
      prefix: sys
      hidden: true
      paths:
        - shortcuts/
    - type: internal
      prefix: tbd
      paths:
        - shortcuts/
    - type: repo
      prefix: spec
      url: github.com/jlevy/speculate
      ref: main
      paths:
        - shortcuts/
        - guidelines/
        - templates/
        - references/
```

**Important consideration:** For `type: internal` sources, the `paths` field indicates
which doc types to include.
The `prefix` determines where they’re stored on disk.
The internal doc bundling needs to know which bundled docs belong to `sys` vs `tbd`.

**Classification of bundled shortcuts (from codebase analysis):**

| Prefix | Bundled Files |
| --- | --- |
| `sys` (hidden) | `skill.md`, `skill-brief.md`, `shortcut-explanation.md` |
| `tbd` | All 29 standard shortcuts (code-review-and-commit, implement-beads, etc.) |

The classification is simple: `shortcuts/system/` → `sys`, `shortcuts/standard/` →
`tbd`.

**After migration to Speculate (Phase 5):**

Some shortcuts currently in `tbd` will move to `spec` (the ~5 general-purpose ones).
But during Phase 1-3, all standard shortcuts remain in `tbd` prefix.

#### Step 2.3: Update `.tbd/.gitignore`

Add `repo-cache/` entry:

```
# Git checkouts for external doc repos
repo-cache/
```

#### Step 2.4: Update `--list` output format

Current `--list` shows: `name (size)` + description.

New format when prefixes are relevant:

```
typescript-rules (spec) 12.3 KB / ~3.5K tokens
   TypeScript coding rules and best practices
code-review-and-commit (tbd) 8.1 KB / ~2.3K tokens
   Run pre-commit checks, review changes, and commit code
```

Show prefix in parentheses after name when:
- The name exists in multiple sources, OR
- A non-default source provides the doc (for clarity)

#### Step 2.5: Error messages for ambiguous lookups

```
Error: "typescript-rules" matches docs in multiple sources:
  spec:typescript-rules (spec/guidelines/typescript-rules.md)
  myorg:typescript-rules (myorg/guidelines/typescript-rules.md)

Use a qualified name: tbd guidelines spec:typescript-rules
```

### Phase 3: New Reference Type and CLI — Detailed Steps

#### Step 3.1: Create `src/cli/commands/reference.ts`

Follow the same pattern as `guidelines.ts` (extends `DocCommandHandler`):

```typescript
class ReferenceHandler extends DocCommandHandler {
  constructor(command: Command) {
    super(command, {
      typeName: 'reference',
      typeNamePlural: 'references',
      paths: DEFAULT_REFERENCE_PATHS,  // Derive from doc-types registry
      docType: 'reference',
    });
  }
  // ... same pattern as guidelines
}

export const referenceCommand = new Command('reference')
  .description('Find and output reference documentation')
  .argument('[query]', 'Reference name or description to search for')
  .option('--list', 'List all available references')
  // ... same options
```

Register in `cli.ts`:

```typescript
import { referenceCommand } from './commands/reference.js';
program.addCommand(referenceCommand);
```

#### Step 3.2: Simplify commands to use doc-types registry

Currently each command hardcodes its paths:

- `shortcut.ts`: `config.docs_cache?.lookup_path ?? DEFAULT_SHORTCUT_PATHS`
- `guidelines.ts`: `DEFAULT_GUIDELINES_PATHS`
- `template.ts`: `DEFAULT_TEMPLATE_PATHS`

With the doc-types registry, all commands derive paths from the registry and config
sources:

```typescript
function getDocPaths(sources: DocsSource[], docType: DocTypeName, docsDir: string): string[] {
  const typeDir = DOC_TYPES[docType].directory;
  return sources
    .filter(s => s.paths.some(p => p.replace(/\/$/, '') === typeDir))
    .map(s => join(docsDir, s.prefix, typeDir));
}
```

#### Step 3.3: Unify `shortcut.ts` with `DocCommandHandler`

**Current issue:** The `shortcut.ts` command has its own
`ShortcutHandler extends BaseCommand` with duplicated logic for listing, querying,
wrapping text, etc. The `guidelines.ts` and `template.ts` commands use
`DocCommandHandler` properly.

**This refactoring is a prerequisite** for the prefix system because the prefix-aware
loading logic should be in `DocCommandHandler`, not duplicated in each command.

Steps:
1. Migrate `ShortcutHandler` to extend `DocCommandHandler`
2. Move category filtering to the base class (or keep as override)
3. Shortcut-specific behavior (agent header, shortcut-explanation fallback) via
   overrides

#### Step 3.4: Update `doc-add.ts`

Currently `doc-add.ts` adds to `shortcuts/custom/`. In the new system:
- `--add` still writes to `docs_cache.files` (per-file overrides)
- The destination path should be `{type}/{name}.md` (flat, no `custom/` subdir)
- OR the destination goes into a dedicated prefix directory

**Recommendation:** Keep `--add` writing to `files:` as overrides, but change the
destination from `shortcuts/custom/foo.md` to just `guidelines/foo.md` or
`shortcuts/foo.md` (flat).
The `files:` section is the highest precedence, so the doc will be found before any
source-provided doc with the same name.

#### Step 3.5: Doctor checks

Add to `tbd doctor`:

```typescript
// Check repo-cache health
async function checkRepoCacheHealth(tbdRoot: string, sources: DocsSource[]): Promise<void> {
  for (const source of sources.filter(s => s.type === 'repo')) {
    const slug = repoUrlToSlug(source.url!);
    const cacheDir = join(tbdRoot, '.tbd', 'repo-cache', slug);

    // Check if cache exists
    if (!await exists(cacheDir)) {
      warn(`Repo cache missing for ${source.url} - run 'tbd sync --docs' to populate`);
      continue;
    }

    // Check if git repo is valid
    try {
      await execGit(['-C', cacheDir, 'status']);
    } catch {
      error(`Repo cache corrupted for ${source.url} - delete and re-sync`);
    }
  }
}
```

### Phase 3b: Documentation Update — Detailed Steps

Files to update:

1. **`docs/development.md`**: Add section on test repo setup, external doc sources, and
   development workflow for testing with local repos.

2. **`docs/docs-overview.md`**: Replace the current doc layout description with
   prefix-based structure.
   Update `tbd reference` command.
   Update the `--add` documentation.

3. **Skill files** (`packages/tbd/docs/shortcuts/system/skill.md`, `skill-brief.md`):
   Add `tbd reference` to the command directory tables.
   Update any doc path references.

4. **`generateShortcutDirectory()` in `doc-cache.ts`**: Update to include references in
   the directory table.
   This function generates the shortcut/guideline directory that appears in skill files.

5. **Shortcuts that reference doc paths**: Several shortcuts reference paths like
   `.tbd/docs/shortcuts/standard/`. Audit and update:
   - `new-shortcut.md`
   - `new-guideline.md`
   - `welcome-user.md`

### Phase 4: Validation — Detailed Steps

**Validation script approach:**

```bash
#!/bin/bash
# validate-docs.sh - Compare output between released and dev builds
set -e

BASELINE_CMD="npx --yes get-tbd@latest"
TEST_CMD="node packages/tbd/dist/bin.mjs"

# Compare all shortcuts
echo "=== Comparing Shortcuts ==="
for name in $($TEST_CMD shortcut --list --json | jq -r '.[].name'); do
  baseline=$($BASELINE_CMD shortcut "$name" 2>/dev/null || echo "NOT_FOUND")
  test=$($TEST_CMD shortcut "$name" 2>/dev/null || echo "NOT_FOUND")
  if [ "$baseline" != "$test" ]; then
    echo "DIFF: shortcut $name"
    diff <(echo "$baseline") <(echo "$test") || true
  fi
done

# Similar for guidelines, templates, references
```

**Expected intentional differences:**
- References section is new (no baseline)
- Content improvements from tbd → Speculate copy
- Prefix information in `--list` output

### Phase 4b: Fresh Install E2E — Detailed Steps

```bash
# Create temp directory
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"
git init

# Install and setup
npm install -g /path/to/local/get-tbd/tarball
tbd setup --auto --prefix=test

# Verify directory structure
ls .tbd/docs/sys/shortcuts/   # skill.md, skill-brief.md
ls .tbd/docs/tbd/shortcuts/   # code-review-and-commit.md, etc.
ls .tbd/docs/spec/guidelines/  # typescript-rules.md, etc.

# Test lookups
tbd guidelines typescript-rules   # Should work (unqualified)
tbd guidelines spec:typescript-rules  # Should work (qualified)
tbd shortcut code-review-and-commit  # Should work
tbd reference --list  # Should show reference docs

# Cleanup
cd /
rm -rf "$TEST_DIR"
npm uninstall -g get-tbd
```

## Issues, Ambiguities, and Recommendations

The following issues were identified during the code-level review of the spec against
the current codebase.
They are ordered by severity/impact.

### Issue 1: `shortcut.ts` Doesn’t Use `DocCommandHandler` (Medium)

**Problem:** The shortcut command (`shortcut.ts`) has its own
`ShortcutHandler extends BaseCommand` with ~280 lines of duplicated logic for listing,
querying, text wrapping, etc.
Meanwhile `guidelines.ts` and `template.ts` properly extend `DocCommandHandler`.

**Impact:** The prefix-aware loading logic needs to be in one place.
Without unifying the commands first, the shortcut command will need separate prefix
support.

**Recommendation:** Add a prerequisite step to Phase 2 or Phase 3 to refactor
`shortcut.ts` to use `DocCommandHandler`. The shortcut-specific behavior (agent header,
category filtering, refresh mode, `shortcut-explanation` no-query fallback) can be
handled via method overrides.

### Issue 2: `lookup_path` Is Shortcut-Only, Not Per-Doc-Type (Low)

**Problem:** The current `docs_cache.lookup_path` in config only applies to shortcuts
(the shortcut command reads it).
Guidelines and templates use hardcoded `DEFAULT_GUIDELINES_PATHS` and
`DEFAULT_TEMPLATE_PATHS`. The spec says “Removed docs_cache.lookup_path: replaced by
prefix system” but doesn’t detail how per-doc-type path resolution works with the prefix
system.

**Impact:** Low — the prefix system naturally replaces this by having each source
declare which doc types it provides (via `paths`), and each command scanning
`.tbd/docs/{prefix}/{type-dir}/` for all relevant prefixes.

**Recommendation:** Already addressed by the design.
The `paths` array in each source declaration replaces `lookup_path`. No action needed
beyond what’s already in the spec, but the implementation should be clear that each doc
command derives its search paths from the sources array.

### Issue 3: `MigrationResult` Missing `warnings` Field (Low)

**Problem:** The spec’s test code expects `result.warnings` but the current
`MigrationResult` type only has `changes: string[]`. There is no `warnings` field.

**Impact:** Test code won’t compile.

**Recommendation:** Add `warnings: string[]` to `MigrationResult`. This is already shown
in the migration function code but not called out as a schema change.

### Issue 4: `@github/slugify` Dependency Is Overkill (Low)

**Problem:** The spec mentions using `@github/slugify` npm package for URL
slugification. This package is designed for title → URL slug conversion, not URL →
filesystem path.
The actual transformation needed is simple: `github.com/jlevy/speculate`
→ `github.com-jlevy-speculate` (just replace `/` with `-`).

**Impact:** Unnecessary dependency.

**Recommendation:** Implement the slug function directly in `repo-url.ts` (~5 lines of
code). No external dependency needed.

### Issue 5: `shortcuts/custom/` Path Not Addressed in Migration (Low)

**Problem:** Users who added shortcuts via `--add` have entries like
`shortcuts/custom/my-shortcut.md: https://example.com/...` in their config.
The migration logic identifies “default” entries as those where
`source === 'internal:' + dest`. Custom URL entries will correctly be preserved in
`files:` overrides.

**Impact:** None if the heuristic is `source.startsWith('internal:')` → default,
anything else → custom.
But `shortcuts/custom/` as a destination path doesn’t map to any prefix in the new
system.

**Recommendation:** During migration, preserve custom `files:` entries as-is.
They’ll be written to `.tbd/docs/{dest}` outside the prefix directories.
The `files:` lookup should check these paths with highest precedence.
This is already described in the spec but should be tested explicitly.

### Issue 6: `DocCache` Flat Directory Scanning — RESOLVED

**Problem (original):** `DocCache.loadDirectory()` currently scans single flat
directories. The new prefix-based storage is nested:
`.tbd/docs/{prefix}/{type}/{name}.md`.

**Resolution:** `DocCache` should be generalized to accept a base dir, a list of source
names (prefixes), and the doc type(s) to load.
It constructs paths as `{baseDir}/{name}/{docType}/` and scans each.
This preserves ordered-path semantics (earlier sources = higher precedence).

```typescript
// New constructor:
constructor(
  baseDir: string,          // .tbd/docs/
  sourceNames: string[],    // ['sys', 'tbd', 'spec'] (in precedence order)
  docTypes: string[],       // ['shortcuts'] or ['guidelines'] etc.
)

// Constructs and scans:
// .tbd/docs/sys/shortcuts/
// .tbd/docs/tbd/shortcuts/
// .tbd/docs/spec/shortcuts/
```

The `sourceNames` are the prefix values from the sources array.
The `docTypes` are the directory names from the doc-types registry.
Each command passes the appropriate doc type(s) for its domain.

### Issue 7: Shallow Clone + Sparse Checkout Git Commands (Low)

**Problem:** The spec shows `git clone --depth 1 --filter=blob:none --sparse`. Using
both `--depth 1` and `--filter=blob:none` is redundant.
`--depth 1` already limits the clone to the latest commit with all blobs for that
commit. `--filter=blob:none` creates a partial clone that fetches blobs on demand, which
is useful for full-history clones but not for depth-1 clones.

**Impact:** Minor — the clone will work either way.

**Recommendation:** Use `git clone --depth 1 --sparse --branch <ref> <url>` (without
`--filter=blob:none`). For updates, use `git fetch --depth 1 origin <ref>` followed by
`git checkout FETCH_HEAD`, since a shallow clone may not be able to do `git pull` for
arbitrary refs.

### Issue 8: `tbd sync --docs` vs `tbd setup --auto` for First-Time Checkout (Low)

**Problem:** The spec doesn’t explicitly clarify whether `tbd sync --docs` handles
first-time repo checkout or if that’s only done during `tbd setup --auto`.

**Impact:** User experience — if someone adds a new source to config.yml manually and
runs `tbd sync --docs`, it should clone the repo.

**Recommendation:** `tbd sync --docs` should handle first-time checkout.
`tbd setup --auto` should also run doc sync.
Both paths should use the same underlying `RepoCache.ensureRepo()`.

### Issue 9: Config YAML Field Ordering (Low)

**Problem:** YAML output field ordering matters for readability.
The spec doesn’t specify the order of fields when writing the new `sources` array to
config.yml.

**Impact:** Readability of config.yml.

**Recommendation:** Use a YAML serializer that preserves insertion order.
Write fields in this order: `type`, `prefix`, `hidden` (if true), `url` (if repo), `ref`
(if repo), `paths`. This matches the spec examples and reads naturally.

### Issue 10: Internal Source Bundled Doc Paths — RESOLVED

**Problem (original):** For `type: internal` sources, the `paths` field alone isn’t
sufficient since bundled docs currently live at `shortcuts/system/` and
`shortcuts/standard/`.

**Resolution:** `sys:` and `tbd:` (or `std:`) are both `type: internal` sources that use
the same mechanism as external repos.
The bundled docs directory structure should be reorganized to match the prefix
convention:

```
packages/tbd/docs/
  sys/                  # System docs (prefix: sys, hidden)
    shortcuts/
      skill.md
      skill-brief.md
      shortcut-explanation.md
  tbd/                  # tbd-specific docs (prefix: tbd)
    shortcuts/
      code-review-and-commit.md
      implement-beads.md
      ...
    guidelines/         # tbd-specific guidelines (if any)
      tbd-sync-troubleshooting.md
```

This way `type: internal` sources work identically to `type: repo` sources — the
`prefix` field directly maps to a subdirectory name under both the bundled docs root AND
`.tbd/docs/`. No special mapping code needed.
The bundled docs restructuring should be done in Phase 1 alongside the format migration.

### Issue 11: Most Shortcuts Are tbd-Specific (Informational)

**Finding:** From analyzing the bundled shortcuts, 24 out of 29 standard shortcuts
reference `tbd` commands and are tbd-specific.
Only 5 are general-purpose:

- `checkout-third-party-repo.md`
- `code-cleanup-docstrings.md`
- `merge-upstream.md`
- `new-validation-plan.md`
- `revise-architecture-doc.md`

**Impact:** The `spec` prefix source will primarily provide **guidelines** (26 files)
and **templates** (3 files), not shortcuts.
Most shortcuts stay in `tbd`.

**Recommendation:** This is fine for the design — the prefix system handles it
correctly. But Phase 5 (Speculate Migration) should note that only ~5 shortcuts move to
Speculate, while the bulk of what moves is guidelines.
The doc classification table in the spec (prefix → doc types → examples) should be
updated to reflect this.

### Issue 12: `generateShortcutDirectory()` Needs Update (Low)

**Problem:** The `generateShortcutDirectory()` function in `doc-cache.ts` generates the
markdown table of shortcuts/guidelines that appears in skill files.
It currently hardcodes skip names (`skill`, `skill-brief`, `shortcut-explanation`). With
the `hidden` source concept, hidden sources should be automatically excluded instead.

**Impact:** The function needs to be aware of which docs come from hidden sources.

**Recommendation:** Pass `hidden` information through `CachedDoc` (add `hidden: boolean`
field) and filter hidden docs in `generateShortcutDirectory()` instead of hardcoding
names.

### Issue 13: Test Strategy Gaps (Medium)

**Problem:** The spec describes unit and integration tests but doesn’t address:
- How to test `RepoCache` without network access (unit tests)
- How to mock git operations in tests
- Whether existing tests in `doc-sync.test.ts` and `doc-cache.test.ts` need updating

**Recommendation:**

For `RepoCache` unit tests, use `git init --bare` to create local test repositories:

```typescript
// In test setup
const testRepo = await createTestRepo({
  'guidelines/test-guide.md': '---\ntitle: Test\n---\n# Test',
  'shortcuts/test-shortcut.md': '---\ntitle: Shortcut\n---\n# SC',
});

// Test sparse checkout against local repo
const cache = new RepoCache(tmpDir);
await cache.ensureRepo(`file://${testRepo}`, 'main', ['guidelines/']);
```

Existing tests (`doc-sync.test.ts`, `doc-cache.test.ts`, `tbd-format.test.ts`) need
updates for the new format, schemas, and prefix-based paths.

## References

- Current doc sync implementation:
  [doc-sync.ts](../../packages/tbd/src/file/doc-sync.ts)
- Config schema: [schemas.ts](../../packages/tbd/src/lib/schemas.ts)
- Related spec: plan-2026-01-26-configurable-doc-cache-sync.md
- Speculate repo: https://github.com/jlevy/speculate
- rust-porting-playbook: https://github.com/jlevy/rust-porting-playbook
- Local checkouts: attic/speculate/, attic/rust-porting-playbook/

* * *

## Engineering Review Notes (2026-02-08)

### What the spec gets right

1. **Git sparse checkout approach is solid** - correct choice over submodules, npm
   packages, or API-only fetching.
   Works with any git host.
2. **Format version bump is necessary and well-reasoned** - the Zod `strip()` data loss
   scenario is real and the forward compatibility protection is important.
3. **Source precedence model is clean** - source order = precedence is simple and
   predictable.
4. **Per-project cache** is appropriate for isolation.
5. **Migration pattern documentation** is thorough and will serve as a template for
   future migrations.
6. **Alternatives analysis** is complete and well-reasoned.

### Design evolution

An earlier draft of this spec used optional `namespace:` fields and `->` path mapping
syntax. The finalized version above replaces these with the **prefix-based design**,
which is a cleaner approach:

- **Prefix replaces namespace** - mandatory `prefix:` on all sources provides collision
  avoidance by construction (each source syncs to its own `{prefix}/` directory)
- **Prefix replaces path mapping** - the new `references/` doc type and flat
  `{type}/{name}.md` convention eliminates the need for `->` mapping syntax
- **Doc type registry** (`DOC_TYPES`) centralizes type definitions, replacing scattered
  path constants

The review identified these issues in the earlier draft, all now addressed by the prefix
redesign:

1. Non-standard doc types (e.g., `reference/`) - now a first-class doc type
2. Name collision avoidance - now handled by prefix-based namespacing
3. `tbd source add` CLI - deferred to Future Work (prefix system makes manual config
   simpler)
4. Cache directory naming - now uses `@github/slugify` for readable slugs
5. Lookup for namespaced subdirectories - prefix-based lookup eliminates this concern

### Remaining risks

1. **Sparse checkout compatibility** - `git sparse-checkout` behavior varies across git
   versions (requires Git 2.25+). Need to verify minimum git version and provide helpful
   error messages.

2. **Sync performance with many sources** - Each repo source requires a `git fetch` on
   sync. With many sources, this could make `tbd sync` slow.
   Consider parallel fetches and/or a `--offline` flag to skip repo updates.

3. **Config file growth** - The `files:` section in config.yml already lists 50+
   entries. The automatic config conversion (f03 → f04 migration) addresses this by
   replacing verbose `files:` entries with concise `sources:` entries.

4. **Speculate migration is a large scope** - Phase 5 essentially restructures an entire
   external project. Consider treating it as a separate spec with its own timeline.

* * *

## Appendix: Relationship to Agent Skills Ecosystem (skills.sh, SKILL.md, agentskills.io)

### Overview of the Agent Skills Ecosystem (as of Feb 2026)

The agent skills ecosystem has three key components:

1. **Agent Skills Open Standard** ([agentskills.io](https://agentskills.io)) -
   Originally developed by Anthropic and released as an open standard.
   Defines the SKILL.md format: YAML frontmatter (`name`, `description`, `license`,
   `compatibility`, `metadata`, `allowed-tools`) + markdown body.
   Adopted by 27+ agent products including Claude Code, Cursor, GitHub Copilot, Codex,
   Gemini CLI, Windsurf, Goose, and others.

2. **skills.sh** ([skills.sh](https://skills.sh)) - Vercel’s open ecosystem for
   discovering and installing skills.
   Functions as “npm for agents.”
   CLI: `npx skills add <owner/repo>`. Installs SKILL.md files to `.agents/skills/` and
   symlinks to agent-specific directories (`.claude/skills/`, `.cursor/skills/`, etc.).
   Hosts a leaderboard with 47K+ total installations tracked.

3. **Anthropic Skills Repo**
   ([github.com/anthropics/skills](https://github.com/anthropics/skills)) - Reference
   implementations of Agent Skills (65K+ stars).
   Skills for document creation (docx, pdf, pptx, xlsx), creative workflows, and
   technical tasks.

### How tbd Relates to This Ecosystem

tbd and the Agent Skills ecosystem operate at **different levels of the progressive
disclosure hierarchy** defined by the Agent Skills spec:

| Level | What | Token Budget | Example |
| --- | --- | --- | --- |
| Level 1 | Metadata (name + description) | ~100 tokens | tbd's skill description in system prompt |
| Level 2 | Skill body (SKILL.md) | <5K tokens | tbd's SKILL.md with workflow docs |
| **Level 3** | **Resources (loaded on demand)** | **Unlimited** | **tbd's guidelines, shortcuts, templates** |

**Key insight:** tbd itself is already an Agent Skill (Level 1-2). It has a SKILL.md
installed in `.claude/skills/tbd/`. The external docs repos feature adds **Level 3
resources** — the domain knowledge that tbd’s meta-skill references via CLI commands
like `tbd guidelines X`.

The Agent Skills spec explicitly supports this pattern:

> "Skills should be structured for efficient use of context … Files (e.g. those in
> `scripts/`, `references/`, or `assets/`) are loaded only when required."

tbd’s `tbd guidelines X` and `tbd shortcut X` commands are exactly this — on-demand
Level 3 resource loading.

### Comparison: skills.sh vs tbd source add

| Aspect | skills.sh (`npx skills add`) | tbd (`tbd source add`) |
| --- | --- | --- |
| **Content type** | SKILL.md files (agent capabilities) | Guidelines, shortcuts, templates (domain knowledge) |
| **Disclosure level** | Level 1-2 (metadata + instructions) | Level 3 (on-demand resources) |
| **Install model** | One-time file copy to `.agents/skills/` | Ongoing git sync to `.tbd/docs/` |
| **Updates** | `npx skills update` (manual) | `tbd sync` (auto or manual) |
| **Discovery** | Browse skills.sh leaderboard | `tbd guidelines --list`, `tbd shortcut --list` |
| **Cross-agent** | Installs to multiple agent directories | Agent-agnostic (CLI-based access) |
| **Namespace** | By owner/repo (`vercel-labs/skills`) | Prefix-based (`prefix:name` syntax) |
| **Path mapping** | Not needed (fixed SKILL.md format) | Not needed (prefix-based flat structure) |
| **Manifest** | SKILL.md frontmatter IS the manifest | Config `sources:` array |
| **Source** | GitHub repos | GitHub repos (same) |

### What tbd Should Learn from skills.sh

1. **The `npx skills add` UX is excellent** — single command, interactive selection,
   works across agents.
   tbd’s future `tbd source add` should match this level of polish.
   The interactive flow (clone → discover → prompt to confirm → install) is the right
   pattern.

2. **GitHub repos as distribution** — Both systems use GitHub repos as the primary
   distribution mechanism.
   This is the right choice for documentation and skill content.
   No need for a separate registry or package manager.

3. **The leaderboard/discovery model** — skills.sh tracks install counts and provides
   trending/popular lists.
   tbd could eventually have a curated index of doc repos ("awesome-tbd-docs" or
   similar), but this isn’t needed for Phase 1.

4. **Cross-agent output directories** — skills.sh installs to multiple agent-specific
   directories. tbd’s approach is inherently more portable since it uses CLI-based access
   rather than file-based skill loading.
   Any agent that can run `tbd guidelines X` gets the knowledge, regardless of its skill
   directory conventions.

5. **Frontmatter compatibility** — The Agent Skills spec standardizes `name`,
   `description`, `license`, `metadata`. tbd’s doc frontmatter (`title`, `description`,
   `author`, `category`) is similar but not identical.
   Consider aligning where possible:
   - `title` ↔ `name` (same concept, different field name)
   - `description` ↔ `description` (identical)
   - `author` ↔ `metadata.author`
   - `category` → `metadata.category`

### What’s Different and Why tbd Needs Its Own Approach

1. **Ongoing sync vs one-time install** — skills.sh copies files once; tbd needs ongoing
   sync because doc repos evolve (new guidelines added, existing ones refined).
   This is the fundamental architectural difference: skills are static capabilities,
   while tbd docs are living knowledge.

2. **Prefix-based namespacing** — skills.sh namespaces by owner/repo at the repository
   level. tbd uses mandatory prefix-based namespacing where each source has its own
   `{prefix}/` directory, providing collision-safe storage by construction.

3. **CLI-based access model** — skills.sh files are loaded directly by agents from the
   filesystem. tbd docs are accessed via CLI commands (`tbd guidelines X`), which
   provides better context management (agents get exactly the doc they need, not all
   docs at once). This is the “meta-skill” pattern documented in our
   `research-skills-vs-meta-skill-architecture.md`.

### Are They Complementary or Competing?

**Complementary.** They solve different problems:

- **skills.sh** answers: "How do I give my agent the *ability* to do X?" (e.g., create
  PDFs, run data analysis, follow design patterns)
- **tbd source add** answers: "How do I give my agent *knowledge* about X?" (e.g., Rust
  porting rules, TypeScript best practices, project-specific conventions)

A project could use both:

```bash
# Install agent capabilities via skills.sh
npx skills add anthropics/skills          # PDF creation, etc.
npx skills add vercel-labs/agent-skills   # Design patterns, etc.

# Install domain knowledge via tbd
tbd source add github.com/jlevy/rust-porting-playbook   # Rust porting expertise
tbd source add github.com/jlevy/speculate               # General coding guidelines
```

The skills give agents new capabilities; tbd’s docs give agents domain expertise to use
those capabilities well.

### Future Integration Considerations

1. **tbd as a skills.sh-listed skill** — tbd itself (the meta-skill) could be listed on
   skills.sh for discovery.
   Users would find tbd via skills.sh, install it with `npx skills add`, and then use
   `tbd source add` for domain knowledge repos.

2. **Doc repos as skills.sh entries** — Individual doc repos (like
   rust-porting-playbook) could potentially be listed on skills.sh as “knowledge
   skills.” This would require each doc repo to have a SKILL.md that describes its
   contents and instructs agents to use `tbd guidelines X` to access them.
   This is a natural evolution but not a Phase 1 concern.

3. **Shared frontmatter standard** — If the Agent Skills spec evolves to support
   “resource-type” skills (not just capability skills), tbd could adopt the standard
   frontmatter format directly.
   Monitor the agentskills.io spec for evolution.

4. **Registry/index for doc repos** — skills.sh has a centralized leaderboard.
   tbd could eventually maintain a similar index of doc repos, or simply piggyback on
   skills.sh’s discovery mechanism.
   A simple GitHub-based “awesome list” is sufficient to start.

### References

- Agent Skills Specification: https://agentskills.io/specification
- skills.sh CLI: https://github.com/vercel-labs/skills
- skills.sh Directory: https://skills.sh
- Anthropic Skills Repo: https://github.com/anthropics/skills
- Vercel announcement:
  https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem
- tbd CLI-as-skill research:
  [research-cli-as-agent-skill.md](../../research/current/research-cli-as-agent-skill.md)
- tbd skills architecture research:
  [research-skills-vs-meta-skill-architecture.md](../../research/current/research-skills-vs-meta-skill-architecture.md)
