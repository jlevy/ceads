# Plan Spec: Unified Sync Command

## Purpose

Unify `tbd sync` to sync both issues (to git remote) and docs (locally from bundled
sources) by default.
This makes sync behavior intuitive and ensures users automatically get new bundled
shortcuts after upgrading tbd.

## Background

Currently, tbd has two separate sync mechanisms:

1. **`tbd sync`**: Syncs issues to the `tbd-sync` git branch (push/pull to remote)
2. **`tbd docs --refresh`**: Syncs docs from config to `.tbd/docs/` (local file
   operations)

This split causes confusion and requires users to run `tbd setup --auto` after upgrading
tbd to get new bundled shortcuts.
The separation is an implementation detail, not a meaningful distinction for users.

### Current Behavior

| Command | What it syncs | Writes to config? |
| --- | --- | --- |
| `tbd sync` | Issues only | No |
| `tbd docs --refresh` | Docs only | Yes (merges defaults) |
| `tbd setup --auto` | Docs only | Yes (merges defaults) |
| Auto-sync (24h) | Docs only | No (existing config only) |

### Problems

1. **Upgrade friction**: After `npm update -g get-tbd`, new shortcuts aren’t available
   until `tbd setup --auto`
2. **Inconsistent naming**: “sync” only syncs issues; “refresh” syncs docs
3. **Hidden behavior**: Auto-sync doesn’t pick up new bundled docs
4. **Extra command**: `tbd docs --refresh` is an extra concept to remember

### Related Work

- [plan-2026-01-26-configurable-doc-cache-sync.md](done/plan-2026-01-26-configurable-doc-cache-sync.md)
  \- Original doc cache implementation
- [plan-2026-01-28-sync-worktree-recovery-and-hardening.md](active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md)
  \- Worktree sync improvements

### Tracked Issues

**Epic:** `tbd-v9pq` - Unified sync command: sync both issues and docs by default

| ID | Phase | Type | Priority | Description |
| --- | --- | --- | --- | --- |
| `tbd-offi` | 1 | task | P2 | Extract shared syncDocsWithDefaults() function |
| `tbd-6zhj` | 2 | task | P2 | Update sync command with --issues/--docs flags |
| `tbd-2d3s` | 3 | task | P2 | Update auto-sync in DocCache to merge defaults |
| `tbd-kvb5` | 4 | task | P2 | Remove docs --refresh command |
| `tbd-oz2c` | 5 | task | P2 | Update setup command to use shared function |
| `tbd-xlmp` | 6 | task | P3 | Update documentation for unified sync |
| `tbd-2dmg` | 7 | task | P3 | Testing for unified sync |

**Dependency chain:** Phase 1 → (2, 3, 5) → 4 → 6. Phase 7 depends on 3, 4, 5.

## Summary of Task

1. **Extend `tbd sync`** to sync both issues and docs by default
2. **Add flags** for selective sync: `--issues` (issues only), `--docs` (docs only)
3. **Always merge defaults** when syncing docs (so new bundled docs appear after
   upgrade)
4. **Always write to config** when docs change (so config stays in sync)
5. **Auto-prune stale internals** (if bundled doc removed from tbd, remove from config)
6. **Remove `tbd docs --refresh`** (replaced by `tbd sync --docs`)
7. **Update auto-sync (24h)** to also merge defaults

## Agent Briefing

The tbd CLI currently has a confusing split between issue sync (`tbd sync`) and doc sync
(`tbd docs --refresh`). Users expect “sync” to sync everything, and after upgrading tbd
via npm, they expect new shortcuts to be available without extra steps.
This spec unifies both operations under `tbd sync`.

The key insight is that syncing docs is a fast, local operation (copying bundled files
to `.tbd/docs/`), while syncing issues involves network operations (push/pull to git
remote). From the user’s perspective, these are both “sync” operations - making local
state match the source of truth.
The implementation details shouldn’t leak into the CLI.

When syncing docs, we always merge the current bundled defaults with the user’s existing
config. This ensures new shortcuts from tbd upgrades are automatically added.
We also auto-prune entries that point to non-existent internal sources (in case a
shortcut is removed in a future tbd version).
The merged config is written back, so the config file remains the source of truth for
what’s installed.

The `tbd docs --refresh` command will be removed entirely - it’s replaced by
`tbd sync --docs`. We don’t need backward compatibility since this is a breaking change
we’re explicitly choosing to make for a cleaner design.

## Backward Compatibility

| Area | Impact | Notes |
| --- | --- | --- |
| CLI | Breaking | `tbd docs --refresh` removed, use `tbd sync --docs` |
| Behavior | Breaking | `tbd sync` now also syncs docs (new default behavior) |
| Config | Compatible | Config format unchanged, just written more often |
| Scripts | Breaking | Any scripts using `tbd docs --refresh` need updating |

## Stage 1: Planning Stage

### Feature Requirements

1. **Unified sync command**
   - `tbd sync` syncs both issues and docs by default
   - `tbd sync --issues` syncs only issues (current behavior)
   - `tbd sync --docs` syncs only docs
   - `tbd sync --status` shows status of both

