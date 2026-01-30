# Feature: Sync Outbox and Claude Code Session Branch Support

**Date:** 2026-01-29

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

This spec addresses two related problems:

1. **General sync resilience**: When `tbd sync` cannot push to the remote (network
   errors, permission issues, etc.), issue data should be preserved locally and synced
   when conditions allow.

2. **Claude Code compatibility**: When tbd runs inside Claude Code Cloud, the standard
   `tbd-sync` branch cannot be pushed due to security restrictions that enforce
   session-specific branch naming.

The solution is a **committed outbox** that stores incremental changes when sync fails,
combined with optional session-specific branch detection for Claude Code environments.

## Goals

- **G1**: **No data loss** - Issue data must never be lost, even when sync fails
- **G2**: **Incremental storage** - Outbox stores only changed issues and new IDs, not
  full copies (keeps git diffs small even with hundreds of issues)
- **G3**: `tbd sync` should work transparently in Claude Code environments
- **G4**: Session-specific branches should merge seamlessly with the canonical
  `tbd-sync` branch
- **G5**: No manual configuration should be required for Claude Code users
- **G6**: Standard environments should continue working unchanged
- **G7**: Multi-session workflows should not cause data loss or conflicts

## Non-Goals

- Changing the fundamental sync architecture (worktree model remains)
- Supporting arbitrary branch naming schemes beyond Claude Code’s requirements
- Automatic merging across sessions (explicit merge on session start is acceptable)
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

### Root Cause: Claude Code Security Restrictions

Claude Code (the CLI and cloud environments) enforces branch naming restrictions for
security:

1. **Session isolation**: Each Claude session gets a unique session ID
2. **Branch pattern**: Pushes are only allowed to branches matching
   `claude/[name]-[SESSION_ID]`
3. **Session ID source**: Extracted from the current working branch name

For example, if working on branch `claude/verify-tbd-initialization-szKzG`, the session
ID is `szKzG`, and only branches like `claude/*-szKzG` can be pushed.

### Why This Restriction Exists

Claude Code’s branch restrictions provide:

1. **Audit trail**: Every change can be traced to a specific AI session
2. **Isolation**: Sessions cannot interfere with each other’s branches
3. **Rollback**: Easy to identify and revert all changes from a specific session
4. **Security**: Prevents uncontrolled modifications to shared branches

### Current Impact

1. **`tbd sync` fails silently** (before tbd-ca3g fix) or with HTTP 403 (after fix)
2. **Issues never sync to remote** in Claude Code environments
3. **Cross-session continuity broken** - issues created in one session can’t be seen in
   another
4. **Manual workaround required** - users must manually configure session-specific
   branch

### Manual Workaround Discovered

The following manual workaround allows sync to work in Claude Code:

```bash
# 1. Extract session ID from current branch
# Current branch: claude/verify-tbd-initialization-szKzG
# Session ID: szKzG

# 2. Create session-specific sync branch from tbd-sync
git checkout -b claude/tbd-sync-szKzG tbd-sync
# Or if tbd-sync doesn't exist locally:
git checkout -b claude/tbd-sync-szKzG origin/tbd-sync

# 3. Update tbd config to use session branch
# Edit .tbd/config.yml:
#   sync:
#     branch: claude/tbd-sync-szKzG

# 4. Now tbd sync works
tbd sync
```

This workaround is cumbersome and must be repeated for each new session.

## Design

### Recommended Approach: Committed Outbox with Session Branch Fallback

The design uses a **two-tier strategy** to guarantee no data loss:

1. **Committed Outbox (Primary Safety)**: A `.tbd/outbox/` directory that stores
   **incremental** issue data when remote sync fails.
   The outbox is **committed to the main branch** (not gitignored), so it survives
   across clones and can be pushed even when `tbd-sync` cannot.

2. **Session-Specific Branches (Secondary)**: Auto-detect Claude Code environment and
   use session-specific sync branches that can be pushed.

### Why Committed Outbox?

The outbox being committed (not gitignored) provides critical benefits:

