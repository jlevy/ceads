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

- **G1**: `tbd sync` should work transparently in Claude Code environments
- **G2**: Session-specific branches should merge seamlessly with the canonical
  `tbd-sync` branch
- **G3**: No manual configuration should be required for Claude Code users
- **G4**: Standard environments should continue working unchanged
- **G5**: Multi-session workflows should not cause data loss or conflicts

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

### Approach

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

### Phase 1: Detection and Manual Override

- [ ] Add `detectClaudeCodeSession()` function to detect environment
- [ ] Add `getSyncBranch()` wrapper that handles session detection
- [ ] Add `--claude-session` flag for manual testing
- [ ] Add `--no-session` flag to bypass detection
- [ ] Add unit tests for session detection

### Phase 2: Session Branch Management

- [ ] Implement `initSessionSyncBranch()` for session start
- [ ] Add merge logic from canonical branch
- [ ] Handle worktree branch switching
- [ ] Add integration tests for session branch lifecycle

### Phase 3: Transparent Sync

- [ ] Update `tbd sync` to use `getSyncBranch()` throughout
- [ ] Ensure push targets session branch in Claude Code
- [ ] Add appropriate logging/debug output for troubleshooting
- [ ] Add e2e tests simulating Claude Code environment

### Phase 4: Documentation and Polish

- [ ] Document workaround in skill file for immediate use
- [ ] Update tbd-design.md with Claude Code support
- [ ] Add troubleshooting guide for session sync issues
- [ ] Update doctor to detect and report Claude Code environment

## Testing Strategy

### Unit Tests

- `detectClaudeCodeSession()` with various branch names
- `getSyncBranch()` in standard vs Claude Code environments
- Session ID extraction edge cases

### Integration Tests

```typescript
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

## Appendix B: Sync Flow Diagram

```
Standard Environment                    Claude Code Environment
─────────────────────                   ─────────────────────────

Branch: main                            Branch: claude/feature-szKzG
         │                                       │
         │ tbd sync                              │ tbd sync
         ▼                                       ▼
detectClaudeCodeSession()               detectClaudeCodeSession()
         │                                       │
         │ returns null                          │ returns { sessionId: 'szKzG' }
         ▼                                       ▼
getSyncBranch()                         getSyncBranch()
         │                                       │
         │ returns 'tbd-sync'                    │ returns 'claude/tbd-sync-szKzG'
         ▼                                       ▼
ensureWorktree('tbd-sync')              initSessionSyncBranch('szKzG')
         │                                       │
         │                                       │ merge from origin/tbd-sync
         │                                       ▼
         │                              ensureWorktree('claude/tbd-sync-szKzG')
         ▼                                       ▼
commit changes to worktree              commit changes to worktree
         │                                       │
         ▼                                       ▼
git push origin tbd-sync                git push origin claude/tbd-sync-szKzG
         │                                       │
         │ SUCCESS                               │ SUCCESS (403 avoided)
         ▼                                       ▼
"Repository is in sync"                 "Repository is in sync"
```

## Appendix C: Issue tbd-knfu Summary

The feature bead tbd-knfu documents this problem and was created during the debugging
session. Key findings:

1. Claude Code enforces `claude/[name]-[SESSION_ID]` branch pattern
2. HTTP 403 occurs when pushing to non-session branches
3. Manual workaround works but is tedious
4. Auto-detection is feasible via branch name parsing
5. Session branches should merge from canonical to maintain continuity
