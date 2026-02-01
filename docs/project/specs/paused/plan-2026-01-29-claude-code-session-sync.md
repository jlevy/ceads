# Feature: Sync Outbox for Resilient Issue Syncing

**Date:** 2026-01-29

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

This spec addresses sync resilience: when `tbd sync` cannot push to the remote (network
errors, permission issues, Claude Code branch restrictions, etc.), issue data should be
preserved locally and synced when conditions allow.

The solution is a **committed outbox** that stores incremental changes when sync fails.
The outbox lives on the user’s current branch and travels with it through merges and
checkouts, ensuring data is never lost even when the `tbd-sync` branch cannot be pushed.

## Goals

- **G1**: **No data loss** - Issue data must never be lost, even when sync fails
- **G2**: **Incremental storage** - Outbox stores only changed issues and new IDs, not
  full copies (keeps git diffs small even with hundreds of issues)
- **G3**: **Branch-agnostic** - Outbox works on any branch (main, feature, Claude Code
  session branches)
- **G4**: **Clean merges** - When branches with outboxes merge, conflicts are rare and
  resolvable
- **G5**: Standard environments should continue working unchanged

## Non-Goals

- Changing the fundamental sync architecture (worktree model remains)
- Special handling for specific environments (Claude Code, etc.)
  - the outbox handles all
- Cloning entire issue sets to outbox (incremental only)

## Background

### Problem Discovery

During a tbd development session in Claude Code, `tbd sync` reported “Already in sync”
even though there were local commits not pushed to the remote.
Investigation revealed:

1. `tbd sync` successfully creates local commits
2. The push to `origin/tbd-sync` silently fails with HTTP 403
3. The error was swallowed (see tbd-ca3g for the silent error bug)
4. Even after fixing error reporting, the push still fails

### Root Cause: Push Restrictions

Various environments restrict which branches can be pushed:

- **Claude Code**: Enforces session-specific branch naming (`claude/*-{SESSION_ID}`)
- **Protected branches**: Some repos protect certain branch patterns
- **Network issues**: Transient connectivity problems
- **Permission issues**: User may lack push access to certain branches

The common thread: the `tbd-sync` branch may not be pushable, but the user’s working
branch (main, feature branch, session branch) typically IS pushable.

### Current Impact (Before This Feature)

1. `tbd sync` fails with an error (HTTP 403, network error, etc.)
2. Issues are committed to the local `tbd-sync` worktree but never reach the remote
3. If the user does a fresh checkout, those issues are lost
4. No recovery mechanism exists

## Design

### Recommended Approach: Committed Outbox

A `.tbd/outbox/` directory stores **incremental** issue data when remote sync fails.
The outbox is **committed to the user’s current branch** (not gitignored), so it
survives across clones and checkouts even when `tbd-sync` cannot be pushed.

### Why Committed Outbox?

The outbox being committed (not gitignored) provides critical benefits:

- **Survives fresh clones**: Outbox data comes along when cloning/checking out
- **Works on any branch**: User’s working branch can usually be pushed even when
  `tbd-sync` cannot
- **Cross-branch recovery**: When branches merge, outboxes merge too
- **Audit trail**: Git history shows what went into outbox and when it was synced

### Why Incremental Storage?

The outbox stores only **changed issues** and **new ID mappings**, not full copies:

- A project may have hundreds or thousands of issues
- Copying all issues to outbox would create massive git diffs
- Incremental storage keeps outbox small (typically a handful of issues)
- Only issues that failed to sync need to be in outbox

### Configuration

The outbox feature is controlled by a config flag (enabled by default):

```yaml
# .tbd/config.yml
sync:
  branch: tbd-sync
  remote: origin
  enable_outbox: true  # Default: true. Set false to disable outbox fallback.
```

**When `enable_outbox: false`:**

- Issue create/update writes ONLY to worktree (no outbox write)
- If push fails, the failure is simply reported (no outbox recovery)
- Issues remain in worktree but may not be synced to remote
- No `.tbd/outbox/` directory is created or used
- This is the pre-outbox behavior: sync either works or fails

Use `enable_outbox: false` if you:
- Want simpler behavior without the safety net
- Trust that sync will always succeed
- Prefer explicit failure over automatic recovery

### Architecture

```
.tbd/
├── data-sync-worktree/     # Existing: worktree on tbd-sync branch
├── outbox/                 # NEW: on user's current branch (NOT gitignored)
│   ├── issues/             # Only issues that failed to sync (incremental)
│   └── mappings/
│       └── ids.yml         # Only NEW short ID mappings (incremental)
├── config.yml
└── state.yml
```

**Key design choice**: The outbox is **on the user’s current branch** (not gitignored),
not on the `tbd-sync` branch.
This means:
- Outbox data is versioned alongside user code
- Outbox data can be pushed/pulled with the user’s working branch
- When branches merge, outboxes merge too (enabling cross-branch recovery)
- tbd does NOT auto-commit outbox changes to the user’s branch (user controls commits)
- tbd DOES auto-commit to `tbd-sync` (existing behavior, unchanged)

### What Goes in the Outbox

The outbox uses a **write-through** strategy: every time we write to the worktree, we
ALSO write to the outbox.
This eliminates the need to reconstruct what changed from git diffs.

| Content | What's Stored | When Written |
| --- | --- | --- |
| Issues | Issue files being created/updated | At write time (parallel to worktree) |
| ID Mappings | New short ID → ULID mappings | At write time (parallel to worktree) |

**File naming and format**: The outbox structure mirrors the `data-sync` directory
exactly:

```
.tbd/outbox/                      # Mirrors .tbd/data-sync-worktree/.tbd/data-sync/
├── issues/
│   ├── {ulid1}.md                # Same filename format as worktree
│   └── {ulid2}.md
└── mappings/
    └── ids.yml                   # Same YAML format, may be a subset
```

- **Issue files**: Same `{ulid}.md` naming, same YAML frontmatter + markdown format
- **ID mappings**: Same `ids.yml` format (YAML key-value map), sorted alphabetically
- **Subset allowed**: Outbox `ids.yml` may contain only NEW mappings (not the full list)
- **Sorted YAML**: Because IDs are sorted alphabetically, merge conflicts are
  rare—changes typically affect different lines

This identical structure means:
- No format conversion needed when merging outbox → worktree
- Standard file comparison works for detecting no-op merges
- Existing issue parsing code works on outbox files

