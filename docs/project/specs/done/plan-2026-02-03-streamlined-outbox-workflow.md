# Feature: Streamlined Outbox Workflow

**Date:** 2026-02-03

**Author:** Claude (with Joshua Levy)

**Status:** Done

**Status:** Draft

## Overview

Improve the outbox workflow to reduce friction and prevent data loss by:

1. **Auto-importing from outbox during sync**: When `tbd sync` runs, automatically
   import any pending items from the outbox first, preventing accumulation.

2. **Auto-saving to outbox on permanent sync failures**: When `tbd sync` encounters a
   permanent failure (e.g., HTTP 403 permission denied), automatically save unsynced
   issues to the outbox before exiting.

These changes make the outbox workflow more “self-healing” - users don’t need to
remember manual steps, and data is preserved automatically when sync fails.

## Goals

- **G1**: Prevent data loss on sync failures without requiring user action
- **G2**: Prevent outbox accumulation by auto-importing during sync
- **G3**: Provide clear user feedback about what happened and what actions are available
- **G4**: Maintain backward compatibility - explicit commands still work

## Non-Goals

- Changing the fundamental workspace/outbox architecture
- Adding real-time sync or daemon-based behavior
- Automatic retry of failed syncs

## Background

### Current State

The current workflow requires manual intervention:

```bash
# Current: Sync fails
tbd sync
# ⚠️  Sync failed: HTTP 403 - push to 'tbd-sync' forbidden
# (User must remember to run next command)

# User manually saves to outbox
tbd save --outbox

# Later, user must remember to import
tbd import --outbox
tbd sync
```

### Problems with Current Approach

1. **Easy to forget `tbd save --outbox`**: On sync failure, if user/agent doesn’t save,
   data can be lost on next checkout.

2. **Outbox accumulation**: If agents save to outbox but never import, items accumulate
   across sessions. Users must remember to run `tbd import --outbox` periodically.

3. **Multiple manual steps**: The recovery workflow requires 3-4 commands instead of
   just working automatically.

### Claude Code Context

Claude Code sessions often have push restrictions (only `claude/*-{SESSION_ID}` branches
allowed). This means `tbd sync` will frequently fail with HTTP 403. The current workflow
requires agents to:

1. Notice the failure
2. Run `tbd save --outbox`
3. Commit the outbox to the working branch
4. Push the working branch

With auto-save, agents only need to do steps 3-4 (the outbox is already populated).

## Design

### Part 1: Auto-Import from Outbox on Successful Sync

**Key insight**: The outbox should only be cleared when sync actually succeeds.
If we’re in an environment where push always fails (e.g., Claude Code with branch
restrictions), we don’t want to keep importing and re-saving on every `tbd sync`
attempt.

**Behavior**: Auto-import from outbox happens *after* a successful push, not before.

```bash
# New behavior - sync succeeds:
tbd sync
# ✓ Synced 5 issue(s) to remote
# ✓ Imported 3 issue(s) from outbox (also synced)

# New behavior - sync fails (blocked environment):
tbd sync
# ⚠️  Sync push failed: HTTP 403
# ✓ Saved 2 issue(s) to outbox
# (Outbox is NOT cleared - it accumulates until sync works)
```

**Command options for granular control**:

| Command | Behavior |
| --- | --- |
| `tbd sync` | Default: sync issues, import outbox only on success |
| `tbd sync --no-outbox` | Skip outbox import even on success |
| `tbd sync --issues` | Existing: sync only issues |
| `tbd sync --docs` | Existing: sync only docs |

**Order of operations**:

1. **Fetch remote** `tbd-sync` branch
2. **Merge remote → worktree**
3. **Commit local changes** to worktree
4. **Push to remote**
5. **If push succeeded AND outbox has issues**: Import from outbox, commit, push again

**Why import after successful push?** If we imported before pushing and the push fails,
we’d have cleared the outbox only to re-save to it.
This creates unnecessary churn in blocked environments.
By importing after success, the outbox only clears when we know data can actually reach
the remote.

#### Corner Cases

**Case 1: Sync succeeds, outbox is empty**
- Normal sync completes
- No outbox-related messages
- `✓ Synced N issue(s) to remote`

**Case 2: Sync succeeds, outbox has issues**
- Primary sync completes first
- Then import from outbox, commit, push again
- Clear outbox only after second push succeeds
- `✓ Synced N issue(s) to remote`
- `✓ Imported M issue(s) from outbox (also synced)`

