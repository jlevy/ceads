/**
 * DocCache - Path-ordered markdown document cache with lookup.
 *
 * Provides document lookups for the `tbd shortcut` command, supporting
 * both exact matching by filename and fuzzy matching against metadata.
 *
 * See: docs/project/specs/active/plan-2026-01-22-doc-cache-abstraction.md
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { parseFrontmatter } from '../utils/markdown-utils.js';

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
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    for (const relativePath of this.paths) {
      const dirPath = join(this.baseDir, relativePath);
      await this.loadDirectory(dirPath, relativePath);
    }

    this.loaded = true;
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

        const doc: CachedDoc = {
          path: filePath,
          name,
          frontmatter,
          content,
          sourceDir,
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
   */
  private parseFrontmatterData(content: string): DocFrontmatter | undefined {
    const rawFrontmatter = parseFrontmatter(content);
    if (!rawFrontmatter) return undefined;

    try {
      const parsed = parseYaml(rawFrontmatter) as Record<string, unknown>;
      return {
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        description: typeof parsed.description === 'string' ? parsed.description : undefined,
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
    const queryLower = query.toLowerCase();
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
