# Plan Spec: Configurable Doc Cache with Auto-Sync

## Purpose

This spec designs a configurable documentation cache system that automatically syncs
documentation files from both internal (bundled) and external (GitHub) sources.
The goal is to ensure that when a user clones a tbd-enabled repository, they get an
up-to-date documentation cache without manual intervention.

## Background

Currently, tbd has a documentation system that stores docs in `.tbd/docs/` (previously
called “cache”). These docs include shortcuts, guidelines, and templates that agents and
users can access via `tbd shortcut`, `tbd guidelines`, and `tbd template` commands.

**Current limitations:**

1. **No auto-sync**: When someone clones a repo with tbd already set up, the
   `.tbd/docs/` directory is gitignored and empty.
   They must explicitly run `tbd setup --auto` to populate it.

2. **Not configurable**: The docs that get installed are hardcoded.
   Users cannot specify custom docs from external sources (like GitHub) or remove
   bundled docs they don’t want.

3. **No refresh mechanism**: There’s no way to update docs from their sources after
   initial setup, or to sync docs across team members.

### Related Work

- [plan-2026-01-22-doc-cache-abstraction.md](done/plan-2026-01-22-doc-cache-abstraction.md)
  \- Implemented the current DocCache system with path-ordered lookups
- [plan-2026-01-25-gitignore-utils-library.md](done/plan-2026-01-25-gitignore-utils-library.md)
  \- Idempotent gitignore editing library used for `.tbd/.gitignore` management

### Tracked Issues

**Epic:** `tbd-xrxr` - Configurable doc cache with auto-sync

| ID | Phase | Type | Priority | Description |
| --- | --- | --- | --- | --- |
| `tbd-2m30` | 9 | feature | P2 | Add tbd_format versioning with tbd-format.ts migration infrastructure |
| `tbd-dwu3` | 1 | task | P2 | Add doc_cache schema and config helpers |
| `tbd-hg5k` | 2 | task | P2 | Implement DocSync core class |
| `tbd-780a` | 3 | task | P2 | Create tbd docs command |
| `tbd-4ayp` | 4 | task | P2 | Integrate doc sync into setup command |
| `tbd-r82b` | 5 | task | P2 | Implement auto-sync on stale docs |
| `tbd-4xvj` | 6 | task | P3 | Documentation for doc cache feature |
| `tbd-kqln` | 7 | task | P3 | Testing for doc cache feature |
| `tbd-mhob` | 8 | bug | P3 | Fix .tbd/.gitignore messaging |
| `tbd-v7n4` | 8 | bug | P3 | Fix .claude/.gitignore messaging (depends on tbd-mhob) |
| `tbd-ne2f` | 8 | task | P4 | Document gitignore pattern re-addition behavior |

**Dependency chain:** Phase 9 → 1 → 2 → (3, 4, 5) → (6, 7). Phase 8 is independent.

## Summary of Task

Implement a configurable doc cache system with these capabilities:

1. **Configuration in config.yml**: A `doc_cache:` key that maps cache paths to source
   locations
2. **Multiple source types**: Support internal (bundled) docs and GitHub URLs
3. **Auto-sync on setup**: `tbd setup --auto` creates default config and syncs all docs
4. **Refresh command**: `tbd docs --refresh` to sync docs from config at any time
5. **Clean sync protocol**: Download new docs, update changed docs, remove deleted docs
6. **Auto-sync**: Automatically sync docs when loading config if stale (configurable
   period)

## Agent Briefing (3-4 Paragraphs)

The tbd documentation system currently installs bundled docs to `.tbd/docs/` during
setup, but this directory is gitignored and doesn’t sync across team members.
When someone clones a repo, they need to manually run `tbd setup --auto` to get the
docs. Additionally, there’s no way to configure which docs are installed or add custom
docs from external sources like GitHub repositories.

The solution is to add a `doc_cache:` configuration section in `.tbd/config.yml` that
maps destination paths (like `shortcuts/precommit-process.md`) to source locations.
Sources can be internal bundled docs (using `internal:` prefix) or GitHub URLs.
The config file IS tracked in git, so team members share the same doc configuration.
When anyone runs `tbd setup --auto` or `tbd docs --refresh`, the system reads this
config and syncs all docs: downloading new ones, updating changed ones, and removing any
that are no longer in the config.