**Case 3: Sync succeeds, but outbox import/push fails**
- Primary sync already succeeded (user’s current work is safe)
- Outbox import attempted but fails (merge conflict, corrupted, etc.)
- OR outbox imported but second push fails
- Print warning: `⚠️ Could not sync outbox: {error}`
- Outbox is NOT cleared (will retry next sync)
- This is rare but possible (e.g., network dropped mid-sync)

**Case 4: Sync fails (permanent), outbox is empty**
- Push fails with 403/permission error
- No existing outbox data
- Auto-save current unsynced issues to outbox
- `⚠️ Sync push failed: HTTP 403`
- `✓ Saved N issue(s) to outbox`

**Case 5: Sync fails (permanent), outbox already has data**
- Push fails with 403/permission error
- Outbox already has issues from previous failed sync
- Auto-save MERGES with existing outbox (doesn’t overwrite)
- Outbox accumulates all unsynced work
- `⚠️ Sync push failed: HTTP 403`
- `✓ Saved N issue(s) to outbox (M total in outbox)`

**Case 6: Sync fails (transient), outbox has data**
- Push fails with timeout/network error
- Don’t auto-save (user should retry)
- Don’t touch outbox (preserve existing data)
- `⚠️ Sync push failed: Connection timeout`
- `This appears to be a temporary issue.
  Retry: tbd sync`

**Case 7: Repeated sync attempts in blocked environment**
- First `tbd sync`: fails, auto-saves 3 issues to outbox
- User commits outbox to working branch
- Second `tbd sync` (same session): fails again
  - Does NOT import from outbox (push didn’t succeed)
  - Auto-save merges current unsynced work with existing outbox
  - If no new changes since last save, outbox unchanged
- Third `tbd sync`: same behavior
- Outbox remains stable until user moves to unblocked environment

**Case 8: User creates more issues between failed syncs**
- First `tbd sync`: fails, saves issues A, B to outbox
- User commits outbox
- User creates issue C
- Second `tbd sync`: fails, saves issue C to outbox (merges with A, B)
- User commits outbox (now has A, B, C)
- Outbox correctly accumulates all unsynced work

**Case 9: User moves from blocked to unblocked environment**
- In Claude Code: multiple `tbd sync` failures, outbox has 5 issues
- User switches to local dev (push works)
- `tbd sync`: succeeds!
- After success: import 5 issues from outbox, commit, push
- Outbox cleared
- All accumulated work is now synced

**Case 10: User wants to skip outbox import on success**
- Use `tbd sync --no-outbox`
- Primary sync succeeds
- Outbox is NOT imported (user will do it manually later)
- Use case: “I want to review outbox contents before importing”

**Case 11: Outbox has conflicts with current worktree**
- Outbox has issue A (title: “Old title”)
- Worktree has issue A (title: “New title”)
- Sync succeeds, then import from outbox
- Merge follows normal rules: LWW based on updated_at
- Conflicts go to attic
- This is expected behavior - same as any merge

**Case 12: No unsynced issues but sync still fails**
- User runs `tbd sync` when already in sync with remote
- Push fails (403)
- Nothing to save (no local changes)
- `⚠️ Sync push failed: HTTP 403`
- `No unsynced issues to save.`
- Outbox unchanged

**Case 13: Outbox import succeeds but second push fails**
- Primary push succeeds
- Import from outbox succeeds
- Second push fails (rare: network dropped)
- Issues are in worktree (safe), but not on remote
- Outbox already cleared
- Next `tbd sync` will push them (they’re in worktree now)
- No data loss, just delayed sync

### Part 2: Auto-Save to Outbox on Permanent Sync Failure

**Behavior**: When `tbd sync` push fails with a permanent error, automatically save
unsynced issues to the outbox.

```bash
# New behavior:
tbd sync
# ⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden
# ✓ Saved 2 issue(s) to outbox (automatic backup)
#
# Your issues are safe in .tbd/workspaces/outbox/
# To recover later:
#   1. Commit and push your current branch
#   2. Run 'tbd sync' in a session where sync works
#      (or 'tbd import --outbox' to import manually)
```

#### Error Classification

**Permanent failures** (auto-save to outbox):
- HTTP 403 Forbidden (permission denied)
- HTTP 401 Unauthorized (auth required/invalid)
- HTTP 404 Not Found (branch doesn’t exist on remote - though this is usually transient)
- “remote rejected” (push hooks rejected)
- “protected branch” errors

**Transient failures** (no auto-save, suggest retry):
- HTTP 5xx Server Error
- Network timeout
- Connection refused
- DNS resolution failure
- SSH key issues (could be permanent, but often config that user can fix)

**Classification heuristic**:
- If the error message contains “403”, “forbidden”, “permission”, “protected”, or
  “rejected” → likely permanent
