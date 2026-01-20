# NATS File System Coordination Layer

**Author:** Claude (exploration document)
**Date:** January 2026
**Status:** Design exploration

---

## Executive Summary

This document explores a coordination layer design where:

1. **TBD defines the schema** for all bindable entities (issues, agents, comments, work queues, claims)
2. **Agents interact purely via file system operations** - reads, writes, and watches
3. **A daemon handles all NATS complexity** - subscribing, publishing, conflict resolution, settlement
4. **State appears as files** in a consistent, eventually-consistent file tree

The key insight: **simplify the agent interface to pure file system semantics while the daemon handles distributed coordination behind the scenes.**

---

## 1. The Core Abstraction

### 1.1 What Agents See

Agents see a unified file system with three areas:

```
.tbd/
├── config.yml                    # Project config (as today)
├── data-sync/                    # Git-durable layer (as today)
│   ├── issues/
│   │   └── is-*.md
│   └── mappings/
│       └── ids.yml
└── live/                         # NEW: Real-time coordination layer
    ├── agents/
    │   ├── agent-abc123.yml      # Agent presence/session
    │   └── agent-def456.yml
    ├── claims/
    │   ├── is-01hx.../owner.yml  # Who owns this issue
    │   └── is-01hx.../lock.yml   # Exclusive edit lock
    ├── queues/
    │   ├── ready.yml             # Issues ready to work
    │   └── agent-abc123.yml      # This agent's work queue
    ├── overlays/
    │   └── is-01hx.../live.yml   # Fast-changing status overlays
    └── threads/
        └── is-01hx.../           # Discussion threads
            ├── 0001.yml
            └── 0002.yml
```

### 1.2 Agent Operations

Agents use **standard file operations only**:

```typescript
// Read current state
const agent = readYaml('.tbd/live/agents/agent-abc123.yml');
const owner = readYaml('.tbd/live/claims/is-01hx5zzkbk.../owner.yml');
const queue = readYaml('.tbd/live/queues/ready.yml');

// Write to claim/update
writeYaml('.tbd/live/claims/is-01hx5zzkbk.../owner.yml', {
  agent_id: 'agent-abc123',
  claimed_at: new Date().toISOString(),
});

// Watch for changes
watch('.tbd/live/queues/ready.yml', (event) => {
  // New work available
});
```

### 1.3 What the Daemon Does

The daemon (`tbd-coord` or `tbd-sync-daemon`) runs in the background:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Local File System (.tbd/live/)                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  agents/  claims/  queues/  overlays/  threads/             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            ↑ ↓ (file watches + atomic writes)       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    tbd-coord daemon                          │    │
│  │  - Watches local files for changes                          │    │
│  │  - Publishes changes to NATS                                │    │
│  │  - Subscribes to NATS for remote changes                    │    │
│  │  - Resolves conflicts (CAS, LWW, merge)                     │    │
│  │  - Maintains structural integrity                           │    │
│  │  - Settles durable data to git                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            ↑ ↓ (NATS protocol)                      │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NATS (Synadia Cloud or self-hosted)              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────────┐    │
│  │  KV Store  │  │  Streams   │  │  Object Store              │    │
│  │  - agents  │  │  - comments│  │  - large payloads          │    │
│  │  - claims  │  │  - audit   │  │  - transcripts             │    │
│  │  - queues  │  │  - events  │  │  - attachments             │    │
│  └────────────┘  └────────────┘  └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Binding Model

### 2.1 Schema-Driven Entity Types

TBD defines the **binding schema** for all entity types:

```typescript
// lib/coordination-schemas.ts

// Entity type prefix determines storage & behavior
export const EntityType = z.enum([
  'is',   // Issue (git-durable)
  'ag',   // Agent session (ephemeral, TTL)
  'cl',   // Claim/lock (ephemeral, TTL)
  'cm',   // Comment (stream-durable)
  'qu',   // Queue entry (KV-durable)
  'ov',   // Overlay/status (KV-durable with TTL option)
  'lk',   // External link mapping (KV-durable)
]);

// Binding relationships
export const BindingSchema = z.object({
  // What this entity binds to
  binds_to: z.object({
    entity_type: EntityType,
    entity_id: z.string(),
  }).optional(),

  // Binding cardinality
  cardinality: z.enum(['one', 'many']).default('one'),

  // Storage class
  storage: z.enum([
    'git',           // Settles to git
    'kv-durable',    // NATS KV, persists across restarts
    'kv-ephemeral',  // NATS KV, TTL-based
    'stream',        // NATS stream (append-only)
    'object',        // NATS object store (large blobs)
  ]),
});
```

