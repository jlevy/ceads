/**
 * DocSync - Sync documentation files from configured sources.
 *
 * Syncs docs from internal bundled sources and external URLs to .tbd/docs/.
 *
 * See: docs/project/specs/active/plan-2026-01-26-configurable-doc-cache-sync.md
 */

import { readdir, readFile, rm, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { writeFile } from 'atomically';
import { fileURLToPath } from 'node:url';

import { TBD_DOCS_DIR } from '../lib/paths.js';
import { fetchWithGhFallback } from './github-fetch.js';
import { readConfig, writeConfig, updateLocalState } from './config.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A parsed document source.
 */
export interface DocSource {
  /** Source type: internal bundled or external URL */
  type: 'internal' | 'url';
  /** The source location - either a relative path or full URL */
  location: string;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Paths of newly downloaded/copied docs */
  added: string[];
  /** Paths of updated docs (content changed) */
  updated: string[];
  /** Paths of removed docs (no longer in config) */
  removed: string[];
  /** Errors encountered during sync */
  errors: { path: string; error: string }[];
  /** Whether the sync was successful overall */
  success: boolean;
}

/**
 * Options for the syncDocsWithDefaults function.
 */
export interface DocSyncOptions {
  /** If true, suppress output (for auto-sync) */
  quiet?: boolean;
  /** If true, don't write files (dry run for --status) */
  dryRun?: boolean;
}

/**
 * Result of the syncDocsWithDefaults operation.
 * Extends SyncResult with additional metadata.
 */
export interface DocSyncResult {
  /** Paths of newly downloaded/copied docs */
  added: string[];
  /** Paths of updated docs (content changed) */
  updated: string[];
  /** Paths of removed docs (no longer in config) */
  removed: string[];
  /** Paths of entries pruned due to missing internal sources */
  pruned: string[];
  /** Whether the config was changed and written */
  configChanged: boolean;
  /** Errors encountered during sync */
  errors: { path: string; error: string }[];
}

/**
 * Options for sync operations.
 */
export interface SyncOptions {
  /** If true, don't actually write/delete files (dry run) */
  dryRun?: boolean;
  /** If true, suppress normal output (only report errors) */
  silent?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Prefix for internal bundled doc sources */
const INTERNAL_PREFIX = 'internal:';

// =============================================================================
// DocSync Class
// =============================================================================

/**
 * Syncs documentation files from configured sources.
 *
 * Supports:
 * - Internal bundled docs (using internal: prefix)
 * - External URLs (raw.githubusercontent.com, etc.)
 */
export class DocSync {
  private readonly docsDir: string;

  /**
   * Create a new DocSync instance.
   *
   * @param tbdRoot - The tbd project root directory (parent of .tbd/)
   * @param config - The doc_cache configuration mapping dest paths to sources
   */
  constructor(
    private readonly tbdRoot: string,
    private readonly config: Record<string, string>,
  ) {
    this.docsDir = join(tbdRoot, TBD_DOCS_DIR);
  }

  /**
   * Parse a source string into a DocSource.
   *
   * @example
   * parseSource('internal:shortcuts/standard/commit-code.md')
   * // => { type: 'internal', location: 'shortcuts/standard/commit-code.md' }
   *
   * @example
   * parseSource('https://raw.githubusercontent.com/org/repo/main/file.md')
   * // => { type: 'url', location: 'https://...' }
   */
  parseSource(source: string): DocSource {
    if (source.startsWith(INTERNAL_PREFIX)) {
      return {
        type: 'internal',
        location: source.slice(INTERNAL_PREFIX.length),
      };
    }

    // Anything else is treated as a URL
    return {
      type: 'url',
      location: source,
    };
  }

  /**
   * Fetch content from a source.
   *
   * @throws If the source cannot be fetched
   */
  async fetchContent(source: DocSource): Promise<string> {
    if (source.type === 'internal') {
      return this.fetchInternalContent(source.location);
    }
    return this.fetchUrlContent(source.location);
  }

  /**
   * Fetch content from an internal bundled doc.
   */
  private async fetchInternalContent(location: string): Promise<string> {
    const basePaths = getDocsBasePath();

    for (const basePath of basePaths) {
      const fullPath = join(basePath, location);
      try {
        await access(fullPath);
        return await readFile(fullPath, 'utf-8');
      } catch {
        // Try next path
      }
    }

    throw new Error(`Internal doc not found: ${location}`);
  }

  /**
   * Fetch content from a URL (with gh CLI fallback on 403).
   */
  private async fetchUrlContent(url: string): Promise<string> {
    const { content } = await fetchWithGhFallback(url);
    return content;
  }

  /**
   * Get the current state of the docs directory.
   * Returns a set of relative paths that exist in .tbd/docs/.
   */
  async getCurrentState(): Promise<Set<string>> {
    const paths = new Set<string>();

    try {
      await access(this.docsDir);
    } catch {
      // Directory doesn't exist yet
      return paths;
    }

    await this.scanDirectory(this.docsDir, '', paths);
    return paths;
  }

  /**
   * Recursively scan a directory and add all .md file paths to the set.
   */
  private async scanDirectory(baseDir: string, prefix: string, paths: Set<string>): Promise<void> {
    try {
      const dirEntries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of dirEntries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.scanDirectory(join(baseDir, entry.name), relativePath, paths);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          paths.add(relativePath);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  /**
   * Sync all docs from config to .tbd/docs/.
   *
   * - Downloads/copies new docs
   * - Updates docs whose source has changed
   * - Removes docs no longer in config
   *
   * @param options - Sync options (dryRun, silent)
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      added: [],
      updated: [],
      removed: [],
      errors: [],
      success: true,
    };

    // Get current state
    const currentPaths = await this.getCurrentState();
    const configPaths = new Set(Object.keys(this.config));

    // Process each doc in config
    for (const [destPath, sourceStr] of Object.entries(this.config)) {
      try {
        const source = this.parseSource(sourceStr);
        const content = await this.fetchContent(source);
        const fullPath = join(this.docsDir, destPath);

        // Check if file exists and compare content
        let exists = false;
        let existingContent = '';

        try {
          existingContent = await readFile(fullPath, 'utf-8');
          exists = true;
        } catch {
          // File doesn't exist
        }

        if (!exists) {
          // New file
          if (!options.dryRun) {
            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, content);
          }
          result.added.push(destPath);
        } else if (existingContent !== content) {
          // Content changed
          if (!options.dryRun) {
            await writeFile(fullPath, content);
          }
          result.updated.push(destPath);
        }
        // else: unchanged, do nothing
      } catch (err) {
        result.errors.push({
          path: destPath,
          error: (err as Error).message,
        });
        result.success = false;
      }
    }

    // Remove docs not in config
    for (const existingPath of currentPaths) {
      if (!configPaths.has(existingPath)) {
        try {
          if (!options.dryRun) {
            await rm(join(this.docsDir, existingPath));
          }
          result.removed.push(existingPath);
        } catch (err) {
          result.errors.push({
            path: existingPath,
            error: `Failed to remove: ${(err as Error).message}`,
          });
        }
      }
    }

    return result;
  }

  /**
   * Get a status of what would change without actually making changes.
   */
  async status(): Promise<SyncResult> {
    return this.sync({ dryRun: true });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get base docs paths (with fallbacks for development).
 * Matches the logic in setup.ts.
 */
function getDocsBasePath(): string[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return [
    // Bundled location (dist/docs/)
    join(__dirname, 'docs'),
    // Development: packages/tbd/docs/
    join(__dirname, '..', '..', 'docs'),
  ];
}

/**
 * Generate default doc_cache config by scanning bundled docs.
 *
 * This creates a config entry for each .md file found in the bundled
 * docs directories (shortcuts, guidelines, templates).
 *
 * @returns A doc_cache config mapping destination paths to internal: sources
 */
export async function generateDefaultDocCacheConfig(): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  const basePaths = getDocsBasePath();

  // Find the first valid base path
  let docsDir: string | null = null;
  for (const path of basePaths) {
    try {
      await access(path);
      docsDir = path;
      break;
    } catch {
      // Try next path
    }
  }

  if (!docsDir) {
    return config;
  }

  // Directories to scan
  const scanDirs = [
    { subdir: 'shortcuts/system', prefix: 'shortcuts/system' },
    { subdir: 'shortcuts/standard', prefix: 'shortcuts/standard' },
    { subdir: 'guidelines', prefix: 'guidelines' },
    { subdir: 'templates', prefix: 'templates' },
  ];

  for (const { subdir, prefix } of scanDirs) {
    const fullDir = join(docsDir, subdir);
    try {
      const entries = await readdir(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const relativePath = `${prefix}/${entry.name}`;
          config[relativePath] = `${INTERNAL_PREFIX}${relativePath}`;
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return config;
}

/**
 * Merge user's doc_cache config with default bundled docs.
 *
 * This ensures:
 * - New bundled docs from tbd updates are added to existing configs
 * - User's custom sources (URLs, etc.) are preserved
 * - User's overrides of bundled docs are respected
 *
 * @param userConfig - The user's existing doc_cache config (may be undefined/empty)
 * @param defaults - The default config from generateDefaultDocCacheConfig()
 * @returns Merged config with defaults as base, user config overlaid
 */
export function mergeDocCacheConfig(
  userConfig: Record<string, string> | undefined,
  defaults: Record<string, string>,
): Record<string, string> {
  // Start with defaults, overlay user config (user takes precedence)
  return {
    ...defaults,
    ...userConfig,
  };
}

/**
 * Check if docs are stale based on last sync time and configured hours.
 *
 * @param lastSyncAt - ISO timestamp of last sync (or undefined if never synced)
 * @param autoSyncHours - Hours between auto-syncs (0 = disabled)
 * @returns true if docs should be synced
 */
export function isDocsStale(lastSyncAt: string | undefined, autoSyncHours: number): boolean {
  // Auto-sync disabled
  if (autoSyncHours <= 0) {
    return false;
  }

  // Never synced
  if (!lastSyncAt) {
    return true;
  }

  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

  return hoursSinceSync >= autoSyncHours;
}

/**
 * Check if an internal doc source exists.
 * Used to detect stale internal entries that should be pruned.
 *
 * @param location - The internal doc location (without 'internal:' prefix)
 * @returns true if the bundled doc exists
 */
export async function internalDocExists(location: string): Promise<boolean> {
  const basePaths = getDocsBasePath();

  for (const basePath of basePaths) {
    const fullPath = join(basePath, location);
    try {
      await access(fullPath);
      return true;
    } catch {
      // Try next path
    }
  }

  return false;
}

/**
 * Prune entries pointing to non-existent internal sources.
 *
 * This removes stale entries from the config that point to internal docs
 * that no longer exist (e.g., if a shortcut was removed in a tbd update).
 * URL sources are always preserved (they may be temporarily unavailable).
 *
 * @param config - The doc_cache files config
 * @returns Pruned config and list of removed entries
 */
export async function pruneStaleInternals(
  config: Record<string, string>,
): Promise<{ config: Record<string, string>; pruned: string[] }> {
  const result: Record<string, string> = {};
  const pruned: string[] = [];

  for (const [dest, source] of Object.entries(config)) {
    if (source.startsWith('internal:')) {
      const location = source.slice('internal:'.length);
      const exists = await internalDocExists(location);
      if (!exists) {
        pruned.push(dest);
        continue; // Don't include in result
      }
    }
    result[dest] = source;
  }

  return { config: result, pruned };
}

/**
 * Compare two doc_cache file configs for equality.
 *
 * @param a - First config
 * @param b - Second config
 * @returns true if configs are equal
 */
function configsEqual(a: Record<string, string> | undefined, b: Record<string, string>): boolean {
  if (!a) return Object.keys(b).length === 0;

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (a[keysA[i]!] !== b[keysB[i]!]) return false;
  }

  return true;
}

/**
 * Sync docs with merged defaults and auto-pruning.
 *
 * This is the single entry point for all doc sync operations.
 * It handles:
 * - Merging user config with bundled defaults
 * - Pruning stale internal entries
 * - Syncing files to .tbd/docs/
 * - Writing config if changed
 * - Updating last sync timestamp
 *
 * @param tbdRoot - The tbd project root directory
 * @param options - Sync options
 * @returns Result of the sync operation
 */
export async function syncDocsWithDefaults(
  tbdRoot: string,
  options: DocSyncOptions = {},
): Promise<DocSyncResult> {
  // Read current config
  const config = await readConfig(tbdRoot);
  const currentFiles = config.docs_cache?.files;

  // Generate defaults and merge
  const defaults = await generateDefaultDocCacheConfig();
  const merged = mergeDocCacheConfig(currentFiles, defaults);

  // Prune stale internal entries
  const { config: prunedConfig, pruned } = await pruneStaleInternals(merged);

  // Check if config changed
  const configChanged = !configsEqual(currentFiles, prunedConfig);

  // Sync files
  const sync = new DocSync(tbdRoot, prunedConfig);
  const syncResult = options.dryRun ? await sync.status() : await sync.sync();

  // Build result
  const result: DocSyncResult = {
    added: syncResult.added,
    updated: syncResult.updated,
    removed: syncResult.removed,
    pruned,
    configChanged,
    errors: syncResult.errors,
  };

  // Skip state/config updates for dry run
  if (options.dryRun) {
    return result;
  }

  // Write config if changed
  if (configChanged) {
    config.docs_cache = {
      lookup_path: config.docs_cache?.lookup_path ?? [
        '.tbd/docs/shortcuts/system',
        '.tbd/docs/shortcuts/standard',
      ],
      files: prunedConfig,
    };
    await writeConfig(tbdRoot, config);
  }

  // Update last sync time
  await updateLocalState(tbdRoot, {
    last_doc_sync_at: new Date().toISOString(),
  });

  return result;
}