- **Survives fresh clones**: Outbox data comes along when cloning/checking out
- **Works in Claude Code**: Session branches CAN be pushed, so outbox data reaches
  remote
- **Cross-session recovery**: Another session can recover data from the outbox
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
├── data-sync-worktree/     # Existing: worktree on tbd-sync (or session branch)
├── outbox/                 # NEW: committed to main branch (NOT gitignored)
│   ├── issues/             # Only issues that failed to sync (incremental)
│   └── mappings/
│       └── ids.yml         # Only NEW short ID mappings (incremental)
├── config.yml
└── state.yml
```

**Key difference from previous design**: The outbox is **on the main branch** (not
gitignored), not on the `tbd-sync` branch.
This means:
- Outbox data is versioned alongside user code
- Outbox data can be pushed/pulled with the user’s working branch
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

**Why write-through?**
- No git diff parsing needed to identify changed files
- Handles multiple commits naturally (we know what we wrote)
- Simpler logic: always write to both places, always clear on success
- The outbox becomes a “transaction log” of pending changes

**User experience:**
- User creates/updates issue → appears in outbox immediately (uncommitted file change)
- User runs `tbd sync` → outbox clears (if push succeeds)
- If sync fails → outbox stays, user sees “X issues pending sync”
- The outbox is a visible “pending changes” indicator

This is good UX because users typically run sync frequently.
The outbox provides visibility into what hasn’t reached the remote yet.

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
| Push fails (403, network) | Copy changed issues to outbox | Data saved as uncommitted file changes |
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

  1. OUTBOX SYNC (runs first)
     └── Check if outbox has pending data
         └── If yes:
             a. Copy outbox issues → worktree (using standard merge + attic)
             b. Merge outbox ids.yml → worktree ids.yml (union of entries)
             c. Commit merged changes to worktree
             NOTE: If same location as last failure, this is a no-op (files match)
             NOTE: If fresh checkout, worktree is behind outbox, so merge applies

  2. NORMAL SYNC
     a. Fetch remote tbd-sync (or session branch)
     b. Merge remote → worktree (existing logic)
     c. Commit local changes to worktree

  3. PUSH
     └── Try push to remote (session branch if Claude Code, else tbd-sync)
         ├── SUCCESS:
         │   a. Clear outbox (remove files from .tbd/outbox/)
         │   b. Report "synced"
         │   NOTE: Outbox removal is NOT auto-committed. User controls when to
         │         commit changes to their working branch.
         │
         └── FAILURE (403, network, etc):
             a. Outbox already has the data (from write-through)
             b. Report "X issues in outbox, will retry on next sync"
             NOTE: No additional work needed - write-through already populated outbox
```

### Critical: Clear Timing

**The outbox is cleared ONLY after push succeeds.** This is critical for data safety:

- If we cleared after worktree commit but before push, and push fails, data is lost
- By clearing only after push succeeds, we guarantee the data reached the remote
- The outbox acts as a “safety net” until data is confirmed synced

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

When syncing from a fresh checkout:

1. Worktree doesn’t exist yet
2. `tbd sync` initializes worktree from remote `tbd-sync` (which doesn’t have failed
   data)
3. Outbox has the failed data (came from main branch checkout)
4. Outbox sync merges the data into worktree (now that worktree exists)
5. Normal sync proceeds
6. Push includes the recovered data

**Important**: Worktree initialization MUST happen before outbox merge.
The current sync implementation already ensures this (worktree is created/repaired
before any operations).

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

/**
 * Clear outbox after successful push.
 *
 * IMPORTANT: Only call this AFTER push succeeds, not just after worktree commit.
 */
async function clearOutbox(tbdRoot: string): Promise<void> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  await rm(join(outboxDir, 'issues'), { recursive: true, force: true });
  await rm(join(outboxDir, 'mappings'), { recursive: true, force: true });
}
```

### Integration Points

The write-through functions need to be called at these existing code locations:

```typescript
// In writeIssue() - packages/tbd/src/file/storage.ts
export async function writeIssue(dataSyncDir: string, issue: Issue): Promise<void> {
  // ... existing write logic ...

  // NEW: Write-through to outbox
  const tbdRoot = findTbdRoot(dataSyncDir);
  await writeIssueToOutbox(tbdRoot, issue);
}