### 2.2 Entity Definitions

```typescript
// Agent session - ephemeral, self-cleans on crash
export const AgentSessionSchema = z.object({
  type: z.literal('ag'),
  id: AgentId,

  // Core fields
  name: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  status: z.enum(['starting', 'ready', 'working', 'paused', 'stopping']),

  // Heartbeat (daemon updates automatically)
  last_heartbeat: z.string().datetime(),

  // What this agent is working on
  current_issue: IssueId.optional(),

  // Timestamps
  started_at: z.string().datetime(),

  // Binding metadata
  _binding: z.object({
    storage: z.literal('kv-ephemeral'),
    ttl_seconds: z.number().default(30),  // Auto-expire if no heartbeat
  }),
});

// Issue claim - binds to an issue
export const IssueClaimSchema = z.object({
  type: z.literal('cl'),
  id: ClaimId,

  // What this claims
  issue_id: IssueId,

  // Who owns it
  agent_id: AgentId,

  // Claim metadata
  claimed_at: z.string().datetime(),
  claim_type: z.enum(['working', 'reviewing', 'editing']),

  // Binding metadata
  _binding: z.object({
    binds_to: z.object({
      entity_type: z.literal('is'),
      entity_id: IssueId,
    }),
    storage: z.literal('kv-ephemeral'),
    ttl_seconds: z.number().default(300),  // 5 min claim timeout
  }),
});

// Comment - binds to an issue, append-only
export const CommentSchema = z.object({
  type: z.literal('cm'),
  id: CommentId,

  // What this comments on
  issue_id: IssueId,

  // Content
  author: z.string(),
  body: z.string(),
  created_at: z.string().datetime(),

  // Optional settlement
  settle_policy: z.enum(['never', 'digest', 'full']).default('never'),

  // Binding metadata
  _binding: z.object({
    binds_to: z.object({
      entity_type: z.literal('is'),
      entity_id: IssueId,
    }),
    cardinality: z.literal('many'),
    storage: z.literal('stream'),
    retention_days: z.number().default(30),
  }),
});

// External link mapping - binds to an issue
export const ExternalLinkSchema = z.object({
  type: z.literal('lk'),
  id: LinkId,

  // What this links
  issue_id: IssueId,

  // External references
  github_issue: z.string().optional(),
  github_pr: z.string().optional(),
  linear_issue: z.string().optional(),
  slack_thread: z.string().optional(),

  // Binding metadata
  _binding: z.object({
    binds_to: z.object({
      entity_type: z.literal('is'),
      entity_id: IssueId,
    }),
    storage: z.literal('kv-durable'),
  }),
});
```

---

## 3. File System Mapping

### 3.1 Directory Structure

The daemon maintains this structure:

```
.tbd/live/
├── _meta/
│   ├── daemon.yml           # Daemon status, NATS connection info
│   ├── sync-cursor.yml      # Last sync position
│   └── schema-version.yml   # Coordination schema version
│
├── agents/
│   ├── ag-abc123.yml        # Agent session
│   └── ag-def456.yml
│
├── claims/
│   └── is-01hx5zzkbk.../    # Per-issue claims
│       ├── owner.yml        # Current owner (one)
│       └── reviewers.yml    # Reviewers (many)
│
├── overlays/
│   └── is-01hx5zzkbk.../    # Per-issue overlays
│       └── status.yml       # Fast status overlay
│
├── queues/
│   ├── _global/
│   │   ├── ready.yml        # Global ready queue
│   │   └── blocked.yml      # Global blocked queue
│   └── ag-abc123/           # Per-agent queues
│       ├── assigned.yml
│       └── watching.yml
│
├── threads/
│   └── is-01hx5zzkbk.../    # Per-issue threads
│       ├── _index.yml       # Thread metadata
│       ├── 0001.yml         # Comment 1
│       ├── 0002.yml         # Comment 2
│       └── ...
│
└── links/
    └── is-01hx5zzkbk.../    # Per-issue external links
        └── mapping.yml
```

