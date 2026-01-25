# Plan Spec: Transactional Mode and Agent Registration

## Purpose

This is a technical design doc for adding transactional workflow support and agent
registration to tbd.
These features enable agents to batch changes and commit them atomically, rather than
syncing immediately after each operation.

## Background

**Current State:**

tbd operates in “immediate mode” - changes are written to the worktree and synced on
demand via `tbd sync`. The sync flow is:

1. Agent makes changes (create, update, close issues)
2. Changes written to `.tbd/data-sync-worktree/` (worktree of `tbd-sync` branch)
3. `tbd sync` commits worktree changes to local `tbd-sync` branch
4. Push to `origin/tbd-sync`
5. On push rejection, fetch + merge + retry

**Problem:**

When an agent works on a feature branch for extended periods, it may want to:
- Batch all tbd changes together
- Review changes before making them visible
- Test/validate before committing
- Abort all changes if something goes wrong
- Have a clean “all-or-nothing” semantic

**Reference Documentation:**

- [tbd-design.md §3.3](docs/tbd-design.md) - Current sync operations
- [tbd-design.md §3.4](docs/tbd-design.md) - Conflict detection and resolution
- [git.ts](packages/tbd/src/file/git.ts) - Core git utilities
- [sync.ts](packages/tbd/src/cli/commands/sync.ts) - Sync command implementation

## Summary of Task

Implement two related features:

1. **Agent Registration** - Agents identify themselves with a name, receiving a unique
   agent ID for the session
2. **Transactional Mode** - Agents can begin/commit/abort transactions, batching all
   changes to a temporary branch before merging to `tbd-sync`

## Backward Compatibility

### CLI Compatibility

| Area | Compatibility Level | Notes |
| --- | --- | --- |
| `tbd sync` | Maintain | Existing immediate mode unchanged |
| `tbd create/update/close` | Maintain | Default behavior unchanged |
| New `tbd agent` commands | Additive | New commands, no breaking changes |
| New `tbd tx` commands | Additive | New commands, no breaking changes |

### Breaking Changes

- None - these are additive features

* * *

## Stage 1: Planning Stage

### 1.1 Feature Requirements

#### Agent Registration

**Commands:**
```bash
tbd agent register [--name <name>]   # Register agent, get unique ID
tbd agent status                      # Show current agent registration
tbd agent unregister                  # Clear agent registration
```

**Behavior:**
- Agent provides optional human-friendly name (e.g., “claude-code-cloud”)
- tbd returns unique agent ID: `ag-{slugified-name}-{ulid}`
- Agent ID stored in `.tbd/agent.yml` (local, gitignored)
- Agent ID used to scope transactions and for audit trail

**ID Format:**
```
ag-claude-code-cloud-01hx5zzkbkactav9wevgemmvrz
ag-cursor-agent-01hx5zzkbkbctav9wevgemmvrz
ag-anonymous-01hx5zzkbkcdtav9wevgemmvrz  # If no name provided
```

#### Transactional Mode

**Commands:**
```bash
tbd tx begin [--name <name>]     # Start transaction, get tx ID
tbd tx status                     # Show tx info and pending changes summary
tbd tx commit                     # Apply all changes, merge to tbd-sync
tbd tx abort                      # Discard all changes
tbd tx list                       # Show orphaned tx branches (for recovery)
```

**Transaction ID Format:**
```
tx-01hx5zzkbkactav9wevgemmvrz
```

**Behavior:**
- `tx begin` creates a new git branch: `tbd-sync-tx-{tx-id}`
- All tbd operations write to the transaction branch instead of `tbd-sync`
- `tx commit` merges transaction branch into `tbd-sync`, then syncs to remote
- `tx abort` deletes the transaction branch
- Transaction state stored in `.tbd/transaction.yml`

#### Use Cases

**Use Case 1: Exploratory agent work that might be abandoned**

An agent works on a feature branch, creating and updating issues as it explores a
solution. The work might be abandoned if the approach doesn’t pan out or the PR is
rejected.

```bash
tbd agent register --name claude-feature-work
tbd tx begin --name "auth-refactor-attempt"

# Agent works, tracking progress in issues
tbd create "Refactor auth middleware" --type task
tbd create "Update session handling" --type task
tbd update bd-xyz --status in_progress
tbd update bd-xyz --notes "Tried approach A, hitting issues..."

# Approach didn't work - abort everything
tbd tx abort
# → No issue changes visible to other agents or in tbd-sync
```