// In generateShortId() or wherever IDs are added to ids.yml
async function addIdMapping(dataSyncDir: string, shortId: string, ulid: string): Promise<void> {
  // ... existing write to ids.yml ...

  // NEW: Write-through to outbox
  const tbdRoot = findTbdRoot(dataSyncDir);
  await addIdToOutbox(tbdRoot, shortId, ulid);
}
```

### Session Branch Detection (Complementary)

In addition to the outbox, auto-detect Claude Code environment to use session-specific
branches that can actually be pushed:

1. **Auto-detect Claude Code environment** using branch naming patterns
2. **Extract session ID** from the current branch name
3. **Dynamically use session-specific sync branch** (`claude/tbd-sync-{SESSION_ID}`)
4. **On session start**, merge from canonical `tbd-sync` (or `origin/tbd-sync`) to get
   issues from other sessions
5. **Transparent operation** - users don’t need to know about session branches

### Detection Strategy

```typescript
/**
 * Detect if running in Claude Code environment.
 *
 * Detection criteria:
 * 1. Current branch matches pattern: claude/*-{SESSION_ID}
 * 2. Session ID is extracted from the branch suffix
 *
 * Returns null if not in Claude Code environment.
 */
export async function detectClaudeCodeSession(): Promise<{
  sessionId: string;
  currentBranch: string;
} | null> {
  const currentBranch = await getCurrentBranch();

  // Pattern: claude/[anything]-[SESSION_ID]
  // SESSION_ID is typically 5 alphanumeric characters
  const match = /^claude\/.*-([a-zA-Z0-9]{5})$/.exec(currentBranch);

  if (!match) {
    return null;
  }

  return {
    sessionId: match[1],
    currentBranch,
  };
}
```

### Session Branch Naming

| Context | Sync Branch Name |
| --- | --- |
| Standard environment | `tbd-sync` (from config) |
| Claude Code session `szKzG` | `claude/tbd-sync-szKzG` |
| Claude Code session `abc12` | `claude/tbd-sync-abc12` |

### Sync Algorithm Updates

#### Modified getSyncBranch()

```typescript
/**
 * Get the effective sync branch name.
 *
 * In Claude Code environments, returns session-specific branch.
 * Otherwise returns configured sync branch.
 */
export async function getSyncBranch(config: TbdConfig): Promise<string> {
  const claudeSession = await detectClaudeCodeSession();

  if (claudeSession) {
    return `claude/tbd-sync-${claudeSession.sessionId}`;
  }

  return config.sync?.branch ?? 'tbd-sync';
}
```

#### Session Start: Merge from Canonical Branch

When starting a new Claude Code session, the sync branch needs to incorporate issues
from other sessions:

```typescript
/**
 * Initialize session-specific sync branch.
 *
 * Called at start of sync when in Claude Code environment.
 * Ensures session branch exists and has latest from canonical branch.
 */