The first time `tbd setup --auto` runs on a fresh project, it creates a default
`doc_cache:` config with all the bundled internal docs.
Users can then edit this config to add their own docs from GitHub, remove docs they
don’t want, or add custom shortcuts from their organization’s repos.
Subsequent runs of `tbd setup --auto` or `tbd docs --refresh` simply sync the cache to
match the current config.
This ensures every team member has consistent documentation without manual coordination.

For GitHub sources, we need to handle URL formats that work with agents (who may be
blocked from certain patterns) and support branch specifications.
Testing should include comprehensive unit tests for the sync protocol (ensuring adds,
updates, and deletes work correctly) and end-to-end tryscript tests that verify the
actual file state after sync operations.

## Backward Compatibility

| Area | Impact | Notes |
| --- | --- | --- |
| Code | Backward compatible | New `doc_cache:` config key is optional; existing repos without it continue to work |
| API | N/A | No API changes |
| File format | Backward compatible | Config schema extended with new optional key |
| Database schema | N/A | No database |

## Stage 1: Planning Stage

### Feature Requirements

1. **Config Structure**
   - New `doc_cache:` key in `.tbd/config.yml`
   - Maps destination paths to source locations
   - Destinations are paths within `.tbd/docs/` (e.g., `shortcuts/my-shortcut.md`)
   - Sources are either `internal:` paths or GitHub URLs

2. **Source Types**
   - `internal:shortcuts/precommit-process.md` - bundled docs from tbd package
   - GitHub URLs - fetch from public repos (need to test agent access)

3. **Default Configuration**
   - First `tbd setup --auto` creates config with all internal docs
   - Explanatory comment in YAML explaining how to customize

4. **Sync Behavior**
   - Compare config against current `.tbd/docs/` state
   - Download new docs not present locally
   - Update docs whose source has changed
   - Remove docs no longer in config
   - Report what changed

5. **Commands**
   - `tbd docs --refresh` - standalone sync command
   - `tbd setup --auto` - includes doc sync as part of setup

6. **Auto-Sync on Stale**
   - Track `last_doc_sync_at` timestamp in `.tbd/state.yml` (gitignored)
   - Configure sync period via `settings.doc_auto_sync_hours` (default: 24)
   - When loading config, check if docs are stale (last sync > period hours ago)
   - If stale, automatically trigger doc sync before proceeding
   - Setting `doc_auto_sync_hours: 0` disables auto-sync
   - Auto-sync is silent unless there are errors or new external docs

7. **Documentation Updates**
   - Update SKILL.md with doc cache configuration instructions
   - Update CLI help for new `tbd docs` command
   - Add explanatory comments in generated config.yml

### Config Format Design

```yaml
# .tbd/config.yml

settings:
  auto_sync: false              # Existing: auto-sync issues after write operations
  doc_auto_sync_hours: 24       # NEW: auto-sync docs if stale (0 = disabled)

# This configures which docs are synced to the .tbd/docs/ directory and available as
# shortcuts, guidelines, and templates via the tbd CLI.
doc_cache:
  shortcuts/system/skill.md: internal:shortcuts/system/skill.md
  shortcuts/system/shortcut-explanation.md: internal:shortcuts/system/shortcut-explanation.md
  shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
  shortcuts/standard/precommit-process.md: internal:shortcuts/standard/precommit-process.md
  shortcuts/custom/my-org-shortcut.md: https://raw.githubusercontent.com/myorg/docs/main/shortcuts/my-org-shortcut.md
  guidelines/typescript-rules.md: internal:guidelines/typescript-rules.md
```

**Design decisions:**
- Use raw GitHub URLs (raw.githubusercontent.com) for clarity and direct fetch
- Keys are destination paths relative to `.tbd/docs/`
- Values are source locations with `internal:` prefix for bundled or full URL for
  external
- YAML dict format (not list) allows easy editing and clear key-value mapping
- Only quote strings when YAML requires it (URLs with special chars)

### State Tracking

```yaml
# .tbd/state.yml (gitignored, per-node)

last_sync_at: 2026-01-25T10:00:00Z       # Existing: last issue sync
last_doc_sync_at: 2026-01-25T10:00:00Z   # NEW: last doc cache sync
```

