# Research Brief: Distributed Semi-Structured File Synchronization

**Last Updated**: 2026-01-24

**Status**: In Progress

**Related**:

- [NATS FS Coordination Layer](../nats-fs-coordination-layer.md) - Initial exploration
- [Entity Binding Model](../entity-binding-model.md) - Schema-driven entity design
- [Distributed File Sync Consistency](../distributed-file-sync-consistency.md) - Consistency concepts reference

---

## Executive Summary

This research explores the design space for a **generic semi-structured data filesystem synchronization layer** that could enable distributed applications to share YAML/JSON/TOML files across nodes with configurable consistency guarantees.

The core tension is between **simplicity** (files as the interface, any tool can read/write) and **consistency** (guarantees about what states are observable across nodes). This research surveys how existing systems navigate this tension, catalogs the spectrum of approaches from pure file sync to full event sourcing, and explores how to build a practical sync layer using NATS as the transport.

**Key insight**: Rather than building application-specific sync logic, we can create a **generic sync layer** where directory paths determine sync policies, and applications simply read/write files. This separates concerns: applications own their data model, the sync layer owns distribution.

**Research Questions**:

1. What consistency guarantees are achievable with a file-based interface?
2. How do existing systems (Firebase, CouchDB, Dropbox, etc.) handle distributed data with varying consistency needs?
3. What is the right abstraction boundary between application logic and sync infrastructure?
4. Can we design a policy-based system where directory structure determines sync behavior?
5. How do we handle the three categories of data: durable/moderate, ephemeral/fast, and large/blob?

---

## Research Methodology

### Approach

- Literature review of distributed systems consistency models
- Analysis of existing sync systems (Dropbox, Syncthing, Firebase, CouchDB, etc.)
- Exploration of NATS JetStream capabilities
- Design iteration through conversation and documentation

### Sources

- Official documentation for Firebase, CouchDB, NATS, etcd, Syncthing
- Academic papers on CRDTs, vector clocks, CAP theorem
- Industry blog posts on sync engine architecture (Dropbox, Figma)
- Prior work in this repository on TBD coordination needs

---

## 1. Problem Context

### 1.1 The Core Challenge

Many distributed applications need to share state across nodes:

| Use Case | Characteristics |
|----------|-----------------|
| Configuration management | Moderate size, infrequent updates, needs consistency |
| Coordination (locks, claims) | Small size, must be strongly consistent |
| Status/presence | Small size, high frequency, eventual consistency OK |
| Collaborative editing | Any size, real-time, needs conflict resolution |
| Audit logs | Append-only, ordering matters |
| Large artifacts | Big files, infrequent access, durable |

### 1.2 Data Categories

Our research identifies **three fundamental categories** of data with different sync requirements:

| Category | Size | Latency | Durability | Consistency Need |
|----------|------|---------|------------|------------------|
| **Durable/Moderate** | Small-medium | Seconds OK | Permanent | Merge-based |
| **Ephemeral/Fast** | Small-medium | Milliseconds | Configurable | LWW or CAS |
| **Large/Blob** | Large | Varies | Permanent | Content-addressed |

### 1.3 Example: TBD Issue Tracking

TBD (git-native issue tracking) exemplifies these categories:

- **Durable**: Issue documents, ID mappings → Git
- **Ephemeral/Fast**: Agent heartbeats, claims, status overlays → Real-time sync
- **Large/Blob**: Transcripts, attachments → Object storage

This is one use case, but the pattern applies broadly to any distributed application.

---

## 2. Survey of Existing Systems

### 2.1 File Sync Systems

#### Dropbox

**Status**: ✅ Complete

**Model**: File-level sync with last-write-wins

**Details**:
- Each file synced independently
- Conflicts create "conflicted copy" files
- No cross-file consistency guarantees
- Proprietary sync protocol

**Assessment**: Optimized for simplicity and offline-first. Works well for human-edited documents where conflicts are rare and can be manually resolved. Not suitable for machine coordination where duplicate state is unacceptable.