Without transactions, these exploratory issue updates would pollute `tbd-sync`, creating
noise for other agents and humans reviewing the issue history.

**Use Case 2: Batch creation of plan/epic hierarchy**

An agent is planning work by creating a structured hierarchy: an epic with multiple
child tasks. During planning, the structure might change or the entire plan might be
abandoned.

```bash
tbd agent register --name claude-planner
tbd tx begin --name "q1-auth-epic"

# Create epic and all child tasks
tbd create "Q1 Auth Improvements" --type epic
tbd create "Add OAuth support" --type task --parent bd-epic
tbd create "Implement MFA" --type task --parent bd-epic
tbd create "Audit logging" --type task --parent bd-epic
tbd dep add bd-mfa bd-oauth --type blocks

# User reviews plan, requests changes...
# Agent adjusts structure...

# Plan finalized - commit all at once
tbd tx commit
# → All issues appear atomically in tbd-sync
```

Without transactions, partial plans would be visible during creation, and abandoned
plans would leave orphaned issues that need manual cleanup.

### 1.2 Scope Definition

**In Scope:**
- [ ] Agent registration with unique IDs
- [ ] Transaction begin/commit/abort commands
- [ ] Branch-native transaction implementation (git branches)
- [ ] Transaction state persistence
- [ ] Integration with existing sync mechanism
- [ ] Agent ID recorded in issue `created_by` and `updated_by` fields

**Out of Scope (Future):**
- Event log/journal-based transactions (more complex, consider for V2)
- Multi-transaction isolation (concurrent transactions on same machine)
- Remote transaction coordination (transactions spanning multiple machines)
- Transaction timeout/expiry
- Nested transactions

### 1.3 Success Criteria

- [ ] `tbd agent register` returns unique agent ID
- [ ] `tbd tx begin` creates transaction branch
- [ ] Operations during transaction write to transaction branch
- [ ] `tbd tx commit` merges to tbd-sync and syncs to remote
- [ ] `tbd tx abort` cleanly removes transaction branch
- [ ] Non-transactional mode (immediate) remains default and unchanged
- [ ] Tests pass
- [ ] Documentation updated

### 1.4 Open Questions

1. **Should agent registration be required for transactions?**
   - Option A: Yes - transactions always scoped to an agent
   - Option B: No - transactions can be anonymous
   - **Recommendation:** Option A - cleaner audit trail

2. **What happens if agent crashes mid-transaction?**
   - Transaction branch remains, `tbd tx list` shows orphaned transactions
   - User can `tbd tx abort --id <tx-id>` to clean up
   - Consider: automatic cleanup of transactions older than X days?

3. **Should we support `--tx` flag on all commands as alternative to `tx begin`?**
   - e.g., `tbd create "Fix bug" --tx` auto-begins if no active tx
   - Adds complexity, defer to future enhancement

* * *

## Stage 2: Architecture Stage

### 2.1 Git Branch Architecture

```
main branch                    tbd-sync branch              tx branch (temporary)
├── src/                       └── .tbd/                    └── .tbd/
├── .tbd/                          └── data-sync/               └── data-sync/
│   ├── config.yml                     ├── issues/                  ├── issues/
│   └── cache/                         └── ...                      └── ...
│       ├── agent.yml
│       └── transaction.yml

                               ↑                            ↑
                               │                            │
                               └──── tx commit merges ──────┘
```

**Branch Naming:**
- Sync branch: `tbd-sync` (existing)
- Transaction branches: `tbd-sync-tx-{tx-id}` (temporary, deleted after commit/abort)

### 2.2 Sync Flow Comparison

**Immediate Mode (Current - Default):**
```
1. tbd create "Fix bug"
2. Write to worktree (tbd-sync branch)
3. tbd sync
4. Commit worktree → local tbd-sync
5. Push tbd-sync → origin/tbd-sync
```

**Transactional Mode (New - Opt-in):**
```
1. tbd agent register --name claude
   → Returns ag-claude-01hx5zz...

2. tbd tx begin
   → Creates branch tbd-sync-tx-01hx5zz...
   → Stores tx state in .tbd/transaction.yml

3. tbd create "Fix bug"
   → Detects active transaction
   → Writes to tx branch worktree instead of tbd-sync worktree

4. tbd update bd-123 --status in_progress
   → Writes to tx branch worktree

5. tbd tx commit --message "Complete auth feature"
   → Commits tx worktree to tx branch
   → Merges tx branch into local tbd-sync
   → Pushes tbd-sync → origin/tbd-sync
   → Deletes tx branch
   → Clears transaction.yml
```

