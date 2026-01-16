# Tbd Design: Operational Edit Plan

**Source:** [tbd-distributed-systems-review.md](tbd-distributed-systems-review.md)

**Target:** [tbd-design.md](tbd-design.md)

**Status:** Revised - Complex items moved to Optional Enhancements appendix (Section
7.7)

> **Note:** After review, we decided to keep v1 simple.
> HLC, lease-based claims, and detailed Bridge specs are documented in Appendix 7.7 as
> optional enhancements to add if specific problems arise.
> The core design uses simple `updated_at` LWW with the attic preserving all conflict
> losers.

* * *

## Overview

This document provides a step-by-step implementation plan for all Critical and Important
items identified in the distributed systems review.
Work through these sequentially, checking off items as they are completed.

### Directory Structure Reference

All paths in this document use the current directory structure:

```
.tbd/                     # On main branch
├── config.yml              # Tracked
├── .gitignore              # Tracked (ignores "local/")
└── local/                  # All gitignored:
    ├── nodes/              # Private workspace (lo-*.json)
    ├── cache/              # Bridge cache
    │   ├── outbound/
    │   ├── inbound/
    │   ├── dead_letter/
    │   └── state.json
    └── daemon.*            # Daemon files

.tbd-sync/                # On tbd-sync branch
├── nodes/                  # Synced entities
├── attic/                  # Conflict archive
└── meta.json               # Runtime metadata
```

* * *

## Phase 1: Critical Issues (Must Address Before v1)

### Edit 1.1: Replace LWW Timestamps with Hybrid Logical Clocks

- [x] **Completed**

**Location:** Section 2.5.1 (Common Types) and Section 2.5.2 (BaseEntity)

**Current:**

```typescript
// Section 2.5.1
const Timestamp = z.string().datetime();

// Section 2.5.2
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,
});
```

**Replace with:**

```typescript
// Section 2.5.1 - Add after Timestamp definition
const Timestamp = z.string().datetime();

// Hybrid Logical Clock for conflict resolution
// See: https://cse.buffalo.edu/tech-reports/2014-04.pdf
const HybridTimestamp = z.object({
  wall: z.string().datetime(), // Wall clock (for display)
  logical: z.number().int(), // Lamport-style counter
  node: z.string(), // Node identifier for deterministic tiebreak
});

// Section 2.5.2 - Update BaseEntity
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp, // Wall clock for display
  updated_at: Timestamp, // Wall clock for display
  hlc: HybridTimestamp, // For merge conflict resolution
});
```

**Also update Section 3.6 (Merge Algorithm):**

**Current (lines ~1010-1012):**

```typescript
case 'lww':
  merged[field] = local.updated_at >= remote.updated_at
    ? localVal
    : remoteVal;
  break;
```

**Replace with:**

```typescript
case 'lww':
  merged[field] = hlcCompare(local.hlc, remote.hlc) >= 0
    ? localVal
    : remoteVal;
  break;

// Add helper function before mergeEntities:
function hlcCompare(a: HybridTimestamp, b: HybridTimestamp): number {
  // Compare logical counter first (causal ordering)
  if (a.logical !== b.logical) return a.logical - b.logical;
  // Tiebreak by wall clock (best effort)
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  // Final tiebreak by node ID (deterministic)
  return a.node.localeCompare(b.node);
}

// Add HLC update function:
function updateHlc(current: HybridTimestamp, nodeId: string): HybridTimestamp {
  const now = new Date().toISOString();
  return {
    wall: now,
    logical: now > current.wall ? current.logical + 1 : current.logical + 1,
    node: nodeId,
  };
}
```

* * *

### Edit 1.2: Add Bridge Consistency Guarantees

- [x] **Completed**

**Location:** Add new Section 5.2.1 after Section 5.2 (Bridge Architecture)

**Add:**