async function initSessionSyncBranch(
  sessionId: string,
  canonicalBranch: string,
  remote: string
): Promise<void> {
  const sessionBranch = `claude/tbd-sync-${sessionId}`;

  // Check if session branch exists locally
  const localExists = await branchExists(sessionBranch);

  // Check if session branch exists on remote
  const remoteExists = await remoteBranchExists(remote, sessionBranch);

  // Check if canonical branch exists
  const canonicalExists =
    (await branchExists(canonicalBranch)) ||
    (await remoteBranchExists(remote, canonicalBranch));

  if (!localExists && !remoteExists) {
    // New session - create branch from canonical or as orphan
    if (canonicalExists) {
      // Fetch latest canonical
      await git('fetch', remote, canonicalBranch);
      // Create session branch from canonical
      await git('checkout', '-b', sessionBranch, `${remote}/${canonicalBranch}`);
    } else {
      // No canonical exists - create orphan (first time setup)
      await git('checkout', '--orphan', sessionBranch);
      await git('commit', '--allow-empty', '-m', 'tbd: initialize sync branch');
    }
  } else if (!localExists && remoteExists) {
    // Session branch exists on remote (resuming session)
    await git('fetch', remote, sessionBranch);
    await git('checkout', '-b', sessionBranch, `${remote}/${sessionBranch}`);

    // Also merge any updates from canonical
    if (canonicalExists) {
      await git('fetch', remote, canonicalBranch);
      await mergeIfNeeded(`${remote}/${canonicalBranch}`);
    }
  } else {
    // Local exists - ensure we have latest from canonical
    if (canonicalExists) {
      await git('fetch', remote, canonicalBranch);
      await mergeIfNeeded(`${remote}/${canonicalBranch}`);
    }
  }
}
```

### Worktree Management

The worktree path remains `.tbd/data-sync-worktree/` but points to the session-specific
branch in Claude Code environments:

```typescript
async function ensureWorktreeForSession(
  tbdRoot: string,
  syncBranch: string
): Promise<void> {
  const worktreePath = join(tbdRoot, WORKTREE_DIR);

  // Check if worktree exists
  const health = await checkWorktreeHealth(tbdRoot);

  if (!health.valid) {
    // Create worktree for session branch
    await git('worktree', 'add', worktreePath, syncBranch);
    return;
  }

  // Worktree exists - check if it's on the right branch
  const worktreeBranch = await git(
    '-C',
    worktreePath,
    'rev-parse',
    '--abbrev-ref',
    'HEAD'
  );

  if (worktreeBranch.trim() !== syncBranch) {
    // Need to switch worktree to session branch
    // This is complex - may need to prune and recreate
    await git('worktree', 'remove', worktreePath);
    await git('worktree', 'add', worktreePath, syncBranch);
  }
}
```

### Configuration

No configuration changes required for users.
The feature is automatic.

For debugging/testing, add optional flag:

```yaml
# .tbd/config.yml
sync:
  branch: tbd-sync # Canonical branch (used in standard environments)
  # claude_session_override: abc12  # For testing - force session ID
```

CLI flag for manual override:

```bash
# Force session mode (useful for testing)
tbd sync --claude-session abc12