2. **Doc sync always merges defaults**
   - Generate defaults from bundled docs
   - Merge with existing `config.docs_cache.files`
   - User customizations (URL sources, overrides) preserved
   - New bundled docs automatically added

3. **Config write policy**
   - Write config when docs are synced AND config changed
   - Compare merged config to current before writing (avoid noise)
   - Auto-prune entries pointing to non-existent internal sources

4. **Auto-sync (24h) also merges defaults**
   - Currently only syncs existing config entries
   - Change to merge defaults like explicit sync does
   - Ensures fresh clones pick up new bundled docs over time

5. **Remove `tbd docs --refresh`**
   - Delete the `--refresh` and `--status` options from docs command
   - `tbd docs` remains for viewing bundled docs

### Command Design

```
tbd sync                    # Sync everything (issues + docs)
tbd sync --issues           # Issues only (legacy behavior)
tbd sync --docs             # Docs only (replaces docs --refresh)
tbd sync --status           # Show status of both
tbd sync --push             # Push issues only (existing)
tbd sync --pull             # Pull issues only (existing)
tbd sync --fix              # Repair worktree (existing)
```

**Flag combinations:**
- `--issues` and `--docs` are mutually exclusive with `--push`/`--pull`
- `--push` and `--pull` only apply to issues (network operations)
- `--status` shows both issue and doc sync status

### Sync Order

1. **Docs first** (fast, local operations)
   - Merge defaults with config
   - Sync files to `.tbd/docs/`
   - Write config if changed
   - Update `last_doc_sync_at` in state

2. **Issues second** (network operations, may fail)
   - Commit worktree changes
   - Pull from remote
   - Push to remote

If issues sync fails, docs are still synced.
This is acceptable - the user can retry issues sync, and docs are in a good state.

### Config Merge Logic

```typescript
async function syncDocs(tbdRoot: string): Promise<SyncResult> {
  const config = await readConfig(tbdRoot);

  // 1. Generate defaults from bundled docs
  const defaults = await generateDefaultDocCacheConfig();

  // 2. Merge: defaults as base, user config overlays
  const merged = mergeDocCacheConfig(config.docs_cache?.files, defaults);

  // 3. Prune entries with missing internal sources
  const pruned = await pruneStaleInternals(merged);

  // 4. Sync files
  const sync = new DocSync(tbdRoot, pruned);
  const result = await sync.sync();

  // 5. Write config if changed
  if (!deepEqual(pruned, config.docs_cache?.files)) {
    config.docs_cache = { ...config.docs_cache, files: pruned };
    await writeConfig(tbdRoot, config);
  }

  // 6. Update state
  await updateLocalState(tbdRoot, {
    last_doc_sync_at: new Date().toISOString(),
  });

  return result;
}
```

### Auto-Prune Logic

```typescript
async function pruneStaleInternals(
  config: Record<string, string>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const [dest, source] of Object.entries(config)) {
    if (source.startsWith('internal:')) {
      // Check if bundled doc exists
      const exists = await internalDocExists(source);
      if (!exists) {
        console.warn(`Removing stale internal doc: ${dest}`);
        continue; // Don't include in result
      }
    }
    result[dest] = source;
  }

  return result;
}
```

### Output Design

**`tbd sync` (default - both):**
```
Syncing docs...
  Added 2 doc(s), updated 1 doc(s)
Syncing issues...
  Pulled 3 issue(s), pushed 2 issue(s)
Synced: ↓3 ↑2 issues, +2 ~1 docs
```

**`tbd sync --status`:**
```
Docs:
  2 new bundled doc(s) available
  Last synced: 2 days ago

Issues:
  Local: 1 modified, 1 new
  Remote: 2 commit(s) behind
```

### Acceptance Criteria

1. `tbd sync` syncs both issues and docs
2. `tbd sync --issues` syncs only issues (same as current `tbd sync`)
3. `tbd sync --docs` syncs only docs (same as removed `tbd docs --refresh`)
4. New bundled docs automatically appear after `npm update && tbd sync`
5. User customizations (URL sources) preserved across syncs
6. Stale internal entries auto-pruned with warning
7. Config only written when actually changed
8. `tbd docs --refresh` removed (command not found)
9. Auto-sync (24h) picks up new bundled docs
10. `tbd sync --status` shows both issue and doc status

## Stage 2: Architecture Stage

### File Changes

```
packages/tbd/src/cli/commands/
├── sync.ts           # MODIFY: Add doc sync, --issues/--docs flags
├── docs.ts           # MODIFY: Remove --refresh and --status options
└── setup.ts          # MODIFY: Use shared syncDocs() function

packages/tbd/src/file/
├── doc-sync.ts       # MODIFY: Add pruneStaleInternals(), export syncDocs()
└── doc-cache.ts      # MODIFY: Update auto-sync to merge defaults
```

### Shared Doc Sync Function

Extract doc sync logic into a reusable function in `doc-sync.ts`:

```typescript
// packages/tbd/src/file/doc-sync.ts

export interface DocSyncOptions {
  /** If true, suppress output (for auto-sync) */
  quiet?: boolean;
  /** If true, don't write files (dry run for --status) */
  dryRun?: boolean;
}

export interface DocSyncResult {
  added: string[];
  updated: string[];
  removed: string[];
  pruned: string[];  // NEW: entries removed due to missing internals
  configChanged: boolean;
  errors: { path: string; error: string }[];
}

/**
 * Sync docs with merged defaults and auto-pruning.
 * This is the single entry point for all doc sync operations.
 */
export async function syncDocsWithDefaults(
  tbdRoot: string,
  options?: DocSyncOptions
): Promise<DocSyncResult>;
```

### Updated Auto-Sync in DocCache

```typescript
// packages/tbd/src/file/doc-cache.ts

private async checkAutoSync(quiet: boolean): Promise<void> {
  // ... existing staleness check ...

  // CHANGE: Use syncDocsWithDefaults() instead of direct DocSync
  // This ensures auto-sync also merges defaults
  await syncDocsWithDefaults(tbdRoot, { quiet });
}
```

### Sync Command Changes

```typescript
// packages/tbd/src/cli/commands/sync.ts

interface SyncOptions {
  push?: boolean;
  pull?: boolean;
  status?: boolean;
  force?: boolean;
  fix?: boolean;
  issues?: boolean;  // NEW: sync only issues
  docs?: boolean;    // NEW: sync only docs
}

async run(options: SyncOptions): Promise<void> {
  // Validate mutually exclusive options
  if (options.issues && options.docs) {
    throw new CLIError('Cannot use both --issues and --docs');
  }
  if ((options.issues || options.docs) && (options.push || options.pull)) {
    throw new CLIError('--push/--pull only work with issue sync');
  }

  const syncDocs = !options.issues;  // Sync docs unless --issues
  const syncIssues = !options.docs;  // Sync issues unless --docs

  // 1. Sync docs first (fast, local)
  if (syncDocs) {
    const docResult = await syncDocsWithDefaults(this.tbdRoot, {
      quiet: this.ctx.quiet,
      dryRun: options.status,
    });
    this.reportDocSync(docResult, options.status);
  }

  // 2. Sync issues second (network)
  if (syncIssues) {
    // ... existing issue sync logic ...
  }
}
```

## Stage 3: Implementation

### Phase 1: Extract Shared Doc Sync Function

- [ ] Create `syncDocsWithDefaults()` in `doc-sync.ts`
- [ ] Add `pruneStaleInternals()` helper
- [ ] Add config comparison and conditional write
- [ ] Unit tests for new functions

### Phase 2: Update Sync Command

- [ ] Add `--issues` and `--docs` flags
- [ ] Validate mutually exclusive flag combinations
- [ ] Call `syncDocsWithDefaults()` when syncing docs
- [ ] Update output to show both issue and doc results
- [ ] Update `--status` to show both statuses

### Phase 3: Update Auto-Sync in DocCache

- [ ] Change `checkAutoSync()` to use `syncDocsWithDefaults()`
- [ ] Ensure auto-sync merges defaults (picks up new bundled docs)
- [ ] Unit tests for auto-sync behavior

### Phase 4: Remove docs --refresh

- [ ] Remove `--refresh` option from docs command
- [ ] Remove `--status` option from docs command (moved to sync)
- [ ] Update `handleRefresh()` and `handleStatus()` removal
- [ ] Update docs command help text

### Phase 5: Update Setup Command

- [ ] Replace inline doc sync logic with `syncDocsWithDefaults()`
- [ ] Ensure setup still works correctly
- [ ] Remove duplicate doc sync code

### Phase 6: Update Documentation

- [ ] Update tbd-design.md sync section
- [ ] Update SKILL.md sync instructions
- [ ] Update any shortcuts referencing `docs --refresh`
- [ ] Update CLI help text

### Phase 7: Testing

- [ ] Unit tests for `syncDocsWithDefaults()`
- [ ] Unit tests for auto-prune behavior
- [ ] Integration test: `tbd sync` syncs both
- [ ] Integration test: `tbd sync --issues` only syncs issues
- [ ] Integration test: `tbd sync --docs` only syncs docs
- [ ] Integration test: new bundled docs appear after upgrade simulation
- [ ] Integration test: stale internals are pruned
- [ ] Verify `tbd docs --refresh` returns command not found

## Open Questions

1. **Should `--status` be split?** Currently proposed as showing both.
   Could also have `--status --issues` or `--status --docs` for selective status.

   **Recommendation**: Keep simple - `--status` always shows both.
   Selective status adds complexity without much value.

2. **What about `tbd docs --status`?** The docs command still exists for viewing docs.
   Should it have its own `--status`?

   **Recommendation**: No.
   Status is a sync concern, not a docs viewing concern.
   Use `tbd sync --status` for all sync status.

3. **Output verbosity?** Should doc sync results show in default output, or only
   verbose?

   **Recommendation**: Show summary in default output ("Synced: +2 ~1 docs"), details in
   verbose mode.