**Why write-through?**
- No git diff parsing needed to identify changed files
- Handles multiple commits naturally (we know what we wrote)
- Simpler logic: always write to both places, always clear on success
- The outbox becomes a “transaction log” of pending changes

**User experience:**
- User creates/updates issue → appears in outbox immediately (uncommitted file change)
- User runs `tbd sync` → outbox clears (if push succeeds)
- If sync fails → outbox stays, warning printed with commit instructions
- User/agent commits outbox to preserve data across checkouts
- The outbox is a visible “pending changes” indicator

This is good UX because users typically run sync frequently.
The outbox provides visibility into what hasn’t reached the remote yet.

**Critical for data safety**: If push fails, tbd prints a warning instructing the
user/agent to commit the outbox.
This is NOT automatic—tbd never auto-commits to the user’s working branch.
But the warning ensures users/agents know to take action.
If the warning is ignored and the user does a fresh checkout, uncommitted outbox data is
lost. Agents SHOULD always follow the warning and commit the outbox.

**User can edit outbox files:**
- Outbox files are regular files the user can see and edit
- User might create an issue, then want to modify it before sync
- Since outbox is merged to worktree FIRST during sync, user edits are applied
- This makes the outbox a visible, editable staging area
- Example: User creates issue with typo → edits `.tbd/outbox/issues/xyz.md` → runs sync
  → fixed version gets synced

**Note**: Since tbd never deletes issue files, “new or updated” covers all changes.

### Outbox Behavior

| Scenario | Write Behavior | Sync Behavior |
| --- | --- | --- |
| Normal (push works) | Write to worktree | Commit + push, outbox stays empty |
| Push fails (403, network) | Write-through already populated outbox | Warning printed; user/agent must commit outbox |
| Next sync (push works) | N/A | Merge outbox → worktree → push → clear outbox |
| Same location retry | No-op merge (files match) | Retry push, clear on success |
| Fresh checkout | Outbox has data, worktree behind | Merge restores data to worktree |

### Conflict Resolution

**Key insight**: Outbox → worktree merge uses the **same conflict resolution logic** as
remote → worktree merge.
The existing tbd sync conflict handling (timestamp-based YAML merging) applies directly:

- Same issue modified in outbox AND remote → use existing merge logic
- Field-level conflict resolution for YAML issue files
- Last-write-wins as fallback (same as current remote sync)
- Attic used for conflict backups (same as current sync)

No new conflict handling code needed.

### ID Mapping Merge

The `ids.yml` merge is a **union operation**:

- Short IDs are unique (no conflicts possible)
- Outbox ids.yml entries are added to worktree ids.yml
- Uses same merge logic as current sync (or creates file if missing)

### Edge Cases

**Corrupted outbox files**: If an outbox file (e.g., `.tbd/outbox/issues/abc.md`) is
malformed YAML or otherwise unparseable:

- `mergeOutboxToWorktree()` should **skip the corrupted file** and log a warning
- Continue processing other valid outbox files
- Report which files were skipped so user can investigate
- Do NOT fail the entire sync due to one bad file

**User deletes outbox manually**: If a user runs `rm -rf .tbd/outbox/` thinking it’s a
cache:

- This is **safe** - the data is also in the worktree (already committed there)
- The outbox is a safety copy, not the source of truth
- Next sync will proceed normally (no outbox to merge)
- If the worktree push then fails, write-through will repopulate the outbox

### Write-Through Flow

The outbox uses **write-through**: every write to worktree is mirrored to outbox.

```
tbd create / tbd update / tbd close (when enable_outbox: true):

  1. Write issue to worktree (existing behavior)
  2. ALSO write issue to .tbd/outbox/issues/ (new)
  3. If new short ID generated:
     a. Add to worktree ids.yml (existing behavior)
     b. ALSO add to .tbd/outbox/mappings/ids.yml (new)
```

This means the outbox always has the latest uncommitted/unpushed changes, with no need
to reconstruct from git diffs.

### Sync Flow with Outbox

The outbox introduces a new “outbox sync” category alongside the existing docs sync and
issues sync. **Outbox sync always runs first** to ensure the worktree has full history
before proceeding.

```
tbd sync (when enable_outbox: true):

  0. SNAPSHOT OUTBOX (for concurrent operation safety)
     └── Record current outbox files BEFORE any operations
         - List issue files in .tbd/outbox/issues/
         - List ID mappings in .tbd/outbox/mappings/ids.yml
         - This snapshot determines what gets merged and cleared
         - Files created AFTER this point (during sync) are preserved

  1. OUTBOX SYNC (runs first)
     └── Check if snapshot has pending data
         └── If yes:
             a. Copy SNAPSHOTTED outbox issues → worktree (using standard merge + attic)
             b. Merge SNAPSHOTTED outbox ids.yml → worktree ids.yml (union of entries)
             c. Commit merged changes to worktree
             NOTE: If same location as last failure, this is a no-op (files match)
             NOTE: If fresh checkout, worktree is behind outbox, so merge applies

  2. NORMAL SYNC
     a. Fetch remote tbd-sync
     b. Merge remote → worktree (existing logic)
     c. Commit local changes to worktree

  3. PUSH
     └── Try push to remote tbd-sync
         ├── SUCCESS:
         │   a. Clear ONLY SNAPSHOTTED outbox files (preserve files created during sync)
         │   b. Report "synced"
         │   NOTE: Outbox removal is NOT auto-committed. User controls when to
         │         commit changes to their working branch.
         │
         └── FAILURE (403, network, etc):
             a. Outbox already has the data (from write-through)
             b. Print WARNING with error details and TWO OPTIONS:
                - Option 1: Resolve the issue and run `tbd sync` again
                - Option 2: Commit the outbox to preserve data
             NOTE: tbd does NOT auto-commit. User/agent chooses which option.
```

### Push Failure Warning

When push fails, `tbd sync` MUST print a clear, actionable warning that presents **two
options**:

```
⚠️  Sync failed: {ERROR_DETAILS}

Your issue changes are saved locally in .tbd/outbox/

You have two options:

  1. RESOLVE AND RETRY: Fix the issue above and run `tbd sync` again.
     If sync succeeds, the outbox will be cleared automatically.

  2. COMMIT OUTBOX: Preserve your data by committing the outbox:
     git add .tbd/outbox && git commit -m "tbd: preserve outbox (sync failed)"

Warning: If you do neither and perform a fresh checkout, your issue data will be lost.
```