**Auto-sync behavior:**
- When loading config (during any tbd command), check `last_doc_sync_at`
- If `doc_auto_sync_hours > 0` and time since last sync exceeds that period, trigger doc
  sync
- This ensures docs stay fresh without manual intervention
- Setting `doc_auto_sync_hours: 0` disables auto-sync entirely
- Default: 24 hours (sync once per day when actively using tbd)

### GitHub URL Format Options

**Option A: Raw GitHub URLs (Recommended)**
```yaml
shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/path/to/file.md
```
- Pros: Standard URLs, clear what’s being fetched, branch in URL
- Cons: Verbose, agents sometimes blocked from github.com domains

**Option B: Custom github: prefix**
```yaml
shortcuts/custom/my-shortcut.md: github:org/repo:main:path/to/file.md
```
- Pros: Compact, easy to parse
- Cons: Non-standard, need to document format

**Option C: GitHub API**
```yaml
shortcuts/custom/my-shortcut.md: https://api.github.com/repos/org/repo/contents/path/to/file.md?ref=main
```
- Pros: Official API
- Cons: Returns base64-encoded content, rate limited

**Recommendation**: Start with Option A (raw URLs) but test agent access.
If blocked, implement Option B as fallback.

### Not in Scope

- Private repository access (requires auth tokens)
- Non-GitHub external sources (could add later)
- Automatic version detection/updates
- Conflict resolution (config wins, local changes overwritten)
- Partial sync (always syncs entire config)

### Acceptance Criteria

1. `tbd setup --auto` on fresh project creates config with all internal docs listed
2. `tbd setup --auto` on existing project syncs docs from config
3. `tbd docs --refresh` syncs docs from config without full setup
4. Adding a doc to config and running refresh downloads it
5. Removing a doc from config and running refresh deletes it
6. GitHub URLs successfully download content (test with public repo)
7. Sync reports what changed (added, updated, removed counts)
8. Config includes explanatory comments for users/agents
9. **Auto-sync**: Running any tbd command 25+ hours after last sync triggers automatic
   doc sync
10. **Auto-sync disable**: Setting `doc_auto_sync_hours: 0` prevents automatic syncs
11. `last_doc_sync_at` is updated in state.yml after each successful sync

## Stage 2: Architecture Stage

### File Structure

```
packages/tbd/src/
├── file/
│   ├── doc-cache.ts       # Existing DocCache class
│   └── doc-sync.ts        # NEW: Sync logic for doc_cache config
├── cli/commands/
│   ├── docs.ts            # NEW: tbd docs command with --refresh
│   └── setup.ts           # Modified: integrate doc sync
└── lib/
    └── schemas.ts         # Modified: add doc_cache schema
```

### Schema Extension

```typescript
// In schemas.ts

// Doc cache mapping: destination path -> source location
export const DocCacheConfigSchema = z.record(
  z.string(),  // destination path (e.g., "shortcuts/my-shortcut.md")
  z.string()   // source location (internal: or URL)
);

// Extended settings
export const SettingsSchema = z.object({
  auto_sync: z.boolean().default(false),           // existing
  doc_auto_sync_hours: z.number().default(24),     // NEW: 0 = disabled
}).default({});

export const ConfigSchema = z.object({
  // ... existing fields ...
  settings: SettingsSchema,
  doc_cache: DocCacheConfigSchema.optional(),
});

// Extended local state (gitignored)
export const LocalStateSchema = z.object({
  last_sync_at: Timestamp.optional(),      // existing: issue sync
  last_doc_sync_at: Timestamp.optional(),  // NEW: doc cache sync
});
```

### DocSync Class Design

```typescript
// packages/tbd/src/file/doc-sync.ts

export interface SyncResult {
  added: string[];      // Paths of newly downloaded docs
  updated: string[];    // Paths of updated docs
  removed: string[];    // Paths of removed docs
  errors: Array<{ path: string; error: string }>;
}

export interface DocSource {
  type: 'internal' | 'url';
  location: string;  // internal path or URL
}

export class DocSync {
  constructor(
    private readonly tbdRoot: string,
    private readonly config: Record<string, string>
  ) {}

  /**
   * Parse source string into DocSource
   * "internal:shortcuts/foo.md" -> { type: 'internal', location: 'shortcuts/foo.md' }
   * "https://..." -> { type: 'url', location: 'https://...' }
   */
  parseSource(source: string): DocSource;

  /**
   * Fetch content from a source
   */
  async fetchContent(source: DocSource): Promise<string>;

  /**
   * Get current state of .tbd/docs/ directory
   * Returns map of relative paths to content hashes
   */
  async getCurrentState(): Promise<Map<string, string>>;

  /**
   * Sync docs from config to .tbd/docs/
   * - Downloads new docs
   * - Updates changed docs
   * - Removes docs not in config
   */
  async sync(): Promise<SyncResult>;
}
```

