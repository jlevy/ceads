# Tbd Design: Distributed Systems Review

**Reviewer:** Claude (Opus 4.5)

**Date:** January 2025

**Document Reviewed:** [tbd-design.md](tbd-design.md)

**Last Updated:** January 2025 (recommendations reviewed; complex items deferred to
Optional Enhancements appendix)

* * *

## Executive Summary

The Tbd design makes a clear and correct choice: **Git is the source of truth**. This is
the right foundation.
However, several areas need deeper specification, particularly around the Bridge Layer’s
consistency model, clock synchronization, and claim coordination semantics.

This review identifies issues ranging from critical (will cause data loss) to
nice-to-have (future improvements), with actionable recommendations for each.

### Directory Structure Reference

The design uses a split directory structure:

**On main branch:**

```
.tbd/
├── config.yml              # Project configuration (tracked)
├── .gitignore              # Contains just "local/" (tracked)
└── local/                  # All gitignored files:
    ├── nodes/              # Private workspace (lo-*.json)
    ├── cache/              # Bridge cache
    │   ├── outbound/       # Queue: messages to send
    │   ├── inbound/        # Buffer: recent messages
    │   ├── dead_letter/    # Failed after max_attempts
    │   └── state.json      # Connection state
    ├── daemon.sock         # Daemon socket
    ├── daemon.pid          # Daemon PID
    └── daemon.log          # Daemon log
```

**On tbd-sync branch:**

```
.tbd-sync/
├── nodes/                  # Synced entities (is-*, ag-*, ms-*)
│   ├── issues/
│   ├── agents/
│   └── messages/
├── attic/                  # Conflict archive
│   ├── conflicts/
│   └── orphans/
└── meta.json               # Runtime metadata
```

This separation ensures synced data never causes merge conflicts on working branches.

* * *

## Table of Contents