# Disable session detection (force canonical branch)
tbd sync --no-session
```

## Implementation Plan

### Phase 1: Committed Outbox (Primary Safety Net)

Implement the outbox to guarantee no data loss regardless of push failures.

**Config:**
- [ ] Add `sync.enable_outbox` to config schema (default: `true`)
- [ ] Read config flag where needed

**Write-Through Functions (called at write time):**
- [ ] Implement `writeIssueToOutbox()` - mirror issue write to outbox
- [ ] Implement `addIdToOutbox()` - mirror ID mapping to outbox
- [ ] Integrate into `writeIssue()` in storage.ts
- [ ] Integrate into ID mapping write logic

**Sync-Time Functions:**
- [ ] Implement `hasOutboxData()` - check if outbox has pending issues/IDs
- [ ] Implement `getOutboxCount()` - count items for status reporting
- [ ] Implement `mergeOutboxToWorktree()` - merge pending data using existing conflict
  resolution (including attic)
- [ ] Implement `clearOutbox()` - clear after successful push

**ID Mapping Helpers:**
- [ ] Implement `readIdMappings()` - parse ids.yml to object
- [ ] Implement `writeIdMappings()` - write object to ids.yml

**Sync Integration:**
- [ ] Update `tbd sync` to check/merge outbox FIRST (before normal sync)
- [ ] Update `tbd sync` to clear outbox ONLY after push succeeds
- [ ] Add `tbd sync --status` output for outbox count

**Important:** Outbox is on the user’s branch (NOT gitignored).
tbd does NOT auto-commit outbox changes - user sees them as uncommitted file changes.

**Tests:**
- [ ] Add unit tests for write-through operations
- [ ] Add unit tests for merge/clear operations
- [ ] Add integration test: create issue → appears in outbox → sync clears it
- [ ] Add integration test: push fails → outbox retained → next sync merges
- [ ] Add integration test: fresh checkout with outbox → data recovered
- [ ] Add integration test: retry cycle is idempotent

### Phase 2: Session Branch Detection

Add Claude Code environment detection to enable session-specific branches.

- [ ] Add `detectClaudeCodeSession()` function to detect environment
- [ ] Add `getSyncBranch()` wrapper that handles session detection
- [ ] Add `--claude-session` flag for manual testing
- [ ] Add `--no-session` flag to bypass detection
- [ ] Add unit tests for session detection

### Phase 3: Session Branch Management

Implement automatic session branch lifecycle.

- [ ] Implement `initSessionSyncBranch()` for session start
- [ ] Add merge logic from canonical branch
- [ ] Handle worktree branch switching
- [ ] Add integration tests for session branch lifecycle

### Phase 4: Transparent Sync Integration

Wire everything together for seamless operation.

- [ ] Update `tbd sync` to use `getSyncBranch()` throughout
- [ ] Ensure push targets session branch in Claude Code
- [ ] Add appropriate logging/debug output for troubleshooting
- [ ] Add e2e tests simulating Claude Code environment

### Phase 5: Doctor and Visibility

Add diagnostic support for the new features.

- [ ] Update `tbd doctor` to detect and report Claude Code environment
- [ ] Add doctor check for outbox status (pending issues)
- [ ] Add `tbd sync --status` to show outbox + session branch info
- [ ] Add troubleshooting guide for session sync issues

### Phase 6: Documentation

- [ ] Document workaround in skill file for immediate use
- [ ] Update tbd-design.md with outbox and Claude Code support (see details below)
- [ ] Add architecture diagram to developer docs

#### tbd-design.md Updates

The following sections in `packages/tbd/docs/tbd-design.md` need updates:

##### Main Design Doc Sections

**1. Table of Contents (lines ~14-210)**
- Add entry for new section `3.7 Sync Outbox`

**2. Section 2.2 Directory Structure (lines ~690-757)**
- Add `outbox/` to the “On Main Branch” directory listing
- Note that outbox is NOT gitignored (committed to main)

**3. NEW Section 3.7 Sync Outbox (insert after line ~2097, between 3.6 Attic and 4.
CLI)**
- Purpose: Safety net for sync failures
- Configuration: `sync.enable_outbox` flag (default: true)
- Architecture: Committed to main branch, incremental storage
- Write-through pattern: Every worktree write mirrored to outbox
- Sync flow: Outbox merge → normal sync → push → clear on success
- Behavior when disabled: Simple failure reporting, no recovery

**4. Section 3.3.3 Sync Algorithm (lines ~1876-1912)**
- Add reference to outbox sync phase (runs first when enabled)
- Note that outbox merge uses same conflict resolution as remote merge

**5. Section 4.7 Sync Commands (find location)**
- Document `tbd sync --status` showing outbox count
- Note outbox behavior in sync output

**6. Section 6.4.5 Cloud Environment Bootstrapping (lines ~2800+)**
- Add Claude Code session branch detection
- Document automatic session-specific sync branches

##### Reference Doc Section

**7. Section 7.3 File Structure Reference (lines ~4835-4872)**
- Add `outbox/` directory to the file tree under `.tbd/` on main branch:
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
- `mergeOutboxToWorktree()` - no conflicts, with conflicts (uses attic), empty outbox
- `clearOutbox()` - clears all files

**ID Mappings:**
- `readIdMappings()` / `writeIdMappings()` - round-trip YAML
- Union merge of ids.yml (no conflicts, additive only)

**Session Detection:**
- `detectClaudeCodeSession()` with various branch names
- `getSyncBranch()` in standard vs Claude Code environments
- Session ID extraction edge cases

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

describe('Claude Code session sync', () => {
  it('detects Claude Code environment from branch name', async () => {
    await git('checkout', '-b', 'claude/test-feature-abc12');
    const session = await detectClaudeCodeSession();
    expect(session).toEqual({
      sessionId: 'abc12',
      currentBranch: 'claude/test-feature-abc12',
    });
  });

  it('uses session-specific sync branch in Claude Code', async () => {
    await git('checkout', '-b', 'claude/test-feature-abc12');
    const syncBranch = await getSyncBranch(config);
    expect(syncBranch).toBe('claude/tbd-sync-abc12');
  });

  it('uses canonical branch in standard environment', async () => {
    await git('checkout', 'main');
    const syncBranch = await getSyncBranch(config);
    expect(syncBranch).toBe('tbd-sync');
  });

  it('creates session branch from canonical on first sync', async () => {
    // Setup: canonical branch exists with issues
    await setupCanonicalBranch();

    // Simulate Claude Code environment
    await git('checkout', '-b', 'claude/new-session-xyz99');

    // Run sync
    await runSync();

    // Verify session branch created
    expect(await branchExists('claude/tbd-sync-xyz99')).toBe(true);

    // Verify issues merged from canonical
    const issues = await listIssues();
    expect(issues.length).toBeGreaterThan(0);
  });
});
```