### Internal Doc Resolution

Internal docs are bundled with the tbd package.
Resolution:

1. Check `dist/docs/` (production build)
2. Fall back to `../../docs/` (development)
3. Use same `getDocsBasePath()` logic from existing setup.ts

### URL Fetching

For external URLs:
1. Use native `fetch()` (Node 18+)
2. Timeout after 30 seconds
3. Validate response is text/markdown
4. Handle redirects (follow up to 3)
5. Report clear errors for failures

### Docs Command Design

```typescript
// packages/tbd/src/cli/commands/docs.ts

export function registerDocsCommand(program: Command): void {
  program
    .command('docs')
    .description('Manage documentation cache')
    .option('--refresh', 'Sync docs from config')
    .option('--status', 'Show sync status without changing files')
    .option('--json', 'Output as JSON')
    .action(async (options, command) => {
      // Implementation
    });
}
```

### Setup Integration

Modify `tbd setup --auto` to:

1. If no `doc_cache:` in config, generate default with all internal docs
2. Run doc sync (same as `tbd docs --refresh`)
3. Continue with rest of setup (hooks, skill files, etc.)

## Stage 3: Refine Architecture

### Existing Components to Reuse

1. **`getDocsBasePath()`** in setup.ts - finds bundled docs location
2. **`atomically.writeFile()`** - safe file writes
3. **`ensureDir()`** - directory creation
4. **Config read/write** in file/config.ts
5. **OutputManager** for consistent CLI output
6. **`ensureGitignorePatterns()`** in
   [gitignore-utils.ts](packages/tbd/src/utils/gitignore-utils.ts) - idempotent
   gitignore management with return value indicating what changed

### Simplification Decisions

1. **No content hashing** for v1 - just compare existence, always overwrite on sync
2. **No incremental sync** - always process entire config
3. **No caching of remote content** - fetch fresh each time
4. **Config is source of truth** - local changes to docs will be overwritten

### Error Handling

| Error | Handling |
| --- | --- |
| Network failure | Report error, continue with other docs |
| Invalid URL | Report error, skip this doc |
| Internal doc not found | Report error, this is a bug |
| Permission denied | Report error, continue with others |
| Parse error | Report error, skip this doc |

## Stage 4: Implementation

### Phase 1: Schema and Config (`tbd-dwu3`)

- [ ] Add `doc_cache` field to ConfigSchema in schemas.ts
- [ ] Add config migration to add doc_cache to existing configs
- [ ] Add helper to generate default doc_cache config from bundled docs

### Phase 2: DocSync Core (`tbd-hg5k`)

- [ ] Create `file/doc-sync.ts` with DocSync class
- [ ] Implement `parseSource()` for internal: and URL sources
- [ ] Implement `fetchContent()` for both source types
- [ ] Implement `getCurrentState()` to scan .tbd/docs/
- [ ] Implement `sync()` with add/update/remove logic
- [ ] Unit tests for DocSync class

### Phase 3: Docs Command (`tbd-780a`)

- [ ] Create `cli/commands/docs.ts`
- [ ] Implement `--refresh` flag
- [ ] Implement `--status` flag for dry-run
- [ ] Register command in cli.ts
- [ ] Unit tests for command

### Phase 4: Setup Integration (`tbd-4ayp`)

- [ ] Modify setup.ts to generate default doc_cache config
- [ ] Call DocSync.sync() during setup
- [ ] Update setup output to report sync results

### Phase 5: Auto-Sync on Config Load (`tbd-r82b`)

- [ ] Add `doc_auto_sync_hours` field to ConfigSchema settings
- [ ] Add `last_doc_sync_at` field to LocalStateSchema
- [ ] Create helper to check if docs are stale (last sync > configured hours)
- [ ] Integrate auto-sync check into config loading path
- [ ] Update state.yml after successful sync
- [ ] Ensure auto-sync is silent (no output) unless errors occur
- [ ] Unit tests for staleness check and auto-sync trigger

