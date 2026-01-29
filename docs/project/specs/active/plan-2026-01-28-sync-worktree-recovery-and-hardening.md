# Feature: Sync Worktree Recovery and Hardening

**Date:** 2026-01-28

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

The tbd sync system has critical bugs that allow data loss and silent failures.
When the hidden worktree (`.tbd/data-sync-worktree/`) is missing or corrupted, the
system:
1. Silently falls back to writing data to the wrong location (`.tbd/data-sync/`)
2. Reports “Already in sync” when hundreds of issues have never been synced
3. Fails to detect or recover from worktree corruption

This spec addresses comprehensive fixes to make sync robust, recoverable, and fail-safe.

## Goals

- **G1**: Sync should NEVER report “in sync” when data hasn’t been synced
- **G2**: Missing/corrupted worktree should be automatically repaired
- **G3**: Path resolution should be consistent across all sync operations
- **G4**: Clear error messages when sync cannot proceed
- **G5**: Recovery path for existing repos with data in wrong location

## Non-Goals

- Changing the fundamental worktree architecture (that’s working correctly when set up)
- Supporting non-worktree sync modes (the fallback path is the bug, not a feature)
- Backward compatibility with the broken state (we fix it, not preserve it)

## Background

### Incident: ai-trade-arena Data Loss

On 2026-01-28, discovered that the ai-trade-arena repo had 951 issues in
`.tbd/data-sync/` that were never synced to the `tbd-sync` branch.
The remote branch only contained the initial commit from Jan 17, while issues were
actively created through Jan 27.

**Timeline:**
- Jan 17: tbd initialized, worktree created, initial commit pushed
- Jan 18: Beads migration imported ~950 issues
- Jan 18-27: Issues created/modified, never synced
- Jan 28: `tbd sync` reported “Already in sync” (false)

### Root Cause Analysis

**Bug 1: Path Mismatch in sync.ts**
```typescript
// Line 57 - data operations use resolved path
this.dataSyncDir = await resolveDataSyncDir(tbdRoot);  // → .tbd/data-sync/ (fallback)

// Line 273, 427 - commit operations use hardcoded path
const worktreePath = join(process.cwd(), WORKTREE_DIR);  // → .tbd/data-sync-worktree
```

Data is read/written via `dataSyncDir` but commit operations target `worktreePath`.

**Bug 2: getSyncStatus checks gitignored path**
```typescript
// Line 140 - runs on MAIN branch where data-sync/ is gitignored!
const status = await git('status', '--porcelain', DATA_SYNC_DIR);
```

Returns empty because `.tbd/data-sync/` is in `.tbd/.gitignore`.

> **Note:** Line numbers reference the sync.ts implementation as of 2026-01-28. Verify
> against current code before implementation.

**Bug 3: Silent fallback in resolveDataSyncDir**
```typescript
// paths.ts lines 225-246
export async function resolveDataSyncDir(baseDir): Promise<string> {
  try {
    await access(worktreePath);  // Check if worktree exists
    return worktreePath;
  } catch {
    return directPath;  // SILENT fallback - no warning, no error
  }
}
```

**Bug 4: No worktree health check before sync**
- Sync doesn’t verify worktree exists before operations
- Should call `updateWorktree()` which would recreate if missing

**Bug 5: commitWorktreeChanges fails silently**
```typescript
// Line 300-306 - catches errors but only checks for "nothing to commit"
} catch (error) {
  const msg = (error as Error).message;
  if (msg.includes('nothing to commit')) {
    return emptyTallies();
  }
  throw error;  // Other errors (like missing dir) may not reach here
}
```

**Bug 6: Fresh clone sync doesn’t pull from remote**

When a user clones a repo with an existing `origin/tbd-sync` branch:
- No local `tbd-sync` branch exists
- No local worktree exists
- `tbd sync` says “Already in sync” without creating worktree or pulling issues
- Remote has 603 issues, local shows 0

The fix: sync should detect remote branch exists but no local setup, and create worktree
from remote.

### Comparison: Working vs Broken Repos

| Aspect | TBD (Working) | ai-trade-arena | markform | lexikon-site | Fresh Clone |
| --- | --- | --- | --- | --- | --- |
| Failure Mode | None | Worktree deleted | Never initialized | Never pushed | Clone not initialized |
| `data-sync-worktree/` | EXISTS | MISSING (prunable) | MISSING | EXISTS | MISSING |
| Local tbd-sync | EXISTS | EXISTS | MISSING | EXISTS | MISSING |
| Remote tbd-sync | EXISTS | EXISTS (empty) | MISSING | MISSING | EXISTS (603 issues) |
| Wrong location issues | 0 | 957 | 8 | 0 | 0 |
| Correct location issues | 603 | 0 | 0 | 0 | 0 |
| Severity | OK | CRITICAL | CRITICAL | MINOR | CRITICAL |
| Doctor --fix action | N/A | Prune + recreate + migrate | Create + migrate | Just sync | Create worktree from remote |

**Four distinct failure modes:**

1. **Worktree deleted** (ai-trade-arena): Worktree was created, then deleted.
   Git still tracks it as “prunable”.
   Branches exist. Data written to wrong fallback path.
   - Fix: `git worktree prune`, recreate worktree, migrate data, push

2. **Never initialized** (markform): Worktree was never created (possibly due to older
   tbd version or interrupted setup).
   No branches exist. Data written to wrong path.
   - Fix: Create orphan branch, create worktree, migrate data, push

3. **Never pushed** (lexikon-site): Everything local is correct, but remote branch
   doesn’t exist. User just needs to push.
   - Fix: Run `tbd sync` to push

4. **Fresh clone not initialized** (git clone scenario): User clones a repo where remote
   tbd-sync exists with issues, but sync doesn’t create local worktree or pull issues.
   - Fix: `tbd sync` or `tbd doctor --fix` should create worktree from remote branch

### Bug Summary Table

| Bug # | Description | Location | Doctor Detection | Doctor --fix Action |
| --- | --- | --- | --- | --- |
| 1 | Path mismatch: dataSyncDir vs WORKTREE_DIR | sync.ts:57,273,427 | N/A (code fix) | N/A |
| 2 | getSyncStatus checks gitignored path | sync.ts:140 | N/A (code fix) | N/A |
| 3 | Silent fallback in resolveDataSyncDir | paths.ts:225-246 | "Worktree missing" | Create worktree |
| 4 | No worktree health check before sync | sync.ts | "Worktree missing/prunable" | Repair worktree |
| 5 | commitWorktreeChanges fails silently | sync.ts:300-306 | "Data in wrong location" | Migrate data |
| 6 | Fresh clone doesn't pull from remote | sync.ts | "Worktree missing, remote exists" | Create from remote |