```markdown
### 5.2.1 Bridge Consistency Guarantees

Bridges provide eventually consistent views of Git state. The following guarantees apply:

#### Consistency Model

| Guarantee                 | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| **Read-Your-Writes**      | After writing via Bridge, same agent's reads reflect that write |
| **Eventual Consistency**  | All agents eventually see the same state                        |
| **Monotonic Reads**       | Once version N seen, never see version < N (same session)       |
| **Conflict Preservation** | No data ever lost; conflicts preserved in attic                 |

**Tbd does NOT provide:**

- Linearizability (global ordering)
- Serializable transactions
- Strong consistency

#### Latency Expectations

| Mode            | Operation        | Expected Latency      |
| --------------- | ---------------- | --------------------- |
| File-only       | Read/Write       | <10ms                 |
| Git sync        | Pull/Push        | 1-30 seconds          |
| Bridge (GitHub) | Propagation      | 1-5 seconds (webhook) |
| Bridge (Native) | Propagation      | <100ms                |
| Bridge (Slack)  | Message delivery | <1 second             |

#### Git vs Bridge Conflict Resolution

When Git and Bridge both have changes to the same entity:

1. Compare Git entity `version` vs Bridge metadata `synced_version`
2. If Git version > synced_version: **Git wins** (bridge is stale)
3. If Git version == synced_version AND bridge changed: **Bridge accepted**, bump Git version
4. If Git version > synced_version AND bridge changed: **CONFLICT**
   - Git wins
   - Bridge changes preserved in attic with `source: "bridge"` metadata
```

* * *

### Edit 1.3: Add Idempotency Keys to Outbound Queue

- [x] **Completed**

**Location:** Section 5.8 (Offline-First Architecture), update Cache Types and add
schema

**Current (Section 5.8, Cache State Schema around line 2273):**

```typescript
const CacheState = z.object({
  last_bridge_sync: Timestamp.optional(),
  connection_status: z.enum(['connected', 'disconnected', 'connecting']),
  retry_count: z.number().default(0),
  last_error: z.string().optional(),
  outbound_count: z.number().default(0),
});
```

**Add before CacheState:**

```typescript
// Outbound queue item with idempotency
const OutboundQueueItem = z.object({
  idempotency_key: z.string().uuid(), // Unique per send attempt
  entity_type: z.enum(['message', 'claim', 'release', 'update']),
  payload: z.unknown(), // Entity or operation data
  created_at: Timestamp,
  attempts: z.number().default(0),
  last_attempt_at: Timestamp.optional(),
  last_error: z.string().optional(),
  max_attempts: z.number().default(10),
});

// Retry policy configuration
const RetryPolicy = z.object({
  max_attempts: z.number().default(10),
  initial_backoff_ms: z.number().default(1000),
  max_backoff_ms: z.number().default(300000), // 5 minutes
  backoff_multiplier: z.number().default(2),
});
```

**Update CacheState:**

```typescript
const CacheState = z.object({
  last_bridge_sync: Timestamp.optional(),
  connection_status: z.enum(['connected', 'disconnected', 'connecting']),
  retry_policy: RetryPolicy.default({}),
  last_error: z.string().optional(),
  outbound_count: z.number().default(0),
  dead_letter_count: z.number().default(0), // Items that exceeded max_attempts
});
```

**Add to directory structure (Section 5.8):**

```
.tbd/local/cache/
├── outbound/              # Queue: items waiting to send
│   ├── {uuid}.json        # Pending items
│   └── {uuid}.delivered   # Confirmed, awaiting cleanup
├── inbound/               # Buffer: recent items from bridge
├── dead_letter/           # Failed after max_attempts
│   └── {uuid}.json
└── state.json
```

* * *

## Phase 2: Important Issues (Strong Recommendation)

### Edit 2.1: Add Lease-Based Claims

- [x] **Completed**

**Location:** Section 2.5.3 (IssueSchema), add claim field

**Current IssueSchema (around line 460):**

```typescript
const IssueSchema = BaseEntity.extend({
  // ... existing fields ...
  assignee: z.string().optional(),
  // ...
});
```

**Add after assignee:**