### 2.3 State Files

**`.tbd/agent.yml`** (gitignored):
```yaml
# Current agent registration
id: ag-claude-code-cloud-01hx5zzkbkactav9wevgemmvrz
name: claude-code-cloud
registered_at: 2025-01-19T10:00:00Z
```

**`.tbd/transaction.yml`** (gitignored):
```yaml
# Active transaction (null if no transaction)
id: tx-01hx5zzkbkactav9wevgemmvrz
name: auth-feature  # Optional user-provided name
agent_id: ag-claude-code-cloud-01hx5zzkbkactav9wevgemmvrz
branch: tbd-sync-tx-01hx5zzkbkactav9wevgemmvrz
started_at: 2025-01-19T10:30:00Z
base_commit: abc123...  # tbd-sync commit when tx started
```

### 2.4 Transaction Worktree Strategy

**Approach: Single worktree, switch branches**
- One worktree at `.tbd/data-sync-worktree/`
- On `tx begin`, checkout tx branch in worktree
- On `tx commit/abort`, checkout tbd-sync back
- Only one transaction active at a time (enforced)

**Why single worktree:**
- Simpler - no second worktree lifecycle management
- No extra disk space
- Matches constraint of one transaction at a time
- During transaction, agent wants to see tx state anyway

**Trade-off:** During a transaction, viewing “original” tbd-sync state requires
`git show tbd-sync:path` rather than file reads.
This is acceptable since it’s a rare need - agents typically want to see their pending
changes.

### 2.5 Implementation Location

| Component | File | Description |
| --- | --- | --- |
| Agent commands | `packages/tbd/src/cli/commands/agent.ts` | New file |
| Transaction commands | `packages/tbd/src/cli/commands/tx.ts` | New file |
| Agent state | `packages/tbd/src/file/agent.ts` | New file |
| Transaction state | `packages/tbd/src/file/transaction.ts` | New file |
| Transaction git ops | `packages/tbd/src/file/git.ts` | Extend existing |
| Path constants | `packages/tbd/src/lib/paths.ts` | Add state file paths |

### 2.6 Worktree Branch Switching

Since the worktree is already on the correct branch (either `tbd-sync` or
`tbd-sync-tx-{id}`), existing commands work without modification.
The worktree path resolution remains unchanged - only the branch it’s checked out to
changes.

**On `tx begin`:**
```bash
# In the worktree directory
git checkout -b tbd-sync-tx-{id}
```

**On `tx commit`:**
```bash
# Commit any pending changes to tx branch
git add -A && git commit -m "tbd tx: {message}"

# Switch back to tbd-sync and merge
git checkout tbd-sync
git merge tbd-sync-tx-{id} -m "tbd tx commit: {message}"

# Clean up
git branch -d tbd-sync-tx-{id}
```

**On `tx abort`:**
```bash
# Discard changes and switch back
git checkout tbd-sync
git branch -D tbd-sync-tx-{id}
```

**Key insight:** No changes needed to create/update/close commands - they already write
to the worktree, which is now on the transaction branch.

* * *

## Stage 3: Implementation Stage

### Phase 1: Agent Registration

- [ ] Create `packages/tbd/src/file/agent.ts`
  - [ ] `AgentState` schema (Zod)
  - [ ] `generateAgentId(name?: string)` function
  - [ ] `registerAgent(name?: string)` function
  - [ ] `getRegisteredAgent()` function
  - [ ] `unregisterAgent()` function

- [ ] Create `packages/tbd/src/cli/commands/agent.ts`
  - [ ] `agent register [--name <name>]` command
  - [ ] `agent status` command
  - [ ] `agent unregister` command

- [ ] Register in `packages/tbd/src/cli/cli.ts`

- [ ] Update `packages/tbd/src/lib/paths.ts`
  - [ ] Add `AGENT_STATE_FILE = 'agent.yml'`

### Phase 2: Transaction State Management

- [ ] Create `packages/tbd/src/file/transaction.ts`
  - [ ] `TransactionState` schema (Zod)
  - [ ] `generateTransactionId()` function
  - [ ] `beginTransaction(name?: string)` function
  - [ ] `getActiveTransaction()` function
  - [ ] `clearTransaction()` function
  - [ ] `listOrphanedTransactions()` function (find tx branches without state file)