### Manual Testing Checklist

**Outbox (Incremental, on main branch):**
- [ ] Push fails → only CHANGED issues saved to outbox (not all issues)
- [ ] Push fails → only NEW ID mappings saved to outbox (not all IDs)
- [ ] Outbox files appear as uncommitted changes (visible in git status)
- [ ] tbd does NOT auto-commit outbox changes to user’s branch
- [ ] Next successful sync → outbox merged (to worktree) and cleared
- [ ] Outbox cleared only AFTER push succeeds (not after worktree commit)
- [ ] `tbd sync --status` shows outbox count
- [ ] Conflict between outbox and remote → resolved correctly (attic used)
- [ ] Fresh checkout → outbox data recovered to worktree
- [ ] Retry cycle is idempotent (no data duplication)
- [ ] Config `enable_outbox: false` disables outbox behavior

**Session Branches:**
- [ ] Standard environment: sync works as before
- [ ] Claude Code: auto-detects session ID
- [ ] Claude Code: creates session-specific branch
- [ ] Claude Code: push succeeds to session branch
- [ ] New session: merges issues from canonical branch
- [ ] Resumed session: continues from existing session branch
- [ ] `--no-session` flag bypasses detection

## Rollout Plan

### Phase 1: Document Workaround (Immediate)

Add workaround to skill file so Claude Code users can manually configure:

```markdown
## Claude Code Sync Workaround

If `tbd sync` fails with HTTP 403 in Claude Code, manually configure session branch:

1. Extract session ID from your branch (e.g., `szKzG` from
   `claude/feature-name-szKzG`)
2. Create session branch: `git checkout -b claude/tbd-sync-{SESSION_ID} tbd-sync`
3. Edit `.tbd/config.yml`: set `sync.branch: claude/tbd-sync-{SESSION_ID}`
4. Run `tbd sync`
```

### Phase 2: Detection Only

Release with detection logging:

- Log when Claude Code environment detected
- Log effective sync branch being used
- Continue using configured branch (manual config still required)

### Phase 3: Full Automation

Release with automatic session branch management:

- Auto-create session branches
- Auto-merge from canonical
- No manual configuration required

## Open Questions

1. **Should session branches be cleaned up?**
   - After a session ends, the session branch could be merged to canonical and deleted
   - Recommendation: Leave for manual cleanup; sessions may be resumed

2. **How to handle conflicts between sessions?**
   - Two sessions could modify the same issue
   - Recommendation: Last write wins (standard git merge behavior)

3. **Should canonical branch be updated automatically?**
   - Session branches could auto-merge to canonical on sync
   - Recommendation: No - keep canonical stable; merge on explicit action

4. **What if user manually sets branch in config?**
   - Should auto-detection override user config?
   - Recommendation: User config takes precedence; auto-detection only when branch is
     default `tbd-sync`

5. **Alternative detection methods?**
   - Environment variable `CLAUDE_SESSION_ID`?
   - Claude Code may provide explicit signals in the future
   - Recommendation: Start with branch pattern; add env var support later