### 3.2 File Format

All files are YAML for human readability and git-diff friendliness:

```yaml
# .tbd/live/agents/ag-abc123.yml
type: ag
id: ag-abc123
name: "Claude Agent 1"
status: working
current_issue: is-01hx5zzkbkactav9wevgemmvrz
last_heartbeat: "2026-01-20T10:30:00Z"
started_at: "2026-01-20T09:00:00Z"
capabilities:
  - code-review
  - bug-fix
  - documentation
```

```yaml
# .tbd/live/claims/is-01hx5zzkbkactav9wevgemmvrz/owner.yml
type: cl
id: cl-01hx6aakbkactav9wevgemmvrz
issue_id: is-01hx5zzkbkactav9wevgemmvrz
agent_id: ag-abc123
claimed_at: "2026-01-20T10:25:00Z"
claim_type: working
```

```yaml
# .tbd/live/overlays/is-01hx5zzkbkactav9wevgemmvrz/status.yml
issue_id: is-01hx5zzkbkactav9wevgemmvrz
overlay_status: in_progress
overlay_assignee: ag-abc123
last_activity: "2026-01-20T10:30:00Z"
# Note: These override git-durable fields for "now" queries
```

---

## 4. Daemon Architecture

### 4.1 Daemon Responsibilities

```typescript
class CoordinationDaemon {
  private nats: NatsConnection;
  private kv: KV;
  private streams: Map<string, JetStreamClient>;
  private watcher: FSWatcher;

  async start() {
    // 1. Connect to NATS
    await this.connectNats();

    // 2. Bootstrap local state from NATS
    await this.bootstrapFromRemote();

    // 3. Start watching local files
    this.watchLocalFiles();

    // 4. Subscribe to NATS updates
    this.subscribeToUpdates();

    // 5. Start heartbeat for this daemon
    this.startHeartbeat();

    // 6. Start settlement worker
    this.startSettlementWorker();
  }

  // Handle local file change
  async onLocalFileChange(path: string, event: 'create' | 'modify' | 'delete') {
    const entity = await this.parseEntityFile(path);

    // Validate against schema
    const validated = this.validateEntity(entity);

    // Apply to NATS with appropriate operation
    switch (entity._binding.storage) {
      case 'kv-ephemeral':
      case 'kv-durable':
        await this.applyToKV(entity, event);
        break;
      case 'stream':
        await this.appendToStream(entity);
        break;
      case 'git':
        // Queue for settlement
        this.settlementQueue.push(entity);
        break;
    }
  }

  // Handle NATS update
  async onRemoteUpdate(subject: string, data: Uint8Array) {
    const entity = decode(data);
    const localPath = this.entityToPath(entity);

    // Check for conflict
    const localEntity = await this.readLocalEntity(localPath);
    if (localEntity && this.hasConflict(localEntity, entity)) {
      entity = this.resolveConflict(localEntity, entity);
    }

    // Write to local file system
    await this.writeEntityFile(localPath, entity);
  }
}
```

### 4.2 Conflict Resolution

The daemon handles conflicts using the same strategies as TBD git sync:

```typescript
interface ConflictResolver {
  // For KV entries (claims, overlays)
  resolveKV(local: Entity, remote: Entity): Entity {
    // CAS-based: NATS revision wins
    // If local has changes not yet pushed, merge based on field rules
    return this.fieldMerge(local, remote, {
      immutable: ['type', 'id', 'issue_id'],
      lww: ['status', 'assignee', 'claimed_at'],
      union: ['capabilities', 'watchers'],
      max: ['revision'],
    });
  }

  // For streams (comments) - no conflict, append-only
  resolveStream(local: Entity, remote: Entity): Entity[] {
    // Both are kept, ordered by timestamp
    return [local, remote].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
  }
}
```

### 4.3 Settlement to Git

The daemon periodically settles durable data to git:

