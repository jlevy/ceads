/**
 * Zod schemas for tbd entities.
 *
 * These schemas are the normative specification for the file format.
 * See: tbd-design.md §2.6 Schemas
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
 * Issue ID: prefix + 26 lowercase alphanumeric characters (ULID format).
 * Format: is-{ulid} where ulid is 26 chars (a-z, 0-9).
 * Example: is-01hx5zzkbkactav9wevgemmvrz
 */
export const IssueId = z.string().regex(/^is-[0-9a-z]{26}$/);

/**
 * Short ID: 1+ base36 characters used for external/display IDs.
 * Typically 4 chars for new IDs (e.g., a7k2, b3m9).
 * Imports may preserve longer numeric IDs (e.g., "100" from "tbd-100").
 */
export const ShortId = z.string().regex(/^[0-9a-z]+$/);

/**
 * External Issue ID input: accepts {prefix}-{short} or just {short}.
 * Examples: bd-a7k2, a7k2, bd-100, 100
 */
export const ExternalIssueIdInput = z.string().regex(/^([a-z]+-)?[0-9a-z]+$/);

/**
 * Edit counter - incremented on every local change.
 * NOTE: Version is NOT used for conflict detection (Git push rejection is used).
 * Content hash is used as tiebreaker during merge resolution.
 * Version is informational only - set to max(local, remote) + 1 after merges.
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
 * Git branch name - restricted to safe characters.
 * Allows: alphanumeric, hyphens, underscores, forward slashes, and dots.
 * Prevents shell injection in git commands.
 */
export const GitBranchName = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9._/-]+$/,
    'Invalid branch name: only alphanumeric, dots, underscores, hyphens, and slashes allowed',
  );

/**
 * Git remote name - restricted to safe characters.
 * Allows: alphanumeric, hyphens, underscores, and dots.
 * Prevents shell injection in git commands.
 */
export const GitRemoteName = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Invalid remote name: only alphanumeric, dots, underscores, and hyphens allowed',
  );

/**
 * Project configuration stored in .tbd/config.yml
 */
export const ConfigSchema = z.object({
  tbd_version: z.string(),
  sync: z
    .object({
      branch: GitBranchName.default('tbd-sync'),
      remote: GitRemoteName.default('origin'),
    })
    .default({}),
  display: z.object({
    id_prefix: z.string().min(1).max(20), // Required: set during init --prefix or import
  }),
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
 * Shared metadata stored in .tbd/data-sync/meta.yml
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
 *
 * Note: Current implementation uses state.json (see tbd-hckf to change to YAML).
 * Only last_sync_at is currently used. Additional fields reserved for future.
 */
export const LocalStateSchema = z.object({
  last_sync_at: Timestamp.optional(), // When this node last synced successfully
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