Where `{ERROR_DETAILS}` includes the specific error (e.g., “HTTP 403 - push to
‘tbd-sync’ forbidden”, “Network error - connection refused”, etc.).

**Why two options:**

1. **Resolve and retry** - If the issue is transient (network blip) or fixable
   (permissions), the user can fix it and sync again.
   The outbox clears on success.
2. **Commit outbox** - If the issue cannot be resolved (e.g., Claude Code’s branch
   restrictions), committing the outbox preserves data across checkouts.

**Why explicit warning matters:**

- tbd never auto-commits to the user’s working branch (user controls their commits)
- But users/agents MUST know their data is at risk if they don’t act
- The warning gives users agency: fix the problem OR commit the fallback
- Agents (like Claude Code) will typically commit the outbox since they can’t resolve
  the underlying restriction

**Data safety depends on user action:**

| User Action After Warning | Data Survives Fresh Checkout? |
| --- | --- |
| Resolves issue, runs `tbd sync` again | Yes (outbox cleared) |
| Commits outbox, pushes branch | Yes |
| Commits outbox, doesn't push | Yes (locally) |
| Ignores warning | **No** - data lost on fresh checkout |

### Agent Behavior on Sync Failure

When an AI agent (Claude Code, Cursor, etc.)
encounters a sync push failure, it should evaluate the two options:

1. **If the issue is resolvable** (e.g., network error, temporary auth issue):
   - Fix the issue
   - Run `tbd sync` again
   - Outbox clears on success

2. **If the issue is NOT resolvable** (e.g., branch restrictions, persistent permission
   issues):
   - Commit the outbox to preserve data
   - Push the working branch (which typically succeeds even when `tbd-sync` doesn’t)
   - Data survives across checkouts and branch merges

When the underlying issue cannot be resolved, option 2 is the right choice.

**Example agent response to sync failure:**

```
Sync failed with HTTP 403 (branch push forbidden).
Committing outbox to preserve issue data...

$ git add .tbd/outbox
$ git commit -m "tbd: preserve outbox (sync failed)"
$ git push origin my-feature-branch

Outbox committed and pushed. Data will be recovered on next successful sync.
```

This workflow ensures data is preserved on the working branch.
The outbox travels with the branch through merges and gets recovered when conditions
allow a successful sync.

### Critical: Clear Timing

**The outbox is cleared ONLY after push succeeds.** This is critical for data safety:

- If we cleared after worktree commit but before push, and push fails, data is lost
- By clearing only after push succeeds, we guarantee the data reached the remote
- The outbox acts as a “safety net” until data is confirmed synced

### Concurrent Operation Safety (Snapshot-Based Clear)

A race condition exists if `tbd create` runs while `tbd sync` is in progress:

```
Timeline (WITHOUT snapshot-based clear):
1. tbd sync starts, snapshots nothing, merges outbox → worktree
2. User runs `tbd create "New issue"` (writes to worktree AND outbox)
3. tbd sync pushes (includes new issue in worktree)
4. tbd sync clears ALL of outbox (DELETES the new issue!)
5. Push actually failed (network timeout after partial send)
6. New issue is now lost from outbox - DATA LOSS
```

**Solution: Snapshot-based clear.** Instead of “clear everything in outbox,” we “clear
only what we snapshotted at sync start.”

**Why not file locks?** File locks (flock, fcntl, lockfile) are unreliable on network
filesystems (NFS, SMB). They can be silently lost, cause deadlocks, or simply not work.
The snapshot approach requires no locking primitives and is safe on any filesystem.

**How it works:**

1. At sync start, snapshot the list of files currently in outbox
2. Merge only those snapshotted files to worktree
3. Perform normal sync and push
4. On success, delete only the snapshotted files (not files created during sync)
5. Files created during sync remain in outbox for next sync

```typescript
interface OutboxSnapshot {
  /** Issue filenames (e.g., ['01ABC.md', '01DEF.md']) */
  issues: string[];
  /** Short IDs that were in ids.yml (e.g., ['tbd-a1b2', 'tbd-c3d4']) */
  ids: string[];
  /** Timestamp when snapshot was taken (for debugging) */
  timestamp: number;
}

/**
 * Snapshot current outbox state at sync start.
 * Only files in this snapshot will be merged and cleared.
 */
async function snapshotOutbox(tbdRoot: string): Promise<OutboxSnapshot> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  const snapshot: OutboxSnapshot = {
    issues: [],
    ids: [],
    timestamp: Date.now(),
  };

  // Snapshot issue files
  const issuesDir = join(outboxDir, 'issues');
  if (await dirExists(issuesDir)) {
    snapshot.issues = (await readdir(issuesDir))
      .filter(f => f.endsWith('.md'));
  }

  // Snapshot ID mappings
  const idsPath = join(outboxDir, 'mappings', 'ids.yml');
  if (await fileExists(idsPath)) {
    const idMap = await readIdMappings(idsPath);
    snapshot.ids = Object.keys(idMap);
  }

  return snapshot;
}

/**
 * Clear only the files that were in our snapshot.
 * Files created after snapshot (during sync) are preserved.
 *
 * IMPORTANT: Only call after push succeeds.
 */
async function clearSnapshotedOutboxFiles(
  tbdRoot: string,
  snapshot: OutboxSnapshot
): Promise<void> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);

  // Delete only snapshotted issue files
  for (const issueFile of snapshot.issues) {
    const issuePath = join(outboxDir, 'issues', issueFile);
    await rm(issuePath, { force: true });
  }

  // Remove only snapshotted IDs from ids.yml (preserve new ones)
  const idsPath = join(outboxDir, 'mappings', 'ids.yml');
  if (await fileExists(idsPath) && snapshot.ids.length > 0) {
    const currentIds = await readIdMappings(idsPath);

    // Remove only the IDs that were in our snapshot
    for (const shortId of snapshot.ids) {
      delete currentIds[shortId];
    }

    // Write back remaining IDs, or delete file if empty
    if (Object.keys(currentIds).length === 0) {
      await rm(idsPath, { force: true });
    } else {
      await writeIdMappings(idsPath, currentIds);
    }
  }

  // Clean up empty directories
  await rmdirIfEmpty(join(outboxDir, 'issues'));
  await rmdirIfEmpty(join(outboxDir, 'mappings'));
  await rmdirIfEmpty(outboxDir);
}

/**
 * Remove directory if empty (no-op if non-empty or doesn't exist).
 */
async function rmdirIfEmpty(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir);
    if (entries.length === 0) {
      await rmdir(dir);
    }
  } catch {
    // Directory doesn't exist or can't be read - that's fine
  }
}
```