```typescript
class SettlementWorker {
  async settle() {
    // 1. Collect entities marked for git settlement
    const toSettle = this.settlementQueue.drain();

    // 2. Group by issue
    const byIssue = groupBy(toSettle, e => e.issue_id);

    // 3. For each issue, update git-durable file
    for (const [issueId, entities] of byIssue) {
      const issue = await this.loadIssue(issueId);

      // Apply overlays to issue
      const overlay = entities.find(e => e.type === 'ov');
      if (overlay?.settle_fields) {
        Object.assign(issue, pick(overlay, overlay.settle_fields));
      }

      // Apply comment digests
      const comments = entities.filter(e => e.type === 'cm');
      if (comments.length > 0) {
        issue.body += '\n\n## Discussion Digest\n';
        issue.body += this.digestComments(comments);
      }

      // Write to git worktree
      await this.writeIssue(issue);
    }

    // 4. Commit and push
    await this.gitCommitAndPush('chore: settle coordination state');
  }
}
```

---

## 5. Agent Startup Flow

### 5.1 Bootstrap Sequence

When an agent starts:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent Startup                                                      │
│                                                                     │
│  1. tbd init (if needed)                                           │
│     └─→ Creates .tbd/config.yml, .tbd/data-sync-worktree           │
│                                                                     │
│  2. tbd sync                                                        │
│     └─→ Pulls latest git state                                     │
│                                                                     │
│  3. tbd coord start (or auto-started)                              │
│     └─→ Daemon connects to NATS                                    │
│     └─→ Bootstraps .tbd/live/ from NATS KV/streams                 │
│     └─→ Starts watching files                                      │
│                                                                     │
│  4. Agent reads files, starts working                               │
│     └─→ Read .tbd/live/queues/ready.yml for available work         │
│     └─→ Write .tbd/live/claims/is-xxx/owner.yml to claim           │
│     └─→ Read .tbd/data-sync/issues/is-xxx.md for issue details     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Graceful Degradation

If NATS is unavailable:

```typescript
class CoordinationDaemon {
  async connectNats() {
    try {
      this.nats = await connect(this.config.nats);
      this.mode = 'online';
    } catch (e) {
      console.warn('NATS unavailable, running in offline mode');
      this.mode = 'offline';
      // Use local files only, sync when reconnected
    }
  }

  // Periodic reconnection attempts
  async reconnectLoop() {
    while (this.mode === 'offline') {
      await sleep(30_000);
      try {
        await this.connectNats();
        if (this.mode === 'online') {
          await this.reconcileOfflineChanges();
        }
      } catch (e) {
        // Continue offline
      }
    }
  }
}
```

---

## 6. NATS Mapping

### 6.1 KV Buckets

```
tbd-agents          # Agent sessions (TTL: 30s)
  key: ag-{id}

tbd-claims          # Issue claims (TTL: 5min)
  key: is-{id}/owner
  key: is-{id}/reviewers

tbd-overlays        # Fast status overlays
  key: is-{id}/status

tbd-queues          # Work queues
  key: global/ready
  key: global/blocked
  key: ag-{id}/assigned

tbd-links           # External link mappings
  key: is-{id}/mapping
```

### 6.2 Streams

```
tbd-comments        # Comment events
  subject: comments.{issue_id}
  retention: 30 days

tbd-audit           # Audit log for all changes
  subject: audit.{entity_type}.{operation}
  retention: 90 days

tbd-events          # General coordination events
  subject: events.{event_type}
  retention: 7 days
```

### 6.3 Object Store

```
tbd-blobs           # Large payloads
  key: {hash}       # Content-addressed
  metadata: {issue_id, type, created_at}
```

---

## 7. Benefits of This Design

### 7.1 Simplicity for Agents

- **No NATS client code** - agents just use file system
- **No event handling** - daemon abstracts all pub/sub
- **Familiar model** - files + watches are universal
- **Easy debugging** - inspect files directly
- **Works offline** - local files always available

### 7.2 Structural Consistency

- **Schema validation** - daemon validates all writes
- **Binding enforcement** - can't create orphan comments
- **TTL management** - daemon handles expiration
- **Conflict resolution** - automatic, deterministic

### 7.3 Performance