6. **What if outbox grows very large?**
   - If a user is offline for extended periods, outbox could accumulate many issues
   - Recommendation: This is acceptable - the outbox is incremental (only changed
     issues), so even hundreds of changed issues is manageable.
     The alternative (losing data) is worse.

7. **Should outbox changes be auto-committed?**
   - tbd currently never auto-commits to the user’s working branch
   - Outbox lives on the user’s branch (not tbd-sync)
   - Recommendation: NO. Outbox changes are file changes only.
     User sees them in `git status` and commits when ready.
     This is consistent with tbd’s current behavior of never auto-committing to the
     user’s branch. The user may be on a feature branch or may want to review the changes
     first.

## References

- Related issue: tbd-knfu (Claude Code environment support feature)
- Silent error bug: tbd-ca3g (sync silent failure)
- Claude Code docs: https://docs.anthropic.com/en/docs/claude-code
- Workaround documented in: .tbd/docs/guidelines/

## Appendix A: Environment Detection Alternatives

### Option 1: Branch Pattern Detection (Recommended)

Detect from branch name pattern `claude/*-{SESSION_ID}`.

**Pros:**
- No external dependencies
- Works immediately
- Session ID is reliably extracted

**Cons:**
- Relies on branch naming convention
- Could false-positive on user branches named similarly

### Option 2: Environment Variable

Claude Code could set `CLAUDE_SESSION_ID` environment variable.

**Pros:**
- Explicit signal
- No pattern matching required

**Cons:**
- Requires Claude Code to provide this (not currently available)
- Would need coordination with Anthropic

### Option 3: Git Config

Claude Code could set a git config value.

**Pros:**
- Persisted in repo
- Explicit signal

**Cons:**
- Pollutes git config
- May not be set in all environments

### Recommendation

Use Option 1 (branch pattern) as primary detection.
Add Option 2 (env var) as fallback when/if available.
This provides immediate functionality with room for improvement.

## Appendix B: Write-Through and Sync Flow Diagrams

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
                    │ OUTBOX SYNC (if       │
                    │ enable_outbox=true)   │
                    │ Check outbox for      │
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
                    │ detectClaudeCodeSession│
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Claude Code?          │
                    ├───────────────────────┤
                    │ YES                   │ NO
                    ▼                       ▼
        syncBranch =            syncBranch =
        claude/tbd-sync-{ID}    tbd-sync
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
        │ Clear outbox          │   │ enable_outbox?            │
        │ (remove files)        │   ├───────────────────────────┤
        │ (no auto-commit)      │   │ TRUE           │ FALSE    │
        │ Report "Synced"       │   │ Outbox already │ Report   │
        └───────────────────────┘   │ has data (from │ failure, │
                                    │ write-through) │ done     │
                                    │ Report "X in   │          │
                                    │ outbox"        │          │
                                    └───────────────────────────┘
```

### Key Points

1. **Write-through** - Every issue write is mirrored to outbox (when
   `enable_outbox: true`)
2. **Worktree first** - Must exist before outbox merge can proceed
3. **Outbox sync second** - Pending data from previous failed syncs gets merged
4. **Session detection third** - Determines target branch (Claude Code vs standard)
5. **Normal sync** - Fetch, merge remote, commit local changes TO WORKTREE (auto-commit)
6. **Push attempt** - Uses session branch if Claude Code, else canonical
7. **Success** - Clear outbox ONLY after push succeeds
8. **Failure (outbox enabled)** - Outbox already has data (from write-through), nothing
   extra to do
9. **Failure (outbox disabled)** - Just report failure; data is in worktree but may not
   sync
10. **Idempotent** - Retry cycle causes no data duplication (merges are additive)
11. **No auto-commit to main** - Outbox changes are file changes only; user commits when
    ready

## Appendix C: Issue tbd-knfu Summary

The feature bead tbd-knfu documents this problem and was created during the debugging
session. Key findings:

1. Claude Code enforces `claude/[name]-[SESSION_ID]` branch pattern
2. HTTP 403 occurs when pushing to non-session branches
3. Manual workaround works but is tedious
4. Auto-detection is feasible via branch name parsing
5. Session branches should merge from canonical to maintain continuity