```typescript
  assignee: z.string().optional(),

  // Lease-based claim for coordination
  claim: z.object({
    agent_id: EntityId,
    claimed_at: Timestamp,
    lease_expires: Timestamp,       // TTL for the claim
    lease_sequence: z.number(),     // Monotonic, prevents ABA problem
  }).optional(),
```

**Add to Section 4.5 (Agent Commands), update Claim section:**

**Current:**

```bash
tbd agent claim <issue-id>
```

**Expand to:**

```bash
tbd agent claim <issue-id> [options]

Options:
  --ttl <seconds>         Lease duration (default: 3600 = 1 hour)
  --force                 Claim even if already claimed (steals claim)

# Lease renewal
tbd agent renew <issue-id> [options]

Options:
  --ttl <seconds>         New lease duration
```

**Add claim protocol documentation (new subsection under 4.5):**

```markdown
#### Claim Protocol

**Without Bridge (Git-only):**

1. Read issue, check if `claim` exists and `lease_expires > now`
2. If claimed by another agent: error (unless --force)
3. Write issue with new `claim` object, increment `lease_sequence`
4. Sync to propagate claim
5. Race condition window: sync latency (seconds to minutes)

**With Bridge (recommended for multi-agent):**

1. Request claim via Bridge (atomic compare-and-swap)
2. Bridge validates: no active lease OR force flag
3. Bridge updates lease, returns `lease_sequence`
4. Agent must renew before `lease_expires`
5. Git sync records claim durably
6. If Bridge unavailable: fall back to Git-only with warning

**Lease expiry:**

- Expired claims can be stolen by any agent
- `tbd ready` excludes issues with active (non-expired) claims
- Stale claims (agent inactive + expired lease) auto-release
```

* * *

### Edit 2.2: Add GitHub Field-Level Sync Direction

- [x] **Completed**

**Location:** Section 5.3 (GitHub Issues Bridge), add configuration schema

**Add after “Field Mapping” table:**

````markdown
#### Sync Direction Configuration

Each field can have a sync direction policy:

```typescript
const GitHubSyncDirection = z.enum([
  'tbd_wins', // Tbd overwrites GitHub
  'github_wins', // GitHub overwrites Tbd
  'lww', // Last-write-wins by timestamp
  'union', // Merge both (for arrays)
  'readonly', // Tbd reads from GitHub, never writes
]);

const GitHubBridgeConfig = z.object({
  enabled: z.boolean(),
  repo: z.string(), // "owner/repo"
  auto_promote: z.boolean().default(false),

  field_sync: z
    .object({
      title: GitHubSyncDirection.default('lww'),
      description: GitHubSyncDirection.default('tbd_wins'),
      status: GitHubSyncDirection.default('lww'),
      priority: GitHubSyncDirection.default('tbd_wins'),
      labels: GitHubSyncDirection.default('union'),
      assignee: GitHubSyncDirection.default('lww'),
      comments: z.literal('union'), // Always merge, never overwrite
    })
    .default({}),

  rate_limit: z
    .object({
      requests_per_hour: z.number().default(4000), // Leave buffer below 5000
      burst_size: z.number().default(100),
    })
    .default({}),
});
```
````

**Default behavior:**

- `title`, `status`, `assignee`: LWW (collaborative editing)
- `description`, `priority`: Tbd wins (agent is authority)
- `labels`: Union (both sources contribute)
- `comments`: Always merged, never deleted

#### Rate Limiting

GitHub API limits: 5,000 requests/hour (authenticated).

**Implementation:**

- Track request count in `.tbd/local/cache/state.json`
- Exponential backoff on 429 responses
- Batch operations where possible (GraphQL)
- Log warning at 80% of limit

````

---

### Edit 2.3: Add Retry Policy and Dead Letter Queue

- [x] **Completed**

**Location:** Section 5.8 (Offline-First Architecture)