- **Local reads** - no network for reads
- **Batched writes** - daemon can coalesce
- **Efficient sync** - NATS handles pub/sub efficiently
- **Lazy loading** - only sync what's watched

### 7.4 Operational Simplicity

- **Single daemon** - one process per machine
- **Standard tools** - NATS is well-understood
- **Incremental adoption** - can run without coordination layer
- **Clear boundaries** - git for durable, NATS for real-time

---

## 8. Potential Concerns

### 8.1 File System as IPC

**Concern:** Using file system as inter-process communication is unconventional.

**Mitigation:**
- Well-tested pattern (Unix domain sockets, /tmp, /var/run)
- Atomic writes prevent corruption
- File watches are mature (inotify, FSEvents, kqueue)
- Simpler than custom IPC protocols

### 8.2 Consistency Model

**Concern:** File system + NATS = eventual consistency complexities.

**Mitigation:**
- Clear ownership rules (coordination is authoritative for "now")
- CAS operations for critical updates
- Conflict resolution is deterministic
- Agents can verify claims before acting

### 8.3 Daemon Dependency

**Concern:** Requires daemon to be running for coordination.

**Mitigation:**
- Graceful offline mode
- Git layer still works independently
- Can run `tbd` commands without daemon (no coordination, but works)
- Daemon auto-starts on first coordination operation

### 8.4 File System Overhead

**Concern:** Many small files = inode pressure, directory scanning.

**Mitigation:**
- Entity count is bounded (agents << 100, claims << issues)
- Use structured directories (per-issue subdirs)
- Index files for fast enumeration
- Can tune inotify limits if needed

---

## 9. Implementation Phases

### Phase 1: Core Daemon

- [ ] NATS connection management
- [ ] KV bootstrap/sync for agents and claims
- [ ] Local file watching
- [ ] Basic conflict resolution
- [ ] Heartbeat/TTL management

### Phase 2: Full Entity Support

- [ ] Comment streams
- [ ] Queue management
- [ ] Overlay handling
- [ ] External link mapping

### Phase 3: Settlement

- [ ] Git settlement worker
- [ ] Digest generation
- [ ] Configurable settlement policies

### Phase 4: Tooling

- [ ] `tbd coord status` - daemon status
- [ ] `tbd coord start/stop` - daemon control
- [ ] `tbd watch` - file watch wrapper
- [ ] Agent SDK helpers

---

## 10. Open Questions

1. **Should the daemon be part of `tbd` or a separate tool?**
   - Pro separate: cleaner boundaries, optional dependency
   - Pro unified: simpler user experience, shared code

2. **How to handle partial failures?**
   - NATS up but git push fails
   - Local write succeeds but NATS rejects (CAS failure)

3. **Watch granularity?**
   - Watch individual files vs directories
   - Polling fallback for systems without inotify

4. **Config location for NATS credentials?**
   - In `.tbd/config.yml` (project-specific)
   - In `~/.config/tbd/credentials` (user-level)
   - Environment variables

5. **Multi-project coordination?**
   - Can one daemon handle multiple repos?
   - Or one daemon per repo?

---

## 11. Comparison with Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **File System Abstraction (this design)** | Simple agent interface, debuggable, offline works | Requires daemon, file system overhead |
| **Direct NATS client in agents** | No daemon, direct control | Complex agent code, no offline, harder debugging |
| **Unix domain sockets** | Fast IPC | Platform-specific, not inspectable |
| **HTTP API server** | Standard interface | More infrastructure, latency |
| **SQLite + triggers** | ACID, mature | File locking issues, not distributed |

---

## 12. Conclusion

The file system abstraction over NATS coordination is a compelling design because:

1. **It preserves TBD's simplicity** - agents don't need to learn new APIs
2. **It's debuggable** - files are inspectable, no hidden state
3. **It degrades gracefully** - offline mode just works
4. **It's operationally simple** - one daemon, standard NATS
5. **It separates concerns clearly** - git for durable, files for interface, NATS for transport

The main cost is running a daemon, but that cost is well-bounded and provides significant value for real-time coordination use cases.

**Recommended next step:** Prototype the daemon with just agent sessions and issue claims to validate the file-watching mechanics and NATS integration patterns.
