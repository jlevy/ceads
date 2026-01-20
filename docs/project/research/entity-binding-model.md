# Entity Binding Model for TBD Coordination

**Author:** Claude (exploration document)
**Date:** January 2026
**Status:** Design exploration

---

## Overview

This document explores the **entity binding model** - the formal specification of what entities exist, what they bind to, and how their storage/lifecycle is determined. This is the "schema of schemas" that TBD would own, enabling a layered architecture where:

- **TBD defines** what entities are valid and how they relate
- **Storage backends** (git, NATS KV, NATS streams) implement persistence
- **Daemons/tools** maintain consistency across backends
- **Agents** interact through simple interfaces (files, CLI)

---

## 1. The Binding Graph

### 1.1 Entity Hierarchy

```
                    ┌─────────────┐
                    │   Project   │  (implicit root)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │   Issue   │    │   Agent   │    │   Queue   │
    │   (is)    │    │   (ag)    │    │   (qu)    │
    └─────┬─────┘    └─────┬─────┘    └───────────┘
          │                │
    ┌─────┼─────┐          │
    │     │     │          │
┌───▼──┐ ┌▼───┐ ┌▼────┐ ┌──▼───┐
│Claim │ │Link│ │Cmt  │ │Work  │
│(cl)  │ │(lk)│ │(cm) │ │Entry │
└──────┘ └────┘ └─────┘ └──────┘

Binding direction: Child → Parent
Storage: Varies by entity type
```

### 1.2 Binding Rules

Each entity type has explicit binding rules:

```typescript
// The binding specification for each entity type
const EntityBindings = {
  // Issues bind to nothing (top-level within project)
  is: {
    binds_to: null,
    allows_children: ['cl', 'lk', 'cm', 'ov'],
  },

  // Agents bind to nothing (top-level within project)
  ag: {
    binds_to: null,
    allows_children: ['we'],  // work entries
  },

  // Claims bind to exactly one issue
  cl: {
    binds_to: { type: 'is', cardinality: 'one', required: true },
    allows_children: [],
  },

  // Links bind to exactly one issue
  lk: {
    binds_to: { type: 'is', cardinality: 'one', required: true },
    allows_children: [],
  },

  // Comments bind to exactly one issue
  cm: {
    binds_to: { type: 'is', cardinality: 'one', required: true },
    allows_children: [],
  },

  // Overlays bind to exactly one issue
  ov: {
    binds_to: { type: 'is', cardinality: 'one', required: true },
    allows_children: [],
  },

  // Work entries bind to exactly one agent
  we: {
    binds_to: { type: 'ag', cardinality: 'one', required: true },
    references: { type: 'is', field: 'issue_id' },  // Also references an issue
    allows_children: [],
  },

  // Queues bind to nothing (global or agent-scoped)
  qu: {
    binds_to: { type: 'ag', cardinality: 'one', required: false },  // Optional
    allows_children: [],
  },
};
```

---

## 2. Storage Classes

### 2.1 Storage Decision Matrix

| Entity | Mutability | Size | Lifetime | Storage Class |
|--------|------------|------|----------|---------------|
| Issue (is) | Mutable | Small | Permanent | git |
| Agent (ag) | Mutable | Small | Session (TTL) | kv-ephemeral |
| Claim (cl) | Mutable | Tiny | Session (TTL) | kv-ephemeral |
| Comment (cm) | Immutable | Varies | Configurable | stream |
| Link (lk) | Mutable | Small | Permanent | kv-durable |
| Overlay (ov) | Mutable | Tiny | Configurable | kv-durable |
| Work Entry (we) | Mutable | Small | Session | kv-ephemeral |
| Queue (qu) | Mutable | Small-Medium | Computed | kv-durable |

### 2.2 Storage Class Definitions

```typescript
interface StorageClass {
  // Where data lives
  backend: 'git' | 'nats-kv' | 'nats-stream' | 'nats-object';

  // Durability
  durability: 'permanent' | 'durable' | 'ephemeral';

  // Time-to-live (for ephemeral)
  ttl_seconds?: number;

  // Retention policy (for streams)
  retention?: {
    max_age_days?: number;
    max_bytes?: number;
    max_messages?: number;
  };

  // Settlement policy (for coordination → git)
  settlement?: {
    trigger: 'never' | 'on_close' | 'periodic' | 'on_demand';
    format: 'full' | 'digest' | 'reference';
  };
}

const StorageClasses: Record<string, StorageClass> = {
  'git': {
    backend: 'git',
    durability: 'permanent',
    // Settled by normal tbd sync
  },

  'kv-ephemeral': {
    backend: 'nats-kv',
    durability: 'ephemeral',
    ttl_seconds: 30,  // Default, can be overridden
  },

  'kv-durable': {
    backend: 'nats-kv',
    durability: 'durable',
    settlement: {
      trigger: 'on_demand',
      format: 'reference',  // Just store a ref in git
    },
  },

  'stream': {
    backend: 'nats-stream',
    durability: 'durable',
    retention: {
      max_age_days: 30,
    },
    settlement: {
      trigger: 'on_close',
      format: 'digest',  // Summarize to git on issue close
    },
  },

  'object': {
    backend: 'nats-object',
    durability: 'durable',
    retention: {
      max_bytes: 100 * 1024 * 1024,  // 100MB per project
    },
    settlement: {
      trigger: 'never',  // Too big for git
      format: 'reference',
    },
  },
};
```

