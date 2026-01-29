# Feature: Claude Code Session-Specific Sync Branch Support

**Date:** 2026-01-29

**Author:** Claude (with Joshua Levy)

**Status:** Draft

## Overview

When tbd runs inside Claude Code (Anthropic’s AI coding environment), the standard
`tbd-sync` branch cannot be pushed to the remote due to security restrictions.
Claude Code enforces session-specific branch naming to isolate changes by session.
This spec proposes automatic detection of Claude Code environments and dynamic
session-specific sync branch management.

## Goals

- **G1**: **No data loss** - Issue data must never be lost, even when sync fails
- **G2**: `tbd sync` should work transparently in Claude Code environments
- **G3**: Session-specific branches should merge seamlessly with the canonical
  `tbd-sync` branch
- **G4**: No manual configuration should be required for Claude Code users
- **G5**: Standard environments should continue working unchanged
- **G6**: Multi-session workflows should not cause data loss or conflicts

## Non-Goals

- Changing the fundamental sync architecture (worktree model remains)
- Supporting arbitrary branch naming schemes beyond Claude Code’s requirements
- Automatic merging across sessions (explicit merge on session start is acceptable)

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

### Recommended Approach: Local Outbox with Session Branch Fallback

The design uses a **two-tier strategy** to guarantee no data loss:

1. **Local Outbox (Primary Safety)**: A `.tbd/outbox/` directory that stores issue data
   locally when remote sync fails.
   This ensures data is never lost regardless of push restrictions.

2. **Session-Specific Branches (Secondary)**: Auto-detect Claude Code environment and
   use session-specific sync branches that can be pushed.

### Why Outbox First?

Session branches solve the “can’t push to tbd-sync” problem, but don’t help if:
- Network is down
- All remote pushes fail for any reason
- Git remote is misconfigured

The outbox guarantees local persistence regardless of remote state, then syncs when
conditions allow.

### Architecture

```
.tbd/
├── data-sync-worktree/     # Existing: worktree on tbd-sync (or session branch)
├── outbox/                 # NEW: local-only staging area (gitignored)
│   ├── issues/             # Issue files pending sync
│   └── mappings/           # Mapping files pending sync
├── config.yml
└── .gitignore              # outbox/ added here
```

### Outbox Behavior

| Scenario | Write Behavior | Sync Behavior |
| --- | --- | --- |
| Normal (push works) | Write to worktree | Commit + push, outbox stays empty |
| Push fails (403, network) | Move uncommitted to outbox | Data preserved locally |
| Next sync (push works) | N/A | Merge outbox → worktree → push → clear outbox |
| Worktree unavailable | Write directly to outbox | Wait for worktree repair |

### Conflict Resolution

**Key insight**: Outbox → worktree merge uses the **same conflict resolution logic** as
remote → worktree merge.
The existing tbd sync conflict handling (timestamp-based YAML merging) applies directly:

- Same issue modified in outbox AND remote → use existing merge logic
- Field-level conflict resolution for YAML issue files
- Last-write-wins as fallback (same as current remote sync)

No new conflict handling code needed.

### Sync Flow with Outbox

```
tbd sync:
  1. Check if outbox has pending data
     └── If yes: merge outbox → worktree (using existing conflict resolution)
                 commit merged changes

  2. Try push to remote (session branch if Claude Code, else tbd-sync)
     ├── Success: clear outbox, report "synced"
     └── Failure: move any uncommitted worktree changes to outbox
                  report "X issues saved to local outbox, will retry"
```

### Outbox Implementation