---

#### Syncthing

**Status**: ✅ Complete

**Model**: File-level sync with vector clocks

**Details**:
- Open-source, peer-to-peer
- Uses vector clocks to track causality
- Conflicts create `.sync-conflict-*` files
- Supports ignore patterns and folder types

**Assessment**: More sophisticated conflict detection than Dropbox, but still requires manual resolution. Good for personal file sync, limited for programmatic coordination.

---

### 2.2 Real-Time Databases

#### Firebase Realtime Database

**Status**: ✅ Complete

**Model**: JSON tree with real-time sync and optional transactions

**Details**:
- Data stored as one large JSON tree
- Real-time listeners for changes
- Simple writes are eventually consistent (LWW)
- Transactions available for atomic read-modify-write
- Offline support with local persistence

**Key insight**: Two-tier consistency model:
```javascript
// Simple write - LWW, eventually consistent
db.ref('status/node-1').set({ online: true, timestamp: Date.now() });

// Transaction - strongly consistent
db.ref('locks/resource-1').transaction(current => {
  if (current === null) {
    return { owner: 'me', timestamp: Date.now() };
  }
  return undefined;  // Abort - already locked
});
```

**Assessment**: Pragmatic hybrid approach. Most operations use simple writes (fast, scalable). Critical operations use transactions (consistent but slower). This pattern is highly relevant to our design.

---

#### Firestore

**Status**: ✅ Complete

**Model**: Document-collection hierarchy with strong consistency

**Details**:
- Documents organized in collections (like folders)
- Strong consistency for single-document operations
- Transactions for multi-document atomicity
- Real-time listeners with snapshot isolation

**Key insight**: Stronger default consistency than Realtime Database, but with similar transaction semantics for critical operations.

**Assessment**: Good model for structured data. The document/collection metaphor maps well to files/directories.

---

#### Couchbase / CouchDB

**Status**: ✅ Complete

**Model**: Document database with revision-based sync

**CouchDB Details**:
- Every document has `_rev` (revision ID)
- Updates require current `_rev` (optimistic concurrency)
- Conflicts tracked, not auto-resolved
- Multi-master replication with conflict detection
- "Winning" revision chosen deterministically, conflicts preserved

```javascript
// Document with revision
{ "_id": "issue-123", "_rev": "2-abc123", "title": "Bug fix" }

// Update requires matching revision
db.put({ "_id": "issue-123", "_rev": "2-abc123", "title": "Fixed!" });
// Fails with conflict if revision changed
```

**Couchbase Details**:
- Adds strong consistency options (via Couchbase Server)
- Sub-document operations for partial updates
- N1QL query language
- Cross-datacenter replication (XDCR)

**Assessment**: CouchDB's revision-based model is elegant for conflict detection. The "keep all conflicting revisions" approach is valuable for audit trails. Could inform our merge strategy design.

---

#### RethinkDB

**Status**: ✅ Complete

**Model**: Real-time document database with changefeeds

**Details**:
- Push-based change notifications (changefeeds)
- Strong consistency by default
- Atomic operations on documents
- ReQL query language

**Assessment**: Changefeeds concept is relevant - applications subscribe to changes rather than polling. Similar to NATS KV watches.

---

### 2.3 Coordination Services

#### etcd

**Status**: ✅ Complete

**Model**: Strongly consistent key-value store (Raft consensus)

**Details**:
- Linearizable reads and writes
- Watch API for change notifications
- Lease-based TTL for ephemeral keys
- Transactions with conditions

```go
// Atomic claim with precondition
txn := client.Txn(ctx).
    If(clientv3.Compare(clientv3.Version("lock/resource"), "=", 0)).
    Then(clientv3.OpPut("lock/resource", myId)).
    Else(clientv3.OpGet("lock/resource"))
```