1. [Source of Truth: Git vs Bridge](#1-source-of-truth-git-vs-bridge)

2. [Clock Synchronization and LWW: A Critical Flaw](#2-clock-synchronization-and-lww-a-critical-flaw)

3. [Claim Coordination: Race Conditions](#3-claim-coordination-race-conditions)

4. [Bridge Layer Consistency Guarantees](#4-bridge-layer-consistency-guarantees)

5. [GitHub Issues Bridge: Specific Concerns](#5-github-issues-bridge-specific-concerns)

6. [Message Ordering and Causality](#6-message-ordering-and-causality)

7. [Offline-First Cache: Missing Guarantees](#7-offline-first-cache-missing-guarantees)

8. [Sequence Array Merge: Open Question Analysis](#8-sequence-array-merge-open-question-analysis)

9. [Summary of Recommendations](#9-summary-of-recommendations)

10. [Alternative Architecture: Event Sourcing](#10-alternative-architecture-event-sourcing)

11. [Additional Issues (Second Pass Review)](#11-additional-issues-second-pass-review)

12. [Operational Plan: Critical and Important Edits](#12-operational-plan-critical-and-important-edits)

* * *

## 1. Source of Truth: Git vs Bridge

### Current Design

The document states (line 1749):

> “Git remains truth: Bridges are views/caches; git is always authoritative”

**This is the correct choice.** Here’s why:

| Approach | Pros | Cons |
| --- | --- | --- |
| **Git as truth** (current) | Durable, auditable, works offline, no vendor lock-in | Higher latency for coordination |
| **Bridge as truth** | Sub-second coordination, real-time updates | Single point of failure, requires connectivity, data loss risk |

### Recommendation: Keep Git as Source of Truth

The design correctly positions bridges as **eventually consistent caches** with Git as
the durable log. However, the document needs to be more explicit about what “Git wins”
means in practice.

**Add explicit conflict resolution rules for bridge sync:**

```
Bridge Sync Conflict Resolution:
1. Compare Git entity version vs Bridge entity metadata.synced_version
2. If Git version > synced_version: Git wins (bridge is stale)
3. If Git version == synced_version but bridge changed: Bridge change accepted, bump Git version
4. If Git version > synced_version AND bridge changed: CONFLICT
   → Git wins, bridge change preserved in attic with bridge_source metadata
```

* * *

## 2. Clock Synchronization and LWW: A Critical Flaw

### The Problem

The merge algorithm (section 3.6 of the design) relies heavily on `updated_at`
timestamps:

```typescript
// Line 1011 of design doc
merged[field] = local.updated_at >= remote.updated_at ? localVal : remoteVal;
```

**This is a classic distributed systems anti-pattern.** Wall-clock time cannot be
trusted:

- NTP drift can be 10-100ms typically, but seconds or minutes in edge cases

- A machine with a fast clock always “wins” LWW conflicts

- Containerized environments often have inconsistent clocks

- Cloud-hosted IDEs may have different clock sources

### Real-World Scenario

```
Machine A (clock: 10:00:00): Updates issue title to "Fix auth"
Machine B (clock: 10:00:05 - 5 seconds fast): Updates title to "Refactor auth"
Machine A syncs first, pushes version 3
Machine B syncs, detects conflict (same version, different hash)
  → B's update "wins" because B's timestamp is later
  → User on Machine A loses their change silently
```

### Recommendation: Hybrid Logical Clocks (HLC)

Replace wall-clock timestamps with **Hybrid Logical Clocks** for conflict resolution:

```typescript
const HybridTimestamp = z.object({
  wall: z.string().datetime(), // Wall clock (informational)
  logical: z.number().int(), // Logical counter
  node_id: z.string(), // Node identifier for tiebreaking
});

// BaseEntity update
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp, // Wall clock for display
  updated_at: Timestamp, // Wall clock for display
  hlc: HybridTimestamp, // For conflict resolution
});
```

**HLC Merge Rule:**

```typescript
function hlcCompare(a: HybridTimestamp, b: HybridTimestamp): number {
  if (a.logical !== b.logical) return a.logical - b.logical;
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  return a.node_id.localeCompare(b.node_id); // Deterministic tiebreak
}
```

**Benefits:**

- Provides causal ordering without synchronized clocks

- Deterministic: same inputs always produce same winner

- `wall` field still available for human-readable display

**Reference:**
[Kulkarni et al., “Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases”](https://cse.buffalo.edu/tech-reports/2014-04.pdf)

* * *

## 3. Claim Coordination: Race Conditions

### The Problem

Claims are critical for multi-agent coordination, but the current design has significant
race windows:

**Without Daemon (section 4.5 of design):**

```
Agent A: tbd agent claim cd-a1b2
Agent B: tbd agent claim cd-a1b2  (simultaneously)
Both read: issue.assignee is null
Both write: issue.assignee = self
Both sync to git
→ One wins via LWW, but both agents may have started work
```

**With Daemon (local only):**

The daemon provides atomic claims locally, but cross-machine claims still race through
Git.

### Git Sync Latency Problem

Even with frequent sync (sub-minute), there’s a window where:

1. Agent A claims issue, syncs

2. Agent B claims same issue before A’s sync propagates

3. Both believe they own the claim

### Recommendation: Lease-Based Claims with Bridge Coordination

**For single-machine (daemon mode):** Current design is adequate.

**For multi-machine coordination:** Use the Bridge Layer for real-time claim
coordination:

```typescript
const Claim = z.object({
  issue_id: EntityId,
  agent_id: EntityId,
  claimed_at: Timestamp,
  lease_expires: Timestamp, // TTL for the claim
  lease_sequence: z.number(), // Monotonic, prevents ABA problem
});
```

**Claim Protocol:**

```
1. Agent requests claim via Bridge (if available)
2. Bridge performs atomic compare-and-swap
3. On success: Bridge returns lease_sequence
4. Agent must renew lease before expiry
5. Git sync records claims durably, but Bridge provides real-time coordination
6. If Bridge unavailable: Fall back to git-based claiming with advisory warning
```

**Add to IssueSchema:**

```typescript
const IssueSchema = BaseEntity.extend({
  // ... existing fields ...
  claim: z
    .object({
      agent_id: EntityId,
      lease_sequence: z.number(),
      lease_expires: Timestamp,
    })
    .optional(),
});
```

This separates the **coordination concern** (real-time, through Bridge) from the
**durability concern** (Git).

* * *

## 4. Bridge Layer Consistency Guarantees

### What’s Missing

The document describes the Bridge Layer architecture but doesn’t define explicit
consistency guarantees.
For a distributed system, these must be explicit.

### Recommended Consistency Model Definition

Add a new section to the design doc: **5.2.1 Consistency Guarantees**

```markdown
### Bridge Consistency Model

**Read-Your-Writes**: After an agent writes via Bridge, subsequent reads
from the same agent will reflect that write.

**Eventual Consistency**: All agents will eventually see the same state.
Convergence time depends on sync frequency and network conditions.

**No Strong Consistency**: Tbd does NOT provide linearizability or
serializable transactions. Concurrent writes to the same entity may
require conflict resolution.

**Monotonic Reads**: Once an agent sees version N of an entity, it will
never see version < N (within the same session).

**Conflict Preservation**: No write is ever lost. Conflict losers are
preserved in the attic.
```

### Latency Expectations

Define expected latencies for different modes:

| Mode | Operation | Expected Latency |
| --- | --- | --- |
| File-only | Read/Write | <10ms |
| Git sync | Pull/Push | 1-30 seconds |
| Bridge (GitHub) | Propagation | 1-5 seconds (webhook) |
| Bridge (Native) | Propagation | <100ms |
| Bridge (Slack) | Message delivery | <1 second |

* * *

## 5. GitHub Issues Bridge: Specific Concerns

### Field Mapping Conflicts

The document shows GitHub ↔ Tbd field mapping (section 5.3), but doesn’t address:

**Problem:** GitHub Issues have their own versioning (`updated_at`, ETags).
When both systems change:

```
Tbd: status → in_progress (version 5)
GitHub: User adds comment, closes issue via GitHub UI
Sync runs:
  → Which state wins?
  → Is the GitHub comment captured?
  → Is the status change from GitHub honored?
```

### Recommendation: Define Sync Direction Per-Field

```typescript
const GitHubBridgeConfig = z.object({
  field_sync: z.object({
    title: z.enum(['tbd_wins', 'github_wins', 'lww']).default('lww'),
    description: z.enum(['tbd_wins', 'github_wins', 'lww']).default('tbd_wins'),
    status: z.enum(['tbd_wins', 'github_wins', 'lww']).default('lww'),
    labels: z.enum(['union', 'tbd_wins', 'github_wins']).default('union'),
    comments: z.literal('union'), // Always merge comments from both
  }),
});
```

### GitHub Rate Limits

Not mentioned: GitHub API has rate limits (5,000 requests/hour for authenticated
requests). With many agents syncing frequently, this becomes a concern.

**Add:** Rate limit handling, exponential backoff, and request batching.

* * *

## 6. Message Ordering and Causality

### Current Design

Messages sort by `created_at`:

```typescript
// Line 594 of design doc
messages.filter((m) => m.in_reply_to === 'is-a1b2');
// Implicitly sorted by created_at
```

### The Problem

With clock skew, messages can appear out of order:

```
Agent A (slow clock): Posts "I'll fix this" at 10:00:00
Agent B (fast clock): Posts "Already fixed" at 10:00:05 (actual time: 10:00:00)
UI shows: "Already fixed" then "I'll fix this"
```

### Recommendation: Causal Ordering for Messages

For the threaded case (`in_reply_to` chains), enforce causal ordering:

```typescript
const MessageSchema = BaseEntity.extend({
  // ... existing fields ...

  // Causal ordering
  causal_deps: z.array(EntityId).default([]), // Messages this depends on
  lamport_time: z.number().int(), // Logical timestamp
});
```

**Ordering rule:** A message M can only be displayed after all messages in
`M.causal_deps` are displayed.

For simple comment threads (no replies to replies), the current design is probably
acceptable with a note that ordering is best-effort.

* * *

## 7. Offline-First Cache: Missing Guarantees

### Current Design (Section 5.8 of design doc)

```
cache/outbound/  → Queue messages until bridge confirms
cache/inbound/   → Buffer recent messages with TTL
```

### Missing Specifications

**1. Retry Policy**

What happens after repeated failures?

```typescript
const RetryPolicy = z.object({
  max_attempts: z.number().default(10),
  initial_backoff_ms: z.number().default(1000),
  max_backoff_ms: z.number().default(300000), // 5 minutes
  backoff_multiplier: z.number().default(2),
});
```

**2. Dead Letter Queue**

After max_attempts, where do messages go?

```
cache/dead_letter/  → Messages that failed delivery after max attempts
```

**3. Idempotency Keys**

Prevent duplicate delivery:

```typescript
const OutboundMessage = z.object({
  idempotency_key: z.string().uuid(), // Unique per message attempt
  message: MessageSchema,
  created_at: Timestamp,
  attempts: z.number().default(0),
  last_attempt: Timestamp.optional(),
  last_error: z.string().optional(),
});
```

**4. Order Guarantees**

Is FIFO required? The document says “FIFO” but doesn’t specify behavior on failure:

- If message 2 succeeds but message 1 fails, is message 2 delivered?

- Or does message 1 block the queue?

* * *

## 8. Sequence Array Merge: Open Question Analysis

The document asks about merging concurrent `sequence` array changes (Question 3 in
Appendix 7.2).

### Analysis of Options

| Option | Behavior | Pros | Cons |
| --- | --- | --- | --- |
| LWW with attic | Later timestamp wins | Simple, recoverable | May lose intentional reordering |
| OT | Transform concurrent ops | Preserves intent | Complex implementation |
| Union + sort | Merge and re-sort | No data loss | Order may not match either intent |
| Conflict marker | User resolves | Explicit | Blocks progress |

### Recommendation: LWW with Enhanced Attic

LWW is the right choice for v1, but enhance the attic entry:

```typescript
const SequenceAtticEntry = AtticEntrySchema.extend({
  field: z.literal('sequence'),
  lost_value: z.array(EntityId),

  // Enhanced context for sequence conflicts
  sequence_context: z
    .object({
      added_items: z.array(EntityId), // Items winner added
      removed_items: z.array(EntityId), // Items winner removed
      reordered: z.boolean(), // Was this a reorder?
    })
    .optional(),
});
```

This makes attic recovery more actionable: users can see what changed and manually
reconcile if needed.

* * *

## 9. Summary of Recommendations

### v1 Design Decision: Simplicity First

After review, these recommendations are **deferred to Optional Enhancements** (see
[Appendix 7.7](tbd-design.md#77-optional-enhancements) in the design doc).
The v1 design prioritizes simplicity, with these enhancements available if specific
problems arise in practice.

**Rationale:**

- Simple `version + updated_at` LWW works for most use cases (NTP keeps clocks synced)

- The attic preserves all conflict losers, so no data is ever lost

- Advisory claims are sufficient when racing is rare

- Bridge Layer details can be designed when Bridge Layer is built

### Deferred to Optional Enhancements

- [ ] **HLC for conflict resolution** — Add if clock skew causes frequent wrong-winner
  conflicts. See [Section 2](#2-clock-synchronization-and-lww-a-critical-flaw).
  **DEFERRED:** Documented in Appendix 7.7.1.

- [ ] **Lease-based claims** — Add if duplicate work becomes a problem.
  See [Section 3](#3-claim-coordination-race-conditions).
  **DEFERRED:** Documented in Appendix 7.7.2.

- [ ] **Idempotency keys and dead letter queue** — Add when Bridge Layer is built.
  See [Section 7](#7-offline-first-cache-missing-guarantees).
  **DEFERRED:** Documented in Appendix 7.7.3.

- [ ] **Bridge conflict resolution details** — Design when Bridge Layer is built.
  See [Section 1](#1-source-of-truth-git-vs-bridge).
  **DEFERRED:** Documented in Appendix 7.7.4.

- [ ] **Webhook security** — Implement when Bridge Layer is built.
  **DEFERRED:** Documented in Appendix 7.7.5.

### Implemented in v1

- [x] **Basic consistency model** — Eventual consistency, Git as truth, attic for
  conflicts. Documented in Bridge Architecture section.

- [x] **Schema migration strategy** — Forward/backward compatibility, version tracking.
  Added as Section 2.6.

- [x] **ID generation specification** — Crypto-random, collision handling.
  Expanded in Section 2.4.

### Nice to Have (v2 Considerations)

These would improve the system but aren’t blocking for v1:

- [ ] **Causal ordering for messages** — Lamport timestamps for threaded conversations
  to handle clock skew.
  See [Section 6](#6-message-ordering-and-causality).

- [ ] **CRDT consideration for labels/dependencies** — More principled merge for
  set-like fields (G-Set or 2P-Set).
  See distributed systems references in design doc.

- [ ] **Enhanced sequence merge context in attic** — Better attic entries for recovery
  when sequence arrays conflict.
  See [Section 8](#8-sequence-array-merge-open-question-analysis).

- [ ] **GitHub rate limit handling** — Add exponential backoff and request batching for
  GitHub API calls.

* * *

## 10. Alternative Architecture: Event Sourcing

One alternative worth considering for future evolution: **Event Sourcing** instead of
state-based sync.

### Current Design (State-Based)

```
Entity: { version: 5, title: "Fix bug", status: "open" }
Sync: Compare states, merge conflicts
```

### Alternative (Event-Based)

```
Events:
  [v1] IssueCreated { title: "Fix bug" }
  [v2] StatusChanged { from: "open", to: "in_progress" }
  [v3] TitleChanged { from: "Fix bug", to: "Fix auth bug" }

Sync: Replicate events, derive state
```

**Benefits:**

- No merge conflicts on concurrent non-overlapping changes

- Complete audit trail built-in

- Events are immutable, append-only

- Natural fit for Git (append-only log)

**Tradeoffs:**

- More complex implementation

- Event log grows unbounded (needs compaction)

- Requires careful event schema design

This is a significant architectural change that may not be appropriate for v1, but worth
considering for future evolution if merge conflicts become a pain point.

* * *

## Conclusion

The Tbd design is well-thought-out and makes correct foundational choices:

- Git as source of truth ✓

- Schema-agnostic sync ✓

- Layered architecture ✓

- Optional complexity (daemon, bridges) ✓

- No data loss philosophy (attic) ✓

The main areas needing work are:

1. **Clock-independent conflict resolution** (HLC instead of wall-clock LWW)

2. **Explicit consistency guarantees** for the Bridge Layer

3. **Real-time claim coordination** for multi-agent scenarios

4. **Offline-first reliability** (idempotency, retry policy, dead letters)

These are tractable problems with known solutions from distributed systems literature.
The design provides a solid foundation to build on.

* * *

## 11. Additional Issues (Second Pass Review)

The following issues were identified in a second review pass:

| Issue | Severity | Summary |
| --- | --- | --- |
| **11.1** ID Generation | Important | Hash collision risk; need crypto-random + 6 chars |
| **11.2** Partial Sync Failures | Important | No rollback/recovery strategy |
| **11.3** Multi-Entity Atomicity | Important | Operations spanning files can leave inconsistent state |
| **11.4** Schema Migration | Important | No strategy for cross-version sync |
| **11.5** Webhook Security | Important | No validation for GitHub/Slack webhooks |
| **11.6** Outbound Queue Crash Safety | Medium | Duplicate delivery risk (solved by idempotency) |
| **11.7** Reference Integrity During Sync | Medium | Soft references may be temporarily broken |

* * *

## 12. Operational Edit Plan

The full operational plan with step-by-step edit instructions has been extracted to a
separate document for easier tracking:

**→ [tbd-design-operational-plan.md](tbd-design-operational-plan.md)**

### Summary of Edits

**Phase 1 (Critical):**

- Edit 1.1: Replace LWW with Hybrid Logical Clocks

- Edit 1.2: Add Bridge Consistency Guarantees

- Edit 1.3: Add Idempotency Keys + Retry Policy

**Phase 2 (Important):**

- Edit 2.1: Add Lease-Based Claims

- Edit 2.2: Add GitHub Field-Level Sync Direction

- Edit 2.3: Add Retry Policy + Dead Letter Queue

- Edit 2.4: Add ID Generation Specification

- Edit 2.5: Add Schema Migration Strategy

- Edit 2.6: Add Webhook Security

**Phase 3:** Verification checklist for updating examples

* * *

## References

- [Hybrid Logical Clocks (Kulkarni et al.)](https://cse.buffalo.edu/tech-reports/2014-04.pdf)

- [CRDTs: Conflict-free Replicated Data Types](https://crdt.tech/)

- [Erta: Building Consistent Transactions with Inconsistent Replication](https://www.usenix.org/conference/osdi16/technical-sessions/presentation/li)

- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

- [Slack Request Verification](https://api.slack.com/authentication/verifying-requests-from-slack)

- Design doc references in Appendix 7.6