### Phase 6: Documentation (`tbd-4xvj`)

- [ ] Add explanatory comments to generated config.yml
- [ ] Update SKILL.md with doc_cache usage instructions
- [ ] Update CLI help text
- [ ] Document GitHub URL format and limitations
- [ ] Document auto-sync behavior and `doc_auto_sync_hours` setting

### Phase 7: Testing (`tbd-kqln`)

- [ ] Unit tests for DocSync with mock file system
- [ ] Unit tests for URL fetching with mock responses
- [ ] Integration test: fresh setup creates default config
- [ ] Integration test: setup with existing config syncs correctly
- [ ] Integration test: docs --refresh syncs correctly
- [ ] Integration test: auto-sync triggers when docs are stale
- [ ] Integration test: auto-sync disabled when `doc_auto_sync_hours: 0`
- [ ] Tryscript test: end-to-end sync verification
- [ ] Test GitHub URL access from agent environment

### Phase 8: Setup Output Messaging Improvements (`tbd-mhob`, `tbd-v7n4`, `tbd-ne2f`)

This phase addresses inconsistent messaging in `setup.ts` when managing gitignore files.
The `ensureGitignorePatterns()` utility returns `{ added, skipped, created }` but
setup.ts doesn’t use this return value to provide accurate feedback.

**Current behavior** (problematic):
- Always prints `✓ Created .tbd/.gitignore` even when file existed and was updated
- No feedback when file is already up-to-date

**Expected behavior**:
- `✓ Created .tbd/.gitignore` - when file is newly created
- `✓ Updated .tbd/.gitignore` - when patterns were added to existing file
- No message (or `✓ .tbd/.gitignore up to date`) - when no changes needed

**Design decision: Pattern re-addition is intentional**

If a user manually removes a managed pattern (like `docs/`), we re-add it on next setup.
This is correct because:
1. The `docs/` directory is regenerated from the npm package on every setup
2. These are tool-managed files, not user-authored content
3. Tracking them in git would cause noise on every tbd upgrade

**Tracked issues:**
- `tbd-mhob`: Fix .tbd/.gitignore messaging to distinguish created vs updated vs no-op
- `tbd-v7n4`: Fix .claude/.gitignore messaging (same issue, depends on tbd-mhob)
- `tbd-ne2f`: Document gitignore pattern re-addition behavior as intentional design

**Implementation:**