### Failure Mode → Doctor Detection → Fix

| Failure Mode | Doctor Detects | Doctor --fix Does |
| --- | --- | --- |
| Worktree deleted (prunable) | ✗ Worktree is prunable | Prune, recreate, migrate, commit |
| Never initialized | ✗ Worktree missing, ✗ Branch missing | Create orphan, worktree, migrate |
| Never pushed | ⚠ Remote branch missing | (none - user runs tbd sync) |
| Fresh clone | ✗ Worktree missing, remote exists | Create worktree from remote |
| Data in wrong location | ✗ Issues in .tbd/data-sync/ | Backup to .tbd/backups/, migrate to worktree |

## Design

### Approach

1. **Fail-fast, not fail-silent**: If worktree is missing, ERROR immediately
2. **Auto-repair**: Attempt to recreate worktree before erroring
3. **Path consistency**: Use a single source of truth for data path
4. **Migration support**: Handle repos with data in wrong location

### Key Principles

**Path Terminology:**

| Term | Path | Description |
| --- | --- | --- |
| **Worktree path** | `.tbd/data-sync-worktree/.tbd/data-sync/` | Correct production path — inside hidden worktree checkout |
| **Direct path** | `.tbd/data-sync/` | Fallback path — gitignored on main, should NEVER contain data in production |
| **Sync branch** | `tbd-sync` | Orphan branch containing issue data |

**Rules:**
1. The worktree path is the ONLY correct path for data in production
2. The direct path exists ONLY for test fixtures without git (via `allowFallback: true`)
3. If `.tbd/data-sync/issues/` contains data on main branch, this indicates the worktree
   was missing and data was written to the wrong location — a bug requiring migration

### Components

#### 1. Enhanced Path Resolution (paths.ts)

```typescript
export async function resolveDataSyncDir(
  baseDir: string = process.cwd(),
  options?: { allowFallback?: boolean; repair?: boolean }
): Promise<string> {
  const worktreePath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);

  // Check if worktree exists
  if (await pathExists(worktreePath)) {
    return worktreePath;
  }

  // Attempt repair if requested
  if (options?.repair) {
    const result = await initWorktree(baseDir);
    if (result.success) {
      return worktreePath;
    }
  }

  // Only allow fallback in test mode
  if (options?.allowFallback) {
    return join(baseDir, DATA_SYNC_DIR);
  }

  // Fail with clear error
  throw new WorktreeMissingError(
    'Worktree not found at .tbd/data-sync-worktree/. ' +
    'Run `tbd doctor --fix` to repair.'
  );
}
```

#### 2. Sync Command Hardening (sync.ts)

```typescript
async run(options: SyncOptions): Promise<void> {
  // FIRST: Ensure worktree exists and is healthy
  const worktreeStatus = await checkWorktreeHealth(tbdRoot);
  if (!worktreeStatus.healthy) {
    if (options.fix || options.force) {
      await this.repairWorktree(tbdRoot);
    } else {
      throw new WorktreeError(
        `Worktree is ${worktreeStatus.status}. ` +
        `Run 'tbd sync --fix' to repair.`
      );
    }
  }

  // Now safe to resolve path - worktree guaranteed to exist
  this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

  // ... rest of sync
}
```

#### 3. Worktree Health Check (git.ts)

```typescript
export async function checkWorktreeHealth(baseDir: string): Promise<{
  healthy: boolean;
  status: 'valid' | 'missing' | 'prunable' | 'corrupted';
  details?: string;
}> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  // Check directory exists
  if (!await pathExists(worktreePath)) {
    return { healthy: false, status: 'missing' };
  }

  // Check .git file exists and points to valid location
  const gitFile = join(worktreePath, '.git');
  if (!await pathExists(gitFile)) {
    return { healthy: false, status: 'corrupted', details: 'Missing .git file' };
  }

  // Check git worktree list for prunable status
  const worktreeList = await git('worktree', 'list', '--porcelain');
  if (worktreeList.includes('prunable')) {
    return { healthy: false, status: 'prunable', details: 'Git reports prunable' };
  }

  return { healthy: true, status: 'valid' };
}
```

#### 4. Doctor Command Enhancement (doctor.ts)

The doctor command should perform comprehensive health checks on all sync-related
components: worktree, local branch, and remote branch.

