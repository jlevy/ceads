/**
 * DocSync - Sync documentation files from configured sources.
 *
 * Syncs docs from internal bundled sources and external URLs to .tbd/docs/.
 *
 * See: docs/project/specs/active/plan-2026-01-26-configurable-doc-cache-sync.md
 */

import { readdir, readFile, rm, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
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
 * Options for doc sync operations.
 */
export interface DocSyncOptions {
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
   * parseSource('internal:tbd/shortcuts/code-review-and-commit.md')
   * // => { type: 'internal', location: 'tbd/shortcuts/code-review-and-commit.md' }
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
  async sync(options: DocSyncOptions = {}): Promise<SyncResult> {
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

  // Directories to scan (prefix-based layout)
  const scanDirs = [
    { subdir: 'sys/shortcuts', prefix: 'sys/shortcuts' },
    { subdir: 'tbd/shortcuts', prefix: 'tbd/shortcuts' },
    { subdir: 'tbd/guidelines', prefix: 'tbd/guidelines' },
    { subdir: 'tbd/templates', prefix: 'tbd/templates' },
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

// =============================================================================
// Unified Doc Sync with Defaults
// =============================================================================

// Reuse INTERNAL_PREFIX constant from above

/**
 * Options for syncDocsWithDefaults.
 */
export interface SyncDocsOptions {
  /** If true, suppress output (for auto-sync) */
  quiet?: boolean;
  /** If true, don't write files or config (dry run for --status) */
  dryRun?: boolean;
}

/**
 * Result of syncDocsWithDefaults.
 */
export interface SyncDocsResult {
  /** Paths of newly downloaded/copied docs */
  added: string[];
  /** Paths of updated docs (content changed) */
  updated: string[];
  /** Paths of removed docs (no longer in config) */
  removed: string[];
  /** Entries removed due to missing internal sources */
  pruned: string[];
  /** Whether the config was modified (new defaults merged or stale pruned) */
  configChanged: boolean;
  /** Errors encountered during sync */
  errors: { path: string; error: string }[];
  /** Whether the sync was successful overall */
  success: boolean;
}

/**
 * Check if an internal bundled doc exists.
 *
 * @param location - The internal doc path (without 'internal:' prefix)
 * @returns true if the doc exists in any of the bundled doc paths
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
 * Prune entries from config that point to non-existent internal sources.
 *
 * This handles the case where a bundled doc is removed in a tbd update -
 * the stale config entry is automatically cleaned up.
 *
 * @param config - The doc_cache config to prune
 * @returns Object with pruned config and list of removed entries
 */
export async function pruneStaleInternals(
  config: Record<string, string>,
): Promise<{ config: Record<string, string>; pruned: string[] }> {
  const result: Record<string, string> = {};
  const pruned: string[] = [];

  for (const [dest, source] of Object.entries(config)) {
    if (source.startsWith(INTERNAL_PREFIX)) {
      const location = source.slice(INTERNAL_PREFIX.length);
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

// =============================================================================
// Source-based resolution (Phase 1)
// =============================================================================

/** A source entry matching DocsSourceSchema shape. */
interface SourceEntry {
  type: 'internal' | 'repo';
  prefix: string;
  url?: string;
  ref?: string;
  paths: string[];
  hidden?: boolean;
}

/**
 * Resolve an array of doc sources into a flat file map.
 *
 * For each source:
 * - internal: scans bundled docs at {prefix}/{path} and generates internal: entries
 * - repo: (future) uses RepoCache to checkout and scan
 *
 * Files overrides are applied last, taking highest precedence.
 *
 * @param sources - Array of source entries (from config.docs_cache.sources)
 * @param filesOverrides - Optional file overrides (from config.docs_cache.files)
 * @returns Flat map of destination path → source string
 */
export async function resolveSourcesToDocs(
  sources: SourceEntry[],
  filesOverrides?: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const source of sources) {
    if (source.type === 'internal') {
      await resolveInternalSource(source, result);
    }
    // repo type will be added in Phase 2
  }

  // Apply files overrides last (highest precedence)
  if (filesOverrides) {
    for (const [dest, src] of Object.entries(filesOverrides)) {
      result[dest] = src;
    }
  }

  return result;
}

/**
 * Resolve an internal source by scanning bundled docs.
 */
async function resolveInternalSource(
  source: SourceEntry,
  result: Record<string, string>,
): Promise<void> {
  const basePaths = getDocsBasePath();

  for (const pathPattern of source.paths) {
    // Try each base path to find bundled docs
    for (const basePath of basePaths) {
      const scanDir = join(basePath, source.prefix, pathPattern);
      try {
        await access(scanDir);
      } catch {
        continue; // Try next base path
      }

      // Scan for .md files
      const files = await scanMdFiles(scanDir);
      for (const file of files) {
        const destPath = `${source.prefix}/${pathPattern}${file}`;
        const sourcePath = `internal:${source.prefix}/${pathPattern}${file}`;
        result[destPath] = sourcePath;
      }
      break; // Found in this base path, no need to check others
    }
  }
}

/**
 * Recursively scan a directory for .md files.
 * Returns paths relative to the given directory.
 */
async function scanMdFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subResults = await scanMdFiles(join(dirPath, entry.name));
        for (const sub of subResults) {
          results.push(`${entry.name}/${sub}`);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return results;
}

/**
 * Compute a deterministic hash of a sources array.
 *
 * Used to detect when source configuration changes, triggering a cache clear.
 * Returns the first 8 hex characters of a SHA256 hash.
 */
export function getSourcesHash(sources: SourceEntry[]): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(sources));
  return hash.digest('hex').slice(0, 8);
}

/** Path to the sources hash file within .tbd/docs/. */
const SOURCES_HASH_FILE = '.sources-hash';

/**
 * Read the stored sources hash from .tbd/docs/.sources-hash.
 * Returns undefined if the file doesn't exist.
 */
export async function readSourcesHash(tbdRoot: string): Promise<string | undefined> {
  const hashPath = join(tbdRoot, TBD_DOCS_DIR, SOURCES_HASH_FILE);
  try {
    const content = await readFile(hashPath, 'utf-8');
    return content.trim();
  } catch {
    return undefined;
  }
}

/**
 * Write the sources hash to .tbd/docs/.sources-hash.
 */
export async function writeSourcesHash(tbdRoot: string, hash: string): Promise<void> {
  const docsDir = join(tbdRoot, TBD_DOCS_DIR);
  await mkdir(docsDir, { recursive: true });
  const hashPath = join(docsDir, SOURCES_HASH_FILE);
  await writeFile(hashPath, hash + '\n');
}

/**
 * Check if the docs cache should be cleared.
 *
 * Returns true if:
 * - No hash file exists (first sync or post-migration)
 * - Hash doesn't match current sources config
 *
 * .tbd/docs/ is gitignored and fully regenerable, so clearing is safe.
 */
export async function shouldClearDocsCache(
  tbdRoot: string,
  sources: SourceEntry[],
): Promise<boolean> {
  const storedHash = await readSourcesHash(tbdRoot);
  if (!storedHash) {
    return true;
  }
  const currentHash = getSourcesHash(sources);
  return storedHash !== currentHash;
}

/**
 * Deep equality check for config objects.
 */
function configsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.hasOwn(b, key) || a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Sync docs with merged defaults and auto-pruning.
 *
 * This is the single entry point for all doc sync operations that need
 * to pick up new bundled docs from tbd upgrades.
 *
 * Steps:
 * 1. Read current config
 * 2. Generate defaults from bundled docs
 * 3. Merge: defaults as base, user config overlays
 * 4. Prune entries with missing internal sources
 * 5. Sync files to .tbd/docs/
 * 6. Write config if changed
 * 7. Update last_doc_sync_at in state
 *
 * @param tbdRoot - The tbd project root directory
 * @param options - Sync options (quiet, dryRun)
 * @returns Sync result with added/updated/removed/pruned counts
 */
export async function syncDocsWithDefaults(
  tbdRoot: string,
  options: SyncDocsOptions = {},
): Promise<SyncDocsResult> {
  // 1. Read current config
  const config = await readConfig(tbdRoot);
  const originalFiles = config.docs_cache?.files ?? {};

  // 2. Generate defaults from bundled docs
  const defaults = await generateDefaultDocCacheConfig();

  // 3. Merge: defaults as base, user config overlays
  const merged = mergeDocCacheConfig(originalFiles, defaults);

  // 4. Prune entries with missing internal sources
  const { config: prunedConfig, pruned } = await pruneStaleInternals(merged);

  // 5. Sync files to .tbd/docs/
  const docSync = new DocSync(tbdRoot, prunedConfig);
  const syncResult = await docSync.sync({ dryRun: options.dryRun });

  // 6. Check if config changed (files)
  const configChanged = !configsEqual(prunedConfig, originalFiles);

  // 7. Write config if changed (and not dry run)
  if (configChanged && !options.dryRun) {
    config.docs_cache = {
      ...config.docs_cache,
      files: prunedConfig,
    };
    // Remove deprecated lookup_path if still present (f04 migration)
    delete config.docs_cache.lookup_path;
    await writeConfig(tbdRoot, config);
  }

  // 8. Update state (and not dry run)
  if (!options.dryRun) {
    await updateLocalState(tbdRoot, {
      last_doc_sync_at: new Date().toISOString(),
    });
  }

  return {
    added: syncResult.added,
    updated: syncResult.updated,
    removed: syncResult.removed,
    pruned,
    configChanged,
    errors: syncResult.errors,
    success: syncResult.success,
  };
}