---

## 3. Entity Schemas

### 3.1 Base Entity

All entities share a common base:

```typescript
const BaseEntity = z.object({
  // Type discriminator (2-char prefix)
  type: EntityType,

  // Unique identifier (type-prefixed ULID)
  id: z.string().regex(/^[a-z]{2}-[0-9a-z]{26}$/),

  // Version for optimistic concurrency
  version: z.number().int().min(1).default(1),

  // Timestamps
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),

  // Creator (agent ID or "human")
  created_by: z.string().optional(),
});
```

### 3.2 Issue Schema (git-durable)

```typescript
const IssueSchema = BaseEntity.extend({
  type: z.literal('is'),

  // Content
  kind: IssueKind,
  title: z.string().min(1).max(500),
  status: IssueStatus,
  priority: Priority,

  // Assignment (advisory in git, authoritative in overlay)
  assignee: z.string().optional(),

  // Organization
  labels: z.array(z.string()).default([]),
  parent: IssueId.optional(),
  dependencies: z.array(DependencySchema).default([]),

  // Body (markdown)
  body: z.string().default(''),
});

// Storage: git
// Settlement: N/A (already in git)
```

### 3.3 Agent Session Schema (kv-ephemeral)

```typescript
const AgentSessionSchema = BaseEntity.extend({
  type: z.literal('ag'),

  // Identity
  name: z.string().optional(),
  host: z.string().optional(),  // Machine identifier

  // Capabilities
  capabilities: z.array(z.string()).default([]),

  // Current state
  status: z.enum(['starting', 'ready', 'working', 'paused', 'stopping']),
  current_issue: IssueId.optional(),

  // Heartbeat (auto-updated by daemon)
  last_heartbeat: z.string().datetime(),

  // Session timing
  started_at: z.string().datetime(),
});

// Storage: kv-ephemeral (TTL: 30s, refreshed by heartbeat)
// Settlement: never (ephemeral by design)
```

### 3.4 Claim Schema (kv-ephemeral)

```typescript
const ClaimSchema = BaseEntity.extend({
  type: z.literal('cl'),

  // What is claimed
  issue_id: IssueId,

  // Who claims it
  agent_id: AgentId,

  // Claim details
  claim_type: z.enum([
    'working',    // Exclusive: actively working on this issue
    'reviewing',  // Non-exclusive: reviewing work
    'watching',   // Non-exclusive: monitoring for changes
  ]),

  // Timing
  claimed_at: z.string().datetime(),
  expires_at: z.string().datetime().optional(),
});

// Storage: kv-ephemeral (TTL: 5min default, refreshed while active)
// Settlement: never (status overlay captures final state)

// Cardinality rules:
// - 'working': at most 1 per issue
// - 'reviewing': many per issue
// - 'watching': many per issue
```

### 3.5 Comment Schema (stream)

```typescript
const CommentSchema = BaseEntity.extend({
  type: z.literal('cm'),

  // What this comments on
  issue_id: IssueId,

  // Content
  author: z.string(),  // Agent ID or human identifier
  body: z.string(),

  // Optional: reference to large payload
  body_ref: z.string().optional(),  // obj://bucket/key

  // Settlement hint
  settle_policy: z.enum([
    'never',   // Don't include in git settlement
    'digest',  // Include summary only
    'full',    // Include full content
  ]).default('never'),

  // For threaded replies
  reply_to: CommentId.optional(),
});

// Storage: stream (retention: 30 days)
// Settlement: digest on issue close
```

### 3.6 External Link Schema (kv-durable)

```typescript
const ExternalLinkSchema = BaseEntity.extend({
  type: z.literal('lk'),

  // What this links
  issue_id: IssueId,

  // External system references (all optional)
  github_issue: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    url: z.string().url(),
  }).optional(),

  github_pr: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    url: z.string().url(),
  }).optional(),

  linear_issue: z.object({
    id: z.string(),
    url: z.string().url(),
  }).optional(),

  slack_thread: z.object({
    channel: z.string(),
    ts: z.string(),
    url: z.string().url(),
  }).optional(),

  // Generic links
  other: z.array(z.object({
    system: z.string(),
    id: z.string(),
    url: z.string().url().optional(),
  })).default([]),
});

// Storage: kv-durable
// Settlement: reference in issue on close (optional)
```