```typescript
// =============================================================================
// 1. WORKTREE HEALTH CHECK
// =============================================================================
const worktreeStatus = await checkWorktreeHealth(tbdRoot);
if (!worktreeStatus.healthy) {
  issues.push({
    severity: 'error',
    message: `Worktree is ${worktreeStatus.status}`,
    fix: 'Run `tbd doctor --fix` to repair',
    autoFixable: true,
  });
}

// =============================================================================
// 2. LOCAL BRANCH HEALTH CHECK
// =============================================================================
const localBranchStatus = await checkLocalBranchHealth(syncBranch);
if (!localBranchStatus.exists) {
  issues.push({
    severity: 'error',
    message: `Local branch '${syncBranch}' does not exist`,
    fix: 'Run `tbd doctor --fix` to create from remote or initialize',
    autoFixable: true,
  });
} else if (localBranchStatus.orphaned) {
  // Branch exists but has no commits (empty orphan)
  issues.push({
    severity: 'warning',
    message: `Local branch '${syncBranch}' exists but has no commits`,
    fix: 'This may be normal for a new repo, or run `tbd sync` to push data',
    autoFixable: false,
  });
}

// =============================================================================
// 3. REMOTE BRANCH HEALTH CHECK
// =============================================================================
const remoteBranchStatus = await checkRemoteBranchHealth(remote, syncBranch);
if (!remoteBranchStatus.exists) {
  issues.push({
    severity: 'warning',
    message: `Remote branch '${remote}/${syncBranch}' does not exist`,
    fix: 'Run `tbd sync` to push local branch to remote',
    autoFixable: false,
  });
} else if (remoteBranchStatus.diverged) {
  issues.push({
    severity: 'warning',
    message: `Local and remote '${syncBranch}' have diverged`,
    fix: 'Run `tbd sync` to reconcile changes',
    autoFixable: false,
  });
}

// =============================================================================
// 4. SYNC STATE CONSISTENCY CHECK
// =============================================================================
// NOTE: Only run these checks if worktree is healthy. If worktree is missing/prunable,
// we already reported that error above and these checks would produce misleading results.
if (worktreeStatus.healthy) {
  const syncConsistency = await checkSyncConsistency(tbdRoot, syncBranch, remote);

  // Check: worktree HEAD matches local branch
  if (!syncConsistency.worktreeMatchesLocal) {
    issues.push({
      severity: 'error',
      message: `Worktree HEAD does not match local '${syncBranch}' branch`,
      details: `Worktree: ${syncConsistency.worktreeHead}, Branch: ${syncConsistency.localHead}`,
      fix: 'Run `tbd doctor --fix` to reset worktree to branch HEAD',
      autoFixable: true,
    });
  }

  // Check: local has unpushed commits
  if (syncConsistency.localAhead > 0) {
    issues.push({
      severity: 'info',
      message: `Local '${syncBranch}' is ${syncConsistency.localAhead} commit(s) ahead of remote`,
      fix: 'Run `tbd sync` to push changes',
      autoFixable: false,
    });
  }

  // Check: remote has unpulled commits
  if (syncConsistency.localBehind > 0) {
    issues.push({
      severity: 'info',
      message: `Local '${syncBranch}' is ${syncConsistency.localBehind} commit(s) behind remote`,
      fix: 'Run `tbd sync` to pull changes',
      autoFixable: false,
    });
  }
}

// =============================================================================
// 5. DATA LOCATION CHECK
// =============================================================================
// Check for data in wrong location (direct path instead of worktree)
const wrongPath = join(tbdRoot, DATA_SYNC_DIR);
const wrongPathIssues = await listIssues(wrongPath).catch(() => []);
if (wrongPathIssues.length > 0) {
  issues.push({
    severity: 'error',
    message: `Found ${wrongPathIssues.length} issues in wrong location (.tbd/data-sync/)`,
    fix: 'Run `tbd doctor --fix` to migrate to worktree',
    autoFixable: true,
  });
}

// Check: local data exists but remote is empty (the ai-trade-arena bug)
// This can happen in two scenarios:
// 1. Worktree is healthy but data never pushed
// 2. Worktree is unhealthy/missing but data exists in wrong location
if (remoteBranchStatus.exists) {
  const remoteIssueCount = await countRemoteIssues(remote, syncBranch);

  if (remoteIssueCount === 0) {
    // Check for data in correct location (worktree)
    if (worktreeStatus.healthy) {
      const worktreeIssueCount = await countIssues(join(tbdRoot, DATA_SYNC_DIR_VIA_WORKTREE));
      if (worktreeIssueCount > 0) {
        issues.push({
          severity: 'error',
          message: `Local worktree has ${worktreeIssueCount} issues but remote has none - data not synced!`,
          fix: 'Run `tbd sync` to push local issues to remote',
          autoFixable: false,
        });
      }
    }

    // Check for data in wrong location (already detected above, but add context about remote)
    if (wrongPathIssues.length > 0) {
      issues.push({
        severity: 'error',
        message: `Remote '${syncBranch}' has no issues - the ${wrongPathIssues.length} local issues were never synced`,
        fix: 'Run `tbd doctor --fix` to repair worktree and migrate data, then `tbd sync`',
        autoFixable: false,
      });
    }
  }
}

// =============================================================================
// 6. MULTI-USER / CLONE SCENARIO CHECK
// =============================================================================
// Detect when a user clones a repo where issues should exist but don't.
// This catches the case where User A had sync issues, and User B clones
// and sees no issues despite evidence they should exist.

const tbdIssueCount = worktreeStatus.healthy
  ? await countIssues(join(tbdRoot, DATA_SYNC_DIR_VIA_WORKTREE))
  : 0;

// Check 1: Beads migration evidence exists but tbd has no issues
const beadsDisabledPath = join(tbdRoot, '.beads-disabled');
const beadsPath = join(tbdRoot, '.beads');
const beadsMigrationExists = await pathExists(beadsDisabledPath);
const beadsActiveExists = await pathExists(beadsPath);

if (beadsMigrationExists && tbdIssueCount === 0 && wrongPathIssues.length === 0) {
  // User B scenario: cloned repo with beads migration but no tbd issues
  const beadsJsonl = join(beadsDisabledPath, '.beads', 'issues.jsonl');
  let beadsIssueCount = 0;
  try {
    const content = await readFile(beadsJsonl, 'utf-8');
    beadsIssueCount = content.trim().split('\n').filter(Boolean).length;
  } catch { /* ignore */ }

  if (beadsIssueCount > 0) {
    issues.push({
      severity: 'error',
      message: `Beads migration exists with ${beadsIssueCount} issues, but tbd has none`,
      details: 'This repo was migrated from beads but issues were never synced to remote. ' +
               'Another user may have the issues locally but they were not pushed.',
      fix: 'Contact the repo owner to run `tbd sync` and push their local issues',
      autoFixable: false,
    });
  }
}

// Check 2: Config has id_prefix set but no issues exist (suggests prior usage)
if (tbdIssueCount === 0 && wrongPathIssues.length === 0 && !beadsMigrationExists) {
  const config = await readConfig(tbdRoot).catch(() => null);
  if (config?.display?.id_prefix) {
    // id_prefix is set, which suggests issues were created at some point
    // But we have no issues - this is suspicious
    issues.push({
      severity: 'warning',
      message: `Config has id_prefix '${config.display.id_prefix}' but no issues exist`,
      details: 'This suggests issues may have been created but not synced, ' +
               'or were lost due to sync issues on another machine.',
      fix: 'If you expect issues to exist, contact the repo owner',
      autoFixable: false,
    });
  }
}

// Check 3: Active beads directory exists (not migrated yet)
if (beadsActiveExists && tbdIssueCount === 0) {
  issues.push({
    severity: 'info',
    message: 'Beads directory exists - migration to tbd available',
    fix: 'Run `tbd import --beads` to migrate beads issues to tbd',
    autoFixable: false,
  });
}
```

#### 4b. Health Check Helper Functions (git.ts)

