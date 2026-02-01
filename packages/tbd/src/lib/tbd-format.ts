/**
 * tbd Directory Format Versioning
 * ================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for .tbd/ directory format versions.
 *
 * WHEN TO BUMP THE FORMAT VERSION:
 * - Bump when changes REQUIRE migration (deleting files, changing formats, moving files)
 * - **Bump when changing config schema** (adding, removing, or modifying fields)
 * - Do NOT bump for additive changes that don't affect config.yml (new directories, etc.)
 *
 * HOW TO ADD A NEW FORMAT VERSION:
 * 1. Add entry to FORMAT_HISTORY with detailed description
 * 2. Implement migrate_fXX_to_fYY() function
 * 3. Add case to migrateToLatest()
 * 4. Update CURRENT_FORMAT
 * 5. Add tests for the migration path
 *
 * FORWARD COMPATIBILITY POLICY:
 * ConfigSchema uses Zod's strip() mode, which discards unknown fields. To prevent
 * data loss when users mix tbd versions:
 *
 * 1. When changing config schema, bump the format version (e.g., f03 → f04)
 * 2. config.ts checks format compatibility via isCompatibleFormat()
 * 3. Older tbd versions will error with "format 'fXX' is from a newer tbd version"
 * 4. The error tells users to upgrade: npm install -g get-tbd@latest
 *
 * This ensures older versions fail fast rather than silently corrupting config.
 * See ConfigSchema in schemas.ts and checkFormatCompatibility() in config.ts.
 */

// =============================================================================
// Format Constants
// =============================================================================

/**
 * Current format version.
 * Bump this ONLY for breaking changes that require migration.
 */
export const CURRENT_FORMAT = 'f03';

/**
 * Initial format version for configs that don't have tbd_format field.
 */
export const INITIAL_FORMAT = 'f01';

// =============================================================================
// Format History
// =============================================================================

/**
 * Complete history of format versions with their changes.
 * This serves as documentation and enables version detection.
 */
export const FORMAT_HISTORY = {
  f01: {
    introduced: '0.1.0',
    description: 'Initial format',
    structure: {
      'config.yml': 'Project configuration',
      'state.yml': 'Local state (gitignored)',
      'docs/': 'Documentation cache (gitignored)',
      'issues/': 'Issue YAML files',
    },
  },
  f02: {
    introduced: '0.1.5',
    description: 'Adds configurable doc_cache',
    changes: [
      'Added doc_cache: key to config.yml for configurable doc sources',
      'Added settings.doc_auto_sync_hours for automatic doc refresh',
      'Added last_doc_sync_at to state.yml for tracking sync time',
    ],
    migration: 'Populates default doc_cache config from bundled docs',
  },
  f03: {
    introduced: '0.1.6',
    description: 'Consolidates docs_cache config structure',
    changes: [
      'Consolidated doc_cache: and docs: into single docs_cache: key',
      'Moved doc_cache: -> docs_cache.files:',
      'Moved docs.paths: -> docs_cache.lookup_path:',
      'Removed separate docs: key',
    ],
    migration: 'Migrates old config keys to new docs_cache structure',
  },
} as const;

export type FormatVersion = keyof typeof FORMAT_HISTORY;

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Raw config data before parsing/validation.
 * Used during migration when we need to work with potentially old formats.
 */
export interface RawConfig {
  tbd_format?: string;
  tbd_version?: string;
  sync?: {
    branch?: string;
    remote?: string;
  };
  display?: {
    id_prefix?: string;
  };
  settings?: {
    auto_sync?: boolean;
    doc_auto_sync_hours?: number;
  };
  // Old format (f02 and earlier)
  docs?: {
    paths?: string[];
  };
  doc_cache?: Record<string, string>;
  // New format (f03+)
  docs_cache?: {
    files?: Record<string, string>;
    lookup_path?: string[];
  };
}

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
  /** The migrated config */
  config: RawConfig;
  /** Format version before migration */
  fromFormat: FormatVersion;
  /** Format version after migration */
  toFormat: FormatVersion;
  /** Whether any changes were made */
  changed: boolean;
  /** Description of changes made */
  changes: string[];
}

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Migrate from f01 to f02.
 * - Adds tbd_format field
 * - Adds doc_auto_sync_hours setting (default: 24)
 * - doc_cache will be populated separately during setup (requires file system access)
 */