- If the error message contains “timeout”, “connection”, “network”, “5xx”, or
  “temporarily” → likely transient
- When in doubt, treat as transient (let user retry)

#### Output Messages

**On permanent failure with auto-save**:
```
⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden

✓ Saved 2 issue(s) to outbox (automatic backup)

Your issues are safe. To recover later:
  1. Commit your working branch:  git add .tbd/workspaces && git commit -m "tbd: save outbox"
  2. Push your working branch:    git push
  3. Later, run 'tbd sync' when push access is available
     (outbox will be imported automatically)
```

**On transient failure (no auto-save)**:
```
⚠️  Sync push failed: Connection timeout

This appears to be a temporary issue. Options:
  • Retry:  tbd sync
  • Save for later:  tbd save --outbox
```

**On permanent failure when nothing to save**:
```
⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden

No unsynced issues to save (already in sync with remote).
```

**On auto-save failure**:
```
⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden
⚠️  Auto-save to outbox also failed: {error}

Run 'tbd save --outbox' manually, or 'tbd doctor' to diagnose.
```

#### Corner Cases

**Case 1: No unsynced issues**
- If the sync failed but there are no local changes to preserve, skip auto-save
- Print: “No unsynced issues to save”

**Case 2: Outbox already has data**
- Merge with existing outbox data (existing behavior)
- Print: “Saved N issue(s) to outbox” (doesn’t mention merge)

**Case 3: Auto-save fails**
- Print both errors: sync failure AND save failure
- Suggest manual intervention: `tbd save --outbox` or `tbd doctor`

**Case 4: User doesn’t want auto-save**
- New flag: `tbd sync --no-auto-save`
- Use case: User is debugging and wants to see raw error without side effects
- By default, auto-save is enabled (safer default)

**Case 5: Fetch succeeds but push fails (the common case)**
- This is the typical Claude Code scenario
- Fetch worked (we can read remote), but push is forbidden
- Auto-save kicks in, preserving local changes

**Case 6: Fetch fails (network issue)**
- Classify as transient
- No auto-save (network is broken, can’t determine if it’s permanent)
- Suggest retry

**Case 7: Both fetch and push fail**
- If fetch fails with permission error → permanent, auto-save
- If fetch fails with network error → transient, no auto-save

### Part 3: Command-Line Options Summary

**`tbd sync` options**:

| Flag | Behavior |
| --- | --- |
| (default) | Sync issues + auto-import outbox + auto-save on failure |
| `--no-outbox` | Skip outbox auto-import (still auto-save on failure) |
| `--no-auto-save` | Skip auto-save on failure (still auto-import outbox) |
| `--issues` | Existing: sync only issues (respects outbox flags) |
| `--docs` | Existing: sync only docs |

**Explicit commands (unchanged)**:

| Command | Behavior |
| --- | --- |
| `tbd save --outbox` | Manually save to outbox |
| `tbd import --outbox` | Manually import from outbox |
| `tbd workspace list` | See what's in workspaces |

### Part 4: User and Agent Experience

#### Typical Agent Workflow (After This Change)

**Scenario: Claude Code session with push restrictions**

```bash
# Agent creates/updates issues
tbd create "Fix authentication bug" --type=bug
tbd update tbd-a1b2 --status in_progress

# Agent tries to sync at end of session
tbd sync
# ⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden
# ✓ Saved 2 issue(s) to outbox (automatic backup)
# ...

# Agent only needs to commit and push the outbox
git add .tbd/workspaces && git commit -m "tbd: save outbox"
git push  # This succeeds (working branch is allowed)

# Agent can safely run tbd sync again (nothing bad happens)
tbd sync
# ⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden
# (No new issues to save - outbox already has them)

# Later, in different environment (local dev, CI), sync just works:
tbd sync
# ✓ Synced 0 issue(s) to remote
# ✓ Imported 2 issue(s) from outbox (also synced)
```

**Key improvements**:
1. Agent doesn’t need to remember `tbd save --outbox` - it happens automatically
2. Repeated `tbd sync` in blocked environment is safe (no outbox churn)
3. Outbox is imported only after successful push (not before)

#### Typical User Workflow

```bash
# User runs sync, it fails
tbd sync
# ⚠️  Sync push failed: HTTP 403 - push to 'tbd-sync' forbidden
# ✓ Saved 2 issue(s) to outbox (automatic backup)
# (Message explains next steps)

# User commits and pushes their branch
git add .tbd/workspaces && git commit -m "tbd: save outbox"
git push

# User can run tbd sync multiple times - no harm
tbd sync  # Same error, but outbox unchanged

# Later, on a machine with push access, user just syncs
tbd sync
# ✓ Synced 0 issue(s) to remote
# ✓ Imported 2 issue(s) from outbox (also synced)
```