```typescript
const OUTBOX_DIR = '.tbd/outbox';

/**
 * Merge pending outbox data into worktree.
 * Uses existing conflict resolution from sync.
 */
async function mergeOutboxToWorktree(
  tbdRoot: string,
  dataSyncDir: string
): Promise<{ merged: number; conflicts: string[] }> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);

  if (!await hasOutboxData(outboxDir)) {
    return { merged: 0, conflicts: [] };
  }

  const outboxIssues = await listIssues(join(outboxDir, 'issues'));
  const conflicts: string[] = [];
  let merged = 0;

  for (const issue of outboxIssues) {
    const existingPath = join(dataSyncDir, 'issues', `${issue.id}.yml`);
    const existing = await readIssue(existingPath).catch(() => null);

    if (existing) {
      // Use existing conflict resolution logic
      const resolved = await mergeIssues(existing, issue);
      if (resolved.hadConflict) {
        conflicts.push(issue.id);
      }
      await writeIssue(dataSyncDir, resolved.issue);
    } else {
      // No conflict - just copy
      await writeIssue(dataSyncDir, issue);
    }
    merged++;
  }

  return { merged, conflicts };
}

/**
 * Move uncommitted worktree changes to outbox for later retry.
 */
async function moveToOutbox(
  tbdRoot: string,
  dataSyncDir: string
): Promise<number> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  await ensureDir(join(outboxDir, 'issues'));
  await ensureDir(join(outboxDir, 'mappings'));

  // Get uncommitted issue files from worktree
  const uncommitted = await getUncommittedIssues(dataSyncDir);

  for (const issue of uncommitted) {
    // Copy to outbox
    await writeIssue(join(outboxDir, 'issues'), issue);
    // Revert in worktree (will be re-applied on next successful sync)
    await git('-C', dataSyncDir, 'checkout', '--', `issues/${issue.id}.yml`);
  }

  return uncommitted.length;
}

/**
 * Clear outbox after successful sync.
 */
async function clearOutbox(tbdRoot: string): Promise<void> {
  const outboxDir = join(tbdRoot, OUTBOX_DIR);
  await rm(join(outboxDir, 'issues'), { recursive: true, force: true });
  await rm(join(outboxDir, 'mappings'), { recursive: true, force: true });
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

### Phase 1: Local Outbox (Primary Safety Net)

Implement the outbox to guarantee no data loss regardless of push failures.

- [ ] Add `outbox/` to `.tbd/.gitignore`
- [ ] Implement `hasOutboxData()` - check if outbox has pending issues
- [ ] Implement `mergeOutboxToWorktree()` - merge pending data using existing conflict
  resolution
- [ ] Implement `moveToOutbox()` - save uncommitted changes when push fails
- [ ] Implement `clearOutbox()` - clear after successful sync
- [ ] Update `tbd sync` to check/merge outbox at start
- [ ] Update `tbd sync` to move to outbox on push failure
- [ ] Add `tbd sync --status` output for outbox count
- [ ] Add unit tests for outbox operations
- [ ] Add integration test: push fails → data in outbox → next sync merges

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
- [ ] Update tbd-design.md with outbox and Claude Code support
- [ ] Add architecture diagram to developer docs

## Testing Strategy

### Unit Tests

**Outbox:**
- `hasOutboxData()` - empty vs populated outbox
- `mergeOutboxToWorktree()` - no conflicts, with conflicts, empty outbox
- `moveToOutbox()` - uncommitted files moved correctly
- `clearOutbox()` - clears all files

**Session Detection:**
- `detectClaudeCodeSession()` with various branch names
- `getSyncBranch()` in standard vs Claude Code environments
- Session ID extraction edge cases

### Integration Tests

```typescript
describe('Outbox fallback', () => {
  it('saves to outbox when push fails', async () => {
    // Create issue
    await tbd('create', 'Test issue');

    // Mock push to fail
    mockPushFailure(403);

    // Sync should succeed but report outbox
    const result = await tbd('sync');
    expect(result.stdout).toContain('saved to local outbox');

    // Verify outbox has the issue
    expect(await hasOutboxData(tbdRoot)).toBe(true);
  });

  it('merges outbox on next successful sync', async () => {
    // Setup: issue in outbox from failed push
    await setupOutboxWithIssue('test-1234');

    // Now push succeeds
    mockPushSuccess();

    // Sync should merge outbox and clear it
    const result = await tbd('sync');
    expect(result.stdout).toContain('merged 1 issue from outbox');

    // Outbox should be empty
    expect(await hasOutboxData(tbdRoot)).toBe(false);
  });

  it('handles conflict between outbox and remote', async () => {
    // Setup: same issue modified in outbox AND remote
    await setupOutboxWithIssue('test-1234', { title: 'Local title' });
    await setupRemoteWithIssue('test-1234', { title: 'Remote title' });

    // Sync should use existing conflict resolution
    const result = await tbd('sync');
    expect(result.stdout).toContain('resolved 1 conflict');
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

**Outbox:**
- [ ] Push fails → data saved to outbox
- [ ] Next successful sync → outbox merged and cleared
- [ ] `tbd sync --status` shows outbox count
- [ ] Conflict between outbox and remote → resolved correctly

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

## Appendix B: Combined Sync Flow Diagram

```
                            tbd sync
                                │
                                ▼
                    ┌───────────────────────┐
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
        │ worktree (using       │           │
        │ existing conflict     │           │
        │ resolution)           │           │
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
                    │ Commit worktree       │
                    │ changes               │
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
        ┌───────────────────┐   ┌───────────────────────┐
        │ Clear outbox      │   │ Move uncommitted      │
        │ "Synced"          │   │ to outbox             │
        └───────────────────┘   │ "X issues in outbox"  │
                                └───────────────────────┘
```

### Key Points

1. **Outbox checked first** - Pending data from previous failed syncs gets merged
2. **Session detection second** - Determines target branch
3. **Push attempt** - Uses session branch if Claude Code, else canonical
4. **Failure handling** - Data preserved in outbox, never lost

## Appendix C: Issue tbd-knfu Summary

The feature bead tbd-knfu documents this problem and was created during the debugging
session. Key findings:

1. Claude Code enforces `claude/[name]-[SESSION_ID]` branch pattern
2. HTTP 403 occurs when pushing to non-session branches
3. Manual workaround works but is tedious
4. Auto-detection is feasible via branch name parsing
5. Session branches should merge from canonical to maintain continuity