**Race condition resolved:**

```
Timeline (WITH snapshot-based clear):
1. tbd sync starts, snapshots outbox (empty or has old issues)
2. User runs `tbd create "New issue"` (writes to worktree AND outbox)
3. tbd sync merges snapshot → worktree (new issue not in snapshot)
4. tbd sync pushes
5. tbd sync clears only snapshotted files (new issue PRESERVED in outbox)
6. Even if push failed, new issue is safe in outbox
```

### No-Op Case (Same Location Retry)

When retrying a failed sync from the same location:

1. Last sync: Failed to push, but committed to local worktree AND saved to outbox
2. This sync: Outbox has same files as worktree (already committed locally)
3. Merge outbox → worktree is a no-op (files already match)
4. Try push again
5. If succeeds: clear outbox
6. If fails again: copy-to-outbox is also a no-op (files already in outbox)

The entire retry cycle is **idempotent** - repeating it causes no harm and no data
duplication.

### Fresh Checkout Case

When syncing from a fresh checkout **where outbox was previously committed**:

1. Worktree doesn’t exist yet
2. `tbd sync` initializes worktree from remote `tbd-sync` (which doesn’t have the
   previously-failed data)
3. Outbox has the failed data (committed to user’s branch, came with checkout)
4. Outbox sync merges the data into worktree (now that worktree exists)
5. Normal sync proceeds
6. Push includes the recovered data

**Important**: Worktree initialization MUST happen before outbox merge.
The current sync implementation already ensures this (worktree is created/repaired
before any operations).

**Critical precondition**: Recovery requires the user/agent to have committed the outbox
after the previous push failure (following the warning instructions).
If the outbox was never committed before the fresh checkout, data from that session is
lost. This is why the push failure warning is critical and why agents SHOULD always
commit the outbox.

### Outbox Implementation

```typescript
const OUTBOX_DIR = '.tbd/outbox';

// ============================================================================
// WRITE-THROUGH: Called at issue/ID write time
// ============================================================================

/**
 * Write issue to outbox (called alongside worktree write).
 *
 * This is the write-through pattern: every worktree write is mirrored to outbox.
 */
async function writeIssueToOutbox(
  tbdRoot: string,
  issue: Issue
): Promise<void> {
  const config = await readConfig(tbdRoot);
  if (!config.sync?.enable_outbox) return; // Outbox disabled

  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  await ensureDir(join(outboxDir, 'issues'));
  await writeIssue(join(outboxDir, 'issues'), issue);
}

/**
 * Add ID mapping to outbox (called alongside worktree ids.yml write).
 *
 * This is the write-through pattern: every new ID is mirrored to outbox.
 */
async function addIdToOutbox(
  tbdRoot: string,
  shortId: string,
  ulid: string
): Promise<void> {
  const config = await readConfig(tbdRoot);
  if (!config.sync?.enable_outbox) return; // Outbox disabled

  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  await ensureDir(join(outboxDir, 'mappings'));

  const outboxIdsPath = join(outboxDir, 'mappings', 'ids.yml');
  const existingIds = await readIdMappings(outboxIdsPath).catch(() => ({}));
  existingIds[shortId] = ulid;
  await writeIdMappings(outboxIdsPath, existingIds);
}

// ============================================================================
// SYNC TIME: Check, merge, and clear outbox
// ============================================================================

/**
 * Check if outbox has any pending data.
 */
async function hasOutboxData(tbdRoot: string): Promise<boolean> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  const issuesDir = join(outboxDir, 'issues');
  const idsPath = join(outboxDir, 'mappings', 'ids.yml');

  const hasIssues = await dirExists(issuesDir) &&
    (await readdir(issuesDir)).length > 0;
  const hasIds = await fileExists(idsPath);

  return hasIssues || hasIds;
}

/**
 * Get count of items in outbox (for status reporting).
 */
async function getOutboxCount(tbdRoot: string): Promise<{ issues: number; ids: number }> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  const issuesDir = join(outboxDir, 'issues');
  const idsPath = join(outboxDir, 'mappings', 'ids.yml');

  let issues = 0;
  let ids = 0;

  if (await dirExists(issuesDir)) {
    issues = (await readdir(issuesDir)).filter(f => f.endsWith('.md')).length;
  }
  if (await fileExists(idsPath)) {
    const idMap = await readIdMappings(idsPath);
    ids = Object.keys(idMap).length;
  }

  return { issues, ids };
}

/**
 * Merge pending outbox data into worktree.
 * Uses existing conflict resolution from sync (including attic).
 *
 * This is additive: outbox issues are merged into worktree,
 * outbox IDs are unioned into worktree ids.yml.
 *
 * Called at START of sync, before fetching remote.
 */
async function mergeOutboxToWorktree(
  tbdRoot: string,
  dataSyncDir: string
): Promise<{ merged: number; conflicts: string[] }> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);

  if (!await hasOutboxData(tbdRoot)) {
    return { merged: 0, conflicts: [] };
  }

  const conflicts: string[] = [];
  let merged = 0;

  // 1. Merge issues (using existing merge algorithm + attic)
  const outboxIssuesDir = join(outboxDir, 'issues');
  if (await dirExists(outboxIssuesDir)) {
    const outboxIssues = await listIssues(outboxIssuesDir);

    for (const outboxIssue of outboxIssues) {
      const existing = await readIssue(dataSyncDir, outboxIssue.id).catch(() => null);

      if (existing) {
        // Issue exists in worktree - use standard merge (with attic for conflicts)
        const result = mergeIssues(null, outboxIssue, existing);
        await writeIssue(dataSyncDir, result.merged);
        if (result.conflicts.length > 0) {
          conflicts.push(outboxIssue.id);
        }
      } else {
        // Issue doesn't exist in worktree - just copy
        await writeIssue(dataSyncDir, outboxIssue);
      }
      merged++;
    }
  }

  // 2. Merge ID mappings (union operation)
  const outboxIdsPath = join(outboxDir, 'mappings', 'ids.yml');
  if (await fileExists(outboxIdsPath)) {
    const outboxIds = await readIdMappings(outboxIdsPath);
    const worktreeIdsPath = join(dataSyncDir, 'mappings', 'ids.yml');
    const worktreeIds = await readIdMappings(worktreeIdsPath).catch(() => ({}));

    // Union: add outbox entries to worktree (short IDs are unique, no conflicts)
    const mergedIds = { ...worktreeIds, ...outboxIds };
    await writeIdMappings(worktreeIdsPath, mergedIds);
  }

  return { merged, conflicts };
}

// NOTE: Outbox clearing uses clearSnapshotedOutboxFiles() with a snapshot taken at
// sync start. See "Concurrent Operation Safety" section for the implementation.
```

