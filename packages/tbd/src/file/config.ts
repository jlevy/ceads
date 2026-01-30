/**
 * Config file operations.
 *
 * Config is stored at .tbd/config.yml and contains project-level settings.
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 *
 * See: tbd-design.md §2.2.2 Config File
 */

import { readFile, mkdir, access } from 'node:fs/promises';
import { join, dirname, parse as parsePath } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { Config, LocalState } from '../lib/types.js';
import { ConfigSchema, LocalStateSchema } from '../lib/schemas.js';
import { CONFIG_FILE, STATE_FILE, SYNC_BRANCH } from '../lib/paths.js';
import {
  CURRENT_FORMAT,
  needsMigration,
  migrateToLatest,
  type RawConfig,
} from '../lib/tbd-format.js';

/**
 * Path to config file relative to project root.
 * Re-exported from paths.ts for backwards compatibility.
 */
export const CONFIG_FILE_PATH = CONFIG_FILE;

/**
 * Create default config for a new project.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
function createDefaultConfig(version: string, prefix: string): Config {
  return ConfigSchema.parse({
    tbd_format: CURRENT_FORMAT,
    tbd_version: version,
    sync: {
      branch: SYNC_BRANCH,
      remote: 'origin',
    },
    display: {
      id_prefix: prefix,
    },
    settings: {
      auto_sync: false,
      doc_auto_sync_hours: 24,
    },
  });
}

/**
 * Initialize a new config file with default settings.
 * Creates .tbd directory if it doesn't exist.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
export async function initConfig(
  baseDir: string,
  version: string,
  prefix: string,
): Promise<Config> {
  const tbdDir = join(baseDir, '.tbd');
  await mkdir(tbdDir, { recursive: true });

  const config = createDefaultConfig(version, prefix);
  await writeConfig(baseDir, config);

  return config;
}

/**
 * Read config from file with automatic migration if needed.
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 *
 * @throws If config file doesn't exist or is invalid.
 */
export async function readConfig(baseDir: string): Promise<Config> {
  const configPath = join(baseDir, CONFIG_FILE_PATH);
  const content = await readFile(configPath, 'utf-8');
  const data = parseYaml(content) as RawConfig;

  // Check if migration is needed
  if (needsMigration(data)) {
    const result = migrateToLatest(data);
    // Note: We don't automatically write the migrated config here.
    // Migration writes should be explicit via writeConfig() after setup.
    return ConfigSchema.parse(result.config);
  }

  return ConfigSchema.parse(data);
}

/**
 * Read config from file, returning migration info if a migration was applied.
 * Use this when you need to know if the config was migrated.
 */
export async function readConfigWithMigration(
  baseDir: string,
): Promise<{ config: Config; migrated: boolean; changes: string[] }> {
  const configPath = join(baseDir, CONFIG_FILE_PATH);
  const content = await readFile(configPath, 'utf-8');
  const data = parseYaml(content) as RawConfig;

  if (needsMigration(data)) {
    const result = migrateToLatest(data);
    return {
      config: ConfigSchema.parse(result.config),
      migrated: result.changed,
      changes: result.changes,
    };
  }

  return {
    config: ConfigSchema.parse(data),
    migrated: false,
    changes: [],
  };
}

/**
 * Write config to file with explanatory comments.
 */
export async function writeConfig(baseDir: string, config: Config): Promise<void> {
  const configPath = join(baseDir, CONFIG_FILE_PATH);

  const yaml = stringifyYaml(config, {
    sortMapEntries: true,
    lineWidth: 0,
  });

  // Add explanatory comments for docs_cache section
  let content = yaml;
  if (config.docs_cache && Object.keys(config.docs_cache).length > 0) {
    const docsCacheComment = `# Documentation cache configuration.
# files: Maps destination paths (relative to .tbd/docs/) to source locations.
#   Sources can be:
#   - internal: prefix for bundled docs (e.g., "internal:shortcuts/standard/commit-code.md")
#   - Full URL for external docs (e.g., "https://raw.githubusercontent.com/org/repo/main/file.md")
# lookup_path: Search paths for doc lookup (like shell $PATH). Earlier paths take precedence.
#
# To sync docs: tbd sync --docs
# To check status: tbd sync --status
#
# Auto-sync: Docs are automatically synced when stale (default: every 24 hours).
# Configure with settings.doc_auto_sync_hours (0 = disabled).
`;
    content = content.replace('docs_cache:', docsCacheComment + 'docs_cache:');
  }

  await writeFile(configPath, content);
}

/**
 * Check if tbd is initialized in the given directory (immediate check only).
 * Returns true if .tbd/ directory exists directly in baseDir.
 */
async function hasTbdDir(dir: string): Promise<boolean> {
  const tbdDir = join(dir, '.tbd');
  try {
    await access(tbdDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the tbd repository root by walking up the directory tree.
 * Similar to how git finds .git/ directories.
 *
 * @param startDir - Directory to start searching from
 * @returns The tbd root directory path, or null if not found
 */
export async function findTbdRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const { root } = parsePath(startDir);

  while (currentDir !== root) {
    if (await hasTbdDir(currentDir)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Check root directory as well
  if (await hasTbdDir(root)) {
    return root;
  }

  return null;
}

/**
 * Check if tbd is initialized in the given directory or any parent directory.
 * Walks up the directory tree looking for .tbd/.
 */
export async function isInitialized(baseDir: string): Promise<boolean> {
  const root = await findTbdRoot(baseDir);
  return root !== null;
}

// =============================================================================
// Local State Operations
// =============================================================================

/**
 * Read local state from .tbd/state.yml
 * Returns empty state if file doesn't exist.
 */
export async function readLocalState(baseDir: string): Promise<LocalState> {
  const statePath = join(baseDir, STATE_FILE);
  try {
    const content = await readFile(statePath, 'utf-8');
    const data: unknown = parseYaml(content);
    return LocalStateSchema.parse(data ?? {});
  } catch {
    // File doesn't exist or is invalid - return empty state
    return {};
  }
}

/**
 * Write local state to .tbd/state.yml
 */
export async function writeLocalState(baseDir: string, state: LocalState): Promise<void> {
  const statePath = join(baseDir, STATE_FILE);

  // Ensure .tbd directory exists
  await mkdir(join(baseDir, '.tbd'), { recursive: true });

  const yaml = stringifyYaml(state, {
    sortMapEntries: true,
    lineWidth: 0,
  });

  await writeFile(statePath, yaml);
}

/**
 * Update specific fields in local state (merge with existing).
 */
export async function updateLocalState(
  baseDir: string,
  updates: Partial<LocalState>,
): Promise<LocalState> {
  const current = await readLocalState(baseDir);
  const updated = { ...current, ...updates };
  await writeLocalState(baseDir, updated);
  return updated;
}

// =============================================================================
// Welcome State Operations
// =============================================================================

/**
 * Check if the user has seen the welcome message.
 */
export async function hasSeenWelcome(baseDir: string): Promise<boolean> {
  const state = await readLocalState(baseDir);
  return state.welcome_seen === true;
}

/**
 * Mark the welcome message as seen.
 */
export async function markWelcomeSeen(baseDir: string): Promise<void> {
  await updateLocalState(baseDir, { welcome_seen: true });
}