**Add after "Message Flow" diagram:**
```markdown
#### Retry and Failure Handling

**Retry Policy:**
````

Attempt 1: immediate Attempt 2: 1 second delay Attempt 3: 2 seconds Attempt 4: 4 seconds
… Attempt N: min(initial \* 2^(N-1), max_backoff)

````

**After max_attempts exceeded:**
1. Move item from `.tbd/local/cache/outbound/` to `.tbd/local/cache/dead_letter/`
2. Increment `dead_letter_count` in `.tbd/local/cache/state.json`
3. Log error with full context
4. Item preserved indefinitely until manual intervention

**Dead letter recovery:**
```bash
# List dead letter items
tbd cache dead-letter list

# Retry a dead letter item
tbd cache dead-letter retry <idempotency-key>

# Discard a dead letter item
tbd cache dead-letter discard <idempotency-key>
````

**FIFO Ordering:**

- Outbound queue is FIFO within entity type
- If item N fails, items N+1 … are blocked for same entity
- Different entities can proceed independently
- This prevents out-of-order delivery for single entity

````

---

### Edit 2.4: Add ID Generation Specification

- [x] **Completed**

**Location:** Section 2.4 (ID Generation)

**Current:**
```markdown
Entity IDs follow a consistent pattern:

{prefix}-{hash}

- **Prefix**: 2-3 lowercase letters derived from directory name
- **Hash**: Lowercase alphanumeric, typically 4-8 characters
````

**Expand to:**

````markdown
Entity IDs follow a consistent pattern:

{prefix}-{hash}

- **Prefix**: 2 lowercase letters matching directory name (`is-`, `ag-`, `lo-`, `ms-`)
- **Hash**: 6 lowercase alphanumeric characters (base36)

#### ID Generation Algorithm

```typescript
import { randomBytes } from 'crypto';

function generateId(prefix: string): string {
  // 6 bytes = 48 bits of entropy ≈ 281 trillion possibilities
  const bytes = randomBytes(6);
  const hash = bytes.toString('base36').toLowerCase().slice(0, 6);
  return `${prefix}${hash}`;
}
```
````

**Properties:**

- **Cryptographically random**: No timestamp or content dependency
- **Collision probability**: ~1 in 2 billion per prefix at 50,000 entities
- **On collision**: Regenerate ID (detected by file-exists check on write)

**ID validation regex:**

```typescript
const EntityId = z.string().regex(/^[a-z]{2}-[a-z0-9]{6}$/);
```

````

---

### Edit 2.5: Add Schema Migration Strategy

- [x] **Completed**

**Location:** Add new Section 2.6 after Section 2.5 (Schemas)

**Add:**
```markdown
### 2.6 Schema Versioning and Migration

#### Version Tracking

Schema versions are tracked in `.tbd-sync/meta.json` (on the sync branch):

```json
{
  "schema_versions": [
    { "collection": "issues", "version": 1 },
    { "collection": "agents", "version": 1 }
  ],
  "created_at": "2025-01-07T08:00:00Z",
  "last_sync": "2025-01-07T14:30:00Z"
}
````

> **Note:** User-editable configuration (prefixes, TTLs) lives in `.tbd/config.yml` on
> the main branch. Schema versions live in `meta.json` on the sync branch because they
> describe the synced data and must propagate with it.

#### Compatibility Requirements

**Forward compatibility (required):**

- Newer CLI versions MUST read older entity versions
- Unknown fields MUST be preserved on read/write (pass-through)
- Missing fields MUST use schema defaults

**Backward compatibility (best effort):**

- Older CLI versions reading newer entities: unknown fields ignored
- Core fields (`id`, `version`, `type`) never change shape
- Breaking changes require explicit migration

#### Migration Execution

**Automatic (non-breaking):**

- New optional fields: added with defaults on write
- Field renames: handled in code, both names accepted on read

**Manual (breaking):**

```bash
# Check if migration needed
tbd doctor --check-schema

# Run migration
tbd migrate --to 2