### Integration Points

**Important**: Write-through should be added at the **command layer**, not the storage
layer. The storage layer (`writeIssue()` in `storage.ts`) is a pure file operation with
no knowledge of tbd root or outbox.
Adding outbox logic there would create unwanted coupling.

Instead, add write-through in the command implementations where tbd root is already
known:

```typescript
// In create.ts - packages/tbd/src/cli/commands/create.ts
export async function createIssue(tbdRoot: string, ...): Promise<Issue> {
  // ... existing create logic ...
  await writeIssue(dataSyncDir, issue);

  // NEW: Write-through to outbox (tbdRoot is already available here)
  await writeIssueToOutbox(tbdRoot, issue);

  // ... existing ID mapping logic ...
  await addIdMapping(dataSyncDir, shortId, ulid);

  // NEW: Write-through ID to outbox
  await addIdToOutbox(tbdRoot, shortId, ulid);

  return issue;
}

// Similarly in update.ts and close.ts
export async function updateIssue(tbdRoot: string, ...): Promise<Issue> {
  // ... existing update logic ...
  await writeIssue(dataSyncDir, issue);

  // NEW: Write-through to outbox
  await writeIssueToOutbox(tbdRoot, issue);

  return issue;
}
```

**Why command layer?**
- `tbdRoot` is already available in command context
- Keeps storage layer as pure file operations (no tbd-specific logic)
- Clear separation: storage writes files, commands orchestrate tbd operations
- Easier to test: can test storage and outbox independently

## Implementation Plan

### Phase 1: Committed Outbox (Primary Safety Net)

Implement the outbox to guarantee no data loss regardless of push failures.

**Config:**
- [ ] Add `sync.enable_outbox` to config schema (default: `true`)
- [ ] Read config flag where needed

**Write-Through Functions (called at write time):**
- [ ] Implement `writeIssueToOutbox()` - mirror issue write to outbox
- [ ] Implement `addIdToOutbox()` - mirror ID mapping to outbox
- [ ] Integrate into command layer (create.ts, update.ts, close.ts)
- [ ] NOT in storage layer - keep storage as pure file operations

**Sync-Time Functions:**
- [ ] Implement `hasOutboxData()` - check if outbox has pending issues/IDs
- [ ] Implement `getOutboxCount()` - count items for status reporting
- [ ] Implement `snapshotOutbox()` - snapshot current outbox state at sync start
- [ ] Implement `mergeOutboxToWorktree()` - merge pending data using existing conflict
  resolution (including attic); accept snapshot parameter to merge only snapshotted
  files
- [ ] Implement `clearSnapshotedOutboxFiles()` - clear only snapshotted files after
  successful push (preserves files created during sync)

**ID Mapping Helpers:**
- [ ] Implement `readIdMappings()` - parse ids.yml to object
- [ ] Implement `writeIdMappings()` - write object to ids.yml

**Sync Integration:**
- [ ] Update `tbd sync` to check/merge outbox FIRST (before normal sync)
- [ ] Update `tbd sync` to clear outbox ONLY after push succeeds
- [ ] Add `tbd sync --status` output for outbox count
- [ ] Implement push failure WARNING with TWO OPTIONS (see “Push Failure Warning”)
- [ ] Warning must include: error details, Option 1 (resolve + retry), Option 2 (commit
  outbox), data loss risk

**Important:** Outbox is on the user’s branch (NOT gitignored).
tbd does NOT auto-commit outbox changes - user sees them as uncommitted file changes.
When push fails, tbd prints a warning with two options: (1) resolve the issue and run
`tbd sync` again (outbox clears on success), or (2) commit the outbox to preserve data.

**Tests:**
- [ ] Add unit tests for write-through operations
- [ ] Add unit tests for merge/clear operations
- [ ] Add integration test: create issue → appears in outbox → sync clears it
- [ ] Add integration test: push fails → outbox retained → next sync merges
- [ ] Add integration test: push fails → warning printed with commit instructions
- [ ] Add integration test: fresh checkout with committed outbox → data recovered
- [ ] Add integration test: fresh checkout without committed outbox → data lost
  (expected)
- [ ] Add integration test: retry cycle is idempotent
- [ ] Add integration test: concurrent create during sync preserves new issue
- [ ] Add unit test: `snapshotOutbox()` captures current state correctly
- [ ] Add unit test: `clearSnapshotedOutboxFiles()` only clears snapshotted files

### Phase 2: Doctor and Visibility

Add diagnostic support for the outbox feature.

- [ ] Add doctor check for outbox status (pending issues)
- [ ] Add `tbd sync --status` to show outbox count
- [ ] Add troubleshooting guide for sync issues

### Phase 3: Documentation

- [ ] Update tbd-design.md with outbox support (see details below)
- [ ] Add architecture diagram to developer docs

#### tbd-design.md Updates

The following sections in `packages/tbd/docs/tbd-design.md` need updates:

**1. Table of Contents**
- Add entry for new section `3.7 Sync Outbox`

**2. Section 2.2 Directory Structure**
- Add `outbox/` to the directory listing
- Note that outbox is NOT gitignored (committed to user’s branch)

**3. NEW Section 3.7 Sync Outbox** (insert between 3.6 Attic and 4. CLI)
- Purpose: Safety net for sync failures
- Configuration: `sync.enable_outbox` flag (default: true)
- Architecture: Committed to user’s branch, incremental storage
- Write-through pattern: Every worktree write mirrored to outbox
- Sync flow: Outbox merge → normal sync → push → clear on success
- Behavior when disabled: Simple failure reporting, no recovery

**4. Section 3.3.3 Sync Algorithm**
- Add reference to outbox sync phase (runs first when enabled)
- Note that outbox merge uses same conflict resolution as remote merge