function migrate_f01_to_f02(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  // Add format version
  migrated.tbd_format = 'f02';
  changes.push('Added tbd_format: f02');

  // Ensure settings exists and add doc_auto_sync_hours
  migrated.settings ??= {};
  if (migrated.settings.doc_auto_sync_hours === undefined) {
    migrated.settings.doc_auto_sync_hours = 24;
    changes.push('Added settings.doc_auto_sync_hours: 24');
  }

  // Note: doc_cache is intentionally NOT added here.
  // It will be populated during setup when we have access to the file system
  // and can enumerate the bundled docs.

  return {
    config: migrated,
    fromFormat: 'f01',
    toFormat: 'f02',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f02 to f03.
 * - Consolidates doc_cache: and docs: into docs_cache:
 * - Moves doc_cache: -> docs_cache.files:
 * - Moves docs.paths: -> docs_cache.lookup_path:
 * - Removes separate docs: and doc_cache: keys
 */
function migrate_f02_to_f03(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  // Update format version
  migrated.tbd_format = 'f03';
  changes.push('Updated tbd_format: f03');

  // Initialize docs_cache if it doesn't exist
  migrated.docs_cache ??= {};

  // Migrate doc_cache -> docs_cache.files
  if (migrated.doc_cache && Object.keys(migrated.doc_cache).length > 0) {
    migrated.docs_cache.files = { ...migrated.doc_cache };
    changes.push('Moved doc_cache: -> docs_cache.files:');
    delete migrated.doc_cache;
  }

  // Migrate docs.paths -> docs_cache.lookup_path
  if (migrated.docs?.paths && migrated.docs.paths.length > 0) {
    migrated.docs_cache.lookup_path = [...migrated.docs.paths];
    changes.push('Moved docs.paths: -> docs_cache.lookup_path:');
  }

  // Remove old docs: key
  if (migrated.docs) {
    delete migrated.docs;
    changes.push('Removed docs: key');
  }

  return {
    config: migrated,
    fromFormat: 'f02',
    toFormat: 'f03',
    changed: changes.length > 0,
    changes,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Detect the format version of a config.
 * Returns INITIAL_FORMAT ('f01') if no tbd_format field is present.
 */
export function detectFormat(config: RawConfig): FormatVersion {
  const format = config.tbd_format;
  if (!format) {
    return INITIAL_FORMAT;
  }
  if (format in FORMAT_HISTORY) {
    return format as FormatVersion;
  }
  // Unknown format - treat as latest (will fail validation if incompatible)
  return CURRENT_FORMAT;
}

/**
 * Check if a config needs migration.
 */
export function needsMigration(config: RawConfig): boolean {
  const currentFormat = detectFormat(config);
  return currentFormat !== CURRENT_FORMAT;
}

/**
 * Migrate a config to the latest format version.
 *
 * This function applies all necessary migrations in sequence.
 * It does NOT populate doc_cache - that requires file system access
 * and should be done separately during setup.
 *
 * @param config - The raw config to migrate
 * @returns Migration result with the migrated config and change log
 */
export function migrateToLatest(config: RawConfig): MigrationResult {
  const fromFormat = detectFormat(config);

  if (fromFormat === CURRENT_FORMAT) {
    return {
      config,
      fromFormat,
      toFormat: CURRENT_FORMAT,
      changed: false,
      changes: [],
    };
  }

  let current = config;
  let currentFormat: FormatVersion = fromFormat;
  const allChanges: string[] = [];

  // Apply migrations in sequence
  if (currentFormat === 'f01') {
    const result = migrate_f01_to_f02(current);
    current = result.config;
    currentFormat = 'f02' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f02') {
    const result = migrate_f02_to_f03(current);
    current = result.config;
    currentFormat = 'f03' as FormatVersion;
    allChanges.push(...result.changes);
  }

  // Add more migrations here as new format versions are added

  return {
    config: current,
    fromFormat,
    toFormat: currentFormat,
    changed: allChanges.length > 0,
    changes: allChanges,
  };
}

/**
 * Check if a format version is compatible with the current tbd version.
 * Future format versions are considered incompatible (would need tbd upgrade).
 */
export function isCompatibleFormat(format: string): boolean {
  const formatVersions = Object.keys(FORMAT_HISTORY);
  const currentIndex = formatVersions.indexOf(CURRENT_FORMAT);
  const checkIndex = formatVersions.indexOf(format);

  if (checkIndex === -1) {
    // Unknown format - might be from a newer tbd version
    return false;
  }

  // Compatible if same or older format (we can migrate up)
  return checkIndex <= currentIndex;
}

/**
 * Get a human-readable description of what migrations will be applied.
 */
export function describeMigration(fromFormat: FormatVersion): string[] {
  const descriptions: string[] = [];
  let current = fromFormat;

  if (current === 'f01') {
    descriptions.push('f01 → f02: Add doc_cache configuration support');
    current = 'f02';
  }

  if (current === 'f02') {
    descriptions.push('f02 → f03: Consolidate doc_cache and docs into docs_cache');
    current = 'f03';
  }

  // Add more migration descriptions here

  return descriptions;
}