```typescript
/**
 * Check local sync branch health.
 */
export async function checkLocalBranchHealth(syncBranch: string): Promise<{
  exists: boolean;
  orphaned: boolean;
  head?: string;
}> {
  try {
    const head = await git('rev-parse', `refs/heads/${syncBranch}`);
    return { exists: true, orphaned: false, head: head.trim() };
  } catch {
    // Check if branch ref exists but is orphaned (no commits)
    try {
      await git('show-ref', '--verify', `refs/heads/${syncBranch}`);
      return { exists: true, orphaned: true };
    } catch {
      return { exists: false, orphaned: false };
    }
  }
}

/**
 * Check remote sync branch health.
 */
export async function checkRemoteBranchHealth(
  remote: string,
  syncBranch: string
): Promise<{
  exists: boolean;
  diverged: boolean;
  head?: string;
}> {
  try {
    await git('fetch', remote, syncBranch);
    const head = await git('rev-parse', `refs/remotes/${remote}/${syncBranch}`);

    // Check for divergence
    const mergeBase = await git('merge-base', syncBranch, `${remote}/${syncBranch}`).catch(() => '');
    const localHead = await git('rev-parse', syncBranch).catch(() => '');
    const remoteHead = head.trim();

    const diverged = mergeBase.trim() !== localHead.trim() &&
                     mergeBase.trim() !== remoteHead;

    return { exists: true, diverged, head: remoteHead };
  } catch {
    return { exists: false, diverged: false };
  }
}

/**
 * Check consistency between worktree, local branch, and remote.
 */
export async function checkSyncConsistency(
  baseDir: string,
  syncBranch: string,
  remote: string
): Promise<{
  worktreeHead: string;
  localHead: string;
  remoteHead: string;
  worktreeMatchesLocal: boolean;
  localAhead: number;
  localBehind: number;
}> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  const worktreeHead = await git('-C', worktreePath, 'rev-parse', 'HEAD').catch(() => '');
  const localHead = await git('rev-parse', syncBranch).catch(() => '');
  const remoteHead = await git('rev-parse', `${remote}/${syncBranch}`).catch(() => '');

  let localAhead = 0;
  let localBehind = 0;

  if (localHead && remoteHead) {
    const aheadOutput = await git('rev-list', '--count', `${remote}/${syncBranch}..${syncBranch}`).catch(() => '0');
    const behindOutput = await git('rev-list', '--count', `${syncBranch}..${remote}/${syncBranch}`).catch(() => '0');
    localAhead = parseInt(aheadOutput, 10) || 0;
    localBehind = parseInt(behindOutput, 10) || 0;
  }

  return {
    worktreeHead: worktreeHead.trim(),
    localHead: localHead.trim(),
    remoteHead: remoteHead.trim(),
    worktreeMatchesLocal: worktreeHead.trim() === localHead.trim(),
    localAhead,
    localBehind,
  };
}
```

#### 5. Migration Command (migrate-data subcommand or doctor --fix)

For repos with data in the wrong location:

```typescript
async function migrateDataToWorktree(baseDir: string): Promise<void> {
  const wrongPath = join(baseDir, DATA_SYNC_DIR);
  const correctPath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);

  // Ensure worktree exists
  await initWorktree(baseDir);

  // Copy issues from wrong path to correct path
  const issues = await listIssues(wrongPath);
  for (const issue of issues) {
    await writeIssue(correctPath, issue);
  }

  // Copy mappings
  const mappingsWrong = join(wrongPath, 'mappings');
  const mappingsCorrect = join(correctPath, 'mappings');
  await copyDir(mappingsWrong, mappingsCorrect);

  // Commit in worktree
  await git('-C', join(baseDir, WORKTREE_DIR), 'add', '-A');
  await git('-C', join(baseDir, WORKTREE_DIR), 'commit', '-m',
    `tbd: migrate ${issues.length} issues from incorrect location`);

  // Remove wrong path data (after backup confirmation)
  // await rm(wrongPath, { recursive: true });
}
```

### API Changes

**New options:**
- `tbd sync --fix` - Attempt to repair worktree before syncing
- `tbd doctor --fix` - Auto-fix detected issues including worktree

**New errors:**
- `WorktreeMissingError` - Worktree directory doesn’t exist
- `WorktreeCorruptedError` - Worktree exists but is invalid

## Implementation Plan

**Epic:**
[tbd-4bg7](/.tbd/data-sync-worktree/.tbd/data-sync/issues/is-01kg3fj7r0jqj8p1hg9wt9h4sz.md)
\- Sync Worktree Recovery and Hardening

### Implementation Issues

All implementation work is tracked as tbd issues with proper dependencies.

#### Phase 1: Detection and Error Reporting (14 issues)

| ID | Title | Status | Blocked By |
| --- | --- | --- | --- |
| tbd-nc9p | Add WorktreeMissingError, WorktreeCorruptedError, SyncBranchError classes | open | - |
| tbd-wwb2 | Add checkLocalBranchHealth() function | open | - |
| tbd-9pw4 | Add checkRemoteBranchHealth() function | open | - |
| tbd-nkkt | Doctor: Add data location check (issues in wrong path) | open | - |
| tbd-uzdy | Enhance checkWorktreeHealth() to detect prunable state | open | tbd-nc9p |
| tbd-sad6 | Add checkSyncConsistency() function | open | tbd-uzdy, tbd-wwb2, tbd-9pw4 |
| tbd-7v8p | Doctor: Enhanced worktree health check with prunable detection | open | tbd-uzdy |
| tbd-ty40 | Doctor: Add local branch health check | open | tbd-wwb2 |
| tbd-umee | Doctor: Add remote branch health check | open | tbd-9pw4 |
| tbd-ft5u | Doctor: Add sync consistency check | open | tbd-sad6 |
| tbd-xho7 | Doctor: Add 'local has data but remote empty' detection | open | tbd-nkkt |
| tbd-6cok | Doctor: Add multi-user/clone scenario detection | open | tbd-nkkt |
| tbd-vuk8 | Sync: Check worktree health before operations | open | tbd-uzdy |
| tbd-3bs1 | Tests: Phase 1 detection and error reporting | open | tbd-vuk8 |

#### Phase 2: Path Consistency (5 issues)

| ID | Title | Status | Blocked By |
| --- | --- | --- | --- |
| tbd-ji4n | Update getSyncStatus() to check worktree, not main branch | open | tbd-3bs1 |
| tbd-24vi | Update commitWorktreeChanges() to use dataSyncDir consistently | open | tbd-ji4n |
| tbd-30ch | Audit sync.ts for hardcoded DATA_SYNC_DIR/WORKTREE_DIR usage | open | tbd-24vi |
| tbd-uv33 | Update resolveDataSyncDir() to throw WorktreeMissingError | open | tbd-nc9p |
| tbd-t7n2 | Tests: Phase 2 path consistency | open | tbd-30ch, tbd-uv33 |

#### Phase 3: Auto-Repair (6 issues)