**5. Section 4.7 Sync Commands**
- Document `tbd sync --status` showing outbox count
- Note outbox behavior in sync output

**6. Section 7.3 File Structure Reference**
- Add `outbox/` directory to the file tree under `.tbd/`:
  ```
  .tbd/
  ├── config.yml
  ├── .gitignore
  ├── docs/                       # Gitignored
  ├── state.yml                   # Gitignored
  ├── outbox/                     # NEW: Committed (NOT gitignored)
  │   ├── issues/                 # Pending issues (incremental)
  │   └── mappings/
  │       └── ids.yml             # Pending ID mappings
  └── data-sync-worktree/         # Gitignored
  ```
- Update file counts table to include outbox (typically 0-10 files, <10 KB)

## Testing Strategy

### Unit Tests

**Write-Through:**
- `writeIssueToOutbox()` - issue appears in outbox after write
- `addIdToOutbox()` - ID mapping appears in outbox after write
- Write-through respects `enable_outbox: false` config

**Sync-Time Outbox:**
- `hasOutboxData()` - empty vs populated outbox (issues only, ids only, both)
- `getOutboxCount()` - correct counts for reporting
- `snapshotOutbox()` - captures current files correctly, empty outbox returns empty
  snapshot
- `mergeOutboxToWorktree()` - no conflicts, with conflicts (uses attic), empty outbox
- `mergeOutboxToWorktree()` - corrupted file skipped with warning, valid files processed
- `clearSnapshotedOutboxFiles()` - clears only snapshotted files, preserves files
  created after snapshot

**Edge Cases:**
- Corrupted outbox file → skipped with warning, other files processed
- Deleted outbox directory → sync proceeds normally (no outbox to merge)
- Empty outbox directory → no-op merge

**ID Mappings:**
- `readIdMappings()` / `writeIdMappings()` - round-trip YAML
- Union merge of ids.yml (no conflicts, additive only)

### Integration Tests

```typescript
describe('Outbox write-through', () => {
  it('issue appears in outbox immediately after create', async () => {
    // Create an issue
    await tbd('create', 'Test issue');

    // Outbox should have the issue BEFORE sync
    const outboxIssues = await listIssues(join(tbdRoot, '.tbd/outbox/issues'));
    expect(outboxIssues.length).toBe(1);
    expect(outboxIssues[0].title).toBe('Test issue');
  });

  it('ID mapping appears in outbox immediately after create', async () => {
    // Create an issue (generates new ID)
    const result = await tbd('create', 'Test issue');
    const issueId = parseIssueId(result.stdout);

    // Outbox should have the ID mapping BEFORE sync
    const outboxIds = await readIdMappings(join(tbdRoot, '.tbd/outbox/mappings/ids.yml'));
    expect(Object.keys(outboxIds).length).toBe(1);
  });

  it('sync clears outbox on success', async () => {
    // Create issue (appears in outbox)
    await tbd('create', 'Test issue');
    expect(await hasOutboxData(tbdRoot)).toBe(true);

    // Sync succeeds
    await tbd('sync');

    // Outbox should be empty
    expect(await hasOutboxData(tbdRoot)).toBe(false);
  });

  it('only new issues go to outbox (not existing ones)', async () => {
    // Setup: 100 existing issues (already synced, not in outbox)
    await setupManyIssues(100);
    await tbd('sync'); // Clear outbox

    // Create 2 new issues
    await tbd('create', 'Test issue 1');
    await tbd('create', 'Test issue 2');

    // Verify only 2 issues in outbox (not 102)
    const outboxIssues = await listIssues(join(tbdRoot, '.tbd/outbox/issues'));
    expect(outboxIssues.length).toBe(2);
  });
});

describe('Outbox on sync failure', () => {
  it('outbox retained when push fails', async () => {
    // Create issue (write-through puts it in outbox)
    await tbd('create', 'Test issue');
    expect(await hasOutboxData(tbdRoot)).toBe(true);

    // Push fails
    mockPushFailure(403);
    await tbd('sync');

    // Outbox should still have the issue
    expect(await hasOutboxData(tbdRoot)).toBe(true);
  });

  it('prints warning with two options when push fails', async () => {
    // Create issue
    await tbd('create', 'Test issue');

    // Push fails
    mockPushFailure(403);
    const result = await tbd('sync');

    // Should print warning with error details
    expect(result.stderr).toContain('Sync failed');
    expect(result.stderr).toContain('.tbd/outbox');

    // Should present Option 1: resolve and retry
    expect(result.stderr).toContain('tbd sync');
    expect(result.stderr).toMatch(/resolve|retry|fix/i);

    // Should present Option 2: commit outbox
    expect(result.stderr).toContain('git add .tbd/outbox');
    expect(result.stderr).toContain('commit');

    // Should warn about data loss if neither option taken
    expect(result.stderr).toMatch(/data.*(lost|loss)/i);
  });

  it('clears outbox only after push succeeds', async () => {
    // Create issue (in outbox via write-through)
    await tbd('create', 'Test issue');

    // Push fails
    mockPushFailure(403);
    await tbd('sync');
    expect(await hasOutboxData(tbdRoot)).toBe(true);

    // Now push succeeds
    mockPushSuccess();
    await tbd('sync');

    // NOW outbox should be empty
    expect(await hasOutboxData(tbdRoot)).toBe(false);
  });

  it('retry cycle is idempotent', async () => {
    // Create issue (in outbox via write-through)
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');

    const outboxBefore = await readOutboxState(tbdRoot);

    // Retry multiple times (still failing)
    for (let i = 0; i < 3; i++) {
      await tbd('sync');
    }

    const outboxAfter = await readOutboxState(tbdRoot);

    // Outbox should be unchanged (no duplicates, no data loss)
    expect(outboxAfter).toEqual(outboxBefore);
  });

  it('recovers data on fresh checkout', async () => {
    // Create issue, fail push (outbox has data via write-through)
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');

    // Simulate fresh checkout (delete worktree, outbox remains)
    await deleteWorktree(tbdRoot);

    // Now push succeeds
    mockPushSuccess();
    await tbd('sync');

    // Issue should be recovered (merged from outbox) and pushed
    const issues = await listIssues(dataSyncDir);
    expect(issues.some(i => i.title === 'Test issue')).toBe(true);

    // Outbox should be cleared
    expect(await hasOutboxData(tbdRoot)).toBe(false);
  });

  it('handles conflict between outbox and remote', async () => {
    // Setup: same issue modified in outbox AND remote
    await setupOutboxWithIssue('test-1234', { title: 'Local title' });
    await setupRemoteWithIssue('test-1234', { title: 'Remote title' });

    // Sync should use existing conflict resolution (with attic)
    mockPushSuccess();
    const result = await tbd('sync');
    expect(result.stdout).toContain('resolved 1 conflict');

    // Attic should have backup
    const atticFiles = await glob('.tbd/data-sync-worktree/.tbd/data-sync/attic/**');
    expect(atticFiles.length).toBeGreaterThan(0);
  });
});

describe('Concurrent operation safety (snapshot-based clear)', () => {
  it('preserves issue created during sync', async () => {
    // Setup: one issue already in outbox
    await tbd('create', 'Existing issue');
    const existingOutbox = await listOutboxFiles(tbdRoot);
    expect(existingOutbox.issues.length).toBe(1);

    // Simulate: sync starts, snapshots outbox (1 issue)
    const snapshot = await snapshotOutbox(tbdRoot);
    expect(snapshot.issues.length).toBe(1);

    // Simulate: new issue created DURING sync (after snapshot)
    await tbd('create', 'New issue during sync');
    const midSyncOutbox = await listOutboxFiles(tbdRoot);
    expect(midSyncOutbox.issues.length).toBe(2);

    // Simulate: sync completes, clears only snapshotted files
    mockPushSuccess();
    await clearSnapshotedOutboxFiles(tbdRoot, snapshot);

    // New issue should still be in outbox
    const finalOutbox = await listOutboxFiles(tbdRoot);
    expect(finalOutbox.issues.length).toBe(1);
    const remainingIssue = await readIssue(join(tbdRoot, '.tbd/outbox/issues'), finalOutbox.issues[0]);
    expect(remainingIssue.title).toBe('New issue during sync');
  });

  it('preserves ID mapping added during sync', async () => {
    // Setup: one ID already in outbox
    await tbd('create', 'Existing issue');
    const snapshot = await snapshotOutbox(tbdRoot);
    expect(snapshot.ids.length).toBe(1);

    // Simulate: new issue created DURING sync
    await tbd('create', 'New issue during sync');

    // Clear only snapshotted IDs
    mockPushSuccess();
    await clearSnapshotedOutboxFiles(tbdRoot, snapshot);

    // New ID should still be in outbox ids.yml
    const remainingIds = await readIdMappings(join(tbdRoot, '.tbd/outbox/mappings/ids.yml'));
    expect(Object.keys(remainingIds).length).toBe(1);
  });

  it('snapshot is empty when outbox is empty', async () => {
    const snapshot = await snapshotOutbox(tbdRoot);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.ids).toEqual([]);
  });

  it('clearing empty snapshot is a no-op', async () => {
    // Create an issue (populates outbox)
    await tbd('create', 'Test issue');
    expect(await hasOutboxData(tbdRoot)).toBe(true);

    // Clear with empty snapshot (simulates: sync started with empty outbox)
    const emptySnapshot: OutboxSnapshot = { issues: [], ids: [], timestamp: Date.now() };
    await clearSnapshotedOutboxFiles(tbdRoot, emptySnapshot);

    // Issue should still be in outbox
    expect(await hasOutboxData(tbdRoot)).toBe(true);
  });
});
```