- [ ] Update `packages/tbd/src/lib/paths.ts`
  - [ ] Add `TRANSACTION_STATE_FILE = 'transaction.yml'`

### Phase 3: Transaction Git Operations

- [ ] Update `packages/tbd/src/file/git.ts`
  - [ ] `createTransactionBranch(txId: string)` - checkout -b in worktree
  - [ ] `commitTransaction(message?: string)` - commit pending changes to tx branch
  - [ ] `mergeTransactionToSync(txId: string, message?: string)` - merge tx → tbd-sync
  - [ ] `abortTransaction(txId: string)` - checkout tbd-sync, delete tx branch
  - [ ] `getWorktreeBranch()` - get current branch in worktree

### Phase 4: Transaction Commands

- [ ] Create `packages/tbd/src/cli/commands/tx.ts`
  - [ ] `tx begin [--name <name>]` command
  - [ ] `tx status` command - shows tx info + changes summary (like git status)
  - [ ] `tx commit` command - error if no changes
  - [ ] `tx abort` command
  - [ ] `tx list` command - shows orphaned tx branches for recovery

- [ ] Register in `packages/tbd/src/cli/cli.ts`

**`tx status` output example:**
```
Transaction: auth-feature (tx-01hx5zzkbk...)
Started: 2025-01-19T10:30:00Z (2 hours ago)
Agent: ag-claude-01hx5zzkbk...

Changes (5 issues):
  new:      is-01hx5zzkbk..., is-01hx5zzkbl...
  updated:  is-01hx5zzkbm..., is-01hx5zzkbn..., is-01hx5zzkbo...

Run 'tbd tx commit' to finalize, 'tbd tx abort' to discard.
```

**When no transaction active:**
```
No active transaction.
Run 'tbd tx begin' to start one.
```

### Phase 5: Testing

- [ ] Create `packages/tbd/tests/agent.test.ts`
- [ ] Create `packages/tbd/tests/transaction.test.ts`
- [ ] Create tryscript: `packages/tbd/tests/cli-agent.tryscript.md`
- [ ] Create tryscript: `packages/tbd/tests/cli-transaction.tryscript.md`

### Phase 6: Documentation

- [ ] Update `docs/tbd-design.md` (see section below)
- [ ] Update `docs/tbd-docs.md` with new commands
- [ ] Update `docs/SKILL.md` with transaction workflow

* * *

## Design Document Updates Required

### Updates to `docs/tbd-design.md`

#### §1.1 What is tbd?

Add to key characteristics:
```markdown
- **Transactional mode**: Optional batched commits for agents working on features
```

#### §1.2 When to Use tbd (add transactional use cases)

Add new rows to the “Use tbd when” table:

| Scenario | Why tbd |
| --- | --- |
| Agent doing exploratory work | Transactions let you abort all changes if approach fails |
| Batch creation of issue hierarchies | Atomic commits prevent partial/orphaned issues |
| Long-running agent sessions | Batch changes until work is validated |

#### NEW §1.X Transactional Mode (Motivation)

Add a new section after §1.2 explaining transactional mode:

```markdown
### 1.X Transactional Mode

By default, tbd operates in **immediate mode**: changes are written to the worktree
and synced on demand. This works well for simple workflows.

For more complex agent workflows, tbd supports **transactional mode**: batch all
changes and commit them atomically, or abort them entirely.

**When to use transactional mode:**

| Use Case | Problem Without Transactions | Solution |
| --- | --- | --- |
| Exploratory work | Abandoned experiments pollute issue history | `tx abort` discards all changes |
| Plan/epic creation | Partial hierarchies visible during creation | `tx commit` makes all issues appear atomically |
| Feature branch work | Issue updates persist even if PR rejected | Changes only committed when work is finalized |

**Example: Exploratory work that might be abandoned**

An agent explores a solution approach, tracking progress in issues. If the approach
fails, all changes are discarded:

​```bash
tbd tx begin --name "auth-refactor-attempt"
tbd create "Refactor auth middleware" --type task
tbd update bd-xyz --status in_progress
tbd update bd-xyz --notes "Tried approach A, hitting issues..."