| ID | Title | Status | Blocked By |
| --- | --- | --- | --- |
| tbd-77xk | Add --fix flag to tbd sync | open | tbd-t7n2 |
| tbd-e5sp | Implement repairWorktree() function | open | tbd-77xk |
| tbd-u8x8 | Implement migrateDataToWorktree() function | open | tbd-e5sp |
| tbd-unn8 | Add confirmation prompt for destructive repair operations | open | tbd-u8x8 |
| tbd-25oc | Doctor --fix: Implement repair actions | open | tbd-e5sp, tbd-u8x8, tbd-unn8 |
| tbd-onx8 | Tests: Phase 3 auto-repair | open | tbd-25oc |

#### Phase 4: Prevention (6 issues)

| ID | Title | Status | Blocked By |
| --- | --- | --- | --- |
| tbd-q9zv | Add architectural test: issues written to worktree path | open | tbd-onx8 |
| tbd-xl9d | Add CI check: worktree health after operations | open | tbd-q9zv |
| tbd-nk1w | Update init/setup to verify worktree after creation | open | tbd-onx8 |
| tbd-53lh | Add warning in resolveDataSyncDir test mode fallback | open | tbd-t7n2 |
| tbd-rbaz | Add e2e tryscript test for sync worktree scenarios | open | tbd-onx8 |
| tbd-kb4y | Document worktree architecture in developer docs | open | - |

* * *

### Phase 1 Details: Detection and Error Reporting

Add proper detection and clear error messages before any auto-repair.

**Health Check Functions (git.ts):**
- [ ] Add `checkWorktreeHealth()` function - detect missing/prunable/corrupted worktree
- [ ] Add `checkLocalBranchHealth()` function - detect missing/orphaned local tbd-sync
  branch
- [ ] Add `checkRemoteBranchHealth()` function - detect missing/diverged remote branch
- [ ] Add `checkSyncConsistency()` function - compare worktree HEAD, local HEAD, remote
  HEAD

**Doctor Command (doctor.ts):**
- [ ] Add worktree health check to doctor
- [ ] Add local branch health check to doctor
- [ ] Add remote branch health check to doctor
- [ ] Add sync consistency check (worktree matches local, ahead/behind counts)
- [ ] Add data location check (detect issues in wrong .tbd/data-sync/ path)
- [ ] Add “local has data but remote empty” detection (the ai-trade-arena bug)
- [ ] Add multi-user/clone scenario detection:
  - [ ] Beads migration exists but tbd has no issues (User B cloned broken repo)
  - [ ] Config has id_prefix but no issues (suggests lost data)
  - [ ] Active .beads/ directory exists (migration available)

**Sync Command (sync.ts):**
- [ ] Update `tbd sync` to check worktree health before operations
- [ ] Add clear error messages when worktree is unhealthy

**Error Classes (add to `packages/tbd/src/lib/errors.ts`):**
- [ ] Add `WorktreeMissingError` class - extends `TbdError`, thrown when worktree
  doesn’t exist
- [ ] Add `WorktreeCorruptedError` class - extends `TbdError`, thrown when worktree
  exists but is invalid
- [ ] Add `SyncBranchError` class - extends `TbdError`, for sync branch issues

Example:
```typescript
// packages/tbd/src/lib/errors.ts
export class WorktreeMissingError extends TbdError {
  constructor(message: string = 'Worktree not found') {
    super(message, 'WORKTREE_MISSING');
  }
}
```

**Tests:**
- [ ] Add tests for each health check function
- [ ] Add tests for doctor detecting each issue type
- [ ] Add golden tests for doctor output with various issues

### Phase 2 Details: Path Consistency

Fix the path mismatch bugs in sync.ts.

- [ ] Update `getSyncStatus()` to check worktree status, not main branch
  - Change from: `git('status', '--porcelain', DATA_SYNC_DIR)`
  - Change to: Check files in worktree path via `resolveDataSyncDir()`
- [ ] Update `commitWorktreeChanges()` to use `this.dataSyncDir` consistently
  - Remove: `const worktreePath = join(process.cwd(), WORKTREE_DIR)`
  - Use: `this.dataSyncDir` which is already resolved via `resolveDataSyncDir()`
- [ ] Audit all sync operations for hardcoded `WORKTREE_DIR` or `DATA_SYNC_DIR` usage
  - All data paths MUST go through `resolveDataSyncDir()`
  - Only exception: worktree creation/repair in git.ts (which needs the raw paths)
- [ ] Ensure `resolveDataSyncDir()` throws `WorktreeMissingError` when worktree missing
  (non-test mode)
- [ ] Add tests verifying path consistency:
  - [ ] Test that `resolveDataSyncDir()` returns worktree path in production
  - [ ] Test that `resolveDataSyncDir()` throws when worktree missing
  - [ ] Test that `resolveDataSyncDir({ allowFallback: true })` returns direct path

### Phase 3 Details: Auto-Repair

Add automatic worktree repair capabilities.

- [ ] Add `--fix` flag to `tbd sync`
- [ ] Implement repair logic: recreate worktree if missing/prunable
- [ ] Add `--fix` flag to `tbd doctor`
- [ ] Add migration logic for data in wrong location
- [ ] Add confirmation prompt before destructive operations
- [ ] Add tests for repair scenarios

### Phase 4 Details: Prevention

Ensure this bug category cannot recur.

- [ ] Add architectural test: verify issues written to worktree path
- [ ] Add CI check: worktree health after operations
- [ ] Update init/setup to verify worktree after creation
- [ ] Add warning in resolveDataSyncDir when falling back (test mode only)
- [ ] Document worktree architecture in developer docs

### Phase 5: Documentation Updates (COMPLETED)

Update design specification to cover these corner cases.

- [x] Add worktree health states to tbd-design.md §2.3.4
- [x] Add path terminology and resolution semantics to tbd-design.md §2.3.5
- [x] Add worktree error classes specification to tbd-design.md §2.3.6
- [x] Expand doctor command specification in tbd-design.md §4.9 with detailed health
  checks
- [x] Add sync command worktree health requirement to tbd-design.md §4.7
- [x] Update sync algorithm in tbd-design.md §3.3.3 with prerequisite step
- [x] Update Decision 7 in tbd-design.md §7.1 to clarify no silent fallback
- [x] Update table of contents in tbd-design.md
- [x] Add safety backup requirement for corrupted worktrees
- [x] Add `.tbd/backups/` to .gitignore specification for local backups

**Changes made to [tbd-design.md](../../../packages/tbd/docs/tbd-design.md):**

