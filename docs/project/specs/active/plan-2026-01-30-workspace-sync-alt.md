# Feature: Workspace Sync for Resilient Issue Syncing (Alternative Design)

**Date:** 2026-01-30

**Author:** Claude (with Joshua Levy)

**Status:** Draft (Alternative to outbox design)

## Overview

This spec addresses sync resilience: when `tbd sync` cannot push to the remote (network
errors, permission issues, Claude Code branch restrictions, etc.), issue data should be
preserved locally and recoverable when conditions allow.

This alternative design uses **explicit workspaces** instead of automatic write-through.
Users (or agents) explicitly save data to named workspaces when needed, rather than
having every write automatically mirrored.
This provides more flexibility and user control at the cost of requiring explicit
action.

## Goals

- **G1**: **No data loss** - Issue data can be preserved even when sync fails (via
  explicit save)
- **G2**: **User control** - User decides when and where to save, not automatic
- **G3**: **Flexible destinations** - Save to named workspaces OR arbitrary directories
- **G4**: **Bidirectional sync** - Workspaces can be merged back to worktree using
  standard merge logic
- **G5**: **Backup-friendly** - Easy to create full or incremental backups
- **G6**: Standard environments should continue working unchanged

## Non-Goals

- Automatic write-through (that’s the outbox model)
- Changing the fundamental sync architecture (worktree model remains)
- Special handling for specific environments (workspaces handle all scenarios)

## Use Cases

The workspace model supports several distinct workflows beyond sync failure recovery:

### Use Case 1: Sync Failure Recovery (Primary)

When `tbd sync` fails to push (e.g., in Claude Code with branch restrictions):

```bash
# Sync fails with HTTP 403
tbd sync
# ⚠️  Sync failed: HTTP 403 - push to 'tbd-sync' forbidden

# Save unsynced changes to outbox
tbd save --outbox

# Commit and push your working branch (which succeeds)
git add .tbd/workspaces/outbox && git commit -m "tbd: save outbox"
git push

# Later, in a new session where sync works:
tbd import --outbox    # Imports and clears outbox
tbd sync               # Pushes to remote
```

**Multiple agents/sessions**: Multiple clients can all save to the same outbox.
Since `tbd save` uses merge logic, concurrent saves work correctly:
- Different issues: No conflicts, all preserved
- Same issue edited compatibly: Merged automatically
- Same issue edited incompatibly: Conflict goes to attic (which is useful - you’d want
  to know if multiple agents are making incompatible edits to the same issue)

### Use Case 2: Bulk Editing Issues

Export issues to a temp directory, make systematic edits (via scripts or manually), then
import the changes back:

```bash
# Export all issues to a temp directory
tbd save --dir=/tmp/bulk-edit

# Make systematic edits (e.g., change all priorities, update labels, etc.)
# Could be manual edits or via sed/awk/scripts:
cd /tmp/bulk-edit/issues
sed -i 's/priority: P3/priority: P2/g' *.md

# Import the edited issues back
tbd import --dir=/tmp/bulk-edit

# Sync to remote
tbd sync
```

This is useful for:
- Bulk priority changes across many issues
- Adding/removing labels systematically
- Fixing typos in issue templates
- Migrating issue formats

### Use Case 3: Point-in-Time Backups

Create named snapshots of all issues at a particular point in time:

```bash
# Create a backup before major refactoring
tbd save --workspace=pre-refactor-2026-01

# ... work happens, issues change ...

# Later, if needed, see what changed
diff -r .tbd/workspaces/pre-refactor-2026-01/issues .tbd/data-sync-worktree/.tbd/data-sync/issues

# Or restore the backup
tbd import --workspace=pre-refactor-2026-01
```

### Use Case 4: Cross-Repository Issue Transfer

Transfer issues between repositories or share them externally:

```bash
# In source repo: export issues
tbd save --dir=/tmp/shared-issues

# Copy to another machine or share via any mechanism
scp -r /tmp/shared-issues user@other:/tmp/

# In destination repo: import issues
tbd import --dir=/tmp/shared-issues
tbd sync
```

### Use Case 5: Offline Work with Manual Sync

Work offline and manually manage syncing:

```bash
# Before going offline, save current state
tbd save --workspace=offline-snapshot

# Work offline, creating/updating issues normally
tbd create "New feature idea"
tbd update tbd-a1b2 --status in_progress

# When back online, issues are in the worktree
# No import needed since you worked in the worktree directly
tbd sync
```

### Use Case 6: Issue Review/Audit

Export issues for review or audit purposes:

```bash
# Export all issues to a readable format
tbd save --dir=/tmp/audit-2026-01

# Review issues, generate reports, etc.
ls /tmp/audit-2026-01/issues/*.md | wc -l  # Count issues
grep -l "status: open" /tmp/audit-2026-01/issues/*.md  # Find open issues
```

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

### Current Impact (Before This Feature)

1. `tbd sync` fails with an error (HTTP 403, network error, etc.)
2. Issues are committed to the local `tbd-sync` worktree but never reach the remote
3. If the user does a fresh checkout, those issues are lost
4. No recovery mechanism exists

## Design

### Recommended Approach: Explicit Workspaces

Instead of automatic write-through to an outbox, users explicitly save their work to
**named workspaces** when needed.
This is more flexible and gives users full control.

### Architecture

```
.tbd/
├── data-sync-worktree/     # Existing: worktree on tbd-sync branch
├── workspaces/             # NEW: Named workspace directories (NOT gitignored)
│   ├── outbox/             # Special workspace for sync failure recovery
│   │   ├── issues/
│   │   ├── mappings/
│   │   │   └── ids.yml
│   │   └── attic/          # Conflicts during save to this workspace
│   ├── my-feature/         # User-created workspace
│   │   ├── issues/
│   │   ├── mappings/
│   │   │   └── ids.yml
│   │   └── attic/
│   └── backup-2026-01/     # Another user-created workspace
│       ├── issues/
│       ├── mappings/
│       │   └── ids.yml
│       └── attic/
├── config.yml
└── state.yml
```

**Key design choice**: Workspaces are on the user’s current branch (not gitignored), so
they survive across clones and checkouts when committed.

### Commands

#### `tbd save` - Save worktree to workspace

Saves data from the worktree to a workspace (or arbitrary directory).

```bash
# Save ALL issues to a named workspace
tbd save --workspace=my-feature

# Save ALL issues to an arbitrary directory
tbd save --dir=/tmp/my-backup

# Save only UPDATED (unsynced) issues to workspace
tbd save --workspace=my-feature --updates-only

# Convenience shortcut for sync failure recovery
tbd save --outbox
# Equivalent to: tbd save --workspace=outbox --updates-only
```

