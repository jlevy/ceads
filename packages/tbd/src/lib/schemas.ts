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

  // Child ordering hints - soft ordering for children under this parent.
  // Array of internal IssueIds in preferred display order.
  // May contain stale IDs; display logic filters for actual children.
  child_order_hints: z.array(IssueId).nullable().optional(),

  // Beads compatibility
  due_date: Timestamp.nullable().optional(),
  deferred_until: Timestamp.nullable().optional(),

  created_by: z.string().nullable().optional(),
  closed_at: Timestamp.nullable().optional(),
  close_reason: z.string().nullable().optional(),

  // Spec linking - path to related spec/doc (relative to repo root)
  spec_path: z.string().nullable().optional(),
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
 * Doc cache configuration - maps destination paths to source locations.
 *
 * Keys are destination paths relative to .tbd/docs/ (e.g., "shortcuts/standard/code-review-and-commit.md")
 * Values are source locations:
 * - internal: prefix for bundled docs (e.g., "internal:shortcuts/standard/code-review-and-commit.md")
 * - Full URL for external docs (e.g., "https://raw.githubusercontent.com/org/repo/main/file.md")
 *
 * Example:
 * ```yaml
 * doc_cache:
 *   shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
 *   shortcuts/custom/my-shortcut.md: https://raw.githubusercontent.com/org/repo/main/shortcuts/my-shortcut.md
 * ```
 */
export const DocCacheConfigSchema = z.record(z.string(), z.string());

/**
 * Documentation cache configuration (consolidated structure).
 *
 * Combines file sync mappings and lookup paths into a single config block.
 * See: docs/project/specs/active/plan-2026-01-26-docs-cache-config-restructure.md
 */
export const DocsCacheSchema = z.object({
  /**
   * Files to sync: maps destination paths to source locations.
   * Keys are destination paths relative to .tbd/docs/
   * Values are source locations:
   * - internal: prefix for bundled docs (e.g., "internal:shortcuts/standard/code-review-and-commit.md")
   * - Full URL for external docs (e.g., "https://raw.githubusercontent.com/org/repo/main/file.md")
   */
  files: z.record(z.string(), z.string()).optional(),
  /**
   * Search paths for doc lookup (like shell $PATH).
   * Earlier paths take precedence when names conflict.
   */
  lookup_path: z
    .array(z.string())
    .default(['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']),
});

/**
 * Project configuration stored in .tbd/config.yml
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 * The tbd_format field tracks breaking changes to this schema.
 *
 * ⚠️ FORWARD COMPATIBILITY POLICY:
 * This schema uses Zod's default strip() mode, which discards unknown fields.
 * To prevent data loss when users mix tbd versions:
 *
 * 1. **When changing config schema (adding, removing, or modifying fields), ALWAYS
 *    bump the format version** (e.g., f03 → f04)
 * 2. Older tbd versions will error when they see an unknown format version
 * 3. The error message tells users to upgrade tbd
 *
 * This ensures older versions fail fast rather than silently corrupting config.
 * The format version check happens in config.ts via isCompatibleFormat().
 *
 * See tbd-format.ts for format version history and migration rules.
 */
export const ConfigSchema = z.object({
  /**
   * Format version for the .tbd/ directory structure.
   * See tbd-format.ts for version history and migration rules.
   * Only bumped for breaking changes that require migration.
   */
  tbd_format: z.string().default('f01'),

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
      /**
       * How often to automatically sync documentation cache (in hours).
       * - Default: 24 (sync once per day when actively using tbd)
       * - Set to 0 to disable auto-sync
       * - Only triggers when accessing docs (shortcut, guidelines, template commands)
       */
      doc_auto_sync_hours: z.number().default(24),
      /**
       * Whether to install the ensure-gh-cli.sh hook script during setup.
       * When true (default), `tbd setup` installs a SessionStart hook that
       * ensures the GitHub CLI is available in agent sessions.
       * Set to false or use `tbd setup --no-gh-cli` to disable.
       */
      use_gh_cli: z.boolean().default(true),
    })
    .default({}),
  /**
   * Documentation cache configuration (consolidated).
   * Contains files to sync and lookup paths.
   * See DocsCacheSchema for structure details.
   */
  docs_cache: DocsCacheSchema.optional(),
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
 * Per-node state stored in .tbd/state.yml (gitignored).
 * Tracks local timing information that shouldn't be shared across nodes.
 */
export const LocalStateSchema = z.object({
  /** When this node last synced issues successfully */
  last_sync_at: Timestamp.optional(),
  /** When this node last synced the doc cache successfully */
  last_doc_sync_at: Timestamp.optional(),
  /** Whether the user has seen the welcome message */
  welcome_seen: z.boolean().optional(),
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
  field: z.string(),
  lost_value: z.string(),
  winner_source: z.enum(['local', 'remote']),
  loser_source: z.enum(['local', 'remote']),
  context: z.object({
    local_version: Version,
    remote_version: Version,
    local_updated_at: Timestamp,
    remote_updated_at: Timestamp,
  }),
});
