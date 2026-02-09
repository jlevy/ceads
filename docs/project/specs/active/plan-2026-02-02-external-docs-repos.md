---
title: External Docs Repos
description: Pull shortcuts, guidelines, templates, and references from external git repositories
---
# Feature: External Docs Repos

**Date:** 2026-02-02 (last updated 2026-02-08)

**Status:** Draft

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
  type: z.enum(['internal', 'repo']),
  prefix: z.string().min(1).max(16).regex(/^[a-z0-9-]+$/),
  url: z.string().optional(),           // Required for type: repo
  ref: z.string().optional(),            // Defaults to 'main' for repos
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

### Phase 0: Speculate Prep (Do First)

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

### Phase 3: New Reference Type and CLI

- [ ] Add `reference` to DOC_TYPES registry
- [ ] Create `tbd reference` command (follows same pattern as guidelines/template)
- [ ] Update doc command handler to use doc-types registry
- [ ] Simplify existing commands (shortcut, guidelines, template) to use registry
- [ ] Remove hardcoded path constants from `paths.ts`
- [ ] Add `tbd doctor` checks for repo cache health

### Phase 3b: Documentation Update

Update all tbd documentation to reflect the new architecture:

- [ ] Update `docs/development.md` with new doc structure
- [ ] Update `docs/docs-overview.md` with prefix system
- [ ] Update skill.md with new `tbd reference` command
- [ ] Update skill-brief.md shortcut/guideline directory info
- [ ] Review and update all shortcuts that reference doc paths
- [ ] Update README if it references doc structure
- [ ] Add migration guide for users with custom doc configs

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

**Phase 0: Speculate Prep**

1. Create Speculate `tbd` branch with flat `{type}/{name}.md` structure
2. This becomes the integration test target for all subsequent phases

**Phase 1: Core Infrastructure**

3. Implement doc-types registry, repo-url utility, format bump
4. Implement prefix-based storage and sync

**Phase 2: Prefix System and Lookup**

5. Implement qualified (`prefix:name`) and unqualified lookup
6. Add hidden source support
7. Test against Speculate `tbd` branch

**Phase 3: New Reference Type and CLI**

8. Add `tbd reference` command
9. Simplify existing commands to use doc-types registry

**Phase 3b: Documentation Update**

10. Update all tbd docs to reflect new architecture
11. Add migration guide for users

**Phase 4: Validation**

12. Run validation script comparing all output with `get-tbd@latest`
13. Document intentional differences, fix unintentional ones

**Phase 4b: Fresh Install E2E**

14. Fresh install test with prefix-based sources
15. Test qualified and unqualified lookups
16. All tests must pass before proceeding

**Phase 5: Speculate Migration (Finalize)**

17. Merge Speculate `tbd` → `main`
18. Update tbd default config to use Speculate `main`
19. Remove duplicated general docs from tbd bundled set
20. Release new tbd version

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

## Future Work

**CLI commands for managing sources** (not in initial implementation):

```bash
# Add a repo source with prefix
tbd source add github.com/org/guidelines --prefix myorg

# Add with specific ref
tbd source add github.com/org/guidelines --prefix myorg --ref v2.0

# List configured sources with prefixes
tbd source list

# Remove a source by prefix
tbd source remove myorg
```

These commands would:
- Require `--prefix` for new sources
- Validate prefix is unique
- Default `ref` to `main` but always write it explicitly to config.yml
- Validate the repo is accessible before adding

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