- [ ] Update [setup.ts:1142-1159](packages/tbd/src/cli/commands/setup.ts#L1142-L1159) to
  use `ensureGitignorePatterns()` return value for .tbd/.gitignore messaging
- [ ] Update [setup.ts:678-680](packages/tbd/src/cli/commands/setup.ts#L678-L680) to use
  return value for .claude/.gitignore messaging
- [ ] Add code comment explaining why pattern re-addition is intentional
- [ ] Close beads tbd-mhob, tbd-v7n4, tbd-ne2f when complete

### Phase 9: tbd Directory Format Versioning (`tbd-2m30`)

Add explicit format versioning for the entire `.tbd/` directory structure to enable safe
migrations.

**Current state:**
- `tbd_version` exists - stores the tbd version that created/updated the config
- No format version - can’t detect incompatible structural changes

**Proposed additions to config.yml:**

```yaml
# .tbd/config.yml
tbd_format: f01             # NEW: Bumped ONLY for breaking changes requiring migration
tbd_version: 0.1.5          # Existing: Last tbd version to touch this config
```

**Design:**

| Field | Purpose | When Updated |
| --- | --- | --- |
| `tbd_version` | Track which tbd version last modified config | Every `tbd setup` |
| `tbd_format` | Detect breaking .tbd/ structure changes requiring migration | ONLY on breaking changes |

**When to bump `tbd_format`:**
- ✅ Bump: Deleting/renaming files that old code expects
- ✅ Bump: Changing file formats in incompatible ways
- ✅ Bump: Moving files to different locations
- ❌ Don’t bump: Adding new optional fields to config.yml
- ❌ Don’t bump: Adding new files/directories
- ❌ Don’t bump: Any change that works without migration

**Format version history:**
- `f01` - Initial format (current: config.yml, state.yml, docs/, issues/)
- `f02` - Adds `doc_cache:` config key (this spec) - requires migration to populate
  default

**Core implementation: `tbd-format.ts`**

Create `packages/tbd/src/lib/tbd-format.ts` as the **single source of truth** for:
1. Current format version constant
2. Format version history with detailed changelog
3. Migration functions for each version transition
4. Validation that format is compatible

```typescript
/**
 * tbd Directory Format Versioning
 * ================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for .tbd/ directory format versions.
 *
 * WHEN TO BUMP THE FORMAT VERSION:
 * - Bump when changes REQUIRE migration (deleting files, changing formats, moving files)
 * - Do NOT bump for additive changes (new optional config fields, new directories)
 *
 * HOW TO ADD A NEW FORMAT VERSION:
 * 1. Add entry to FORMAT_HISTORY with detailed description
 * 2. Implement migrate_fXX_to_fYY() function
 * 3. Add case to migrateToLatest()
 * 4. Update CURRENT_FORMAT
 * 5. Add tests for the migration path
 */

export const CURRENT_FORMAT = 'f02';

export const FORMAT_HISTORY = {
  f01: {
    introduced: '0.1.0',
    description: 'Initial format',
    structure: {
      'config.yml': 'Project configuration',
      'state.yml': 'Local state (gitignored)',
      'docs/': 'Documentation cache (gitignored)',
      'issues/': 'Issue YAML files',
    },
  },
  f02: {
    introduced: '0.2.0',
    description: 'Adds configurable doc_cache',
    changes: [
      'Added doc_cache: key to config.yml for configurable doc sources',
      'Added settings.doc_auto_sync_hours for automatic doc refresh',
    ],
    migration: 'Populates default doc_cache config from bundled docs',
  },
} as const;

export function migrateToLatest(config: unknown, fromFormat: string): Config {
  // ... migration logic
}
```

**Usage pattern (prominently marked):**

```typescript
// In config.ts - prominently marked
import { CURRENT_FORMAT, migrateToLatest } from './tbd-format.js';
// ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules

export function readConfig(tbdRoot: string): Config {
  const raw = loadYaml(configPath);
  const format = raw.tbd_format ?? 'f01';  // Missing = f01

  if (format !== CURRENT_FORMAT) {
    return migrateToLatest(raw, format);
  }
  return ConfigSchema.parse(raw);
}
```

**Implementation:**

- [ ] Create `packages/tbd/src/lib/tbd-format.ts` with format history and migration
  infrastructure
- [ ] Add `tbd_format` field to ConfigSchema (default: ‘f01’)
- [ ] Implement f01 → f02 migration (adds default doc_cache)
- [ ] Update config.ts to use tbd-format.ts (with prominent comments)
- [ ] Update `tbd setup --auto` to run migrations and update tbd_format
- [ ] Add comprehensive tests for migration paths
- [ ] Add `tbd doctor` check for format version compatibility

## Open Questions

1. **GitHub URL access**: Do agents get blocked from raw.githubusercontent.com?
   Need to test and potentially implement fallback.

2. **Branch handling**: Should we support branch in config separately, or require full
   URLs with branch?

   **Leaning toward**: Full URLs with branch included - simpler, more explicit.

3. **Auth for private repos**: Out of scope for v1, but how would we add it later?

   **Future option**: Support `GITHUB_TOKEN` env var or config credential.

4. **Conflict handling**: What if user modifies a synced doc locally?

   **Decision**: Config wins.
   Local changes are overwritten.
   Document this clearly.

5. **Sync triggers**: Should we auto-sync on every tbd command, or only explicit
   refresh?

   **Decision**: Auto-sync triggers when docs are stale (configurable via
   `doc_auto_sync_hours`, default 24). Only checks on commands that use docs (shortcuts,
   guidelines, templates).
   Explicit sync via `tbd setup --auto` and `tbd docs --refresh` always runs regardless
   of staleness.

6. **Where to check staleness**: Where in the code should we check if docs are stale?

   **Decision**: Check in DocCache constructor when instantiated.
   This ensures auto-sync only runs when docs are actually being accessed, not for
   unrelated commands like `tbd list` or `tbd show`. Commands that use docs (shortcut,
   guidelines, template) will trigger the check; other commands won’t incur the
   overhead.
