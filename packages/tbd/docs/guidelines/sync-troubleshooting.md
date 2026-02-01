---
title: Sync and Workspace Troubleshooting
description: Common issues and solutions for tbd sync and workspace operations
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
## Common Sync Issues

### Push Fails with HTTP 403

**Symptoms:**
- `tbd sync` reports HTTP 403 error
- Local commits exist but aren’t pushed to remote

**Causes:**
- Branch restrictions (e.g., Claude Code session branch requirements)
- Push permissions not granted for tbd-sync branch

**Solutions:**
1. Save unsynced work: `tbd save --outbox`
2. Commit outbox to working branch
3. Push working branch (which typically succeeds)
4. Import later when in an environment that can push

### “Already in sync” but data not on remote

**Symptoms:**
- `tbd sync` says “Already in sync”
- Checking remote shows data is missing

**Causes:**
- Previous push silently failed
- Local branch is ahead of remote but error was missed

**Solutions:**
1. Run `tbd sync --status` to check actual state
2. Check `git log tbd-sync --oneline` vs `git log origin/tbd-sync --oneline`
3. If local is ahead, push manually: `git push origin tbd-sync`
4. If that fails, use workspace recovery workflow

### Network Timeouts

**Symptoms:**
- `tbd sync` hangs or times out
- “Connection refused” or timeout errors

**Solutions:**
1. Check network connectivity
2. Verify remote URL: `git remote -v`
3. Save work locally: `tbd save --workspace=offline-backup`
4. Retry when network is available

## Workspace Issues

### Workspace not showing in status

**Symptoms:**
- `tbd status` doesn’t show expected workspaces
- `tbd workspace list` returns empty

**Causes:**
- Workspace directory doesn’t exist
- Workspace directory is not a valid directory

**Solutions:**
1. Check directory exists: `ls .tbd/workspaces/`
2. Ensure workspace was created: `tbd save --workspace=test`
3. Verify workspace structure: `ls .tbd/workspaces/test/`

### Import conflicts

**Symptoms:**
- `tbd import` reports conflicts
- Expected data not in worktree

**Causes:**
- Same issue edited in both workspace and worktree
- Conflicting changes at field level

**Solutions:**
1. Check attic for conflict details: `ls .tbd/data-sync-worktree/.tbd/data-sync/attic/`
2. Review conflict files to understand what was lost
3. Manually merge if needed
4. Re-import with fresh workspace if appropriate

### Workspace not committed

**Symptoms:**
- Workspace data lost after checkout
- `git status` shows untracked .tbd/workspaces/

**Causes:**
- Workspace was saved but not committed to git

**Solutions:**
1. Always commit after save:
   `git add .tbd/workspaces && git commit -m "tbd: save workspace"`
2. Set up git hooks to remind about uncommitted workspaces
3. Check `git status` before switching branches

## Worktree Issues

### Worktree corrupted

**Symptoms:**
- `tbd doctor` reports worktree problems
- Commands fail with worktree errors

**Solutions:**
1. Run `tbd doctor --fix` to auto-repair
2. If that fails, manually repair:
   ```bash
   rm -rf .tbd/data-sync-worktree
   git worktree prune
   tbd doctor --fix
   ```
3. Save work to workspace before repair if needed

### Worktree shows “detached HEAD”

**Symptoms:**
- `git -C .tbd/data-sync-worktree status` shows detached HEAD
- Commits not going to tbd-sync branch

**Solutions:**
1. Run `tbd doctor --fix` to repair
2. This recreates worktree on proper branch

## Diagnostic Commands

```bash
# Check overall health
tbd doctor

# Check sync status without syncing
tbd sync --status

# List workspaces
tbd workspace list

# View worktree branch
git -C .tbd/data-sync-worktree branch

# Compare local vs remote
git log tbd-sync --oneline -5
git log origin/tbd-sync --oneline -5

# Check for unpushed commits
git log origin/tbd-sync..tbd-sync --oneline
```

## Recovery Workflow Summary

When sync fails:

```bash
# 1. Save current state
tbd save --outbox

# 2. Commit to working branch
git add .tbd/workspaces && git commit -m "tbd: save outbox"
git push

# 3. Later, import and sync
tbd import --outbox
tbd sync
```

See `tbd shortcut sync-failure-recovery` for the full workflow.