**Behavior:**
- By default, saves ALL issues from worktree to workspace
- With `--updates-only`, saves only issues that have been modified since last sync
- Uses bidirectional merge: if workspace has data, merge both directions
- Conflicts go to attic IN THE WORKSPACE (not data-sync-worktree)
- Does NOT auto-commit workspace changes

**One of `--workspace`, `--dir`, or `--outbox` is required.**

#### `tbd import` - Import from workspace to worktree

Imports data from a workspace (or arbitrary directory) into the worktree.

```bash
# Import from named workspace
tbd import --workspace=my-feature

# Import from arbitrary directory
tbd import --dir=/tmp/my-backup

# Import and clear workspace on success
tbd import --workspace=my-feature --clear-on-success

# Convenience shortcut for outbox recovery
tbd import --outbox
# Equivalent to: tbd import --workspace=outbox --clear-on-success
```

**Behavior:**
- Merges workspace data into worktree using standard merge logic
- Conflicts go to attic (in worktree, as usual)
- Commits merged changes to worktree
- With `--clear-on-success`: deletes the source workspace ONLY after successful import
- Without `--clear-on-success`: preserves the source workspace

**One of `--workspace`, `--dir`, or `--outbox` is required.**

#### `tbd workspace list` - List workspaces

```bash
tbd workspace list
```

Shows all workspaces in `.tbd/workspaces/` with issue counts by status.
Output format should be consistent with `tbd stats` styling:

```
WORKSPACE           open  in_progress  closed   total
outbox                 2            0       0       2
my-feature             5            1       3       9
backup-2026-01         0            0      12      12
```

This gives visibility into what each workspace contains at a glance.

#### `tbd workspace delete` - Delete a workspace

```bash
tbd workspace delete my-feature
```

Removes the workspace directory.

### The `--outbox` Shortcut

The `--outbox` flag is a convenience for the common “sync failed, save my work”
scenario:

**For saving:**
```bash
tbd save --outbox
# Equivalent to: tbd save --workspace=outbox --updates-only
```

**For importing:**
```bash
tbd import --outbox
# Equivalent to: tbd import --workspace=outbox --clear-on-success
```

The `outbox` workspace is just a regular workspace with a special name.
There’s nothing magical about it - it’s simply the conventional place to save unsynced
changes. The `--clear-on-success` behavior for import makes sense for the outbox because
once you’ve successfully imported and can sync, you don’t need the backup anymore.

### Workspace Structure

Workspaces mirror the `data-sync` directory structure exactly:

```
.tbd/workspaces/my-feature/       # Mirrors .tbd/data-sync-worktree/.tbd/data-sync/
├── issues/
│   ├── {ulid1}.md                # Same filename format as worktree
│   └── {ulid2}.md
├── mappings/
│   └── ids.yml                   # Same YAML format
└── attic/                        # Conflicts during workspace operations
    └── {timestamp}_{ulid}.md
```

This identical structure means:
- No format conversion needed
- Existing issue parsing code works on workspace files
- Standard file comparison works

### ID Mapping Behavior

**IMPORTANT**: When saving to a workspace with `--updates-only` or `--outbox`:

- **Mappings are filtered**: Only ID mappings for issues that are actually saved to the
  workspace are included.
  This prevents bloating the workspace with mappings for issues that weren’t exported.
- **Rationale**: The workspace should be self-contained with only the data it needs.
  If the user exports 2 issues out of 100, the mappings file should only contain 2
  entries, not 100.

When saving without `--updates-only` (full export), all mappings are copied since all
issues are being saved.

### Output Messages

**When no updates exist** (`--updates-only` or `--outbox` with nothing to save):
- Print an informational message: “No issues to save (0 of N issues have updates)”
- This is NOT an error - exit code is 0
- The workspace directory structure is still created (empty issues/, mappings/, attic/)
- This allows the user to see that the save operation ran correctly but found nothing

**When updates exist**:
- Print: “Saved M issue(s) to {target} (M of N total filtered)”
- This helps the user understand how many issues were filtered vs the total

### Sync Flow with Workspaces

The workspace feature does NOT change the normal `tbd sync` flow.
It’s a separate set of commands for explicit save/restore operations.

```
Normal tbd sync (unchanged):

  1. Fetch remote tbd-sync
  2. Merge remote → worktree
  3. Commit local changes
  4. Push to remote
     ├── SUCCESS: Done
     └── FAILURE: Print error with instructions to use `tbd save --outbox`
```

When push fails, the user/agent explicitly runs `tbd save --outbox` to preserve their
work. This is a conscious decision, not automatic.

### `tbd save` Flow

```
tbd save --workspace=my-feature [--updates-only]:

  1. Ensure workspace directory exists
     └── Create .tbd/workspaces/my-feature/ if needed

  2. Determine what to save
     ├── --updates-only: Find issues modified since last successful sync
     └── default (--all): All issues in worktree

  3. For each issue to save:
     a. Check if issue exists in workspace
     b. If exists: Merge using standard algorithm
        - Base: none (or previous common version if tracked)
        - Ours: workspace version
        - Theirs: worktree version
        - Conflicts → workspace attic
     c. If not exists: Copy issue to workspace

  4. Merge ID mappings (union operation)

  5. Report what was saved
```

### `tbd import` Flow

```
tbd import --workspace=my-feature:

  1. Check workspace exists
     └── Error if not found

  2. For each issue in workspace:
     a. Check if issue exists in worktree
     b. If exists: Merge using standard algorithm
        - Conflicts → worktree attic (as usual)
     c. If not exists: Copy issue to worktree

  3. Merge ID mappings (union operation)

  4. Commit merged changes to worktree

  5. Report what was imported
```

### Push Failure Warning

When push fails, `tbd sync` prints a brief warning:

```
⚠️  Sync failed: {ERROR_DETAILS}

Options:
  1. Fix the issue and retry: tbd sync
  2. Save changes locally:    tbd save --outbox

Run `tbd save --help` for recovery workflow details.
```

### Agent Behavior on Sync Failure

When an AI agent encounters a sync push failure:

1. Run `tbd save --outbox` to save unsynced changes
2. Commit the outbox to the working branch
3. Push the working branch (which typically succeeds)
4. Data survives across checkouts and branch merges
5. Later, `tbd import --outbox` recovers the data and clears the outbox
6. Run `tbd sync` to push to remote

### Configuration

The workspace feature is always available with no configuration needed.
Workspaces are purely filesystem-based (stored in `.tbd/workspaces/`).

## Comparison: Workspace vs Outbox Model