1. **§2.3 Hidden Worktree Model** - Added three new subsections:
   - Worktree Health States (valid, missing, prunable, corrupted)
   - Path Terminology and Resolution (worktree path vs direct path invariants)
   - Worktree Error Classes (WorktreeMissingError, WorktreeCorruptedError,
     SyncBranchError)
   - **Safety note**: Corrupted worktrees must be backed up to `.tbd/backups/` before
     removal to prevent data loss

2. **§3.2.2 .tbd/.gitignore Contents** - Added `backups/` directory for local backups

3. **§3.3.3 Sync Algorithm** - Added prerequisite step 0 for worktree health
   verification and critical invariant about path consistency

4. **§4.7 Sync Commands** - Added `--fix` option, worktree health requirement code, path
   consistency invariant, and error output example

5. **§4.9 Doctor Command** - Expanded from brief checklist to comprehensive
   specification:
   - Worktree health check table
   - Sync branch health check table
   - Sync state consistency check table
   - Data location check table
   - Schema and reference checks table
   - Example output
   - Detailed `--fix` behavior with backup step for corrupted worktrees

6. **§7.1 Decision 7** - Updated to clarify “no silent fallback” policy and added
   “prunable” edge case to tradeoffs/mitigations

## Testing Strategy

### Unit Tests

- `checkWorktreeHealth()` with various worktree states
- `resolveDataSyncDir()` with and without worktree
- Error classes and messages

### Integration Tests

- Sync with missing worktree → error
- Sync with prunable worktree → error
- `tbd sync --fix` recreates worktree
- `tbd doctor` detects issues in wrong location
- `tbd doctor --fix` migrates data

### Golden Tests

- Error output for missing worktree
- Doctor output with worktree issues
- Successful repair output

### Architectural Tests

```typescript
it('never writes issues to .tbd/data-sync/ in production', async () => {
  await run('tbd init');
  await run('tbd create "Test"');

  expect(await exists('.tbd/data-sync/issues/')).toBe(false);
  expect(await exists('.tbd/data-sync-worktree/.tbd/data-sync/issues/')).toBe(true);
});
```

### End-to-End Tryscript Test

This test exercises all failure modes in a single session using multiple clones of a
local bare repo. It validates that tbd sync and doctor correctly handle each scenario.

```bash
#!/bin/bash
# tryscript: test-sync-worktree-scenarios.sh
# Tests all sync/worktree failure modes with local bare repo

set -e  # Exit on error
PASS="\033[32m✓\033[0m"
FAIL="\033[31m✗\033[0m"

echo "=== Setup: Create bare origin repo ==="
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"
git init --bare origin.git
echo "Created bare repo at $TEST_DIR/origin.git"

# ============================================================================
# Scenario 1: Fresh init and sync (happy path)
# ============================================================================
echo ""
echo "=== Scenario 1: Fresh init and sync ==="
git clone origin.git clone1
cd clone1
git commit --allow-empty -m "Initial commit"
git push origin main

# Initialize tbd
tbd setup --auto --prefix=test

# Create some issues
tbd create "Issue 1" --type=task
tbd create "Issue 2" --type=bug
tbd sync

# Verify worktree exists and issues are in correct location
if [ -d ".tbd/data-sync-worktree/.tbd/data-sync/issues" ]; then
  echo -e "$PASS Worktree created correctly"
else
  echo -e "$FAIL Worktree NOT created!"
  exit 1
fi

ISSUE_COUNT=$(ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "$ISSUE_COUNT" -eq 2 ]; then
  echo -e "$PASS Issues in correct location ($ISSUE_COUNT)"
else
  echo -e "$FAIL Issues NOT in correct location! Found $ISSUE_COUNT"
  exit 1
fi

# Verify NO issues in wrong location
WRONG_COUNT=$(ls .tbd/data-sync/issues/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "$WRONG_COUNT" -eq 0 ]; then
  echo -e "$PASS No issues in wrong location"
else
  echo -e "$FAIL Issues in wrong location! Found $WRONG_COUNT"
  exit 1
fi

cd "$TEST_DIR"

# ============================================================================
# Scenario 2: Fresh clone (User B clones after User A synced)
# ============================================================================
echo ""
echo "=== Scenario 2: Fresh clone scenario ==="
git clone origin.git clone2
cd clone2

# Before fix: tbd sync says "Already in sync" with 0 issues
# After fix: tbd sync should create worktree from remote and show 2 issues

tbd doctor
# Expected output should detect: "Worktree is missing, remote branch exists"

# After doctor --fix (or tbd sync with fix):
tbd doctor --fix 2>/dev/null || tbd sync  # Depending on implementation

CLONE2_COUNT=$(ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.yml 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLONE2_COUNT" -eq 2 ]; then
  echo -e "$PASS Fresh clone: Issues pulled from remote ($CLONE2_COUNT)"
else
  echo -e "$FAIL Fresh clone: Expected 2 issues, got $CLONE2_COUNT"
  # This will fail until Bug 6 is fixed
fi

cd "$TEST_DIR"

# ============================================================================
# Scenario 3: Worktree deleted (simulates ai-trade-arena bug)
# ============================================================================
echo ""
echo "=== Scenario 3: Worktree deleted (prunable) ==="
git clone origin.git clone3
cd clone3

# Initialize properly first
tbd setup --auto

# Create worktree from remote
git fetch origin tbd-sync
git worktree add .tbd/data-sync-worktree origin/tbd-sync

# Verify it works
tbd stats
echo "Issues before deletion: $(ls .tbd/data-sync-worktree/.tbd/data-sync/issues/*.yml | wc -l | tr -d ' ')"

# Now simulate the bug: delete the worktree directory
rm -rf .tbd/data-sync-worktree

# Verify git still knows about it (prunable state)
if git worktree list --porcelain | grep -q "prunable"; then
  echo -e "$PASS Worktree marked as prunable"
else
  echo -e "$FAIL Worktree not marked as prunable"
fi

# Create a new issue - this should go to WRONG location (before fix)
# After fix: this should error or auto-repair
tbd create "Issue 3 after worktree deleted" --type=task 2>/dev/null || true

# Check doctor detects the problem
tbd doctor

# Expected: ERROR - Worktree is prunable
# Expected: ERROR - Issues in wrong location (if any were created)

# Repair with doctor --fix
tbd doctor --fix

# Verify repaired
if [ -d ".tbd/data-sync-worktree/.tbd/data-sync/issues" ]; then
  echo -e "$PASS Worktree repaired"
else
  echo -e "$FAIL Worktree NOT repaired"
fi

cd "$TEST_DIR"

# ============================================================================
# Scenario 4: Never initialized (simulates markform bug)
# ============================================================================
echo ""
echo "=== Scenario 4: Never initialized (old tbd version) ==="
git clone origin.git clone4
cd clone4

# Simulate old tbd: create .tbd/ but no worktree
mkdir -p .tbd/data-sync/issues

# Manually create an issue file in the WRONG location
cat > .tbd/data-sync/issues/test-xxxx.yml << 'EOF'
id: test-xxxx
title: Issue created by old tbd
type: task
status: open
priority: 2
created_at: 2025-01-01T00:00:00.000Z
updated_at: 2025-01-01T00:00:00.000Z
EOF

# Doctor should detect:
# - Worktree missing
# - No local branch
# - Issues in wrong location
tbd doctor

# Repair
tbd doctor --fix

# Verify migrated
if [ -f ".tbd/data-sync-worktree/.tbd/data-sync/issues/test-xxxx.yml" ]; then
  echo -e "$PASS Issue migrated to worktree"
else
  echo -e "$FAIL Issue NOT migrated"
fi

cd "$TEST_DIR"

# ============================================================================
# Scenario 5: Never pushed (simulates lexikon-site)
# ============================================================================
echo ""
echo "=== Scenario 5: Never pushed ==="
git clone origin.git clone5
cd clone5

# Initialize and create issue
tbd setup --auto --prefix=test5

# Manually delete remote tracking (simulate never pushed)
git push origin --delete tbd-sync 2>/dev/null || true

# Create issue locally
tbd create "Local only issue" --type=task

# Doctor should warn about missing remote
tbd doctor

# Expected: WARNING - Remote branch does not exist

# Fix: just sync
tbd sync

# Verify remote now exists
if git ls-remote --heads origin tbd-sync | grep -q tbd-sync; then
  echo -e "$PASS Remote branch created by sync"
else
  echo -e "$FAIL Remote branch NOT created"
fi

cd "$TEST_DIR"

# ============================================================================
# Cleanup
# ============================================================================
echo ""
echo "=== Cleanup ==="
rm -rf "$TEST_DIR"
echo "Test directory cleaned up"

echo ""
echo "=== All scenarios tested ==="
```