**Assessment**: Gold standard for coordination data. Strong consistency comes at cost of latency and availability during partitions. Not suitable for general data storage, but relevant for critical coordination operations.

---

#### ZooKeeper

**Status**: ✅ Complete

**Model**: Hierarchical namespace with strong consistency

**Details**:
- Tree of "znodes" (like filesystem)
- Ephemeral nodes (deleted when session ends)
- Sequential nodes (auto-incrementing names)
- Watches for change notification

**Assessment**: The ephemeral node concept (auto-cleanup on disconnect) is valuable for presence/heartbeat tracking. Sequential nodes useful for ordering.

---

#### Consul

**Status**: ✅ Complete

**Model**: Service discovery + KV store with sessions

**Details**:
- KV store with CAS operations
- Sessions for distributed locking
- Health checking integrated
- Multi-datacenter support

**Assessment**: Session-based locking model is interesting - locks automatically released if session dies. Relevant for agent coordination.

---

### 2.4 Event Sourcing Systems

#### Datomic

**Status**: ✅ Complete

**Model**: Immutable database with time-travel

**Details**:
- All data is immutable facts (datoms)
- Transactions are sets of assertions/retractions
- Query at any point in time
- Derived views from fact log

**Assessment**: Event sourcing provides perfect audit trail and enables time-travel queries. Significant complexity cost. May be overkill for most use cases but relevant for high-compliance scenarios.

---

#### EventStore

**Status**: ✅ Complete

**Model**: Purpose-built event sourcing database

**Details**:
- Append-only streams of events
- Projections for derived state
- Subscriptions for real-time
- Optimistic concurrency on streams

**Assessment**: If ordering and audit trail are paramount, event sourcing is the answer. The "state as materialized view" concept could apply to our file-based approach.

---

### 2.5 CRDTs

#### Automerge / Yjs

**Status**: ✅ Complete

**Model**: Conflict-free replicated data types

**Details**:
- Data structures designed to merge automatically
- No conflicts possible (mathematically proven)
- Eventually consistent with strong guarantees
- Works offline, syncs when connected

**Common CRDTs**:
| Type | Use | Merge Rule |
|------|-----|------------|
| G-Counter | Increment-only counter | Sum of node counts |
| LWW-Register | Single value | Latest timestamp wins |
| OR-Set | Add/remove set | Adds beat removes |
| RGA | Text/array | Timestamp-based interleave |

**Assessment**: CRDTs eliminate conflicts by design. Limited to specific data structures. Automerge makes this practical for JSON-like documents. Could be used for specific high-conflict paths.

---

### 2.6 NATS JetStream

#### Key-Value Store

**Status**: ✅ Complete

**Details**:
- Built on JetStream streams
- Revision-based updates (CAS)
- Watch for real-time updates
- TTL support
- Bucket-level configuration

```go
// Create (fails if exists) - perfect for locks
kv.Create("lock/resource", data)

// Update with CAS
entry, _ := kv.Get("key")
kv.Update("key", newData, entry.Revision)
```

**Assessment**: Provides CAS primitives needed for coordination. Watch API enables real-time sync. Natural fit for "fast" tier.

---

#### Streams

**Status**: ✅ Complete

**Details**:
- Append-only ordered log
- Consumer groups for load balancing
- Replay from any position
- Retention policies (time, size, count)

**Assessment**: Good for append-only data (comments, audit logs). Ordering guarantees valuable for event-driven patterns.

---

#### Object Store

**Status**: ✅ Complete

**Details**:
- Large object storage built on streams
- Chunking for large files
- Content-addressed optional
- Watch for changes

**Assessment**: Natural fit for "blob" tier. Handles large files that don't belong in KV or Git.

---

## 3. Design Space Analysis

### 3.1 The Consistency Spectrum

From least to most structured:

```
UNSTRUCTURED                                              STRUCTURED
SIMPLE                                                    COMPLEX
     │                                                         │
     ▼                                                         ▼
┌─────────┬──────────┬──────────┬──────────┬──────────┬───────────┐
│ Pure    │ File +   │ File +   │ Schema + │ Write    │ Full      │
│ File    │ Conflict │ CAS for  │ API      │ Ahead    │ Event     │
│ Sync    │ Detection│ Critical │ Writes   │ Log      │ Sourcing  │
│         │          │ Ops      │          │          │           │
└─────────┴──────────┴──────────┴──────────┴──────────┴───────────┘
     │         │          │          │          │           │
 Dropbox  Syncthing  Firebase   Firestore   Datomic    Full CQRS
```

### 3.2 Approach 1: Pure File Sync

**Description**: Files sync automatically, last-write-wins or conflict files.

**Implementation**:
```
Local file change → Daemon detects → Sync to remote → Other nodes receive
```

**Characteristics**:
- ✅ Dead simple - any tool works
- ✅ No API layer needed
- ✅ Works offline
- ❌ No consistency guarantees
- ❌ Duplicate state possible (both think they claimed)
- ❌ Orphan references (claim → deleted issue)

**Best for**: Low-stakes data, human-resolved conflicts, simple deployments.

---

### 3.3 Approach 2: File Sync + Conflict Detection

**Description**: Files include version metadata, conflicts detected and preserved.

**Implementation**:
```yaml
# Each file has embedded version info
_meta:
  revision: 3
  vector_clock: { node-a: 2, node-b: 1 }
  modified_at: 2026-01-20T10:30:00Z

# Actual data
status: active
owner: agent-123
```

**Conflict handling**:
```
file.yml                    # Winner
file.yml.conflict-20260120  # Loser (preserved)
```

**Characteristics**:
- ✅ Conflicts visible, not silently lost
- ✅ Still simple file interface
- ✅ Can build application-level resolution
- ❌ Conflicts still happen (detected, not prevented)
- ❌ Conflict files accumulate

**Best for**: When conflicts are rare but must not be lost.

---

### 3.4 Approach 3: Hybrid - Simple Sync + CAS for Critical Ops (Firebase Model)

**Description**: Most operations use simple file writes. Critical operations (claims, locks) use CAS through an API.

**Implementation**:
```typescript
// Non-critical: direct file write
await writeFile('status/node-1.yml', { online: true });

// Critical: CAS operation
async function claimResource(id: string): Promise<boolean> {
  try {
    await kv.create(`locks/${id}`, { owner: myId });  // Fails if exists
    await writeFile(`locks/${id}.yml`, { owner: myId });  // Local copy
    return true;
  } catch (e) {
    if (e.code === 'KEY_EXISTS') return false;
    throw e;
  }
}
```

**Characteristics**:
- ✅ Simple for 90% of operations
- ✅ Strong guarantees where needed
- ✅ Files still readable by any tool
- ⚠️ Two code paths (file write vs API)
- ⚠️ Must classify which ops need CAS
- ❌ Critical ops need network (no offline claiming)

**Best for**: Mixed workloads with specific critical operations.

---

### 3.5 Approach 4: Schema-Validated Writes via API, Direct Reads

**Description**: All writes go through API (validates schema, checks integrity). Files readable directly.

**Implementation**:
```typescript
// Write API
async function writeIssue(issue: Issue) {
  // 1. Validate schema
  IssueSchema.parse(issue);

  // 2. Check referential integrity
  if (issue.parent && !await issueExists(issue.parent)) {
    throw new Error('Parent issue not found');
  }

  // 3. Check business rules
  if (issue.status === 'closed' && !issue.resolution) {
    throw new Error('Closed issues need resolution');
  }

  // 4. Write file
  await atomicWrite(`issues/${issue.id}.yml`, serialize(issue));
}

// Read - direct file access
const issue = yaml.parse(readFileSync('issues/is-123.yml'));
```