| Aspect | Outbox (Original) | Workspace (This Design) |
| --- | --- | --- |
| **When data is saved** | Automatic (write-through on every operation) | Explicit (`tbd save` command) |
| **User action required** | None for saving; commit warning on failure | Must run `tbd save` on failure |
| **Flexibility** | Single outbox location | Multiple named workspaces + arbitrary dirs |
| **Backup use cases** | Not designed for backups | Natural backup support (`--all`) |
| **Complexity** | More complex (write-through logic, snapshot-based clear) | Simpler (explicit operations) |
| **Data safety** | Automatic but may be uncommitted | Explicit - user chooses when to save |
| **Sync overhead** | Every write duplicated | No overhead until save is called |
| **Agent workflow** | Agents commit outbox after failure | Agents run save + commit after failure |
| **Recovery** | Automatic on next sync | Explicit `tbd import` |

### Advantages of Workspace Model

1. **Simpler implementation** - No write-through logic, no snapshot-based clearing
2. **More flexible** - Multiple workspaces, arbitrary directories, full vs incremental
3. **Clear user control** - User decides what to save and when
4. **Better for backups** - Easy to create named backups of entire issue set
5. **No sync overhead** - Normal operations don’t duplicate writes
6. **Composable** - `save` and `import` are independent, reusable operations

### Advantages of Outbox Model

1. **Automatic safety** - Data preserved without user action
2. **No forgotten saves** - Can’t forget to save (it’s automatic)
3. **Transparent** - Users don’t need to know about outbox
4. **Simpler agent workflow** - Just commit on failure, no extra save step

### Recommendation

The workspace model is recommended if:
- Users/agents can be trained to run `tbd save --outbox` on failures
- Flexibility (multiple workspaces, backups) is valuable
- Simpler implementation is preferred

The outbox model is recommended if:
- Automatic safety is critical (users might forget to save)
- Agents should require minimal special handling
- The extra implementation complexity is acceptable

## Implementation Plan

### Phase 1: Core Workspace Commands

**Directory Structure:**
- [x] Add `.tbd/workspaces/` to standard tbd structure
- [x] Workspace not gitignored (committed to user’s branch)

**`tbd save` Command:**
- [x] Parse `--workspace=<name>`, `--dir=<path>`, `--outbox` flags
- [x] Implement `--updates-only` (compare with remote tbd-sync) - tbd-lka2 DONE
- [x] Use `mergeIssues()` for proper three-way merge - tbd-hg05 DONE
- [x] Copy ID mappings to workspace - tbd-eglf DONE
- [ ] **BUG FIX**: Only copy mappings for issues being saved (not all mappings) -
  tbd-vq9f
- [x] Conflicts go to workspace attic
- [x] Report what was saved
- [ ] Print informational message when no updates (not an error) - tbd-ffmg
- [ ] Golden session tests for --outbox scenarios - tbd-da94

**`tbd import` Command:**
- [x] Parse `--workspace=<name>`, `--dir=<path>`, `--outbox` flags
- [x] Implement `--clear-on-success` flag (deletes source after successful import)
- [x] `--outbox` is shortcut for `--workspace=outbox --clear-on-success`
- [x] Use `mergeIssues()` for proper three-way merge - tbd-hg05 DONE
- [x] Merge ID mappings from workspace (union) - tbd-eglf DONE
- [x] Do NOT auto-commit (by design - user reviews first)
- [x] Print message suggesting `tbd sync` after import
- [x] Report what was imported

**`tbd workspace` Subcommands:**
- [x] `tbd workspace list` - list workspaces with counts
- [x] `tbd workspace delete <name>` - remove workspace

### Phase 2: Integration

**Sync Integration:**
- [x] Update `tbd sync` failure message to suggest `tbd save --outbox` - tbd-35u6 DONE
- [x] Add `--status` output for workspace counts - tbd-at1r DONE

**Agent Guidelines:**
- [x] Document agent workflow for sync failures - tbd-t2om DONE (sync-failure-recovery
  shortcut)
- [x] Update tbd workflow documentation (sync-troubleshooting guideline)

### Phase 3: Documentation

- [x] Update tbd-design.md with workspace support - tbd-nku6 DONE
- [ ] Add architecture diagram (future)
- [x] Add troubleshooting guide - tbd-cmz1 DONE (sync-troubleshooting guideline)

## Testing Strategy

### Unit Tests

**Save Operations:**
- `saveToWorkspace()` - creates workspace, copies issues
- `saveToWorkspace()` with `--updates-only` - only unsynced issues
- `saveToWorkspace()` with `--updates-only` - only includes mappings for saved issues
  (not all)
- `saveToWorkspace()` with `--updates-only` when no updates - prints info message,
  creates empty workspace
- `saveToWorkspace()` with existing workspace - merges correctly
- Conflicts go to workspace attic

**Import Operations:**
- `importFromWorkspace()` - merges to worktree
- `importFromWorkspace()` with conflicts - uses attic
- `importFromWorkspace()` commits to worktree

**Workspace Management:**
- `listWorkspaces()` - returns workspace names and counts
- `deleteWorkspace()` - removes directory

### Integration Tests