**What this test validates:**

| Scenario | Bug Tested | Expected Doctor Output | Expected Fix |
| --- | --- | --- | --- |
| 1. Fresh init | Happy path | No errors | N/A |
| 2. Fresh clone | Bug 6 | "Worktree missing, remote exists" | Create from remote |
| 3. Worktree deleted | Bugs 1-5 | "Worktree prunable" | Prune + recreate |
| 4. Never initialized | Old version | "Worktree missing, issues in wrong location" | Create + migrate |
| 5. Never pushed | Missing remote | "Remote branch missing" | Push on sync |

This test should be added to CI and run after any changes to sync, paths, or worktree
code.

## Rollout Plan

1. **Immediate**: Document the bug and workaround for affected users
2. **Phase 1**: Release with detection - users see errors instead of silent failure
3. **Phase 2-3**: Release with --fix capabilities
4. **Phase 4**: Add prevention tests to CI

## Open Questions

1. Should `tbd sync` auto-repair by default, or require `--fix` flag?
   - Recommendation: Require `--fix` to make behavior explicit

2. Should we keep the direct path fallback for any scenario?
   - Recommendation: Only for tests with explicit `allowFallback: true`

3. How to handle the backup before migration?
   - Recommendation: Always backup to .tbd/backups/ before migrating, require
     confirmation

4. Should `resolveDataSyncDir` be sync or async?
   - Currently async (does fs.access), keep as-is

## References

- Postmortem:
  [retro-2026-01-16-worktree-architecture-not-implemented.md](../../retrospectives/retro-2026-01-16-worktree-architecture-not-implemented.md)
- Design spec: [tbd-design.md](../../../packages/tbd/docs/tbd-design.md) §2.3 Hidden
  Worktree Model
- Related issues: tbd-1810, tbd-208

## Appendix A: What Doctor Would Report for ai-trade-arena

With the spec implemented, `tbd doctor` would output:

```
Checking tbd health...

✗ ERROR: Worktree is prunable
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Found 951 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

✗ ERROR: Remote 'tbd-sync' has no issues - the 951 local issues were never synced
  Fix: Run `tbd doctor --fix` to repair worktree and migrate data, then `tbd sync`

3 error(s), 0 warning(s), 0 info(s)

Run `tbd doctor --fix` to auto-fix 2 issue(s)
```

After `tbd doctor --fix`:

```
Repairing tbd...

✓ Pruned stale worktree entry
✓ Created worktree at .tbd/data-sync-worktree
✓ Backed up 951 issues to .tbd/backups/tbd-data-sync-backup-20260128-HHMMSS/
✓ Migrated 951 issues to worktree
✓ Committed migration to tbd-sync branch

Run `tbd sync` to push changes to remote.
```

### What User B Would See (After Cloning Broken Repo)

If another user clones ai-trade-arena before the issues are synced, `tbd doctor` would
show:

```
Checking tbd health...

✗ ERROR: Beads migration exists with 721 issues, but tbd has none
  This repo was migrated from beads but issues were never synced to remote.
  Another user may have the issues locally but they were not pushed.
  Fix: Contact the repo owner to run `tbd sync` and push their local issues

⚠ WARNING: Config has id_prefix 'ar' but no issues exist
  This suggests issues may have been created but not synced,
  or were lost due to sync issues on another machine.
  Fix: If you expect issues to exist, contact the repo owner

1 error(s), 1 warning(s), 0 info(s)
```

This gives User B a clear explanation of why they see no issues despite evidence (beads
migration, configured id_prefix) that issues should exist.

## Appendix B: What Doctor Would Report for markform (Never Initialized)

For repos where the worktree was never created and no branches exist:

```
Checking tbd health...

✗ ERROR: Worktree is missing
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Local branch 'tbd-sync' does not exist
  Fix: Run `tbd doctor --fix` to create from remote or initialize

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

✗ ERROR: Found 8 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

3 error(s), 1 warning(s), 0 info(s)
```

After `tbd doctor --fix`:

```
Repairing tbd...

✓ Created orphan branch 'tbd-sync'
✓ Created worktree at .tbd/data-sync-worktree
✓ Backed up 8 issues to .tbd/backups/tbd-data-sync-backup-YYYYMMDD-HHMMSS/
✓ Migrated 8 issues to worktree
✓ Committed migration to tbd-sync branch

Run `tbd sync` to push changes to remote.
```

**Key difference from ai-trade-arena:** No “prune” step needed because there’s no stale
worktree entry in git.
Instead, we create the branch from scratch as an orphan.

