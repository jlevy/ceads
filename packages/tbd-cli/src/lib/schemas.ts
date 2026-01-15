/**
 * Zod schemas for tbd entities.
 *
 * These schemas are the normative specification for the file format.
 * See: tbd-design-v3.md §2.6 Schemas
 */

import { z } from 'zod';

// =============================================================================
// Common Types (§2.6.1)
// =============================================================================

/**
 * ISO8601 timestamp with Z suffix (UTC).
 */
export const Timestamp = z.string().datetime();

/**
 * Issue ID: prefix + 6 hex characters.
 * Stored IDs always have exactly 6 hex chars.
 */
export const IssueId = z.string().regex(/^is-[a-f0-9]{6}$/);

/**
 * Issue ID input: accepts 4-6 chars for CLI convenience.
 * Also accepts bd- prefix for Beads compatibility.
 */
export const IssueIdInput = z.string().regex(/^(is-|bd-)?[a-f0-9]{4,6}$/);

/**
 * Edit counter - incremented on every local change.
 * NOTE: Version is NOT used for conflict detection (content hash is used instead).
 * Version is informational only.
 */
export const Version = z.number().int().nonnegative();

/**
 * Entity type discriminator.
 */
export const EntityType = z.literal('is');

// =============================================================================
// BaseEntity (§2.6.2)
// =============================================================================

/**
 * All entities share common fields.
 */
export const BaseEntity = z.object({
  type: EntityType,
  id: IssueId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,

  // Extensibility namespace for third-party data
  extensions: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Issue Schema (§2.6.3)
// =============================================================================

/**
 * Issue status values matching Beads.
 */
export const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);

/**
 * Issue kind/type values matching Beads.
 * Note: CLI uses --type flag, which maps to this `kind` field.
 */
export const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);

/**
 * Priority: 0 (highest/critical) to 4 (lowest).
 */
export const Priority = z.number().int().min(0).max(4);

/**
 * Dependency types - only "blocks" supported initially.
 */
export const DependencyRelationType = z.enum(['blocks']);

/**
 * A dependency relationship.
 */
export const Dependency = z.object({
  type: DependencyRelationType,
  target: IssueId,
});

/**
 * Full issue schema.
 *
 * Note: Fields use .nullable() in addition to .optional() because
 * YAML parses `field: null` as JavaScript null, not undefined.
 */
export const IssueSchema = BaseEntity.extend({
  type: z.literal('is'),

  title: z.string().min(1).max(500),
  description: z.string().max(50000).nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),

  kind: IssueKind.default('task'),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  assignee: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Hierarchical issues
  parent_id: IssueId.nullable().optional(),

  // Beads compatibility
  due_date: Timestamp.nullable().optional(),
  deferred_until: Timestamp.nullable().optional(),

  created_by: z.string().nullable().optional(),
  closed_at: Timestamp.nullable().optional(),
  close_reason: z.string().nullable().optional(),
});

// =============================================================================
// Config Schema (§2.6.4)
// =============================================================================

/**
 * Project configuration stored in .tbd/config.yml
 */
export const ConfigSchema = z.object({
  tbd_version: z.string(),
  sync: z
    .object({
      branch: z.string().default('tbd-sync'),
      remote: z.string().default('origin'),
    })
    .default({}),
  display: z
    .object({
      id_prefix: z.string().default('bd'), // Beads compat
    })
    .default({}),
  settings: z
    .object({
      auto_sync: z.boolean().default(false),
      index_enabled: z.boolean().default(true),
    })
    .default({}),
});

// =============================================================================
// Meta Schema (§2.6.5)
// =============================================================================

/**
 * Shared metadata stored in .tbd-sync/meta.yml
 */
export const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});

// =============================================================================
// Local State Schema (§2.6.6)
// =============================================================================

/**
 * Per-node state stored in .tbd/cache/state.yml (gitignored).
 */
export const LocalStateSchema = z.object({
  node_id: z.string().optional(),
  last_sync: Timestamp.optional(),
  last_push: Timestamp.optional(),
  last_pull: Timestamp.optional(),
  last_synced_commit: z.string().optional(),
});

// =============================================================================
// Attic Entry Schema (§2.6.7)
// =============================================================================

/**
 * Preserved conflict losers.
 */
export const AtticEntrySchema = z.object({
  entity_id: IssueId,
  timestamp: Timestamp,
  field: z.string().optional(),
  lost_value: z.unknown(),
  winner_source: z.enum(['local', 'remote']),
  loser_source: z.enum(['local', 'remote']),
  context: z.object({
    local_version: Version,
    remote_version: Version,
    local_updated_at: Timestamp,
    remote_updated_at: Timestamp,
  }),
});