```typescript
describe('Workspace save', () => {
  it('saves all issues to workspace by default', async () => {
    // Setup: 5 issues in worktree
    await createIssues(5);

    // Save to workspace
    await tbd('save', '--workspace=my-backup');

    // Workspace should have all 5 issues
    const wsIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/my-backup/issues'));
    expect(wsIssues.length).toBe(5);
  });

  it('saves only updated issues with --updates-only', async () => {
    // Setup: 5 synced issues, then modify 2
    await createAndSyncIssues(5);
    await updateIssue('issue-1');
    await updateIssue('issue-2');

    // Save with --updates-only
    await tbd('save', '--workspace=my-changes', '--updates-only');

    // Workspace should have only 2 issues
    const wsIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/my-changes/issues'));
    expect(wsIssues.length).toBe(2);
  });

  it('--outbox is shortcut for --workspace=outbox --updates-only', async () => {
    // Setup: synced issues, then create new one
    await createAndSyncIssues(3);
    await tbd('create', 'New issue');

    // Save with --outbox
    await tbd('save', '--outbox');

    // Outbox should have only the new issue
    const outboxIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/outbox/issues'));
    expect(outboxIssues.length).toBe(1);
  });

  it('--updates-only only includes mappings for saved issues', async () => {
    // Setup: 5 synced issues (all have mappings), then modify 1
    await createAndSyncIssues(5);
    await updateIssue('issue-1');

    // Save with --updates-only
    await tbd('save', '--workspace=my-changes', '--updates-only');

    // Workspace should have only 1 issue
    const wsIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/my-changes/issues'));
    expect(wsIssues.length).toBe(1);

    // Workspace mappings should only contain the 1 saved issue's mapping
    const wsMappings = await loadIdMapping(join(tbdRoot, '.tbd/workspaces/my-changes'));
    expect(wsMappings.shortToUlid.size).toBe(1);
  });

  it('--outbox with no updates prints info message and creates empty workspace', async () => {
    // Setup: synced issues, no local changes
    await createAndSyncIssues(3);

    // Save with --outbox
    const result = await tbd('save', '--outbox');

    // Should print informational message (not error)
    expect(result.stdout).toContain('No issues to save');
    expect(result.exitCode).toBe(0);

    // Workspace should have 0 issues and 0 mappings
    const outboxIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/outbox/issues'));
    expect(outboxIssues.length).toBe(0);

    const outboxMappings = await loadIdMapping(join(tbdRoot, '.tbd/workspaces/outbox'));
    expect(outboxMappings.shortToUlid.size).toBe(0);
  });

  it('merges with existing workspace data', async () => {
    // Setup: workspace has issue A, worktree has issue A (modified) + B
    await setupWorkspaceWithIssue('my-ws', 'issue-a', { title: 'Old title' });
    await createIssue('issue-a', { title: 'New title' });
    await createIssue('issue-b');

    // Save to workspace
    await tbd('save', '--workspace=my-ws');

    // Workspace should have both issues, A should be merged
    const wsIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/my-ws/issues'));
    expect(wsIssues.length).toBe(2);
  });

  it('conflicts go to workspace attic', async () => {
    // Setup: conflicting changes
    await setupWorkspaceWithIssue('my-ws', 'issue-a', {
      title: 'WS title',
      description: 'WS desc'
    });
    await createIssue('issue-a', {
      title: 'WT title',
      description: 'WT desc'
    });

    // Save to workspace
    await tbd('save', '--workspace=my-ws');

    // Attic should have conflict backup
    const atticFiles = await glob('.tbd/workspaces/my-ws/attic/**');
    expect(atticFiles.length).toBeGreaterThan(0);
  });
});

describe('Workspace import', () => {
  it('imports workspace data to worktree', async () => {
    // Setup: workspace has issues, worktree is empty
    await setupWorkspaceWithIssues('my-ws', 3);

    // Import
    await tbd('import', '--workspace=my-ws');

    // Worktree should have the issues
    const wtIssues = await listWorktreeIssues();
    expect(wtIssues.length).toBe(3);
  });

  it('commits imported changes to worktree', async () => {
    // Setup: workspace has new issue
    await setupWorkspaceWithIssue('my-ws', 'new-issue');

    // Import
    await tbd('import', '--workspace=my-ws');

    // Worktree should have uncommitted changes -> NO, should be committed
    const status = await gitStatus(worktreePath);
    expect(status).toContain('nothing to commit');
  });

  it('merges with existing worktree data', async () => {
    // Setup: workspace has issue A, worktree has issue A (different) + B
    await setupWorkspaceWithIssue('my-ws', 'issue-a', { title: 'WS title' });
    await createWorktreeIssue('issue-a', { title: 'WT title' });
    await createWorktreeIssue('issue-b');

    // Import
    await tbd('import', '--workspace=my-ws');

    // Both issues should exist, A should be merged
    const wtIssues = await listWorktreeIssues();
    expect(wtIssues.length).toBe(2);
  });

  it('--clear-on-success deletes workspace after import', async () => {
    // Setup: workspace with data
    await setupWorkspaceWithIssues('my-ws', 2);
    expect(await workspaceExists(tbdRoot, 'my-ws')).toBe(true);

    // Import with clear flag
    await tbd('import', '--workspace=my-ws', '--clear-on-success');

    // Workspace should be deleted
    expect(await workspaceExists(tbdRoot, 'my-ws')).toBe(false);

    // But data should be in worktree
    const wtIssues = await listWorktreeIssues();
    expect(wtIssues.length).toBe(2);
  });

  it('--outbox is shortcut for --workspace=outbox --clear-on-success', async () => {
    // Setup: outbox with data
    await tbd('save', '--outbox');
    expect(await workspaceExists(tbdRoot, 'outbox')).toBe(true);

    // Import with --outbox
    await tbd('import', '--outbox');

    // Outbox should be deleted
    expect(await workspaceExists(tbdRoot, 'outbox')).toBe(false);
  });
});

describe('Bulk edit workflow', () => {
  it('export, edit externally, re-import', async () => {
    // Setup: create issues with P3 priority
    await tbd('create', 'Issue 1', '--priority=P3');
    await tbd('create', 'Issue 2', '--priority=P3');
    await tbd('sync');

    // Export to temp directory
    await tbd('save', '--dir=/tmp/bulk-edit');

    // Simulate external edit: change P3 to P2 in all files
    const issueFiles = await glob('/tmp/bulk-edit/issues/*.md');
    for (const file of issueFiles) {
      const content = await readFile(file, 'utf8');
      const updated = content.replace(/priority: P3/g, 'priority: P2');
      await writeFile(file, updated);
    }

    // Import the edited files
    await tbd('import', '--dir=/tmp/bulk-edit');

    // Verify priorities changed
    const issues = await listWorktreeIssues();
    for (const issue of issues) {
      expect(issue.priority).toBe('P2');
    }
  });
});

describe('Multi-agent outbox saves', () => {
  it('multiple saves to outbox merge correctly', async () => {
    // Agent 1 creates issue A, saves to outbox
    await tbd('create', 'Issue A from Agent 1');
    await tbd('save', '--outbox');

    // Agent 2 creates issue B, saves to same outbox
    await tbd('create', 'Issue B from Agent 2');
    await tbd('save', '--outbox');

    // Outbox should have both issues
    const outboxIssues = await listIssues(join(tbdRoot, '.tbd/workspaces/outbox/issues'));
    expect(outboxIssues.length).toBe(2);
    expect(outboxIssues.some(i => i.title === 'Issue A from Agent 1')).toBe(true);
    expect(outboxIssues.some(i => i.title === 'Issue B from Agent 2')).toBe(true);
  });

  it('conflicting edits to same issue go to attic', async () => {
    // Setup: both agents have the same issue
    const issue = await tbd('create', 'Shared issue');
    const issueId = parseIssueId(issue.stdout);

    // Agent 1 updates and saves
    await tbd('update', issueId, '--title=Agent 1 title');
    await tbd('save', '--outbox');

    // Simulate Agent 2: different edit to same issue, saves to same outbox
    await tbd('update', issueId, '--title=Agent 2 title');
    await tbd('save', '--outbox');

    // Outbox attic should have the conflict
    const atticFiles = await glob('.tbd/workspaces/outbox/attic/**');
    expect(atticFiles.length).toBeGreaterThan(0);
  });
});

describe('Sync failure workflow', () => {
  it('suggests tbd save --outbox on push failure', async () => {
    // Create issue
    await tbd('create', 'Test issue');

    // Push fails
    mockPushFailure(403);
    const result = await tbd('sync');

    // Should suggest save --outbox
    expect(result.stderr).toContain('tbd save --outbox');
  });

  it('full recovery workflow works', async () => {
    // Create issue, sync fails
    await tbd('create', 'Test issue');
    mockPushFailure(403);
    await tbd('sync');

    // Save to outbox
    await tbd('save', '--outbox');

    // Verify outbox has the issue
    expect(await hasWorkspaceData(tbdRoot, 'outbox')).toBe(true);

    // Simulate fresh checkout (delete worktree)
    await deleteWorktree(tbdRoot);

    // Import from outbox
    await tbd('import', '--workspace=outbox');

    // Issue should be in worktree
    const issues = await listWorktreeIssues();
    expect(issues.some(i => i.title === 'Test issue')).toBe(true);

    // Now sync succeeds
    mockPushSuccess();
    await tbd('sync');

    // Issue should be synced to remote
    const remoteIssues = await listRemoteIssues();
    expect(remoteIssues.some(i => i.title === 'Test issue')).toBe(true);
  });
});

describe('Workspace management', () => {
  it('lists workspaces with counts', async () => {
    // Setup: multiple workspaces
    await tbd('save', '--workspace=ws-1');
    await tbd('create', 'Issue 2');
    await tbd('save', '--workspace=ws-2');

    // List
    const result = await tbd('workspace', 'list');

    expect(result.stdout).toContain('ws-1');
    expect(result.stdout).toContain('ws-2');
  });

  it('deletes workspace', async () => {
    // Setup
    await tbd('save', '--workspace=to-delete');
    expect(await workspaceExists(tbdRoot, 'to-delete')).toBe(true);

    // Delete
    await tbd('workspace', 'delete', 'to-delete');

    expect(await workspaceExists(tbdRoot, 'to-delete')).toBe(false);
  });
});
```