## Appendix C: What Doctor Would Report for lexikon-site (Never Pushed)

For repos where everything local is correct but remote branch doesn’t exist:

```
Checking tbd health...

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

ℹ INFO: Local 'tbd-sync' has commits that are not on remote
  Fix: Run `tbd sync` to push changes

0 error(s), 1 warning(s), 1 info(s)
```

No `--fix` needed - just run `tbd sync` to push.

## Appendix D: What Doctor Would Report for Fresh Clone

For a freshly cloned repo where remote tbd-sync exists but no local setup:

```
Checking tbd health...

✗ ERROR: Worktree is missing
  Remote branch 'origin/tbd-sync' exists with issues.
  Fix: Run `tbd doctor --fix` to create worktree from remote

⚠ WARNING: Local branch 'tbd-sync' does not exist
  Remote branch exists - will create from remote.
  Fix: Run `tbd doctor --fix` to set up local sync

1 error(s), 1 warning(s), 0 info(s)
```

After `tbd doctor --fix`:

```
Repairing tbd...

✓ Created worktree at .tbd/data-sync-worktree from origin/tbd-sync
✓ Set up local tbd-sync branch tracking origin/tbd-sync
✓ Found 603 issues from remote

Repository is ready. Run `tbd stats` to see issue counts.
```

**Key difference from other modes:** No migration needed - issues already exist on
remote, we just need to set up local worktree.

## Appendix E: Doctor --fix Decision Tree

The `tbd doctor --fix` command follows this decision tree:

```
START
  │
  ├─► Check worktree status
  │   ├─► HEALTHY → skip to step 4
  │   ├─► CORRUPTED → (0) BACKUP to .tbd/backups/corrupted-worktree-backup-YYYYMMDD-HHMMSS/
  │   │               then remove directory
  │   ├─► PRUNABLE → (1) git worktree prune
  │   └─► MISSING → continue
  │
  ├─► Check local branch
  │   ├─► EXISTS → (2) git worktree add .tbd/data-sync-worktree tbd-sync
  │   └─► MISSING → Check remote branch
  │       ├─► EXISTS → (2a) git fetch && git worktree add ... origin/tbd-sync
  │       └─► MISSING → (2b) git worktree add --orphan tbd-sync ...
  │
  ├─► Check wrong location (.tbd/data-sync/)
  │   ├─► HAS DATA →
  │   │   ├─► (3) Backup to .tbd/backups/tbd-data-sync-backup-YYYYMMDD-HHMMSS/
  │   │   ├─► (4) Copy to .tbd/data-sync-worktree/.tbd/data-sync/
  │   │   ├─► (5) git -C worktree add -A && git commit
  │   │   └─► (6) Remove wrong location data (optional, with confirmation)
  │   └─► EMPTY → skip migration
  │
  └─► Done - remind user to run `tbd sync`
```

**IMPORTANT: Backup before removal**

Step (0) is critical for corrupted worktrees: the worktree may contain uncommitted issue
data that would be lost if simply deleted.
The backup is stored in `.tbd/backups/` which is gitignored, allowing users to manually
recover data if needed.

**Failure mode mapping:**

| Failure Mode | Steps Executed |
| --- | --- |
| Corrupted worktree | 0, 2, (3-6 if data in wrong location) |
| ai-trade-arena (prunable) | 1, 2, 3, 4, 5, 6 |
| markform (never initialized) | 2b, 3, 4, 5, 6 |
| lexikon-site (never pushed) | None (no --fix needed) |
| Fresh clone (never initialized) | 2a (create from remote) |

## Appendix F: Manual Recovery Steps for ai-trade-arena

If manual recovery is needed (or before `tbd doctor --fix` is implemented):

```bash
# 0. Verify current state
cd /Users/levy/wrk/aisw/ai-trade-arena
git worktree list --porcelain | grep -A3 data-sync-worktree
# Should show: prunable gitdir file points to non-existent location

# 1. Backup (already done)
# Data backed up to: .tbd/backups/tbd-data-sync-backup-20260128-142024/

# 2. Prune the stale worktree entry from git's tracking
git worktree prune
# This removes .git/worktrees/data-sync-worktree/ entry

# 3. Recreate the worktree from existing tbd-sync branch
git worktree add .tbd/data-sync-worktree tbd-sync
# This creates:
#   .tbd/data-sync-worktree/.git (file pointing to main repo)
#   .tbd/data-sync-worktree/.tbd/data-sync/issues/.gitkeep
#   .tbd/data-sync-worktree/.tbd/data-sync/mappings/.gitkeep
#   .tbd/data-sync-worktree/.tbd/data-sync/meta.yml

# 4. Copy issues from wrong location to correct location
cp -R .tbd/data-sync/issues/* .tbd/data-sync-worktree/.tbd/data-sync/issues/
cp -R .tbd/data-sync/mappings/* .tbd/data-sync-worktree/.tbd/data-sync/mappings/

# 5. Commit the recovery in the worktree
git -C .tbd/data-sync-worktree add -A
git -C .tbd/data-sync-worktree commit -m "tbd: recover 951 issues from incorrect location

Issues were incorrectly written to .tbd/data-sync/ on main branch
instead of .tbd/data-sync-worktree/.tbd/data-sync/ on tbd-sync branch.
This was caused by missing worktree directory."

# 6. Push to remote
git push origin tbd-sync

# 7. Verify
tbd sync --status
# Should show: Repository is in sync

tbd stats
# Should show: 951 issues

# 8. (Optional) Remove wrong-location data after confirming recovery
# rm -rf .tbd/data-sync/issues .tbd/data-sync/mappings
# Keep .tbd/data-sync/.gitkeep if it exists
```

## Appendix G: Root Cause Summary

**Why did this happen?**

1. Worktree was created on Jan 17 during `tbd init`
2. At some point, `.tbd/data-sync-worktree/` directory was deleted (cause unknown)
3. Git still tracked the worktree but marked it “prunable”
4. `resolveDataSyncDir()` checked if worktree path exists → NO → fell back to
   `.tbd/data-sync/`
5. All subsequent operations wrote to the fallback path
6. `tbd sync` tried to commit from worktree path → directory missing → nothing to commit
7. `tbd sync` compared local/remote branch commits → same → “Already in sync”
8. 951 issues accumulated in wrong location, never synced

**Why wasn’t this detected?**

1. No health check for worktree before sync operations
2. Silent fallback in `resolveDataSyncDir()` - no warning or error
3. `getSyncStatus()` checked git status on gitignored path (always empty)
4. No check for “local has data but remote is empty”