### 3.7 Status Overlay Schema (kv-durable)

```typescript
const StatusOverlaySchema = BaseEntity.extend({
  type: z.literal('ov'),

  // What this overlays
  issue_id: IssueId,

  // Overlay fields (take precedence over git values for "now")
  status: IssueStatus.optional(),
  assignee: z.string().optional(),
  priority: Priority.optional(),

  // Activity tracking
  last_activity: z.string().datetime(),
  activity_type: z.enum([
    'claimed',
    'updated',
    'commented',
    'released',
  ]).optional(),

  // Fields to settle to git
  settle_fields: z.array(z.enum([
    'status',
    'assignee',
    'priority',
  ])).default([]),
});

// Storage: kv-durable
// Settlement: specified fields on demand or close
```

---

## 4. Consistency Rules

### 4.1 Binding Validation

The daemon enforces binding rules on write:

```typescript
function validateBinding(entity: Entity): ValidationResult {
  const binding = EntityBindings[entity.type];

  if (binding.binds_to) {
    // Must have the binding field
    const parentId = entity[`${binding.binds_to.type}_id`];
    if (binding.binds_to.required && !parentId) {
      return { valid: false, error: `Missing required ${binding.binds_to.type}_id` };
    }

    // Parent must exist
    if (parentId && !entityExists(parentId)) {
      return { valid: false, error: `Parent ${parentId} does not exist` };
    }
  }

  return { valid: true };
}
```

### 4.2 Cardinality Enforcement

```typescript
async function enforceCardinality(claim: Claim): Promise<boolean> {
  if (claim.claim_type === 'working') {
    // Check if another agent has a working claim
    const existing = await getWorkingClaim(claim.issue_id);
    if (existing && existing.agent_id !== claim.agent_id) {
      return false;  // Reject: exclusive claim already held
    }
  }
  return true;  // Allow
}
```

### 4.3 TTL Management

```typescript
class TTLManager {
  // Refresh TTL when heartbeat received
  async refreshAgent(agentId: string) {
    await this.kv.update(`agents/${agentId}`, {
      last_heartbeat: new Date().toISOString(),
    }, { ttl: 30_000 });  // 30 second TTL
  }

  // Clean up expired entities
  async cleanupExpired() {
    // NATS KV handles this automatically via TTL
    // But we may need to clean up local files
    const agents = await this.listAgentFiles();
    for (const file of agents) {
      const agent = await this.readAgent(file);
      if (isExpired(agent.last_heartbeat, 30_000)) {
        await this.deleteFile(file);
        // Also clean up agent's claims
        await this.cleanupAgentClaims(agent.id);
      }
    }
  }
}
```

---

## 5. Settlement Flows

### 5.1 Issue Close Settlement

When an issue is closed, coordination data settles to git:

```typescript
async function settleIssueClose(issueId: string) {
  // 1. Get current overlay
  const overlay = await getOverlay(issueId);

  // 2. Apply overlay fields to issue
  const issue = await loadIssue(issueId);
  if (overlay?.settle_fields?.includes('status')) {
    issue.status = overlay.status ?? issue.status;
  }
  if (overlay?.settle_fields?.includes('assignee')) {
    issue.assignee = overlay.assignee ?? issue.assignee;
  }

  // 3. Generate comment digest
  const comments = await getComments(issueId);
  const digestComments = comments.filter(c => c.settle_policy !== 'never');
  if (digestComments.length > 0) {
    issue.body += '\n\n---\n## Discussion Summary\n';
    issue.body += generateDigest(digestComments);
  }

  // 4. Capture external links
  const links = await getLinks(issueId);
  if (links) {
    issue.body += '\n\n## External Links\n';
    issue.body += formatLinks(links);
  }

  // 5. Write to git
  await writeIssue(issue);

  // 6. Clean up coordination data
  await deleteOverlay(issueId);
  await deleteComments(issueId);  // Keep in stream for retention period
  // Links persist for cross-system sync
}
```

### 5.2 Periodic Checkpoint

```typescript
async function periodicCheckpoint() {
  // Find issues with unsettled coordination data
  const issues = await listIssuesWithOverlays();

  for (const issueId of issues) {
    const overlay = await getOverlay(issueId);
    const issue = await loadIssue(issueId);

    // Only settle if overlay has changes worth persisting
    if (overlay.settle_fields?.length > 0) {
      // Apply and save
      applyOverlay(issue, overlay);
      await writeIssue(issue);

      // Clear settled fields from overlay
      overlay.settle_fields = [];
      await updateOverlay(overlay);
    }
  }

  // Commit if changes made
  await commitIfChanged('chore: periodic coordination checkpoint');
}
```