**Characteristics**:
- ✅ Structural integrity guaranteed
- ✅ Business rules enforced
- ✅ Direct file reads for debugging/interop
- ⚠️ All writes must use API
- ⚠️ Distributed writes still race (need coordination)
- ❌ More code to maintain

**Best for**: Structured data with integrity constraints.

---

### 3.6 Approach 5: Write-Ahead Log with File Materialization

**Description**: All writes logged to ordered stream first, then materialized to files.

**Implementation**:
```typescript
// Write goes through log
async function claimIssue(issueId: string, agentId: string) {
  await stream.publish('operations', {
    type: 'claim',
    issueId,
    agentId,
    preconditions: [{ path: `claims/${issueId}`, exists: false }],
  });
}

// Subscriber materializes to files
stream.subscribe('operations', async (op) => {
  // Check preconditions
  if (!checkPreconditions(op.preconditions)) {
    await logConflict(op);
    return;
  }

  // Materialize to file
  await writeFile(op.path, op.data);
});
```

**Characteristics**:
- ✅ Strong ordering guarantees
- ✅ Perfect audit trail
- ✅ Multi-file transactions possible
- ⚠️ Every write has log latency
- ⚠️ Log is ordering bottleneck
- ❌ More complex
- ❌ Agents can't bypass log

**Best for**: When ordering is critical, audit trail required.

---

### 3.7 Approach 6: Full Event Sourcing

**Description**: Only events stored. State derived by replaying events.

**Implementation**:
```typescript
// Events (immutable facts)
interface IssueClaimed {
  type: 'IssueClaimed';
  issueId: string;
  agentId: string;
  timestamp: number;
}

// Command handler
async function handleClaim(cmd: ClaimCommand) {
  const state = await rebuildState(cmd.issueId);  // Replay events

  if (state.claimed) {
    throw new Error('Already claimed');
  }

  await eventStore.append({ type: 'IssueClaimed', ... });
}

// Projection materializes to files
eventStore.subscribe(event => {
  if (event.type === 'IssueClaimed') {
    writeFile(`claims/${event.issueId}.yml`, { agent: event.agentId });
  }
});
```

**Characteristics**:
- ✅ Perfect consistency (events are truth)
- ✅ Complete audit trail forever
- ✅ Time travel (state at any point)
- ❌ Significant complexity
- ❌ Events forever (storage growth)
- ❌ Eventual consistency for projections
- ❌ Overkill for most cases

**Best for**: Complex domains, compliance requirements, debugging needs.

---

## 4. Comparative Analysis

### 4.1 Approach Comparison Matrix

| Criteria | Pure Sync | +Conflict Detect | +CAS Critical | Schema API | WAL | Event Source |
|----------|-----------|------------------|---------------|------------|-----|--------------|
| Simplicity | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★☆☆☆☆ |
| Consistency | ★☆☆☆☆ | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Performance | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ |
| Offline | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| Auditability | ★☆☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| Debuggability | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |

### 4.2 Decision Factors

**Choose simpler approaches when**:
- Conflicts are rare and acceptable
- Offline-first is critical
- Team lacks distributed systems expertise
- Fast iteration more important than guarantees

**Choose stronger consistency when**:
- Duplicate state is unacceptable (claims, locks)
- Ordering matters (transactions, audit)
- Data integrity is critical
- Compliance requires audit trail

---

## 5. Proposed Architecture: Policy-Based Tiered Sync

### 5.1 Core Concept

Rather than choosing one approach, **use directory paths to determine sync policy**:

```
sync-root/
├── .syncfs/
│   ├── config.yml       # Global config
│   └── policies.yml     # Per-path policies
├── durable/             # Git-backed, merge on conflict
├── fast/                # NATS KV-backed
│   ├── critical/        # CAS required
│   └── casual/          # LWW acceptable
└── blobs/               # Object store-backed
```

### 5.2 Policy Configuration