### Manual Testing Checklist

**Outbox (Incremental, on user’s branch):**
- [ ] Push fails → only CHANGED issues saved to outbox (not all issues)
- [ ] Push fails → only NEW ID mappings saved to outbox (not all IDs)
- [ ] Push fails → WARNING printed with TWO OPTIONS
- [ ] Warning includes error details (403, network error, etc.)
- [ ] Warning presents Option 1: resolve issue and run `tbd sync` again
- [ ] Warning presents Option 2: commit outbox with `git add .tbd/outbox && git commit`
- [ ] Warning mentions data loss risk if neither option taken
- [ ] Option 1 works: fix issue → `tbd sync` → outbox cleared
- [ ] Option 2 works: commit outbox → data preserved → recoverable on fresh checkout
- [ ] Outbox files appear as uncommitted changes (visible in git status)
- [ ] tbd does NOT auto-commit outbox changes to user’s branch
- [ ] Next successful sync → outbox merged (to worktree) and cleared
- [ ] Outbox cleared only AFTER push succeeds (not after worktree commit)
- [ ] `tbd sync --status` shows outbox count
- [ ] Conflict between outbox and remote → resolved correctly (attic used)
- [ ] Fresh checkout (after committing outbox) → outbox data recovered to worktree
- [ ] Fresh checkout (without committing outbox) → data lost (expected behavior)
- [ ] Retry cycle is idempotent (no data duplication)
- [ ] Config `enable_outbox: false` disables outbox behavior

**Edge Cases:**
- [ ] Corrupted outbox file → skipped with warning, other valid files processed
- [ ] User deletes `.tbd/outbox/` manually → sync proceeds normally (safe)
- [ ] Empty outbox directory → no-op merge, sync proceeds

**Concurrent Operations (Snapshot-Based Clear):**
- [ ] `tbd create` during sync → new issue preserved in outbox after sync completes
- [ ] `tbd update` during sync → updated issue preserved in outbox after sync completes
- [ ] Multiple creates during sync → all new issues preserved
- [ ] Snapshot is taken at sync START (before merge/push)
- [ ] Only snapshotted files cleared on success (not files created during sync)
- [ ] Works correctly on network filesystems (no file locks used)

## Open Questions

1. **What if outbox grows very large?**
   - If a user is offline for extended periods, outbox could accumulate many issues
   - Recommendation: This is acceptable - the outbox is incremental (only changed
     issues), so even hundreds of changed issues is manageable.
     The alternative (losing data) is worse.

2. **Should outbox changes be auto-committed?**
   - tbd currently never auto-commits to the user’s working branch
   - Outbox lives on the user’s branch (not tbd-sync)
   - Recommendation: NO auto-commit, but YES explicit warning.
     When push fails, tbd prints a clear warning with instructions to commit the outbox.
     This preserves tbd’s policy of never auto-committing to the user’s branch while
     ensuring users/agents know to take action.
     Agents will follow the warning and commit the outbox, which is the intended
     workflow. Users who ignore the warning accept the risk of data loss on fresh
     checkout.

## References