### Manual Testing Checklist

**Save Operations:**
- [ ] `tbd save --workspace=test` creates workspace with all issues
- [ ] `tbd save --workspace=test --updates-only` saves only modified issues
- [ ] `tbd save --outbox` is equivalent to `--workspace=outbox --updates-only`
- [ ] `tbd save --dir=/tmp/backup` saves to arbitrary directory
- [ ] Save to existing workspace merges correctly
- [ ] Conflicts go to workspace attic (not worktree attic)
- [ ] ID mappings are merged (union)

**Import Operations:**
- [ ] `tbd import --workspace=test` imports to worktree
- [ ] `tbd import --dir=/tmp/backup` imports from arbitrary directory
- [ ] `tbd import --workspace=test --clear-on-success` deletes workspace after import
- [ ] `tbd import --outbox` is equivalent to `--workspace=outbox --clear-on-success`
- [ ] Import merges with existing worktree data
- [ ] Conflicts go to worktree attic
- [ ] Changes are committed to worktree

**Bulk Edit Workflow:**
- [ ] Export with `tbd save --dir=/tmp/edit`
- [ ] Edit files externally (manual or script)
- [ ] Re-import with `tbd import --dir=/tmp/edit`
- [ ] Changes are merged correctly

**Workflow:**
- [ ] Push fails → warning suggests `tbd save --outbox`
- [ ] Full recovery: create → sync fails → save --outbox → fresh checkout → import →
  sync succeeds
- [ ] Agent can follow suggested workflow automatically

**Multi-Agent Scenarios:**
- [ ] Multiple agents can save to same outbox (different issues merge cleanly)
- [ ] Conflicting edits to same issue → conflict goes to outbox attic
- [ ] Attic preserves both versions for review

**Workspace Management:**
- [ ] `tbd workspace list` shows all workspaces
- [ ] `tbd workspace delete <name>` removes workspace

## Open Questions

1. **Should `--outbox` be the default behavior for save?**
   - Current design: `--outbox` is a shortcut, but one of
     `--workspace`/`--dir`/`--outbox` is required
   - Alternative: Make `tbd save` with no args equivalent to `tbd save --outbox`
   - Recommendation: Require explicit flag for clarity

2. ~~**Should import delete the source workspace after success?**~~
   - **Resolved**: Added `--clear-on-success` flag.
     Import is non-destructive by default, but `--clear-on-success` deletes workspace
     after successful import.
   - `--outbox` shortcut includes `--clear-on-success` since that’s the expected
     workflow.

3. ~~**How to track "updated since last sync" for `--updates-only`?**~~
   - **Resolved**: Use Option C - compare with remote tbd-sync branch
   - Compare local worktree issues with what’s on `origin/tbd-sync`
   - Issues that differ (new, modified, or missing from remote) are “updated”
   - Fallback to git diff in worktree when offline/remote unavailable
   - **Implementation**: See tbd-lka2

4. **Should workspaces support issue deletion tracking?**
   - Current design: Only tracks created/updated issues
   - If user deletes an issue, should that be saved to workspace?
   - Recommendation: No - tbd doesn’t delete issues, so not needed

### Implementation Questions (from 2026-01-30 implementation)

5. ~~**Should `tbd import` auto-commit to the worktree?**~~
   - **Resolved**: NO - import should NOT auto-commit
   - Current implementation is correct (merges data only)
   - After import, print a message suggesting: "Run `tbd sync` to commit and push"
   - This gives users a chance to review changes before committing

6. ~~**Merge behavior when workspace and worktree have same issue**~~
   - **Resolved**: Reuse existing `mergeIssues()` function from `git.ts`
   - This provides field-by-field three-way merge with LWW conflict resolution
   - For workspace operations, use null base (no common ancestor) - this falls back to
     LWW based on `created_at`/`updated_at` timestamps
   - Conflicts go to attic as they do in normal sync
   - **Implementation**: Update `saveToWorkspace()` and `importFromWorkspace()` to call
     `mergeIssues()` instead of simple overwrite

7. ~~**ID mapping merge behavior**~~
   - **Resolved**: Copy ID mappings as union (add new entries, don’t overwrite)
   - When saving: copy worktree mappings to workspace
   - When importing: merge workspace mappings into worktree (union)
   - **Implementation**: Add mapping copy to save/import functions

## References