# Approach didn't work - abort everything
tbd tx abort
# → No changes visible in tbd-sync
​```

**Example: Batch creation of plan hierarchy**

An agent creates a structured epic with child tasks. The entire hierarchy appears
atomically when finalized:

​```bash
tbd tx begin --name "q1-roadmap"
tbd create "Q1 Auth Improvements" --type epic
tbd create "Add OAuth support" --type task --parent bd-epic
tbd create "Implement MFA" --type task --parent bd-epic
tbd dep add bd-mfa bd-oauth --type blocks

# Plan finalized
tbd tx commit
# → All issues appear atomically in tbd-sync
​```

Without transactions, partial plans would be visible during creation, and abandoned
plans would leave orphaned issues requiring manual cleanup.
```

#### §2.2 Directory Structure (new section or update)

Add cache files:
```
.tbd/
├── cache/
│   ├── state.yml          # Existing: per-node sync state
│   ├── agent.yml          # NEW: agent registration
│   └── transaction.yml    # NEW: active transaction state
```

#### §2.5 ID Generation (extend)

Add new ID types:

| ID Type | Format | Example | Purpose |
| --- | --- | --- | --- |
| **Agent** | `ag-{slug}-{ulid}` | `ag-claude-01hx5zz...` | Agent session identity |
| **Transaction** | `tx-{ulid}` | `tx-01hx5zz...` | Transaction scope |

#### §2.6 Schemas (new subsections)

Add:
- §2.6.8 AgentStateSchema
- §2.6.9 TransactionStateSchema

#### §3.3 Sync Operations (new subsection)

Add §3.3.4 Transactional Sync:
```markdown
#### 3.3.4 Transactional Sync

Transactional mode provides atomic batch commits using git branches.

**Architecture:**

​```
.tbd/data-sync-worktree/
    │
    ├── normally checked out to: tbd-sync
    │
    └── during transaction: tbd-sync-tx-{tx-id}
​```

**Transaction Lifecycle:**

1. **Begin**: `tbd tx begin` creates branch `tbd-sync-tx-{tx-id}` from current
   `tbd-sync` HEAD and checks it out in the worktree

2. **Work**: All write operations (create, update, close, etc.) write to the
   worktree, which is now on the transaction branch. No changes to existing
   commands required.

3. **Commit**: `tbd tx commit`:
   a. Error if no changes in transaction
   b. Commits any uncommitted changes in worktree to tx branch
   c. Checks out `tbd-sync` in worktree
   d. Merges tx branch into `tbd-sync` (auto-generated message: "tbd tx: {name}")
   e. Pushes `tbd-sync` to remote (with retry on conflict)
   f. Deletes tx branch

4. **Abort**: `tbd tx abort`:
   a. Checks out `tbd-sync` in worktree (discarding uncommitted changes)
   b. Force-deletes tx branch

**Key Design Decision:** Single worktree with branch switching (not separate
worktrees). This is simpler and matches the constraint of one transaction at a
time per machine.

**Conflict Handling:** On `tx commit`, if the remote `tbd-sync` has diverged,
the standard sync conflict resolution applies (field-level merge, attic for
losers). The transaction's changes are treated as local changes in the merge.

**State Persistence:** Transaction state stored in `.tbd/transaction.yml`
(gitignored). If agent crashes mid-transaction, `tbd tx list` shows orphaned
branches for recovery.
```

#### §4 CLI Layer (new sections)

Add §4.X Agent Commands:
```markdown
### 4.X Agent Commands

Agent registration provides identity for audit trails and transaction scoping.

#### Register

​```bash
tbd agent register [--name <name>]

Options:
  --name <name>    Human-friendly name (e.g., "claude-code-cloud")
​```

Registers the current session as an agent. Returns a unique agent ID.

**Output:**
​```
Registered agent: ag-claude-code-cloud-01hx5zzkbk...
​```

If no name provided, uses "anonymous":
​```
Registered agent: ag-anonymous-01hx5zzkbk...
​```

#### Status

​```bash
tbd agent status
​```

Shows current agent registration.

**Output (registered):**
​```
Agent: claude-code-cloud (ag-claude-code-cloud-01hx5zzkbk...)
Registered: 2025-01-19T10:00:00Z (2 hours ago)
​```

**Output (not registered):**
​```
No agent registered.
Run 'tbd agent register' to register.
​```

#### Unregister

​```bash
tbd agent unregister
​```

Clears agent registration for this session.
```

Add §4.Y Transaction Commands:
```markdown
### 4.Y Transaction Commands

Transactions batch changes for atomic commit or rollback.

#### Begin

​```bash
tbd tx begin [--name <name>]

