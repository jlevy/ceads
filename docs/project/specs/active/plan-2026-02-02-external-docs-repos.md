---
title: External Docs Repos
description: Pull shortcuts, guidelines, and templates from external git repositories
---
# Feature: External Docs Repos

**Date:** 2026-02-02 (last updated 2026-02-08)

**Status:** Draft (under review)

## Overview

Enable tbd to pull documentation (shortcuts, guidelines, templates) from external git
repositories, in addition to the current bundled internal docs.
This allows:

- Community-maintained docs that evolve independently of tbd releases
- Project-specific doc repos that can be shared across teams
- "Bleeding edge" guidelines that update more frequently than tbd npm releases
- Potential simplification by moving general-purpose docs out of the tbd codebase
- **Domain-specific knowledge repos** (e.g., Rust porting playbooks, security checklists)
  that teams can opt into per-project with a single command

## Goals

- Allow configuring external git repos as doc sources
- Support selective sync (only certain folders/types from a repo)
- Maintain backward compatibility with existing `internal:` and URL sources
- Make sync work seamlessly with repo sources (checkout on first sync, pull on
  subsequent)
- Keep configuration simple and declarative
- **Single CLI command** to add a knowledge repo so that `tbd sync` immediately includes
  all its docs
- **Optional namespacing** to avoid collisions when multiple repos provide docs with
  similar names
- **Path mapping** so repos with non-standard structures (e.g., `reference/` instead of
  `guidelines/`) can still be integrated cleanly

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

1. **URL sources require per-file enumeration** - Can't say "all guidelines from this
   repo"
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

### Real-World Use Case: rust-porting-playbook