- Related issue: tbd-knfu (sync resilience feature)
- Silent error bug: tbd-ca3g (sync silent failure)
- Original outbox spec: plan-2026-01-29-claude-code-session-sync.md

## Appendix A: Save and Import Flow Diagrams

### Save Flow

```
                    tbd save --workspace=my-feature [--updates-only]
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Ensure workspace dir  │
                    │ exists                │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Determine issues to   │
                    │ save                  │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ --updates-only?       │
                    ├───────────────────────┤
                    │ YES                   │ NO (default)
                    ▼                       ▼
        ┌───────────────────────┐   ┌───────────────────────┐
        │ Find issues modified  │   │ All issues in         │
        │ since last sync       │   │ worktree              │
        └───────────────────────┘   └───────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ For each issue:       │
                    │ - If exists in WS:    │
                    │   merge both versions │
                    │ - If not: copy to WS  │
                    │ - Conflicts → WS attic│
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Merge ID mappings     │
                    │ (union operation)     │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Report what was saved │
                    │ (no auto-commit)      │
                    └───────────────────────┘
```

### Import Flow

```
                    tbd import --workspace=my-feature [--clear-on-success]
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Check workspace exists│
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ For each issue in WS: │
                    │ - If exists in WT:    │
                    │   merge both versions │
                    │ - If not: copy to WT  │
                    │ - Conflicts → WT attic│
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Merge ID mappings     │
                    │ (union operation)     │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Commit merged changes │
                    │ to worktree           │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ --clear-on-success?   │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ YES                   │ NO
                    ▼                       ▼
        ┌───────────────────────┐   ┌───────────────────┐
        │ Delete workspace      │   │ Keep workspace    │
        │ directory             │   │                   │
        └───────────────────────┘   └───────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Report what was       │
                    │ imported              │
                    └───────────────────────┘
```

### Sync Failure Recovery Flow

```
                    Agent creates/updates issues
                                │
                                ▼
                    ┌───────────────────────┐
                    │ tbd sync              │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Push to remote        │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Push result?          │
                    ├───────────────────────┤
                    │ SUCCESS               │ FAILURE
                    ▼                       ▼
        ┌───────────────────────┐   ┌───────────────────────┐
        │ Done                  │   │ Print warning:        │
        │                       │   │ "Run tbd save --outbox│
        │                       │   │ to preserve changes"  │
        └───────────────────────┘   └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ Agent runs:           │
                                    │ tbd save --outbox     │
                                    └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ Agent commits outbox: │
                                    │ git add .tbd/workspaces│
                                    │ git commit            │
                                    │ git push (works)      │
                                    └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ Data preserved on     │
                                    │ working branch        │
                                    └───────────────────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    │ Later (new session)   │
                                    └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ tbd import --workspace│
                                    │ =outbox               │
                                    └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ tbd sync (succeeds)   │
                                    └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ Data recovered and    │
                                    │ synced to remote      │
                                    └───────────────────────┘
```

## Appendix B: Implementation Notes

### Determining “Updated Since Last Sync”

For `--updates-only`, we need to know which issues have been modified since the last
successful sync. Options:

1. **Compare with remote**: Fetch the remote `tbd-sync` branch and compare issue file
   contents/timestamps
   - Pro: Accurate, no extra state needed
   - Con: Requires network access

2. **Track in state.yml**: Record last sync timestamp or issue hashes
   - Pro: Works offline
   - Con: More state to maintain

3. **Git diff in worktree**: Use `git diff` to find uncommitted/unpushed changes
   - Pro: Leverages git
   - Con: Only shows uncommitted changes, not “since last push”

Recommendation: Use option 1 (compare with remote) with fallback to option 3 (git diff)
when offline.

### Workspace Attic vs Worktree Attic

When saving to a workspace, conflicts go to the **workspace’s attic**, not the
worktree’s attic. This is because:

1. The worktree might not be accessible (that’s often why we’re using workspaces)
2. The conflict is between workspace and worktree versions
3. The user examining the workspace should see what conflicted

When importing from a workspace, conflicts go to the **worktree’s attic** (as usual).
This follows normal sync conflict resolution.

## Appendix C: Engineering Review - Workspace vs Outbox Model

### Detailed Comparison

| Aspect | Outbox Model | Workspace Model | Assessment |
| --- | --- | --- | --- |
| **Data safety trigger** | Automatic on every write | Explicit `tbd save` command | Trade-off: Auto is safer but adds overhead |
| **User awareness** | Transparent (user may not know outbox exists) | Explicit (user controls when to save) | Workspace gives more control |
| **Write performance** | 2x writes (worktree + outbox) | 1x writes (normal operation) | Workspace is faster |
| **Backup use cases** | Not supported | Full support (`--all`, named workspaces) | Workspace wins |
| **Cross-repo transfer** | Not supported | Supported via `--dir` | Workspace wins |
| **Bulk editing** | Not supported | Supported (export, edit, re-import) | Workspace wins |
| **Multi-agent scenarios** | Automatic (but each agent appends to outbox) | Explicit (agents call save, merge handles conflicts) | Comparable |
| **Recovery workflow** | Auto-recover on next sync | Explicit import | Outbox is simpler |
| **Agent training needed** | Minimal (just commit on failure) | Must learn `tbd save --outbox` | Outbox is simpler |
| **Implementation complexity** | Higher (write-through, snapshot clearing) | Lower (explicit commands) | Workspace wins |

### What We Kept from the Outbox Model

1. **Outbox concept**: The “outbox” remains as a special named workspace with convenient
   shortcuts
2. **Push failure detection**: Same error detection and warning messages
3. **Git-based persistence**: Data survives via commits to user’s working branch
4. **Merge-based conflict resolution**: Same three-way merge logic, conflicts to attic
5. **Multi-agent support**: Both models handle concurrent writers via merge

### What We Intentionally Changed

1. **Trigger mechanism**: Automatic write-through → Explicit save command
   - Rationale: Simpler, no performance overhead, more flexible

2. **Single location → Multiple destinations**: Fixed outbox → Named workspaces +
   arbitrary directories
   - Rationale: Enables backup, transfer, and bulk edit use cases

3. **Automatic recovery → Explicit import**: Outbox cleared on sync → User runs import
   - Rationale: More predictable, user controls when to integrate

4. **Snapshot-based clearing → `--clear-on-success`**: Complex snapshot logic → Simple
   flag
   - Rationale: Clearer semantics, less error-prone

### Gap Analysis