**Key improvement**: Clear messaging tells user exactly what happened and what to do.

#### Multi-Session Accumulation

```bash
# Session 1 (blocked environment)
tbd create "Issue A"
tbd sync  # Fails, saves Issue A to outbox
git add .tbd/workspaces && git commit -m "tbd: save outbox" && git push

# Session 2 (still blocked)
tbd create "Issue B"
tbd sync  # Fails, merges Issue B with existing outbox
# ✓ Saved 1 issue(s) to outbox (2 total in outbox)
git add .tbd/workspaces && git commit -m "tbd: save outbox" && git push

# Session 3 (finally unblocked - e.g., local dev)
tbd sync
# ✓ Synced 0 issue(s) to remote
# ✓ Imported 2 issue(s) from outbox (also synced)

# All accumulated issues are now synced!
```

### Part 5: Implementation Details

#### Code References

**Key files to modify:**

| File | Purpose |
| --- | --- |
| [sync.ts](packages/tbd/src/cli/commands/sync.ts) | Main sync command - add auto-import and auto-save |
| [workspace.ts](packages/tbd/src/file/workspace.ts) | Workspace operations - already has `saveToWorkspace()` and `importFromWorkspace()` |
| [errors.ts](packages/tbd/src/cli/lib/errors.ts) | Error classes - add error classification utility |

**Insertion points in sync.ts:**

1. **Auto-save on failure** (lines 860-888 in `fullSync()`):
   - Current code reports push failure and suggests `tbd save --outbox`
   - Add error classification and automatic save before returning

2. **Auto-import on success** (lines 848-854 in `fullSync()`):
   - Current code shows success message after push
   - Add outbox check and import after successful push

3. **New `--no-outbox` and `--no-auto-save` flags** (lines 901+ in `syncCommand`):
   - Add command-line options