The [rust-porting-playbook](https://github.com/jlevy/rust-porting-playbook) repo
demonstrates the primary use case for this feature. It contains:

```
rust-porting-playbook/
  guidelines/           # 6 files, compact AI-optimized rules (~2-3K tokens each)
    rust-general-rules.md
    python-to-rust-porting-rules.md
    rust-cli-app-patterns.md
    rust-project-setup.md
    python-to-rust-cli-porting.md
    test-coverage-for-porting.md
  reference/            # 8 files, comprehensive guides/playbooks
    python-to-rust-playbook.md
    python-to-rust-mapping-reference.md
    rust-cli-best-practices.md
    rust-code-review-checklist.md
    ...
  case-studies/         # 8 files, real-world porting examples
    flowmark/
      flowmark-port-analysis.md
      flowmark-port-decision-log.md
      ...
```

**Key observations from this use case:**

1. **Already designed for tbd** - README explicitly shows `tbd guidelines <name>` commands
2. **Guidelines have proper frontmatter** (title, description) matching tbd format
3. **Guidelines reference other tbd guidelines** (e.g., "see `tbd guidelines
   rust-cli-app-patterns`")
4. **Only `guidelines/` maps directly** to tbd's existing structure - `reference/` and
   `case-studies/` are doc types not currently handled
5. **No manifest file** - tbd must auto-discover docs by scanning directories

The desired end-to-end workflow:

```bash
# One command to add the repo
tbd source add github.com/jlevy/rust-porting-playbook

# Sync pulls all docs
tbd sync

# Immediately available
tbd guidelines rust-general-rules
tbd guidelines python-to-rust-playbook   # from reference/
tbd guidelines --list                     # shows all including new ones
```

This use case reveals that the spec must handle **path mapping** (mapping `reference/`
docs into tbd's `guidelines/` category) and **namespace collision avoidance** (what if
two repos both provide `rust-general-rules.md`?).

## Design

### Approach

Add a new source type: `repo:` sources that specify a git repository, branch/tag, and
path pattern. On sync:

1. Check out or update the repo (shallow clone to repo cache - see Cache Location)
2. Scan for matching docs based on path pattern
3. Map source paths to tbd doc categories
4. Sync matching files to `.tbd/docs/`, optionally namespaced

### Proposed Config Format

```yaml
docs_cache:
  # Sources in precedence order (earlier wins on conflicts)
  sources:
    # Built-in tbd docs (highest precedence - tbd-specific shortcuts, system docs)
    - type: internal
      paths:
        - shortcuts/system/        # system shortcuts
        - shortcuts/standard/      # tbd-specific shortcuts (code-review-and-commit, etc.)

    # Speculate repo for general guidelines, shortcuts, templates
    - type: repo
      url: github.com/jlevy/speculate
      ref: main
      paths:
        - guidelines/
        - shortcuts/standard/
        - templates/

    # Domain knowledge repo with path mapping and namespace
    - type: repo
      url: github.com/jlevy/rust-porting-playbook
      ref: main
      namespace: rust-porting         # Optional: prefix to avoid collisions
      paths:
        - guidelines/                 # -> guidelines/rust-porting/ (namespaced)
        - reference/ -> guidelines    # -> guidelines/rust-porting/ (mapped + namespaced)

  # Per-file overrides (highest precedence, applied after sources)
  files:
    guidelines/custom.md: https://example.com/custom.md
```

**Key design decisions:**

1. **Source order IS the precedence** - no separate `lookup_path` needed
2. **Path mapping with `->` syntax** - `reference/ -> guidelines` maps source dir to tbd
   category
3. **Optional `namespace:`** - creates a subdirectory for the source's docs to avoid
   collisions
4. **`ref` is always explicit** in config.yml for clarity

### Namespace Design

The `namespace` field on a repo source controls where files land in `.tbd/docs/`:

**Without namespace** (flat):

```yaml
- type: repo
  url: github.com/jlevy/speculate
  paths:
    - guidelines/              # -> .tbd/docs/guidelines/typescript-rules.md
```

**With namespace:**

```yaml
- type: repo
  url: github.com/jlevy/rust-porting-playbook
  namespace: rust-porting
  paths:
    - guidelines/              # -> .tbd/docs/guidelines/rust-porting/rust-general-rules.md
    - reference/ -> guidelines # -> .tbd/docs/guidelines/rust-porting/python-to-rust-playbook.md
```

**Lookup behavior with namespaces:**

- **Exact match with namespace**: `tbd guidelines rust-porting/rust-general-rules`
- **Fuzzy match by name**: `tbd guidelines rust-general-rules` (finds it if name is
  unique)
- **List shows namespace**: `tbd guidelines --list` shows
  `rust-porting/rust-general-rules`

This matches how file lookup already works in `DocCache` - it scans directories
recursively and matches against filenames. The namespace is just a subdirectory, so
existing fuzzy search handles it naturally.

**When to use namespaces:**

- **Speculate**: No namespace needed (it's the canonical source for general docs)
- **Domain repos** (rust-porting-playbook, security-checklists): Use namespace to avoid
  collisions with other sources
- **Org-specific repos**: Optionally namespace to distinguish from community docs

**Default behavior for `tbd source add`**: When adding a repo that already has docs with
names that would collide with existing ones, tbd should **suggest a namespace** (derived
from the repo name by default, e.g., `rust-porting-playbook` -> `rust-porting`). The
user can accept, modify, or skip namespacing.

### Path Mapping

External repos don't always follow tbd's directory conventions. Path mapping allows
mapping source directories to tbd's standard categories:

```yaml
paths:
  - guidelines/                    # Identity: guidelines/ -> guidelines/
  - shortcuts/standard/            # Identity: shortcuts/standard/ -> shortcuts/standard/
  - reference/ -> guidelines       # Map: reference/ files become guidelines
  - playbooks/ -> guidelines       # Map: playbooks/ files become guidelines
  - workflows/ -> shortcuts        # Map: workflows/ files become shortcuts
```

**Rules:**

1. Bare path (`guidelines/`) = identity mapping (source dir name = dest category)
2. Arrow syntax (`reference/ -> guidelines`) = explicit mapping
3. Destination must be one of: `guidelines`, `shortcuts/standard`, `shortcuts/custom`,
   `templates`
4. If `namespace` is set, it's applied as a subdirectory under the destination

**Why these rules:** tbd's lookup system has fixed search paths
(`guidelines/`, `shortcuts/system/`, `shortcuts/standard/`, `templates/`). Mapping
external paths into these categories ensures docs are discoverable without changing the
runtime lookup logic. This is a significant simplification - the lookup code doesn't need
to know about external repos at all.

### Format Version Compatibility

This feature adds a new `sources` field to `docs_cache`, which requires a format version
bump from `f03` to `f04`. This ensures:

1. **Older tbd versions** see the unknown format and error with "format 'f04' is from a
   newer tbd version" rather than silently stripping the `sources` field
2. **Migration path** is clear: f03 configs without `sources` continue to work unchanged
3. **Forward safety**: Users mixing tbd versions get explicit upgrade prompts

Changes to `tbd-format.ts`:

```typescript
f04: {
  introduced: '0.1.X',  // TBD
  description: 'Adds external repo sources for docs',
  changes: [
    'Added docs_cache.sources: array for repo and internal doc sources',
    'Sources define bulk doc sync from git repos or internal bundled docs',
    'Removed docs_cache.lookup_path: now uses fixed search order',
  ],
  migration: 'Removes lookup_path, clears doc cache for fresh sync',
},
```

**Migration**: The migration function updates `tbd_format: f03` -> `tbd_format: f04` and
removes the deprecated `lookup_path` field.
Existing `docs_cache.files` continues to work as explicit overrides.
The `sources` field is optional and defaults to `[{ type: internal }]` for
backward-compatible behavior.

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
// During f03->f04 migration or source config changes:
if (formatChanged || sourcesConfigChanged) {
  // 1. Clear doc cache entirely
  await rm(join(tbdRoot, '.tbd/docs'), { recursive: true, force: true });

  // 2. Trigger fresh sync
  await syncDocsWithDefaults(tbdRoot, { quiet: false });
}
```

This is safe because `.tbd/docs/` is gitignored and can always be regenerated from
sources.

### Migration Pattern: Version-Only Bump

This is the first "version-only" migration in tbd - where we bump the format version
without transforming any data.
This pattern is needed when:

1. **Adding optional fields** that older versions would silently strip (Zod's `strip()`)
2. **No data transformation required** - old configs work as-is with new code
3. **Forward compatibility protection** - older tbd versions must reject the new format

**Why version-only migrations matter:**

Without bumping the format version, this scenario could occur:

1. User A runs tbd 0.2.0, adds `docs_cache.sources` to their config
2. User B (same repo) runs tbd 0.1.x, which doesn't know about `sources`
3. Zod's `strip()` silently removes the `sources` field when parsing
4. User B runs `tbd setup` or any config-writing operation
5. The `sources` config is lost - User A's changes are silently destroyed

By bumping to f04, step 3 instead produces: "format 'f04' is from a newer tbd version.
Please upgrade: npm install -g get-tbd@latest"

**Implementation checklist:**

When adding a version-only migration, update these locations in `tbd-format.ts`:

```typescript
// 1. Add to FORMAT_HISTORY
f04: {
  introduced: '0.1.X',
  description: 'Adds external repo sources, removes lookup_path',
  changes: [
    'Added docs_cache.sources: array for repo and internal doc sources',
    'Sources define bulk doc sync from git repos or internal bundled docs',
    'Removed docs_cache.lookup_path: now uses fixed search order',
  ],
  migration: 'Removes lookup_path, clears doc cache for fresh sync',
},

// 2. Implement migration function
function migrate_f03_to_f04(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f04';
  changes.push('Updated tbd_format: f04');

  // Remove deprecated lookup_path (now uses fixed search order)
  if (migrated.docs_cache?.lookup_path) {
    delete migrated.docs_cache.lookup_path;
    changes.push('Removed deprecated lookup_path (now uses fixed search order)');
  }

  return {
    config: migrated,
    fromFormat: 'f03',
    toFormat: 'f04',
    changed: true,
    changes,
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
  descriptions.push('f03 -> f04: Add external repo sources, remove lookup_path');
  current = 'f04';
}
```

**Testing version-only migrations:**

```typescript
it('should migrate f03 to f04 and remove lookup_path', () => {
  const oldConfig = {
    tbd_format: 'f03',
    tbd_version: '0.1.6',
    docs_cache: {
      files: { 'guidelines/foo.md': 'internal:guidelines/foo.md' },
      lookup_path: ['.tbd/docs/shortcuts/system'],  // deprecated in f04
    },
  };

  const result = migrateToLatest(oldConfig);

  expect(result.changed).toBe(true);
  expect(result.config.tbd_format).toBe('f04');
  expect(result.changes).toContain('Updated tbd_format: f04');
  expect(result.changes).toContain('Removed deprecated lookup_path (now uses fixed search order)');
  // lookup_path should be removed
  expect(result.config.docs_cache.lookup_path).toBeUndefined();
  // files should be preserved
  expect(result.config.docs_cache.files).toEqual(oldConfig.docs_cache.files);
});

it('should reject f04 config on older tbd version', () => {
  // This test runs against the f03 codebase to verify forward compatibility
  const futureConfig = { tbd_format: 'f04', /* ... */ };
  expect(isCompatibleFormat('f04')).toBe(false);
});
```

### Repo Structure Convention

External repos can follow tbd's standard structure **or** use path mapping to adapt their
own structure.

**Preferred structure** (no path mapping needed):

```
repo-root/
  guidelines/
    typescript-rules.md
    python-rules.md
  shortcuts/
    standard/
      my-shortcut.md
  templates/
    my-template.md
```

**Alternative structure** (uses path mapping):

```
repo-root/
  guidelines/           # maps directly
  reference/            # -> guidelines (via path mapping)
  case-studies/         # -> guidelines (via path mapping, or excluded)
  workflows/            # -> shortcuts/standard (via path mapping)
```

Front matter is optional but recommended:

```yaml
---
title: My Shortcut
description: Does something useful
category: workflow
# Optional: declares tbd dependency (for validation/documentation)
requires_tbd: true
---
```

### Optional Repo Manifest (tbd-docs.yml)

External repos can optionally include a `tbd-docs.yml` manifest that declares how their
docs should be integrated. This is a convenience for repo authors - tbd reads this file
during `tbd source add` to auto-configure path mapping:

```yaml
# tbd-docs.yml in repo root
name: rust-porting-playbook
description: Comprehensive playbook for porting applications to Rust
suggested_namespace: rust-porting

# Declare how paths map to tbd categories
paths:
  - guidelines/                    # identity: guidelines -> guidelines
  - reference/ -> guidelines       # map reference docs as guidelines
  # case-studies/ omitted = not synced by default

# Optional: recommended docs to load first
entry_points:
  - guidelines/rust-general-rules.md
  - reference/python-to-rust-playbook.md
```

When `tbd source add github.com/jlevy/rust-porting-playbook` is run:

1. Clone the repo (shallow)
2. Check for `tbd-docs.yml`
3. If found: use its path mappings and suggested namespace as defaults
4. If not found: auto-discover `guidelines/`, `shortcuts/`, `templates/` dirs
5. Prompt user to confirm (or use `--yes` to accept defaults)
6. Write source config to `.tbd/config.yml`
7. Run initial sync

This means repo authors can provide a good out-of-the-box experience without requiring
users to manually configure path mappings.

### Source Precedence

When the same destination path is specified by multiple sources:

1. Explicit `files:` entries (highest precedence, applied last)
2. Earlier sources in `sources:` array
3. Later sources (lowest precedence)

This allows users to override specific docs while pulling bulk from repos.

**Sync behavior:** During sync, sources are processed in order.
If a file path already exists (from an earlier source), it's skipped.
This means the first source to provide a file wins.

**Collision warning:** When a source provides a file that would be shadowed by a
higher-precedence source, tbd should log a warning (unless the source has a namespace,
in which case collisions are impossible within namespaced directories):

```
  Warning: guidelines/rust-general-rules.md from rust-porting-playbook
  shadowed by same file from speculate (higher precedence)
  Hint: Add namespace: rust-porting to avoid this collision
```

**Runtime lookup:** Uses a fixed search order for name resolution:
1. `.tbd/docs/shortcuts/system/` (tbd internals)
2. `.tbd/docs/shortcuts/standard/` (standard shortcuts)
3. `.tbd/docs/shortcuts/custom/` (user custom shortcuts)
4. `.tbd/docs/guidelines/` (guidelines, searched recursively including subdirs)
5. `.tbd/docs/templates/` (templates)

Since sync already resolved precedence, lookup just finds the first match in these
directories. Namespaced docs in subdirectories (e.g.,
`guidelines/rust-porting/rust-general-rules.md`) are found by the recursive scan.

### Checkout Strategy

**Why shallow clone (not worktree):**

tbd uses worktrees for the tbd-sync branch because that's a branch of the **same** repo.
External doc repos are completely separate git repositories - you can't worktree into a
different remote. Shallow clone is the correct approach for external repos.

**Primary: Git sparse checkout**

```bash
# In repo cache directory (e.g., .tbd/repo-cache/<url-hash>/)
git clone --depth 1 --filter=blob:none --sparse <url>
git sparse-checkout set <paths>
git pull  # on subsequent syncs
```

Advantages:

- Works with any git host (GitHub, GitLab, Bitbucket, self-hosted)
- Minimal storage (only needed paths via sparse checkout)
- Shallow clone (`--depth 1`) minimizes git history overhead
- Works offline after initial sync
- Proper versioning via refs (branch, tag, or commit)

**Fallback: GitHub API (if git unavailable)**

Use `gh api` or raw HTTP to fetch directory listings and files.
Limited to GitHub repos.

### Cache Location

Repo checkouts are stored per-project in `.tbd/repo-cache/` (gitignored).

**Cache key**: Use a readable directory name derived from the URL rather than a hash.
This makes debugging and manual inspection easier:

```
.tbd/
  repo-cache/           # Added to .tbd/.gitignore by setup
    jlevy-rust-porting-playbook/     # <owner>-<repo> from URL
      .git/             # shallow clone
      guidelines/       # sparse checkout
      reference/
    jlevy-speculate/
      .git/
      guidelines/
      shortcuts/
```

Name derivation: extract `<owner>/<repo>` from the URL, join with `-`, lowercase.
Handle collisions (different hosts with same owner/repo) by appending a short hash suffix
when needed.

This keeps each project isolated with its own cache.
The `tbd setup` command will add `repo-cache/` to `.tbd/.gitignore`.

### Sync Workflow

`tbd sync --docs` (or auto-sync):

1. For each `type: repo` source:
   a. Compute cache path from URL
   b. If not cached: sparse clone with specified paths
   c. If cached: `git fetch && git checkout <ref>`
   d. Scan for `.md` files matching path patterns
   e. Apply path mapping (e.g., `reference/` -> `guidelines/`)
   f. Apply namespace prefix if configured
   g. Add to sync manifest

2. For `type: internal` source:
   a. Scan bundled docs (existing behavior)
   b. Add to sync manifest

3. Apply explicit `files:` overrides (URL or internal sources)

4. Sync all files to `.tbd/docs/` (existing DocSync logic)

5. Update config with discovered files (for transparency)

### Changes to Existing Code

**New files:**

- `src/file/repo-cache.ts` - Git sparse checkout operations
- `src/lib/repo-source.ts` - Repo source parsing, validation, path mapping
- `src/cli/commands/source.ts` - `tbd source add/list/remove` commands

**Modified files:**

- `src/lib/tbd-format.ts` - Add f04 format version with migration
- `src/lib/schemas.ts` - Add `DocsSourceSchema`, update `DocsCacheSchema`
- `src/file/doc-sync.ts` - Integrate repo sources, namespace support
- `src/cli/commands/sync.ts` - Handle repo checkout errors/progress
- `src/cli/lib/doc-cache.ts` - Recursive subdirectory scan for namespaced docs

### Error Handling

- **Network errors during checkout**: Warn and skip source, use cached if available
- **Invalid repo URL**: Error at config parse time
- **Missing ref**: Error with helpful message suggesting valid refs
- **Auth required**: Error with suggestion to use `gh auth login` or SSH
- **Path mapping target invalid**: Error at config parse time with valid options
- **Namespace collision** (two non-namespaced sources with same filename): Warn during
  sync, suggest namespace

## Alternatives Considered

### Alternative 1: Only URL Sources (No Git)

Enhance URL sources to support directory listing via GitHub API.

**Pros:** No git dependency, simpler implementation **Cons:** GitHub-only, rate limits,
no versioning, requires enumeration

**Verdict:** Too limiting for the stated goals.

### Alternative 2: npm Package Dependencies

Publish guideline packs as npm packages, install as dependencies.

**Pros:** Familiar pattern, versioning via npm **Cons:** Heavy for text files, requires
npm publish workflow, version lag

**Verdict:** Overkill for documentation files.

### Alternative 3: Git Submodules

Use git submodules for external doc repos.

**Pros:** Native git versioning **Cons:** Submodule UX is poor, requires user git
knowledge, complicates tbd's git usage

**Verdict:** Poor UX, conflicts with tbd's sync model.

## Implementation Plan

### Phase 1: Core Infrastructure + CLI

- [ ] Bump format version f03 -> f04 in `tbd-format.ts` (add FORMAT_HISTORY entry, update
  CURRENT_FORMAT, add migration function)
- [ ] Add `DocsSourceSchema` with repo type support to `schemas.ts`
  - Include `namespace`, `paths` with mapping syntax validation
- [ ] Update `DocsCacheSchema` to include optional `sources` array
- [ ] Implement `RepoCache` class for sparse checkouts (`repo-cache.ts`)
- [ ] Add path mapping logic (`reference/ -> guidelines` parsing and application)
- [ ] Update `DocSync` to handle repo sources with namespace/mapping
- [ ] Clear `.tbd/docs/` during migration (fresh sync after format or source changes)
- [ ] Implement `tbd source add <url>` command
  - Clone, check for `tbd-docs.yml`, auto-discover paths, suggest namespace
  - Write to config, run initial sync
- [ ] Implement `tbd source list` and `tbd source remove <url>`
- [ ] Add `--repos` flag to `tbd sync` for repo-only sync

### Phase 2: Integration and Polish

- [ ] Update `tbd setup` to configure default sources (Speculate)
- [ ] Update `tbd setup` to add `repo-cache/` to `.tbd/.gitignore`
- [ ] Handle source precedence correctly with collision warnings
- [ ] Add progress indicators for repo checkout
- [ ] Error handling and recovery
- [ ] Add `tbd doctor` checks for repo cache health
- [ ] Recursive subdirectory scan in DocCache for namespaced docs
- [ ] Test with rust-porting-playbook as integration test case

### Phase 3: Documentation and Examples

- [ ] Document repo structure conventions
- [ ] Document `tbd-docs.yml` manifest format
- [ ] Create example external guidelines repo
- [ ] Migration guide for moving docs to external repo
- [ ] Update tbd README with external docs section

### Phase 4: Speculate Migration

Make `jlevy/speculate` the upstream repo for general-purpose docs (guidelines, general
shortcuts, templates).
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

**tbd structure** (`packages/tbd/docs/`):

```
guidelines/             # All rules + guidelines merged
shortcuts/
  standard/             # User-invocable shortcuts
  system/               # Internal system shortcuts
templates/              # plan-spec.md, research-brief.md, etc.
```

**Key differences (current state -> will be resolved by migration):**

| Aspect | Speculate (current) | tbd | After Migration |
| --- | --- | --- | --- |
| Front matter | Minimal (`description`, `globs`) | Rich (`title`, `description`, `author`, `category`) | Speculate adopts tbd format |
| Shortcut refs | `@shortcut-precommit-process.md` | `tbd shortcut precommit-process` | Speculate uses tbd syntax |
| tbd references | None | "We track work as beads using tbd..." | Speculate uses tbd refs |
| Directory names | `agent-rules/`, `agent-shortcuts/` | `guidelines/`, `shortcuts/standard/` | Speculate adopts tbd structure |

#### Target State

Speculate becomes the canonical source for general docs.
tbd-specific docs remain in tbd.

**Document classification:**

| Category | Location | Examples |
| --- | --- | --- |
| General guidelines | Speculate | typescript-rules, python-rules, general-coding-rules |
| General shortcuts | Speculate | review-code, create-pr-simple, merge-upstream |
| tbd-specific shortcuts | tbd (internal) | code-review-and-commit, implement-beads, agent-handoff |
| Templates | Speculate | plan-spec, research-brief, architecture-doc |
| System shortcuts | tbd (internal) | skill.md, skill-brief.md |

**Speculate repo changes:**

1. **Adopt tbd's front matter format** - Add `title:`, `author:`, `category:` fields
2. **Rename directories** to match tbd expectations:
   - `agent-rules/` + `agent-guidelines/` -> `guidelines/`
   - `agent-shortcuts/` -> `shortcuts/standard/`
   - Templates -> `templates/`
3. **Remove shortcut prefix** from filenames: `shortcut-commit-code.md` ->
   `commit-code.md`
4. **Use tbd-style references**: e.g., `tbd shortcut review-code`,
   `tbd guidelines typescript-rules` (Speculate docs assume tbd is available -
   simplifies implementation, no translation needed)
5. **Add `tbd-docs.yml` manifest** for automatic integration

**tbd changes:**

1. **Remove duplicated general docs** from `packages/tbd/docs/`
2. **Keep tbd-specific docs** that reference `tbd` commands
3. **Configure Speculate as default source** in setup

#### Shortcut Reference Syntax

Speculate docs use tbd-specific syntax directly:

```markdown
Follow the `tbd shortcut precommit-process` steps...
See `tbd guidelines commit-conventions` for details.
```

This simplifies implementation (no translation layer needed) and assumes Speculate docs
are primarily consumed via tbd.
Users who want Speculate without tbd can still read the docs - they just won't have the
CLI commands available.

#### Migration Tasks

- [ ] Audit all tbd docs: classify as "general" (-> Speculate) or "tbd-specific" (-> keep)
- [ ] Update Speculate repo structure to match tbd's expected layout
- [ ] Update Speculate front matter to include all required fields
- [ ] Rename Speculate files (remove `shortcut-` prefix, etc.)
- [ ] Update shortcut references to use tbd syntax (`tbd shortcut <name>`)
- [ ] Copy improved docs from tbd back to Speculate
- [ ] Add `tbd-docs.yml` to Speculate repo
- [ ] Remove duplicated docs from tbd, configure Speculate as source
- [ ] Test round-trip: Speculate -> tbd sync -> verify all shortcuts/guidelines work
- [ ] Update Speculate README with new structure and tbd integration docs
- [ ] Consider deprecating/simplifying Speculate CLI (users can use tbd instead)

#### Speculate CLI Future

Once tbd can pull docs from Speculate, the Speculate CLI's main value is diminished.
Options:

1. **Deprecate**: Point users to tbd for full workflow tooling
2. **Simplify**: Keep only copier template functionality, remove doc management
3. **Maintain**: Keep both for users who want Speculate without tbd

**Recommendation:** Option 2 - Speculate CLI becomes a lightweight project scaffolding
tool (`speculate init`), while tbd handles all doc/shortcut/guideline management.

## Testing Strategy

- Unit tests for format migration f03 -> f04 (verify version bump, lookup_path removal)
- Unit tests for `DocsSourceSchema` validation (including path mapping syntax)
- Unit tests for path mapping logic (parsing `reference/ -> guidelines`, namespace
  application)
- Unit tests for `RepoCache` sparse checkout logic
- Unit tests for namespace collision detection and warning
- Integration tests with mock git repos
- Integration test with rust-porting-playbook as real repo (6 guidelines, 8 references)
- Golden tests for config parsing with sources
- Test older tbd version rejects f04 configs (manual or CI matrix)
- Test `tbd source add` with repos that have/don't have `tbd-docs.yml`
- Manual testing with real public repos

## Rollout Plan

**Phases 1-3: External Repo Support**

1. Implement repo source infrastructure (format bump, schema, RepoCache, path mapping)
2. Implement `tbd source add/list/remove` CLI commands
3. Test with rust-porting-playbook and Speculate repos as pilots
4. Iterate on config format and namespace UX based on real usage

**Phase 4: Speculate Migration**

5. Restructure Speculate repo to match tbd's expected layout
6. Add `tbd-docs.yml` manifest to Speculate
7. Update Speculate front matter, file naming, and shortcut references (use tbd syntax)
8. Copy improved docs from tbd -> Speculate (general guidelines, shortcuts, templates)
9. Test round-trip: Speculate -> tbd sync -> verify all docs work
10. Configure tbd to use Speculate as default source (automatic in setup)
11. Remove duplicated general docs from tbd bundled set
12. Keep only tbd-specific docs internal (system shortcuts, tbd-enhanced shortcuts)
13. Simplify or deprecate Speculate CLI

## Open Questions

1. ~~**Cache location:**~~ **Decided:** Per-project `.tbd/repo-cache/`, gitignored.

2. ~~**Auth for private repos:**~~ **Decided:** External - users manage git/ssh
   credentials.

3. ~~**Default source:**~~ **Decided:** `jlevy/speculate` is the default,
   auto-configured.

4. **Version pinning UX:** Should `ref` default to `main` (always latest) or require
   explicit pinning? Latest is convenient but less reproducible.
   **Recommendation:** Default to `main` for simplicity. Users who need reproducibility
   can pin to a tag. `tbd source add` always writes the ref explicitly.

5. ~~**What happens when external docs conflict with internal?**~~ **Decided:** Explicit
   precedence order with collision warnings. Namespaces eliminate collisions entirely.

6. **Should external repos be able to declare dependencies on other repos?** (Probably
   not initially - keep it simple.)

7. ~~**Speculate shortcut reference syntax:**~~ **Decided:** Use tbd-specific syntax
   (`tbd shortcut <name>`) directly.
   No translation needed initially.

8. ~~**Speculate directory structure:**~~ **Decided:** Speculate adopts tbd's exact
   structure (`guidelines/`, `shortcuts/standard/`, `templates/`). Config `paths:`
   selects subpaths to sync.
   Source order in config = precedence (no separate lookup_path needed).

9. ~~**Which docs are "general" vs "tbd-specific"?**~~ Need explicit audit (Phase 4
   task).

10. ~~**Name collisions between repos:**~~ **Decided:** Optional `namespace:` field
    creates subdirectories. `tbd source add` suggests namespace when collisions detected.
    Fuzzy search handles namespaced lookups transparently.

11. ~~**Non-standard repo structures (reference/, case-studies/):**~~ **Decided:** Path
    mapping with `->` syntax. Repos can also provide `tbd-docs.yml` manifest for
    automatic configuration.

## Future Work

**Generic shortcut reference syntax** (not in initial implementation):

Support a non-tbd syntax like `@shortcut-<name>` or `{{shortcut:<name>}}` that gets
remapped to `tbd shortcut <name>` during sync.
This would make Speculate docs more tool-agnostic for users who might use them outside
tbd. For now, Speculate uses tbd syntax directly.

**Source pinning/lockfile** (not in initial implementation):

A `.tbd/sources.lock` file that records the exact commit SHA of each repo source after
sync. This would provide full reproducibility without requiring users to pin to tags.

**Repo dependency declarations** (not in initial implementation):

Allow repos to declare dependencies on other repos in `tbd-docs.yml`:

```yaml
dependencies:
  - github.com/jlevy/speculate  # requires general coding rules
```

This could auto-add dependencies when a source is added.

## References

- Current doc sync implementation:
  [doc-sync.ts](../../packages/tbd/src/file/doc-sync.ts)
- Config schema: [schemas.ts](../../packages/tbd/src/lib/schemas.ts)
- Related spec: plan-2026-01-26-configurable-doc-cache-sync.md
- Speculate repo: https://github.com/jlevy/speculate
- rust-porting-playbook: https://github.com/jlevy/rust-porting-playbook
- Local checkouts: attic/speculate/, attic/rust-porting-playbook/

---

## Engineering Review Notes (2026-02-08)

### What the spec gets right

1. **Git sparse checkout approach is solid** - correct choice over submodules, npm
   packages, or API-only fetching. Works with any git host.
2. **Format version bump is necessary and well-reasoned** - the Zod `strip()` data loss
   scenario is real and the forward compatibility protection is important.
3. **Source precedence model is clean** - source order = precedence is simple and
   predictable.
4. **Per-project cache** is appropriate for isolation.
5. **Migration pattern documentation** is thorough and will serve as a template for future
   migrations.
6. **Alternatives analysis** is complete and well-reasoned.

### Issues identified and addressed in this revision

1. **Non-standard doc types were not handled** - The original spec assumed external repos
   would follow tbd's exact structure (`guidelines/`, `shortcuts/standard/`,
   `templates/`). Real repos like rust-porting-playbook have `reference/` and
   `case-studies/` directories that don't map to any tbd category. **Fix:** Added path
   mapping with `->` syntax.

2. **No collision avoidance mechanism** - When multiple repos provide docs with the same
   filename (e.g., two repos both have `rust-general-rules.md`), the original spec relied
   only on precedence (silent shadowing). **Fix:** Added optional `namespace:` field that
   creates subdirectories, plus collision warnings during sync.

3. **CLI for source management was deferred to "Future Work"** - The user's core need is
   "a single CLI command to add a knowledge repo." Without `tbd source add`, the feature
   requires manual config editing, which defeats the simplicity goal. **Fix:** Moved
   `tbd source add/list/remove` to Phase 1.

4. **No manifest format for repo authors** - Repo authors had no way to declare how
   their docs should integrate with tbd. Users had to manually figure out path mappings.
   **Fix:** Added optional `tbd-docs.yml` manifest that `tbd source add` reads
   automatically.

5. **Cache directory naming was opaque** - Using URL hashes makes debugging harder. **Fix:**
   Changed to readable `<owner>-<repo>` directory names.

6. **Lookup didn't support namespaced subdirectories** - The fixed search order
   (`guidelines/`, etc.) would need recursive scanning to find namespaced docs. **Fix:**
   Specified that `guidelines/` is searched recursively, which the existing `DocCache`
   scan logic already supports.

### Remaining risks

1. **Sparse checkout compatibility** - `git sparse-checkout` behavior varies across git
   versions (requires Git 2.25+). Need to verify minimum git version and provide helpful
   error messages.

2. **Sync performance with many sources** - Each repo source requires a `git fetch` on
   sync. With many sources, this could make `tbd sync` slow. Consider parallel fetches
   and/or a `--offline` flag to skip repo updates.

3. **Config file growth** - The `files:` section in config.yml already lists 50+ entries.
   Adding sources with many docs could make the config unwieldy. Consider whether the
   `files:` section should only contain explicit overrides (not auto-discovered files from
   sources).

4. **Speculate migration is a large scope** - Phase 4 essentially restructures an entire
   external project. Consider treating it as a separate spec with its own timeline.

---

## Appendix: Relationship to Agent Skills Ecosystem (skills.sh, SKILL.md, agentskills.io)

### Overview of the Agent Skills Ecosystem (as of Feb 2026)

The agent skills ecosystem has three key components:

1. **Agent Skills Open Standard** ([agentskills.io](https://agentskills.io)) - Originally
   developed by Anthropic and released as an open standard. Defines the SKILL.md format:
   YAML frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`,
   `allowed-tools`) + markdown body. Adopted by 27+ agent products including Claude Code,
   Cursor, GitHub Copilot, Codex, Gemini CLI, Windsurf, Goose, and others.

2. **skills.sh** ([skills.sh](https://skills.sh)) - Vercel's open ecosystem for
   discovering and installing skills. Functions as "npm for agents." CLI:
   `npx skills add <owner/repo>`. Installs SKILL.md files to `.agents/skills/` and
   symlinks to agent-specific directories (`.claude/skills/`, `.cursor/skills/`, etc.).
   Hosts a leaderboard with 47K+ total installations tracked.

3. **Anthropic Skills Repo** ([github.com/anthropics/skills](https://github.com/anthropics/skills)) -
   Reference implementations of Agent Skills (65K+ stars). Skills for document creation
   (docx, pdf, pptx, xlsx), creative workflows, and technical tasks.

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
resources** — the domain knowledge that tbd's meta-skill references via CLI commands like
`tbd guidelines X`.

The Agent Skills spec explicitly supports this pattern:

> "Skills should be structured for efficient use of context... Files (e.g. those in
> `scripts/`, `references/`, or `assets/`) are loaded only when required."

tbd's `tbd guidelines X` and `tbd shortcut X` commands are exactly this — on-demand
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
| **Namespace** | By owner/repo (`vercel-labs/skills`) | Optional `namespace:` field |
| **Path mapping** | Not needed (fixed SKILL.md format) | Required (repos have varied structures) |
| **Manifest** | SKILL.md frontmatter IS the manifest | `tbd-docs.yml` (optional) |
| **Source** | GitHub repos | GitHub repos (same) |

### What tbd Should Learn from skills.sh

1. **The `npx skills add` UX is excellent** — single command, interactive selection,
   works across agents. tbd's `tbd source add` should match this level of polish.
   The interactive flow (clone → discover → prompt to confirm → install) is the right
   pattern, and our spec already describes this.

2. **GitHub repos as distribution** — Both systems use GitHub repos as the primary
   distribution mechanism. This is the right choice for documentation and skill content.
   No need for a separate registry or package manager.

3. **The leaderboard/discovery model** — skills.sh tracks install counts and provides
   trending/popular lists. tbd could eventually have a curated index of doc repos
   ("awesome-tbd-docs" or similar), but this isn't needed for Phase 1.

4. **Cross-agent output directories** — skills.sh installs to multiple agent-specific
   directories. tbd's approach is inherently more portable since it uses CLI-based access
   rather than file-based skill loading. Any agent that can run `tbd guidelines X` gets
   the knowledge, regardless of its skill directory conventions.

5. **Frontmatter compatibility** — The Agent Skills spec standardizes `name`,
   `description`, `license`, `metadata`. tbd's doc frontmatter (`title`, `description`,
   `author`, `category`) is similar but not identical. Consider aligning where possible:
   - `title` ↔ `name` (same concept, different field name)
   - `description` ↔ `description` (identical)
   - `author` ↔ `metadata.author`
   - `category` → `metadata.category`

### What's Different and Why tbd Needs Its Own Approach

1. **Ongoing sync vs one-time install** — skills.sh copies files once; tbd needs ongoing
   sync because doc repos evolve (new guidelines added, existing ones refined). This is
   the fundamental architectural difference: skills are static capabilities, while tbd
   docs are living knowledge.

2. **Path mapping complexity** — SKILL.md files have a fixed structure (one directory,
   one file). tbd doc repos have varied structures (guidelines/, reference/,
   case-studies/) that need mapping to tbd's categories. skills.sh doesn't need this.

3. **Namespace granularity** — skills.sh namespaces by owner/repo at the repository
   level. tbd needs namespace control at the individual doc level because multiple repos
   may provide docs with the same filename.

4. **CLI-based access model** — skills.sh files are loaded directly by agents from the
   filesystem. tbd docs are accessed via CLI commands (`tbd guidelines X`), which provides
   better context management (agents get exactly the doc they need, not all docs at once).
   This is the "meta-skill" pattern documented in our
   `research-skills-vs-meta-skill-architecture.md`.

### Are They Complementary or Competing?

**Complementary.** They solve different problems:

- **skills.sh** answers: "How do I give my agent the *ability* to do X?"
  (e.g., create PDFs, run data analysis, follow design patterns)
- **tbd source add** answers: "How do I give my agent *knowledge* about X?"
  (e.g., Rust porting rules, TypeScript best practices, project-specific conventions)

A project could use both:

```bash
# Install agent capabilities via skills.sh
npx skills add anthropics/skills          # PDF creation, etc.
npx skills add vercel-labs/agent-skills   # Design patterns, etc.

# Install domain knowledge via tbd
tbd source add github.com/jlevy/rust-porting-playbook   # Rust porting expertise
tbd source add github.com/jlevy/speculate               # General coding guidelines
```

The skills give agents new capabilities; tbd's docs give agents domain expertise to use
those capabilities well.

### Future Integration Considerations

1. **tbd as a skills.sh-listed skill** — tbd itself (the meta-skill) could be listed on
   skills.sh for discovery. Users would find tbd via skills.sh, install it with
   `npx skills add`, and then use `tbd source add` for domain knowledge repos.

2. **Doc repos as skills.sh entries** — Individual doc repos (like rust-porting-playbook)
   could potentially be listed on skills.sh as "knowledge skills." This would require
   each doc repo to have a SKILL.md that describes its contents and instructs agents to
   use `tbd guidelines X` to access them. This is a natural evolution but not a Phase 1
   concern.

3. **Shared frontmatter standard** — If the Agent Skills spec evolves to support
   "resource-type" skills (not just capability skills), tbd could adopt the standard
   frontmatter format directly. Monitor the agentskills.io spec for evolution.

4. **Registry/index for doc repos** — skills.sh has a centralized leaderboard. tbd could
   eventually maintain a similar index of doc repos, or simply piggyback on skills.sh's
   discovery mechanism. A simple GitHub-based "awesome list" is sufficient to start.

### References

- Agent Skills Specification: https://agentskills.io/specification
- skills.sh CLI: https://github.com/vercel-labs/skills
- skills.sh Directory: https://skills.sh
- Anthropic Skills Repo: https://github.com/anthropics/skills
- Vercel announcement: https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem
- tbd CLI-as-skill research: [research-cli-as-agent-skill.md](../../research/current/research-cli-as-agent-skill.md)
- tbd skills architecture research: [research-skills-vs-meta-skill-architecture.md](../../research/current/research-skills-vs-meta-skill-architecture.md)