| # | Gap | Outbox Model | Workspace Model | Resolution |
| --- | --- | --- | --- | --- |
| 1 | **Sync failure warning** | Suggests committing outbox | Suggests `tbd save --outbox` | Already covered - workspace model has clear warning message |
| 2 | **Corrupted/partial files** | Write-through might leave partial files | No issue (explicit save is atomic per-file) | N/A - workspace model handles this better |
| 3 | **Safe workspace deletion** | Snapshot-based clearing | `--clear-on-success` flag | Already covered - explicit is clearer |
| 4 | **Atomicity of save** | Write-through is per-operation | `tbd save` is a batch operation | Both work; workspace is more atomic overall |
| 5 | **Idempotency** | Re-running sync with outbox just re-merges | Re-running save/import is safe (merge is idempotent) | Both handle re-runs correctly |

**No gaps identified that require additional features.** The workspace model covers all
safety scenarios from the outbox model while adding flexibility.

### Features Gained

1. **Named workspaces**: Multiple independent save locations
2. **Arbitrary directories**: `--dir` flag for non-tbd locations
3. **Full vs incremental**: `--all` (default) vs `--updates-only`
4. **Bulk editing workflow**: Export, edit externally, re-import
5. **Point-in-time backups**: Named snapshots for rollback
6. **Cross-repo transfer**: Copy issues between repositories

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| User forgets to save on failure | Medium | Data loss | Clear warning message, agent training |
| Agent doesn't follow recovery workflow | Low | Data loss | Document in agent guidelines, test in CI |
| Workspace not committed | Medium | Data lost on checkout | Warning in save output: "Remember to commit" |
| Confusion about workspace vs worktree | Low | User confusion | Clear documentation, help text |

### Conclusion

**Recommendation: Proceed with Workspace Model**

The workspace model is the better choice because:

1. **Simpler implementation**: No write-through logic, no snapshot-based clearing
2. **More flexible**: Supports backups, bulk edits, cross-repo transfer
3. **Explicit control**: Users know what’s happening and when
4. **No performance overhead**: Normal operations aren’t slowed by outbox writes
5. **Covers all safety scenarios**: The `--outbox` shortcut provides equivalent
   protection to the automatic outbox

The only downside is requiring explicit user action on sync failure, but:
- The warning message makes this clear
- Agents can be trained to follow the workflow
- The trade-off for flexibility and simplicity is worth it

**Implementation Priority:**
1. Core `tbd save` and `tbd import` commands
2. `--outbox` shortcuts for common recovery workflow
3. `tbd workspace list/delete` for management
4. Integration with sync failure messages

## Future Directions: Private Workspaces

### Overview

The current workspace model supports saving issues *from* the shared worktree *to* a
workspace. A natural extension is **workspace-scoped issue creation**: creating issues
directly in a workspace without ever touching the shared data-sync directory.

This enables “private mode” workflows where issues are drafted, worked on, and
potentially discarded without polluting the shared namespace.

### Use Cases

#### Spec Implementation with Private Issues

When implementing a spec, an agent might create a dozen issues for tracking sub-tasks.
Currently these all go to the shared namespace immediately:

```bash
# Current behavior: issues created in shared data-sync
tbd create "Implement parser" --parent=tbd-spec1
tbd create "Add validation" --parent=tbd-spec1
tbd create "Write tests" --parent=tbd-spec1
# All 3 issues are now visible to everyone, synced on next tbd sync
```

With private workspaces:

```bash
# Proposed: issues created only in the workspace
tbd create "Implement parser" --workspace=spec-impl
tbd create "Add validation" --workspace=spec-impl
tbd create "Write tests" --workspace=spec-impl

# Work on them privately...

# If spec is completed successfully:
tbd import --workspace=spec-impl   # Issues move to shared namespace

# If spec is abandoned:
tbd workspace delete spec-impl     # Issues never existed in shared namespace
```

#### Private Experimentation

An agent or user experimenting with an approach might create many issues for tracking
work.
If the experiment fails, they can delete the workspace without any shared namespace
pollution.

#### Session-Scoped Private Mode

For extended private work sessions:

```bash
# Set session default (hypothetical)
tbd config set default-workspace my-session

# All creates go to workspace by default
tbd create "Task 1"   # Goes to my-session workspace
tbd create "Task 2"   # Goes to my-session workspace

# Explicit override still possible
tbd create "Shared task" --workspace=shared  # Or some flag for shared namespace
```

### Design Considerations

#### Issue ID Uniqueness

Since all issue IDs include ULIDs (which are globally unique), issues created in a
workspace will have unique IDs that won’t conflict when imported to the shared
namespace. No special handling needed.

#### Parent-Child Workspace Inheritance

When creating a child issue with `--parent`, the child should inherit the parent’s
workspace by default:

```bash
# Epic in private workspace
tbd create "Feature Epic" --type=epic --workspace=my-feature

# Child automatically goes to same workspace
tbd create "Subtask 1" --parent=tbd-epic1
# → Goes to my-feature workspace (inherited from parent)
```

This prevents accidentally splitting a hierarchy across workspaces.

#### Spec Attachment Inheritance

Similarly, when an issue is attached to a spec that’s associated with an epic in a
workspace, child issues should follow:

```bash
# Epic attached to spec, in workspace
tbd create "Spec Epic" --spec=plan-xyz.md --workspace=draft-spec

# Child issues for the spec inherit workspace
tbd create "Implementation task" --spec=plan-xyz.md
# → Goes to draft-spec workspace (inherited from spec's epic)
```

#### Cross-Workspace Reference Rules

**Critical constraint**: References must not create dangling pointers.

| From | To | Allowed? | Rationale |
| --- | --- | --- | --- |
| Workspace issue | Shared issue | ✅ Yes | Shared issues are stable, always visible |
| Workspace issue | Same workspace issue | ✅ Yes | Both in same context |
| Workspace A issue | Workspace B issue | ❌ No | Would break if either workspace deleted |
| Shared issue | Workspace issue | ❌ No | Would break if workspace deleted |

**Implementation**: When creating a dependency or relationship, validate:
1. If source is in shared namespace → target must be in shared namespace
2. If source is in workspace X → target must be in shared namespace OR workspace X

```bash
# In workspace my-feature:
tbd dep add tbd-ws1 tbd-shared1   # ✅ OK: workspace → shared
tbd dep add tbd-ws1 tbd-ws2       # ✅ OK: same workspace → same workspace

# From shared namespace:
tbd dep add tbd-shared1 tbd-ws1   # ❌ ERROR: cannot reference workspace issue
```

#### Listing and Visibility

Commands would need workspace awareness:

```bash
# List only shared issues (current behavior, default)
tbd list

# List only workspace issues
tbd list --workspace=my-feature

# List all issues across shared + specific workspace
tbd list --include-workspace=my-feature

# Show which workspace an issue belongs to
tbd show tbd-abc1
# workspace: my-feature  (or "shared" for data-sync issues)
```

