/**
 * DocCache - Path-ordered markdown document cache with lookup.
 *
 * Provides document lookups for the `tbd shortcut` command, supporting
 * both exact matching by filename and fuzzy matching against metadata.
 *
 * Also provides auto-sync functionality when docs are stale (per spec).
 *
 * See: docs/project/specs/active/plan-2026-01-22-doc-cache-abstraction.md
 * See: docs/project/specs/active/plan-2026-01-26-configurable-doc-cache-sync.md
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import matter from 'gray-matter';

import { readConfig, readLocalState, findTbdRoot } from './config.js';
import { isDocsStale, syncDocsWithDefaults } from './doc-sync.js';
import { estimateTokens } from '../lib/format-utils.js';

// =============================================================================
// Scoring Constants
// =============================================================================

/** Score for exact filename match (with or without .md extension) */
export const SCORE_EXACT_MATCH = 1.0;

/** Score when query is a prefix of the filename */
export const SCORE_PREFIX_MATCH = 0.9;

/** Score when filename contains all query words */
export const SCORE_CONTAINS_ALL = 0.8;

/** Base score for partial word matches (multiplied by matched/total ratio) */
export const SCORE_PARTIAL_BASE = 0.7;

/** Minimum score threshold to return a fuzzy match result */
export const SCORE_MIN_THRESHOLD = 0.5;

// =============================================================================
// Types
// =============================================================================

/**
 * Frontmatter fields used for shortcut documents.
 * These are the expected fields in YAML frontmatter for searchability.
 */
export interface DocFrontmatter {
  /** Display title for the shortcut */
  title?: string;
  /** Brief description for fuzzy matching and listing */
  description?: string;
  /** Category for filtering (e.g., planning, review, git) */
  category?: string;
  /** Optional categorization tags */
  tags?: string[];
}

/**
 * A cached document loaded from the doc path.
 */
export interface CachedDoc {
  /** Full filesystem path to the document */
  path: string;
  /** Filename without extension (used for lookups) */
  name: string;
  /** Parsed YAML frontmatter, if present */
  frontmatter?: DocFrontmatter;
  /** Full file content (including frontmatter for output) */
  content: string;
  /** Which directory in the path this doc came from */
  sourceDir: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Estimated token count (based on ~3.5 chars/token) */
  approxTokens: number;
}

/**
 * A document match with relevance score.
 */
export interface DocMatch {
  /** The matched document */
  doc: CachedDoc;
  /** Match score: 1.0 = exact, lower = fuzzier */
  score: number;
}

// =============================================================================
// DocCache Class
// =============================================================================

/**
 * Options for loading the doc cache.
 */
export interface DocCacheLoadOptions {
  /** If true, suppress auto-sync output (default: false) */
  quiet?: boolean;
}

/**
 * Path-ordered markdown document cache.
 *
 * Loads all .md files from configured paths in order, with earlier paths
 * taking precedence (like shell $PATH). Supports exact lookup by filename
 * and fuzzy search across filename + frontmatter metadata.
 */
export class DocCache {
  /** Active docs (first occurrence of each name) */
  private docs: CachedDoc[] = [];

  /** All docs including shadowed ones */
  private allDocs: CachedDoc[] = [];

  /** Track names we've seen for shadow detection */
  private seenNames = new Set<string>();

  /** Whether the cache has been loaded */
  private loaded = false;

  /**
   * Create a new DocCache.
   *
   * @param paths - Ordered array of directory paths to search (relative to baseDir)
   * @param baseDir - Base directory for resolving relative paths (default: cwd)
   */
  constructor(
    private readonly paths: string[],
    private readonly baseDir: string = process.cwd(),
  ) {}

  /**
   * Load all documents from configured paths.
   *
   * Reads all .md files from each path in order. Documents with the same
   * name in later paths are shadowed (tracked but not returned by default).
   *
   * If auto-sync is enabled and docs are stale, triggers a sync first.
   *
   * @param options - Load options (quiet: suppress auto-sync output)
   */
  async load(options?: DocCacheLoadOptions): Promise<void> {
    if (this.loaded) return;

    // Check for auto-sync before loading
    await this.checkAutoSync(options?.quiet ?? false);

    for (const relativePath of this.paths) {
      const dirPath = join(this.baseDir, relativePath);
      await this.loadDirectory(dirPath, relativePath);
    }

    this.loaded = true;
  }