- Related issue: tbd-knfu (sync resilience feature)
- Silent error bug: tbd-ca3g (sync silent failure)

## Appendix A: Write-Through and Sync Flow Diagrams

### Write-Through Flow (at issue create/update time)

```
                    tbd create / tbd update
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Write issue to        │
                    │ worktree              │
                    │ (existing behavior)   │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ enable_outbox?        │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ YES                   │ NO
                    ▼                       ▼
        ┌───────────────────────┐   ┌───────────────────┐
        │ ALSO write to outbox: │   │ Done              │
        │ - Copy issue file     │   │ (no outbox write) │
        │ - Add ID to ids.yml   │   └───────────────────┘
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ User sees outbox      │
        │ in git status         │
        │ (uncommitted changes) │
        └───────────────────────┘
```

### Sync Flow (clears outbox on success)

```
                            tbd sync
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Ensure worktree       │
                    │ exists (create/repair)│
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ SNAPSHOT OUTBOX       │
                    │ (for concurrent       │
                    │ operation safety)     │
                    │ Record current files: │
                    │ - issues/*.md         │
                    │ - mappings/ids.yml    │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ OUTBOX SYNC (if       │
                    │ enable_outbox=true)   │
                    │ Check SNAPSHOT for    │
                    │ pending data          │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Has pending?          │
                    ├───────────────────────┤
                    │ YES                   │ NO
                    ▼                       │
        ┌───────────────────────┐           │
        │ Merge outbox →        │           │
        │ worktree:             │           │
        │ - Copy issues (merge) │           │
        │ - Union ids.yml       │           │
        │ - Commit to worktree  │           │
        │ (May be no-op if      │           │
        │ files already match)  │           │
        └───────────────────────┘           │
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ NORMAL SYNC           │
                    │ - Fetch remote        │
                    │ - Merge remote →      │
                    │   worktree            │
                    │ - Commit local changes│
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ git push origin       │
                    │ {syncBranch}          │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Push result?          │
                    ├───────────────────────┤
                    │ SUCCESS               │ FAILURE (403, network, etc)
                    ▼                       ▼
        ┌───────────────────────┐   ┌───────────────────────────┐
        │ Clear ONLY SNAPSHOTTED│   │ enable_outbox?            │
        │ outbox files          │   ├───────────────────────────┤
        │ (files created during │   │ TRUE           │ FALSE    │
        │ sync are preserved)   │   │ Print WARNING  │ Report   │
        │ (no auto-commit)      │   │ with 2 options:│ failure, │
        │ Report "Synced"       │   │ 1. Fix + retry │ done     │
        └───────────────────────┘   │ 2. Commit      │          │
                                    │    outbox      │          │
                                    └───────────────────────────┘
```

### Key Points

1. **Write-through** - Every issue write is mirrored to outbox (when
   `enable_outbox: true`)
2. **Worktree first** - Must exist before outbox merge can proceed
3. **Snapshot at sync start** - Record outbox contents BEFORE any operations; this
   determines what gets merged and cleared
4. **Outbox sync** - Pending data from previous failed syncs gets merged (only
   snapshotted files)
5. **Normal sync** - Fetch, merge remote, commit local changes TO WORKTREE (auto-commit)
6. **Push attempt** - Push to configured `tbd-sync` branch
7. **Success** - Clear ONLY SNAPSHOTTED outbox files after push succeeds (files created
   during sync are preserved for next sync)
8. **Failure (outbox enabled)** - Print WARNING with two options: (a) resolve issue and
   retry sync (outbox clears on success), OR (b) commit outbox to preserve data across
   checkouts
9. **Failure (outbox disabled)** - Just report failure; data is in worktree but may not
   sync
10. **Idempotent** - Retry cycle causes no data duplication (merges are additive)
11. **Concurrent-safe** - Snapshot-based clear means operations during sync don’t lose
    data (no file locks needed, NFS-safe)
12. **No auto-commit to user’s branch** - Outbox changes are file changes only; user
    commits when ready
13. **Agent workflow** - Agents evaluate the two options; typically commit outbox if the
    underlying issue cannot be resolved

## Appendix B: Multi-Branch Outbox Merges (Corner Cases)

When multiple agents or users work on different branches, each may accumulate outbox
data. When these branches merge, the outboxes merge too.
This section explains why this generally works cleanly.

### Why Merges Are Usually Clean

1. **Issues are distinct**: Different agents typically create different issues.
   Each issue has a unique ULID, so there are no file conflicts.

2. **ID mappings are distinct**: Each new issue gets a unique short ID. The `ids.yml`
   files are key-value maps where keys (short IDs) don’t collide because they’re
   generated from distinct ULIDs.

3. **Outbox is additive**: The outbox only contains issues that failed to sync.
   When branches merge, git sees two different files being added—no conflict.

### Corner Cases That May Require Manual Resolution

1. **Same issue updated on different branches**
   - Agent A updates `tbd-a1b2` on branch X, fails to sync, commits outbox
   - Agent B updates `tbd-a1b2` on branch Y, fails to sync, commits outbox
   - When X and Y merge, git sees a conflict in `.tbd/outbox/issues/{ulid}.md`
   - Resolution: Standard git merge resolution, then `tbd sync` uses the merged result

2. **Short ID collision** (rare)
   - Agent A generates short ID `x7k9` for ULID `abc...` on branch X
   - Agent B generates short ID `x7k9` for ULID `def...` on branch Y
   - When `ids.yml` files merge, git sees same key with different values
   - Resolution: Manual resolution needed; one mapping must be changed
   - Note: This is extremely rare due to ID generation algorithm

3. **Ordering of outbox merges**
   - Branch A merges to main, then branch B merges to main
   - Each merge adds outbox entries sequentially
   - This is fine—issues are additive and `tbd sync` processes all of them

### After Branch Merge

After merging branches with outboxes:

1. Run `tbd sync` to push all accumulated outbox data to `tbd-sync`
2. If sync succeeds, outbox clears
3. If sync fails, the combined outbox remains for future retry

## Appendix C: Issue tbd-knfu Summary

The feature bead tbd-knfu documents this problem and was created during the debugging
session. Key findings:

1. Various environments may restrict pushing to certain branches
2. HTTP 403 or similar errors occur when push is forbidden
3. The outbox provides a safety net for preserving data in these scenarios
4. Data recovery happens when branches merge and sync eventually succeeds