#### Import Behavior

When importing a workspace:
- All issues move to shared namespace
- All internal references remain valid (same IDs)
- References to shared issues remain valid
- Workspace is optionally cleared after import

#### Backup vs Private Workspaces

There are two distinct use patterns with different UX expectations:

| Aspect | Backup Workspace | Private Workspace |
| --- | --- | --- |
| **Created by** | `tbd save --workspace=X` | `tbd create --workspace=X` |
| **Contains** | Copies of shared issues | Original issues (never in shared) |
| **Purpose** | Point-in-time backup, sync failure recovery | Draft work, scoped implementation |
| **Import default** | Preserve workspace (may want multiple restores) | Clear workspace (work is done) |
| **Typical workflow** | Save → (disaster) → Import → Sync | Create issues → Work → Publish |

This suggests:
- **Backup workspaces**: `tbd import --workspace=X` preserves by default (use
  `--clear-on-success` explicitly)
- **Private workspaces**: `tbd publish --workspace=X` clears by default and syncs (the
  work is done, make it public)

Implementation options:
1. Track workspace type in metadata (backup vs private)
2. Different commands for different intents (`import` vs `publish`)
3. Heuristic: if workspace was created by `tbd save`, preserve; if by `tbd create`,
   clear

Option 2 (different commands) is clearest - `publish` implies “make this public/shared”
while `import` implies “merge this data in (for recovery)”.

### Open Questions

1. **Should there be a “default workspace” setting?**
   - For session-level private mode
   - Could be set in config or environment variable
   - What’s the UX for temporarily overriding it?

2. **How to handle `tbd ready` with workspaces?**
   - Show only shared issues by default?
   - Option to include specific workspace?
   - Or show all issues user has access to?

3. **What about `tbd sync` with workspace issues?**
   - Workspace issues should NOT be synced (by design)
   - Need clear separation between “sync shared issues” and “save workspace”

4. **Workspace metadata storage?**
   - Need to track which workspace each issue belongs to
   - Could be a field in issue YAML or separate mapping file

5. **Migration path for existing issues?**
   - Can a shared issue be “moved” to a workspace?
   - Probably not - that would break external references
   - But workspace issues can always be imported to shared

6. **Multiple workspace contexts?**
   - Can an issue belong to multiple workspaces?
   - Probably not - simpler to have 1:1 relationship
   - Use import/export to copy between workspaces if needed

7. **`tbd publish` command for private workspaces**
   - For private workspace workflows, the common pattern is:
     1. Complete work on issues in workspace
     2. Import all to shared namespace
     3. Delete workspace
     4. Sync to remote
   - Current approach requires:
     `tbd import --workspace=X --clear-on-success && tbd sync`

   **Key insight**: `tbd import` should remain general-purpose:
   - Works with `--workspace=X` (named workspaces in `.tbd/workspaces/`)
   - Works with `--dir=/path` (arbitrary directories for backups, bulk edits,
     cross-repo)
   - Preserves source by default (use `--clear-on-success` explicitly)
   - Does NOT auto-sync (user reviews first)

   **`tbd publish`** is the natural complement to `tbd create --workspace=X`:
   - Only works with workspaces in `.tbd/workspaces/` (not arbitrary directories)
   - Semantics: “make this private work public”
   - Behavior: import + clear workspace + sync (all in one)
   - The streamlined “I’m done with this draft” command

   ```bash
   # Private workspace workflow
   tbd create "Task 1" --workspace=my-feature
   tbd create "Task 2" --workspace=my-feature
   # ... work on tasks ...
   
   # When done: one command to publish all
   tbd publish my-feature
   # → imports issues to shared namespace
   # → deletes my-feature workspace
   # → syncs to remote
   ```

   **Command structure options**:
   - `tbd publish <workspace-name>` - top-level command (simple, discoverable)
   - `tbd workspace publish <name>` - subcommand (groups with list/delete)

   Either works; top-level `tbd publish` may be more discoverable since it’s the
   complement to `tbd create --workspace`.

### Implementation Sketch

#### Phase 1: Core Infrastructure

- Add `workspace` field to issue schema (optional, null = shared)
- Update `tbd create` to accept `--workspace=<name>` flag
- Create workspace directory structure on first use
- Update `tbd list`, `tbd show`, `tbd ready` for workspace awareness

#### Phase 2: Inheritance Rules

- Parent-child workspace inheritance in `tbd create --parent`
- Spec attachment workspace inheritance
- Default workspace configuration

#### Phase 3: Reference Validation

- Validate cross-workspace references on create/update
- Clear error messages for invalid references
- `tbd doctor` checks for invalid cross-workspace references

#### Phase 4: Enhanced Commands

- `tbd list --workspace=<name>` filtering
- Workspace metadata in `tbd show` output
- `tbd publish <workspace-name>` - the complement to `tbd create --workspace`:
  - Only works with workspaces in `.tbd/workspaces/` (not `--dir`)
  - Imports all issues to shared namespace
  - Deletes the workspace
  - Syncs to remote
  - One command to complete private workspace work

### Relationship to Current Design

This feature builds on the existing workspace infrastructure:

| Current Feature | Private Workspace Extension |
| --- | --- |
| `.tbd/workspaces/<name>/` directory | Same location, but issues created directly there |
| `tbd save --workspace` | Copies from shared → workspace (backup) |
| `tbd import --workspace` | Merges workspace → shared (unchanged, general purpose) |
| `tbd workspace list/delete` | Works with private workspaces too |
| *(new)* `tbd publish <name>` | Complement to `create --workspace` (import + clear + sync) |

The key difference: current workspaces are for *backup/export* of shared issues.
Private workspaces are for *creating issues that never touch shared namespace* until
explicitly published.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Complexity of reference validation | Medium | User confusion | Clear error messages, `tbd doctor` checks |
| Forgetting to import completed work | Medium | Lost visibility | Warnings in `tbd status`, session reminders |
| Workspace proliferation | Low | Clutter | `tbd workspace list` shows all, periodic cleanup prompts |
| Cross-workspace reference bugs | Medium | Data integrity | Strict validation, comprehensive tests |

### Conclusion

Private workspaces are a natural extension of the current design that enables important
workflows:
- Draft work without namespace pollution
- Atomic promotion of related issues when work completes
- Easy cleanup when work is abandoned

The main complexity is reference validation to prevent dangling pointers.
This is solvable with clear rules and validation at relationship creation time.

**Recommendation**: Consider this for a future iteration after the current workspace
sync feature is fully stable and tested.