Options:
  --name <name>    Human-friendly name for the transaction
​```

Starts a new transaction. Creates a transaction branch and switches the worktree
to it.

**Output:**
​```
Transaction started: auth-feature (tx-01hx5zzkbk...)
All changes will be batched until 'tbd tx commit' or 'tbd tx abort'.
​```

**Error (transaction already active):**
​```
Error: Transaction already active: auth-feature (tx-01hx5zzkbk...)
Run 'tbd tx commit' or 'tbd tx abort' first.
​```

#### Status

​```bash
tbd tx status
​```

Shows current transaction state and pending changes.

**Output (active transaction):**
​```
Transaction: auth-feature (tx-01hx5zzkbk...)
Started: 2025-01-19T10:30:00Z (2 hours ago)
Agent: ag-claude-01hx5zzkbk...

Changes (5 issues):
  new:      is-01hx5zzkbk..., is-01hx5zzkbl...
  updated:  is-01hx5zzkbm..., is-01hx5zzkbn..., is-01hx5zzkbo...

Run 'tbd tx commit' to finalize, 'tbd tx abort' to discard.
​```

**Output (no transaction):**
​```
No active transaction.
Run 'tbd tx begin' to start one.
​```

> **Note:** For detailed content diffs, use `git diff` directly in the worktree
> (`.tbd/data-sync-worktree/`). tbd doesn't wrap git diff - it's already available.

#### Commit

​```bash
tbd tx commit
​```

Commits the transaction: merges changes to tbd-sync and syncs to remote.
Merge commit message is auto-generated from transaction name.

**Output:**
​```
Committed transaction: auth-feature
  new:      2 issues
  updated:  3 issues
Synced to origin/tbd-sync
​```

**Error (empty transaction):**
​```
Error: Transaction has no changes to commit.
Run 'tbd tx abort' to close the transaction.
​```

#### Abort

​```bash
tbd tx abort
​```

Discards all changes and ends the transaction.

**Output:**
​```
Aborted transaction: auth-feature
All changes discarded.
​```

#### List

​```bash
tbd tx list
​```

Shows transaction branches (for recovering orphaned transactions).

**Output:**
​```
Transaction branches:
  tbd-sync-tx-01hx5zzkbk... (no state file - orphaned)
  tbd-sync-tx-01hx6aabcd... (active)

To clean up orphaned transactions:
  git branch -D tbd-sync-tx-01hx5zzkbk...
​```
```

#### §7.2 Future Enhancements

Add:
```markdown
#### Event-Log Transactions

For more sophisticated transaction handling, a future version could implement
journal-based transactions with append-only event logs, enabling:
- Operation-level replay and undo
- Transaction squashing
- More granular conflict resolution
```

* * *

## Stage 4: Validation Stage

### Test Plan

1. **Agent registration**
   - Register with name → get valid ag-{slug}-{ulid}
   - Register without name → get ag-anonymous-{ulid}
   - Status shows current registration
   - Unregister clears state

2. **Transaction lifecycle**
   - Begin creates branch and worktree
   - Status shows active transaction
   - Create/update operations write to tx worktree
   - Commit merges to tbd-sync and pushes
   - Abort deletes branch without merging

3. **Immediate mode unchanged**
   - Without active transaction, all commands work as before
   - Sync still works normally

4. **Error handling**
   - tx begin when tx already active → error
   - tx commit when no tx active → error
   - tx abort when no tx active → error
   - Orphaned transaction recovery

### Acceptance Criteria

- [ ] `tbd agent register --name claude` returns `ag-claude-{ulid}`
- [ ] `tbd tx begin` creates `tbd-sync-tx-{ulid}` branch
- [ ] `tbd create "Test"` during tx writes to tx worktree
- [ ] `tbd tx status` shows pending changes
- [ ] `tbd tx commit` merges and syncs successfully
- [ ] `tbd tx abort` removes tx branch cleanly
- [ ] Normal `tbd sync` still works (no active tx)
- [ ] All tests pass
- [ ] Design doc updated per specification above

* * *

## References

- [tbd-design.md](docs/tbd-design.md) - Current design specification
- [Git worktree documentation](https://git-scm.com/docs/git-worktree)
- [Event sourcing patterns](https://martinfowler.com/eaaDev/EventSourcing.html) - Future
  enhancement reference