---

## 6. Query Patterns

### 6.1 "What's Available to Work On?"

```typescript
// Agent queries ready queue
async function getReadyWork(): Promise<Issue[]> {
  // 1. Read queue file (fast, local)
  const queue = await readYaml('.tbd/live/queues/_global/ready.yml');

  // 2. Filter out claimed issues
  const claims = await readYaml('.tbd/live/claims/*/owner.yml');
  const claimedIds = new Set(claims.map(c => c.issue_id));

  // 3. Return unclaimed issues
  return queue.issues.filter(id => !claimedIds.has(id));
}
```

### 6.2 "Who's Working on What?"

```typescript
// Query all active work
async function getActiveWork(): Promise<WorkSummary[]> {
  // 1. List all agents
  const agents = await glob('.tbd/live/agents/ag-*.yml');

  // 2. For each agent, get their current issue
  return Promise.all(agents.map(async file => {
    const agent = await readYaml(file);
    const claim = agent.current_issue
      ? await readYaml(`.tbd/live/claims/${agent.current_issue}/owner.yml`)
      : null;

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      status: agent.status,
      current_issue: agent.current_issue,
      claim: claim,
    };
  }));
}
```

### 6.3 "Is This Issue Available?"

```typescript
// Check if issue can be claimed
async function isIssueAvailable(issueId: string): Promise<boolean> {
  try {
    const claim = await readYaml(`.tbd/live/claims/${issueId}/owner.yml`);
    return false;  // Has active claim
  } catch (e) {
    if (e.code === 'ENOENT') {
      return true;  // No claim file = available
    }
    throw e;
  }
}
```

---

## 7. File System Structure

### 7.1 Complete Directory Layout

```
.tbd/
├── config.yml                     # Project config
├── .gitignore                     # Ignores live/, cache/
│
├── data-sync/                     # Git-durable (via worktree)
│   ├── issues/
│   │   └── is-{ulid}.md
│   ├── mappings/
│   │   └── ids.yml
│   └── meta.yml
│
├── live/                          # Coordination layer (daemon-managed)
│   ├── _meta/
│   │   ├── daemon.yml             # Daemon process info
│   │   ├── nats.yml               # Connection status
│   │   └── sync-cursor.yml        # Sync position
│   │
│   ├── agents/
│   │   └── ag-{ulid}.yml          # Agent sessions
│   │
│   ├── claims/
│   │   └── {issue-id}/
│   │       ├── owner.yml          # Working claim (0 or 1)
│   │       └── watchers.yml       # Watch claims (0 to N)
│   │
│   ├── overlays/
│   │   └── {issue-id}/
│   │       └── status.yml         # Fast status overlay
│   │
│   ├── queues/
│   │   ├── _global/
│   │   │   ├── ready.yml          # Issues ready to work
│   │   │   └── blocked.yml        # Blocked issues
│   │   └── {agent-id}/
│   │       └── assigned.yml       # Agent's assigned work
│   │
│   ├── threads/
│   │   └── {issue-id}/
│   │       ├── _index.yml         # Thread metadata
│   │       └── {seq}.yml          # Comments (ordered)
│   │
│   └── links/
│       └── {issue-id}/
│           └── external.yml       # External system links
│
└── cache/                         # Local-only cache
    └── state.yml
```

### 7.2 Gitignore

```gitignore
# .tbd/.gitignore
cache/
data-sync-worktree/
live/                              # Coordination layer is not in git
```

---

## 8. Design Rationale

### 8.1 Why File System as Interface?

1. **Universal** - every language/tool can read/write files
2. **Debuggable** - `cat`, `ls`, `grep` work out of the box
3. **Watchable** - `inotify`/`FSEvents`/`kqueue` are mature
4. **Transactional** - atomic writes are well-understood
5. **Offline-friendly** - local files work without network

### 8.2 Why Separate Storage Classes?

1. **Right tool for the job** - git for durable, KV for fast, streams for history
2. **Performance** - don't burden git with high-frequency updates
3. **Retention flexibility** - TTL for ephemeral, policies for streams
4. **Clear mental model** - developers know what persists where

### 8.3 Why Binding Model?

1. **Structural integrity** - can't create orphan entities
2. **Cleanup cascades** - deleting issue cleans up claims/comments
3. **Query optimization** - entities are co-located by parent
4. **Schema evolution** - add new entity types without breaking existing

---

## 9. Next Steps

1. **Prototype daemon** with agent sessions and claims only
2. **Validate file watching** across platforms (Linux, macOS, Windows)
3. **Benchmark** NATS KV vs direct file reads for read-heavy workloads
4. **Design CLI** for `tbd coord` commands
5. **Document** agent SDK helpers for file operations