# What it does:
# 1. Backs up all entities to .tbd-sync/attic/migrations/
# 2. Transforms each entity to new schema
# 3. Updates .tbd-sync/meta.json schema_versions
# 4. Syncs to propagate changes
```

#### Cross-Version Sync

When Agent A (schema v2) syncs with Agent B (schema v1):

1. A’s entities written in v2 format
2. B reads v2 entities, unknown fields preserved
3. B writes entities (preserving unknown v2 fields)
4. A reads B’s changes, sees preserved v2 fields
5. No data loss; both continue operating

**Warning:** If v2 has breaking changes, B may fail to parse.
CLI should warn: “Remote entities require CLI version >= X.Y.Z”

````

---

### Edit 2.6: Add Webhook Security

- [x] **Completed**

**Location:** Section 5.2 (Bridge Architecture), add security subsection

**Add after Bridge Configuration:**
```markdown
#### Bridge Security

**Webhook Validation (required):**

All bridge webhooks MUST validate request authenticity:

```typescript
// GitHub webhook validation
function validateGitHubWebhook(
  payload: string,
  signature: string,  // X-Hub-Signature-256 header
  secret: string
): boolean {
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Slack request validation
function validateSlackRequest(
  timestamp: string,  // X-Slack-Request-Timestamp
  body: string,
  signature: string,  // X-Slack-Signature
  secret: string
): boolean {
  // Reject if timestamp > 5 minutes old (replay attack)
  if (Math.abs(Date.now()/1000 - Number(timestamp)) > 300) {
    return false;
  }
  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto
    .createHmac('sha256', secret)
    .update(baseString)
    .digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
````

**Secret Management:**

- Store secrets in environment variables, never in config files
- Support secret rotation without downtime
- Log validation failures (without exposing secrets)

**Rate Limiting:**

- Limit webhook endpoints: 100 requests/minute per source IP
- Return 429 when exceeded
- Log rate limit violations

```

---

## Phase 3: Verification Checklist

After making all edits, verify:

- [x] **HLC fields** added to BaseEntity schema and merge algorithm
- [x] **Claim field** added to IssueSchema with lease-based coordination
- [x] **Idempotency key** schema defined for outbound queue items
- [x] **Schema version** migration strategy added (Section 2.6)
- [x] **Config vs Meta separation** documented in schema migration section
- [x] **Table of Contents** updated with new sections (2.6, 5.2.1, 5.2.2)
- [x] **Cross-references** updated (merge algorithm refers to HLC)

**Notes:**
- JSON examples in appendices may need future updates when v2 of spec is released
- All critical and important items from distributed systems review are now addressed

---

## Additional Issues (From Second Pass Review)

These issues were identified in the review but don't have specific edit instructions.
They should be addressed as part of the implementation:

### 11.1 ID Generation and Collision Risk
**Addressed by:** Edit 2.4

### 11.2 Partial Sync Failures
**Add to Section 3.3:**
- Pull atomicity: fetch to staging, validate, apply all or none
- Push atomicity: git's native push is atomic
- Recovery: `.tbd/local/sync-error.log`, `sync_status` in meta.json

### 11.3 Multi-Entity Atomicity
**Options:**
- Operation journaling in `.tbd/local/journal/`
- Or document that `tbd doctor --fix` recovers inconsistent state

### 11.4 Schema Migration Strategy
**Addressed by:** Edit 2.5

### 11.5 Webhook Security
**Addressed by:** Edit 2.6

### 11.6 Outbound Queue Crash Safety
**Addressed by:** Edit 1.3 (idempotency keys)

### 11.7 Entity Reference Integrity During Sync
**Add to Section 3.3:**
- Soft references: `in_reply_to`, `dependencies.target`, `working_on`
- Missing targets are NOT sync errors
- `tbd doctor` detects broken references post-sync

---

## References

- [Hybrid Logical Clocks (Kulkarni et al.)](https://cse.buffalo.edu/tech-reports/2014-04.pdf)
- [CRDTs: Conflict-free Replicated Data Types](https://crdt.tech/)
- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Slack Request Verification](https://api.slack.com/authentication/verifying-requests-from-slack)
```