**Existing functions to reuse:**
- `saveToWorkspace()` from [workspace.ts:260](packages/tbd/src/file/workspace.ts#L260)
- `importFromWorkspace()` from
  [workspace.ts:386](packages/tbd/src/file/workspace.ts#L386)
- `listIssues()` from file operations
- `workspaceExists()` from [workspace.ts:609](packages/tbd/src/file/workspace.ts#L609)

#### Error Classification Function

```typescript
// Add to packages/tbd/src/cli/lib/errors.ts

type SyncErrorType = 'permanent' | 'transient' | 'unknown';

function classifySyncError(error: Error | string): SyncErrorType {
  const msg = typeof error === 'string' ? error : error.message;
  const lower = msg.toLowerCase();

  // Permanent indicators
  const permanentPatterns = [
    /403/, /forbidden/, /permission denied/,
    /401/, /unauthorized/,
    /protected branch/,
    /remote rejected/,
    /pre-receive hook declined/,
    /push declined/,
  ];

  for (const pattern of permanentPatterns) {
    if (pattern.test(lower)) return 'permanent';
  }

  // Transient indicators
  const transientPatterns = [
    /timeout/, /timed out/,
    /connection refused/, /connection reset/,
    /network/, /dns/,
    /5\d\d/, /server error/,
    /temporarily/,
    /try again/,
  ];

  for (const pattern of transientPatterns) {
    if (pattern.test(lower)) return 'transient';
  }

  return 'unknown';
}
```

#### Modified Sync Flow

```typescript
async function sync(options: SyncOptions): Promise<SyncResult> {
  // Step 1-3: Normal sync (fetch, merge, commit)
  const { localChanges, syncCommit } = await performLocalSync();

  // Step 4: Push to remote
  try {
    await pushToRemote();
    console.log(`✓ Synced ${localChanges.length} issue(s) to remote`);

    // Step 5: On success, check if outbox has data to import
    if (!options.noOutbox) {
      await maybeImportOutbox();
    }

    return { success: true, synced: localChanges.length };
  } catch (pushError) {
    // Push failed - classify and maybe auto-save
    const errorType = classifySyncError(pushError);

    if (errorType === 'permanent' && !options.noAutoSave) {
      await handlePermanentFailure(pushError, localChanges);
    } else if (errorType === 'transient') {
      console.log(`⚠️  Sync push failed: ${pushError.message}`);
      console.log(`\nThis appears to be a temporary issue. Options:`);
      console.log(`  • Retry:  tbd sync`);
      console.log(`  • Save for later:  tbd save --outbox`);
    } else {
      // Unknown - suggest retry but also mention save
      console.log(`⚠️  Sync push failed: ${pushError.message}`);
      console.log(`\nOptions:`);
      console.log(`  • Retry:  tbd sync`);
      console.log(`  • Save for later:  tbd save --outbox`);
    }

    return { success: false, error: pushError };
  }
}

async function maybeImportOutbox(): Promise<void> {
  const outboxPath = getOutboxPath();
  if (!await hasIssues(outboxPath)) {
    return; // Nothing to import
  }

  try {
    // Import from outbox
    const imported = await importFromWorkspace(outboxPath, {
      clearOnSuccess: false  // Don't clear yet - wait for push
    });

    // Commit the imported issues
    await commitToWorktree(`Import ${imported.count} issue(s) from outbox`);

    // Push again to sync the imported issues
    await pushToRemote();

    // Only now clear the outbox (both import AND push succeeded)
    await clearWorkspace('outbox');

    console.log(`✓ Imported ${imported.count} issue(s) from outbox (also synced)`);
  } catch (err) {
    // Don't fail the whole sync - primary sync already succeeded
    console.warn(`⚠️  Could not sync outbox: ${err.message}`);
    console.warn(`   Outbox preserved. Will retry on next sync.`);
  }
}

async function handlePermanentFailure(
  error: Error,
  localChanges: Issue[]
): Promise<void> {
  console.log(`⚠️  Sync push failed: ${error.message}`);

  if (localChanges.length === 0) {
    console.log(`\nNo unsynced issues to save (already in sync with remote).`);
    return;
  }

  // Auto-save to outbox (merges with existing outbox data)
  try {
    const existingCount = await countOutboxIssues();
    const saved = await saveToWorkspace('outbox', {
      updatesOnly: true  // Only save unsynced issues
    });

    // Show how many are in outbox now (accumulated)
    const totalCount = await countOutboxIssues();
    if (existingCount > 0 && saved.count > 0) {
      console.log(`\n✓ Saved ${saved.count} issue(s) to outbox (${totalCount} total in outbox)`);
    } else {
      console.log(`\n✓ Saved ${saved.count} issue(s) to outbox`);
    }

    console.log(`\nYour issues are safe. To recover later:`);
    console.log(`  1. Commit your working branch:  git add .tbd/workspaces && git commit -m "tbd: save outbox"`);
    console.log(`  2. Push your working branch:    git push`);
    console.log(`  3. Later, run 'tbd sync' when push access is available`);
    console.log(`     (outbox will be imported automatically on successful sync)`);
  } catch (saveError) {
    console.log(`⚠️  Auto-save to outbox also failed: ${saveError.message}`);
    console.log(`\nRun 'tbd save --outbox' manually, or 'tbd doctor' to diagnose.`);
  }
}
```

## Implementation Plan

### Phase 1: Error Classification

**File:** [packages/tbd/src/cli/lib/errors.ts](packages/tbd/src/cli/lib/errors.ts)

| Task | Description |
| --- | --- |
| 1.1 Add `classifySyncError()` | Pattern matching function to classify errors as permanent/transient/unknown |
| 1.2 Add unit tests | Test all error patterns (403, timeout, network, etc.) |

**Implementation notes:**
- Add after line ~114 (after `SyncBranchError` class)
- Export the function for use in sync.ts
- Test file: `packages/tbd/tests/unit/errors.test.ts`

### Phase 2: Auto-Save on Permanent Failure

**File:** [packages/tbd/src/cli/commands/sync.ts](packages/tbd/src/cli/commands/sync.ts)

| Task | Description |
| --- | --- |
| 2.1 Add `--no-auto-save` flag | New CLI option to disable auto-save (line ~901 in `syncCommand`) |
| 2.2 Import workspace functions | Add imports for `saveToWorkspace`, `workspaceExists` from workspace.ts |
| 2.3 Add `handlePermanentFailure()` method | New private method in `SyncHandler` class |
| 2.4 Modify push failure handling | In `fullSync()` lines 860-888, classify error and call auto-save |
| 2.5 Add smart "no-churn" logic | Only save if there are new changes since last save |
| 2.6 Format output messages | Clear messages for permanent vs transient failures |
| 2.7 Unit tests | Test auto-save triggers, accumulation, no-churn |

**Implementation notes:**
- Insert auto-save logic at line ~860 in `fullSync()` where `pushFailed` is detected
- Use `saveToWorkspace(tbdRoot, dataSyncDir, { outbox: true })`
- Count existing outbox issues before save to show accumulated total

### Phase 3: Auto-Import on Success

**File:** [packages/tbd/src/cli/commands/sync.ts](packages/tbd/src/cli/commands/sync.ts)

| Task | Description |
| --- | --- |
| 3.1 Add `--no-outbox` flag | New CLI option to skip outbox import (line ~901 in `syncCommand`) |
| 3.2 Import workspace functions | Add import for `importFromWorkspace`, `listIssues` if not present |
| 3.3 Add `maybeImportOutbox()` method | New private method in `SyncHandler` class |
| 3.4 Call after successful push | In `fullSync()` around line 848, after push succeeds |
| 3.5 Two-phase sync | Import → commit → push → clear (only clear if all succeed) |
| 3.6 Handle secondary push failure | Preserve outbox if second push fails |
| 3.7 Unit tests | Test import-on-success, secondary push failure |

**Implementation notes:**
- Check if outbox exists and has issues: `workspaceExists(tbdRoot, 'outbox')`
- Use
  `importFromWorkspace(tbdRoot, dataSyncDir, { outbox: true, clearOnSuccess: false })`
- After import succeeds, commit with `commitWorktreeChanges()`
- After second push succeeds, manually clear outbox
- If any step fails, preserve outbox for next sync

### Phase 4: Integration Tests

**File:** `packages/tbd/tests/integration/sync-outbox.test.ts` (new)

| Task | Description |
| --- | --- |
| 4.1 Create test file | New integration test file for outbox scenarios |
| 4.2 Test full recovery workflow | Create → fail → auto-save → recover → sync |
| 4.3 Test accumulation | Multiple failed syncs accumulate in outbox |
| 4.4 Test no-churn | Repeated syncs don't modify unchanged outbox |
| 4.5 Test Claude Code workflow | Blocked env → commit → unblocked env |

### Phase 5: Documentation

| Task | Description |
| --- | --- |
| 5.1 Update CLI help | Add descriptions for `--no-outbox` and `--no-auto-save` |
| 5.2 Update sync-failure-recovery shortcut | Reflect new automatic behavior |
| 5.3 Update tbd-sync-troubleshooting guideline | Add new troubleshooting info |
| 5.4 Update skill.md | Document new sync behavior for agents |

## Testing Strategy

### Unit Tests

**Error classification**:
```typescript
describe('classifySyncError', () => {
  it('classifies HTTP 403 as permanent', () => {
    expect(classifySyncError('HTTP 403 Forbidden')).toBe('permanent');
  });

  it('classifies network timeout as transient', () => {
    expect(classifySyncError('Connection timed out')).toBe('transient');
  });

  it('classifies unknown errors as unknown', () => {
    expect(classifySyncError('Something weird happened')).toBe('unknown');
  });
});
```

**Auto-import (on success only)**:
```typescript
describe('sync auto-import', () => {
  it('imports from outbox only after successful push', async () => {
    await setupOutboxWithIssues(3);
    mockPushSuccess();
    const result = await tbd('sync');
    expect(result.stdout).toContain('Synced');
    expect(result.stdout).toContain('Imported 3 issue(s) from outbox');
    expect(await hasOutboxData()).toBe(false);  // Outbox cleared
  });

  it('does NOT import from outbox if push fails', async () => {
    await setupOutboxWithIssues(3);
    mockPushFailure(403);
    const result = await tbd('sync');
    expect(result.stdout).not.toContain('Imported');
    expect(await hasOutboxData()).toBe(true);  // Outbox preserved
  });

  it('skips import if outbox is empty', async () => {
    mockPushSuccess();
    const result = await tbd('sync');
    expect(result.stdout).not.toContain('Imported');
    expect(result.stdout).not.toContain('outbox');
  });

  it('skips import with --no-outbox even on success', async () => {
    await setupOutboxWithIssues(3);
    mockPushSuccess();
    const result = await tbd('sync', '--no-outbox');
    expect(result.stdout).not.toContain('Imported');
    expect(await hasOutboxData()).toBe(true);  // Outbox preserved
  });

  it('preserves outbox if secondary push fails', async () => {
    await setupOutboxWithIssues(3);
    mockPushSuccessThenFailure();  // First push ok, second fails
    const result = await tbd('sync');
    expect(result.stdout).toContain('Could not sync outbox');
    expect(await hasOutboxData()).toBe(true);  // Outbox preserved for retry
  });
});
```

**Auto-save**:
```typescript
describe('sync auto-save', () => {
  it('auto-saves to outbox on permanent failure', async () => {
    await tbd('create', 'Test issue');
    mockPushFailure(403);

    const result = await tbd('sync');

    expect(result.stdout).toContain('Saved 1 issue(s) to outbox');
    expect(await hasOutboxData()).toBe(true);
  });

  it('does not auto-save on transient failure', async () => {
    await tbd('create', 'Test issue');
    mockPushFailure('timeout');

    const result = await tbd('sync');

    expect(result.stdout).not.toContain('Saved');
    expect(result.stdout).toContain('temporary issue');
  });

  it('does not touch outbox on transient failure', async () => {
    // Setup: outbox already has issues from previous failure
    await setupOutboxWithIssues(3);
    mockPushFailure('timeout');

    const result = await tbd('sync');

    // Outbox should be unchanged
    expect(await countOutboxIssues()).toBe(3);
  });

  it('skips auto-save with --no-auto-save', async () => {
    await tbd('create', 'Test issue');
    mockPushFailure(403);

    const result = await tbd('sync', '--no-auto-save');

    expect(result.stdout).not.toContain('Saved');
  });

  it('handles auto-save failure gracefully', async () => {
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    mockSaveFailure('disk full');

    const result = await tbd('sync');

    expect(result.stdout).toContain('Auto-save to outbox also failed');
    expect(result.stdout).toContain('tbd save --outbox');
  });

  it('merges with existing outbox on repeated failures', async () => {
    // First sync: create issue A, fail, save to outbox
    await tbd('create', 'Issue A');
    mockPushFailure(403);
    await tbd('sync');
    expect(await countOutboxIssues()).toBe(1);

    // Second sync: create issue B, fail, merge with outbox
    await tbd('create', 'Issue B');
    mockPushFailure(403);
    await tbd('sync');

    // Outbox should now have both issues
    expect(await countOutboxIssues()).toBe(2);
    const outboxIssues = await listOutboxIssues();
    expect(outboxIssues.some(i => i.title === 'Issue A')).toBe(true);
    expect(outboxIssues.some(i => i.title === 'Issue B')).toBe(true);
  });

  it('shows accumulated count in outbox', async () => {
    // Setup: outbox already has 3 issues
    await setupOutboxWithIssues(3);

    // Create new issue, sync fails
    await tbd('create', 'New issue');
    mockPushFailure(403);
    const result = await tbd('sync');

    // Should show total count
    expect(result.stdout).toContain('4 total in outbox');
  });

  it('handles repeated sync in blocked environment without churn', async () => {
    // First sync: fails, saves to outbox
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');
    const firstOutboxState = await getOutboxSnapshot();

    // Second sync: fails again, no new issues created
    mockPushFailure(403);
    await tbd('sync');
    const secondOutboxState = await getOutboxSnapshot();

    // Outbox should be unchanged (no unnecessary churn)
    expect(secondOutboxState).toEqual(firstOutboxState);
  });
});
```

### Integration Tests

**Full recovery workflow**:
```typescript
describe('end-to-end recovery', () => {
  it('recovers data across sessions via outbox', async () => {
    // Session 1: Create issue, sync fails, auto-save kicks in
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');

    // Verify outbox has the issue
    expect(await hasOutboxData()).toBe(true);

    // Simulate new session: different environment where push works
    mockPushSuccess();

    // Sync succeeds, then auto-imports outbox
    const result = await tbd('sync');
    expect(result.stdout).toContain('Synced');
    expect(result.stdout).toContain('Imported 1 issue(s) from outbox');

    // Outbox should be cleared
    expect(await hasOutboxData()).toBe(false);

    // Issue should be synced to remote
    const remoteIssues = await listRemoteIssues();
    expect(remoteIssues.some(i => i.title === 'Test issue')).toBe(true);
  });

  it('accumulates issues across multiple failed syncs', async () => {
    // Session 1: Create issue A, sync fails
    await tbd('create', 'Issue A');
    mockPushFailure(403);
    await tbd('sync');
    // User commits outbox to working branch
    await commitWorkspace();

    // Session 1 continued: Create issue B, sync fails
    await tbd('create', 'Issue B');
    mockPushFailure(403);
    await tbd('sync');
    // User commits updated outbox
    await commitWorkspace();

    // Verify outbox accumulated both issues
    expect(await countOutboxIssues()).toBe(2);

    // Session 2: Different environment where push works
    mockPushSuccess();
    const result = await tbd('sync');

    // Should import both accumulated issues
    expect(result.stdout).toContain('Imported 2 issue(s) from outbox');

    // Outbox should be cleared
    expect(await hasOutboxData()).toBe(false);
  });

  it('handles Claude Code workflow: blocked env → commit → unblocked env', async () => {
    // Claude Code session: push to tbd-sync is forbidden
    await tbd('create', 'Feature: add auth');
    await tbd('create', 'Bug: fix login');
    mockPushFailure(403);
    await tbd('sync');

    // Auto-save kicked in
    expect(await countOutboxIssues()).toBe(2);

    // Agent commits and pushes working branch (succeeds)
    await exec('git add .tbd/workspaces && git commit -m "tbd: save outbox"');
    await exec('git push');  // This works (working branch allowed)

    // Later: user syncs from local dev (or CI)
    mockPushSuccess();
    const result = await tbd('sync');

    // All issues recovered and synced
    expect(result.stdout).toContain('Imported 2 issue(s) from outbox');
    expect(await hasOutboxData()).toBe(false);
  });

  it('does not churn outbox on repeated sync in blocked env', async () => {
    // Create issues, sync fails, saves to outbox
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');

    // Get outbox file mtimes
    const mtime1 = await getOutboxMtime();

    // Wait a bit
    await sleep(100);

    // Sync again (no new issues) - should not modify outbox
    mockPushFailure(403);
    await tbd('sync');

    const mtime2 = await getOutboxMtime();

    // Outbox files should not have been rewritten
    expect(mtime2).toEqual(mtime1);
  });
});
```

## Open Questions

1. **Should auto-import print a message even when outbox is empty?**
   - Current design: No message (silent no-op)
   - Alternative: Always print “Outbox: empty” or similar
   - Recommendation: Silent is cleaner, reduces noise

2. **What about the `--all` vs `--updates-only` behavior for auto-save?**
   - Current design: Use `--updates-only` (only unsynced issues)
   - This matches `tbd save --outbox` behavior
   - Full export seems unnecessary for failure recovery

3. **Should we add a config option to disable auto-save globally?**
   - Use case: Users who prefer explicit control
   - Could add `settings.auto_save_on_failure: false` to config.yml
   - Recommendation: Defer until requested (CLI flag should suffice)

4. **How aggressive should error classification be?**
   - Current design: When in doubt, treat as transient
   - Alternative: When in doubt, auto-save anyway
   - Recommendation: Transient default is safer (auto-save is side effect)

## Implementation Status

**Status**: Core implementation complete, integration tests pending.

### Completed

| Phase | Component | Status |
| --- | --- | --- |
| 1 | `classifySyncError()` function in errors.ts | ✅ Complete with 38 unit tests |
| 2.1 | `--no-auto-save` flag | ✅ Complete |
| 2.2 | `handlePermanentFailure()` method | ✅ Complete |
| 2.3 | Integration into fullSync() push failure | ✅ Complete |
| 2.4 | No-churn logic | ✅ Complete (uses updatesOnly + result.saved check) |
| 3.1 | `--no-outbox` flag | ✅ Complete |
| 3.2 | `maybeImportOutbox()` method | ✅ Complete |
| 3.3 | Integration into fullSync() success path | ✅ Complete |
| 4 | Integration tests | ⏳ Pending |
| 5 | Documentation | ⏳ Pending |

### Implementation Notes

1. **Error classification patterns**: Added 10 permanent patterns (403, forbidden,
   permission denied, 401, unauthorized, protected branch, remote rejected, pre-receive
   hook declined, push declined, not allowed to push) and 13 transient patterns
   (timeout, timed out, connection refused/reset/closed, network, dns, 5xx, server
   error, temporarily, try again, could not resolve, no route to host).

2. **No-churn implementation**: Uses `saveToWorkspace` with `outbox: true` which implies
   `updatesOnly: true`. This filters issues via `getUpdatedIssues()` to only those that
   differ from remote. When `result.saved === 0`, the message indicates issues are
   already in outbox.

3. **Two-phase outbox import**: `maybeImportOutbox()` performs: (1) import with
   `clearOnSuccess: false`, (2) commit changes, (3) push to remote, (4) delete outbox
   only if all succeed.
   If secondary push fails, outbox is preserved but issues remain in worktree for next
   sync.

### Open Issues

1. **Integration test infrastructure**: Full integration tests require mocking git push
   failures and setting up test remotes.
   The existing test infrastructure uses isolated git repos but doesn’t easily support
   simulating push failures.
   Consider:
   - Adding mock infrastructure for push operations
   - Creating dedicated test fixtures with branch protection
   - Using git hooks to simulate push rejections

2. **Outbox count after merge**: The `handlePermanentFailure` shows “N total in outbox”
   but this counts files in outbox directory, not accounting for merges.
   If an issue exists in both worktree and outbox, the count may be off by one.

## References

- Related spec: plan-2026-01-30-workspace-sync-alt.md
- Related shortcut: sync-failure-recovery
- Related guideline: tbd-sync-troubleshooting