```yaml
# .syncfs/policies.yml
policies:
  # Git tier - durable, merge-based
  - pattern: "durable/**"
    tier: git
    consistency: merge
    merge_rules:
      id: immutable
      title: lww
      labels: union
      updated_at: max

  # Fast tier - critical operations need CAS
  - pattern: "fast/claims/**"
    tier: nats-kv
    consistency: cas-create
    ttl: 300  # 5 min timeout

  # Fast tier - casual operations use LWW
  - pattern: "fast/status/**"
    tier: nats-kv
    consistency: lww
    ttl: 30

  # Fast tier - append-only for logs
  - pattern: "fast/messages/**"
    tier: nats-stream
    consistency: append
    retention:
      max_age_days: 30

  # Blob tier - content-addressed
  - pattern: "blobs/**"
    tier: object-store
    consistency: content-addressed
```

### 5.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Application (reads/writes files)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│  Local Filesystem                                               │
│  sync-root/{durable,fast,blobs}/**                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ file watches
┌────────────────────────────┼────────────────────────────────────┐
│  Sync Daemon                                                    │
│  ┌─────────────┬─────────────┬─────────────┐                   │
│  │ Policy      │ Conflict    │ File        │                   │
│  │ Engine      │ Resolution  │ Watcher     │                   │
│  └─────────────┴─────────────┴─────────────┘                   │
│  ┌─────────────┬─────────────┬─────────────┐                   │
│  │ Git         │ NATS        │ Blob        │                   │
│  │ Adapter     │ Adapter     │ Adapter     │                   │
│  └─────────────┴─────────────┴─────────────┘                   │
└────────┬────────────────┬────────────────┬──────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐     ┌──────────┐     ┌──────────┐
    │   Git   │     │   NATS   │     │  Object  │
    │ Remote  │     │ Cluster  │     │  Store   │
    └─────────┘     └──────────┘     └──────────┘
```

### 5.4 Daemon Responsibilities

1. **File Watching**: Detect local changes (inotify/FSEvents/kqueue)
2. **Policy Resolution**: Map path to tier and consistency mode
3. **Validation**: Optional schema validation on write
4. **Conflict Resolution**: Apply configured strategy
5. **Remote Sync**: Push to appropriate backend
6. **Remote Subscription**: Pull changes from backend

### 5.5 Consistency Mode Implementations

| Mode | Implementation |
|------|----------------|
| `lww` | Compare timestamps, keep later |
| `cas` | NATS KV update with revision |
| `cas-create` | NATS KV create (fails if exists) |
| `merge` | Field-level three-way merge |
| `append` | NATS stream publish |
| `content-addressed` | Hash-based key, immutable |

---

## 6. Open Research Questions

### 6.1 Abstraction Boundary

**Question**: Where should domain logic live - in the sync layer or application?

**Options**:
- Sync layer is pure file sync, application handles all logic
- Sync layer validates schemas, application handles business rules
- Sync layer enforces referential integrity

**Why it matters**: Affects complexity distribution, reusability, debugging.

---

### 6.2 Conflict Resolution Extensibility

**Question**: Should applications provide custom merge functions?

**Options**:
- Fixed set of merge strategies (LWW, union, max, etc.)
- Pluggable merge functions (JavaScript/WASM)
- CRDT-based merge for specific paths

**Why it matters**: Custom merge enables domain-specific resolution but adds complexity.

---

### 6.3 Offline CAS Operations

**Question**: How to handle CAS operations when offline?

**Options**:
- Queue and retry (may fail on reconnect)
- Optimistic UI with rollback
- Degrade to LWW offline
- Block critical operations offline

**Why it matters**: Offline capability vs consistency tradeoff.

---

### 6.4 Schema Evolution

**Question**: How to handle schema changes over time?

**Options**:
- Additive only (never remove fields)
- Version field with migration
- Transform on read

**Why it matters**: Distributed nodes may have different versions.

---

### 6.5 FUSE vs Daemon

**Question**: Should this be a FUSE filesystem or a userspace daemon?

**Options**:
- FUSE: True filesystem semantics, any application works
- Daemon: Simpler, cross-platform, explicit API for CAS

**Why it matters**: FUSE is powerful but platform-specific and complex.

---

## 7. Recommendations

### 7.1 Summary

For a practical sync layer, we recommend the **Firebase-inspired hybrid model**:

1. **Default to simple file sync** (LWW) for most paths
2. **CAS operations available** for critical paths via library API
3. **Policy-based configuration** determines behavior per path
4. **Three-tier storage**: Git for durable, NATS for fast, Object Store for blobs

### 7.2 Rationale

- **Simplicity**: Applications mostly just read/write files
- **Consistency where needed**: CAS prevents duplicate claims
- **Flexibility**: Policy config adapts to different use cases
- **Debuggability**: Files are inspectable, behavior is predictable

### 7.3 Alternative Approaches

**Full Event Sourcing**: If audit trail and time-travel are critical requirements, consider event sourcing. Accept the complexity cost.

**Pure File Sync**: If consistency doesn't matter (human-resolved conflicts OK), skip the complexity of CAS. Use Syncthing or similar.

**Schema-Heavy**: If data integrity is paramount and writes are infrequent, validate everything through API. Accept the coupling cost.

---

## 8. References

### Systems Documentation
- [Firebase Realtime Database](https://firebase.google.com/docs/database/)
- [CouchDB Replication](https://docs.couchdb.org/en/stable/replication/)
- [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- [etcd](https://etcd.io/docs/)
- [Syncthing](https://docs.syncthing.net/)
- [Dropbox Sync Engine](https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine)

### Academic
- Brewer, "Towards Robust Distributed Systems" (CAP Theorem, 2000)
- Shapiro et al., "Conflict-free Replicated Data Types" (2011)
- Lamport, "Time, Clocks, and the Ordering of Events" (1978)

### Related Work in This Repository
- [NATS FS Coordination Layer](../nats-fs-coordination-layer.md)
- [Entity Binding Model](../entity-binding-model.md)
- [Distributed File Sync Consistency](../distributed-file-sync-consistency.md)

---

## Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **CAS** | Compare-and-swap: atomic update only if current value matches expected |
| **LWW** | Last-write-wins: later timestamp wins conflicts |
| **CRDT** | Conflict-free replicated data type: mathematically merge-able |
| **Vector Clock** | Causality tracking via per-node counters |
| **WAL** | Write-ahead log: log changes before applying |
| **Materialized View** | Derived state computed from source data |

### Appendix B: TBD Use Case Details

```yaml
# Example TBD sync configuration
policies:
  # Issues - durable in Git
  - pattern: "data-sync/issues/**"
    tier: git
    consistency: merge
    merge_rules:
      id: immutable
      type: immutable
      title: lww
      status: lww
      labels: union
      dependencies: union
      version: max

  # Agent sessions - ephemeral with TTL
  - pattern: "live/agents/**"
    tier: nats-kv
    consistency: lww
    ttl: 30

  # Claims - must use CAS to prevent duplicates
  - pattern: "live/claims/**"
    tier: nats-kv
    consistency: cas-create
    ttl: 300

  # Comment threads - append-only
  - pattern: "live/threads/**"
    tier: nats-stream
    consistency: append
    retention:
      max_age_days: 30

  # Large transcripts - content-addressed blobs
  - pattern: "blobs/**"
    tier: object-store
    consistency: content-addressed
```

### Appendix C: NATS Configuration Example

```yaml
# .syncfs/config.yml
nats:
  url: nats://localhost:4222
  credentials: ~/.nats/creds

  kv:
    bucket: syncfs-fast
    replicas: 3

  streams:
    - name: syncfs-messages
      subjects: ["syncfs.messages.>"]
      retention: limits
      max_age: 30d

  object_store:
    bucket: syncfs-blobs
```