  /**
   * Check if docs are stale and auto-sync if needed.
   * Respects the quiet option - only silent when explicitly requested.
   *
   * Uses syncDocsWithDefaults() to ensure auto-sync also picks up new bundled
   * docs from tbd upgrades, not just existing config entries.
   *
   * @param quiet - If true, suppress sync output
   */
  private async checkAutoSync(quiet: boolean): Promise<void> {
    try {
      // Find tbd root
      const tbdRoot = await findTbdRoot(this.baseDir);
      if (!tbdRoot) return;

      // Read config and state
      const config = await readConfig(tbdRoot);
      const state = await readLocalState(tbdRoot);

      // Check if auto-sync is enabled and docs are stale
      const autoSyncHours = config.settings?.doc_auto_sync_hours ?? 24;
      if (!isDocsStale(state.last_doc_sync_at, autoSyncHours)) {
        return;
      }

      // Use syncDocsWithDefaults to merge bundled defaults with user config
      // This ensures new bundled docs from tbd upgrades are picked up by auto-sync
      await syncDocsWithDefaults(tbdRoot, { quiet });
    } catch {
      // Auto-sync errors are silent - don't interrupt the user
    }
  }

  /**
   * Load documents from a single directory.
   */
  private async loadDirectory(dirPath: string, sourceDir: string): Promise<void> {
    let entries: string[];

    try {
      entries = await readdir(dirPath);
    } catch {
      // Directory doesn't exist or isn't readable - skip silently
      // This is expected when paths haven't been initialized yet
      return;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;

      const filePath = join(dirPath, entry);
      const name = basename(entry, '.md');

      try {
        const content = await readFile(filePath, 'utf-8');
        const frontmatter = this.parseFrontmatterData(content);
        const sizeBytes = Buffer.byteLength(content, 'utf-8');
        const approxTokens = estimateTokens(content);

        const doc: CachedDoc = {
          path: filePath,
          name,
          frontmatter,
          content,
          sourceDir,
          sizeBytes,
          approxTokens,
        };

        // Track all docs
        this.allDocs.push(doc);

        // Only add to active docs if not shadowed
        if (!this.seenNames.has(name)) {
          this.docs.push(doc);
          this.seenNames.add(name);
        }
      } catch (error) {
        // Failed to read or parse file - skip with warning context
        console.warn(`Failed to load shortcut ${filePath}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Parse YAML frontmatter from content and return typed data.
   * Uses gray-matter for consistent frontmatter parsing.
   */
  private parseFrontmatterData(content: string): DocFrontmatter | undefined {
    if (!matter.test(content)) {
      return undefined;
    }

    try {
      const parsed = matter(content).data as Record<string, unknown>;
      return {
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        description: typeof parsed.description === 'string' ? parsed.description : undefined,
        category: typeof parsed.category === 'string' ? parsed.category : undefined,
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((t) => typeof t === 'string')
          : undefined,
      };
    } catch {
      // Invalid YAML in frontmatter - return undefined
      return undefined;
    }
  }

  /**
   * Get a document by exact name match.
   *
   * @param name - Filename to match (with or without .md extension)
   * @returns Match with score SCORE_EXACT_MATCH, or null if not found
   */
  get(name: string): DocMatch | null {
    // Strip .md extension if present
    const lookupName = name.endsWith('.md') ? name.slice(0, -3) : name;

    const doc = this.docs.find((d) => d.name === lookupName);
    if (!doc) return null;

    return { doc, score: SCORE_EXACT_MATCH };
  }

  /**
   * Search for documents matching a query.
   *
   * Performs fuzzy matching against filename, title, and description.
   * Returns matches sorted by score descending.
   *
   * @param query - Search query string
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of matches sorted by score descending
   */
  search(query: string, limit = 10): DocMatch[] {
    const matches: DocMatch[] = [];

    for (const doc of this.docs) {
      const score = this.calculateScore(doc, query);
      if (score >= SCORE_MIN_THRESHOLD) {
        matches.push({ doc, score });
      }
    }

    // Sort by score descending, then by name for stability
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.doc.name.localeCompare(b.doc.name);
    });

    return matches.slice(0, limit);
  }

  /**
   * Calculate relevance score for a document against a query.
   */
  private calculateScore(doc: CachedDoc, query: string): number {
    const queryLower = query.toLowerCase().trim();

    // Empty query matches nothing
    if (queryLower.length === 0) {
      return 0;
    }

    const nameLower = doc.name.toLowerCase();
    const titleLower = doc.frontmatter?.title?.toLowerCase() ?? '';
    const descLower = doc.frontmatter?.description?.toLowerCase() ?? '';

    // Exact match on name
    if (nameLower === queryLower) {
      return SCORE_EXACT_MATCH;
    }

    // Prefix match on name
    if (nameLower.startsWith(queryLower)) {
      return SCORE_PREFIX_MATCH;
    }

    // Split query into words for multi-word matching
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);
    const searchableText = `${nameLower} ${titleLower} ${descLower}`;

    // Check if all query words are contained
    const allWordsMatch = queryWords.every((word) => searchableText.includes(word));
    if (allWordsMatch && queryWords.length > 0) {
      return SCORE_CONTAINS_ALL;
    }

    // Partial match - count how many words match
    const matchedWords = queryWords.filter((word) => searchableText.includes(word));
    if (matchedWords.length > 0) {
      const ratio = matchedWords.length / queryWords.length;
      return SCORE_PARTIAL_BASE * ratio;
    }

    return 0;
  }

  /**
   * List all documents.
   *
   * @param includeAll - If true, include shadowed documents
   * @returns Array of cached documents
   */
  list(includeAll = false): CachedDoc[] {
    return includeAll ? this.allDocs : this.docs;
  }

  /**
   * Check if a document is shadowed by an earlier path.
   *
   * @param doc - Document to check
   * @returns True if this doc is shadowed (not the first with this name)
   */
  isShadowed(doc: CachedDoc): boolean {
    const firstDoc = this.docs.find((d) => d.name === doc.name);
    return firstDoc !== doc;
  }

  /**
   * Check if the cache has been loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// =============================================================================
// Shortcut Directory Generation
// =============================================================================

/**
 * Marker comments for shortcut directory section in skill files.
 * Used for incremental updates without overwriting user content.
 */
const SHORTCUT_DIRECTORY_BEGIN = '<!-- BEGIN SHORTCUT DIRECTORY -->';
const SHORTCUT_DIRECTORY_END = '<!-- END SHORTCUT DIRECTORY -->';

/**
 * Build table rows from docs (shared helper for shortcuts and guidelines).
 */
function buildTableRows(docs: CachedDoc[], skipNames: string[] = []): string[] {
  const sortedDocs = [...docs].sort((a, b) => a.name.localeCompare(b.name));
  const rows: string[] = [];

  for (const doc of sortedDocs) {
    if (skipNames.includes(doc.name)) {
      continue;
    }

    const name = doc.name;
    const description = doc.frontmatter?.description ?? '';
    const escapedDescription = description.replace(/\|/g, '\\|');

    rows.push(`| ${name} | ${escapedDescription} |`);
  }

  return rows;
}

/**
 * Generate a formatted markdown directory of shortcuts and guidelines.
 *
 * The output includes:
 * 1. Marker comments for incremental updates
 * 2. Available Shortcuts section with name and description
 * 3. Available Guidelines section with name and description (if provided)
 *
 * @param shortcuts - Array of shortcut CachedDoc objects
 * @param guidelines - Optional array of guideline CachedDoc objects
 * @returns Formatted markdown string with shortcuts and guidelines directory
 *
 * @example
 * const directory = generateShortcutDirectory(shortcutDocs, guidelineDocs);
 * // Returns:
 * // <!-- BEGIN SHORTCUT DIRECTORY -->
 * // ## Available Shortcuts
 * // | Name | Description |
 * // | --- | --- |
 * // | code-review-and-commit | Run pre-commit checks, review changes, and commit code |
 * // ...
 * // ## Available Guidelines
 * // | Name | Description |
 * // | --- | --- |
 * // | typescript-rules | TypeScript coding rules and best practices |
 * // ...
 * // <!-- END SHORTCUT DIRECTORY -->
 */
export function generateShortcutDirectory(
  shortcuts: CachedDoc[],
  guidelines: CachedDoc[] = [],
): string {
  const lines: string[] = [SHORTCUT_DIRECTORY_BEGIN];

  // Shortcuts section
  const shortcutRows = buildTableRows(shortcuts, ['skill', 'skill-brief', 'shortcut-explanation']);

  lines.push('## Available Shortcuts');
  lines.push('');
  lines.push('Run `tbd shortcut <name>` to use any of these shortcuts:');
  lines.push('');

  if (shortcutRows.length === 0) {
    lines.push('No shortcuts available. Create shortcuts in `.tbd/docs/shortcuts/standard/`.');
  } else {
    lines.push('| Name | Description |');
    lines.push('| --- | --- |');
    lines.push(...shortcutRows);
  }

  // Guidelines section (if provided)
  if (guidelines.length > 0) {
    const guidelineRows = buildTableRows(guidelines);

    if (guidelineRows.length > 0) {
      lines.push('');
      lines.push('## Available Guidelines');
      lines.push('');
      lines.push('Run `tbd guidelines <name>` to apply any of these guidelines:');
      lines.push('');
      lines.push('| Name | Description |');
      lines.push('| --- | --- |');
      lines.push(...guidelineRows);
    }
  }

  lines.push('');
  lines.push(SHORTCUT_DIRECTORY_END);

  return lines.join('\n');
}
