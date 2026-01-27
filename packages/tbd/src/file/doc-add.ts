/**
 * Add external documentation to the tbd doc cache.
 *
 * Supports adding docs by URL (including GitHub blob URLs which are
 * auto-converted to raw URLs). Falls back to `gh` CLI for fetching
 * when direct HTTP fetch fails with 403 (common in restricted environments).
 */

import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { writeFile } from 'atomically';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { readConfig, writeConfig } from './config.js';
import { TBD_DOCS_DIR } from '../lib/paths.js';

const execFileAsync = promisify(execFile);

// =============================================================================
// Types
// =============================================================================

/**
 * The type of document being added.
 */
export type DocType = 'guideline' | 'shortcut' | 'template';

/**
 * Options for adding a document.
 */
export interface AddDocOptions {
  /** URL to fetch the document from */
  url: string;
  /** Name for the document (without .md extension) */
  name: string;
  /** Type of document */
  docType: DocType;
}

/**
 * Result of adding a document.
 */
export interface AddDocResult {
  /** The destination path relative to .tbd/docs/ */
  destPath: string;
  /** The raw URL used to fetch the content */
  rawUrl: string;
  /** Whether gh CLI was used as fallback */
  usedGhCli: boolean;
}

// =============================================================================
// GitHub URL Conversion
// =============================================================================

/**
 * Regular expression to match GitHub blob URLs.
 *
 * Matches patterns like:
 *   https://github.com/{owner}/{repo}/blob/{ref}/{path}
 */
const GITHUB_BLOB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;

/**
 * Convert a GitHub blob URL to a raw.githubusercontent.com URL.
 *
 * If the URL is already a raw URL or not a GitHub blob URL, returns it unchanged.
 *
 * @example
 * githubToRawUrl('https://github.com/org/repo/blob/main/docs/file.md')
 * // => 'https://raw.githubusercontent.com/org/repo/main/docs/file.md'
 */
export function githubToRawUrl(url: string): string {
  const match = GITHUB_BLOB_RE.exec(url);
  if (!match) {
    return url;
  }
  const [, owner, repo, ref, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

// =============================================================================
// Fetching with gh CLI Fallback
// =============================================================================

/** Timeout for URL fetches in milliseconds */
const FETCH_TIMEOUT = 30000;

/**
 * Fetch content from a URL, falling back to `gh` CLI on 403 errors.
 *
 * GitHub.com and raw.githubusercontent.com may block requests from
 * certain environments (e.g., CI runners, corporate proxies). When
 * a 403 is received, we retry using `gh api` which authenticates
 * via the user's GitHub CLI token.
 *
 * @returns Object with the fetched content and whether gh CLI was used
 * @throws If both direct fetch and gh CLI fallback fail
 */
export async function fetchWithGhFallback(
  url: string,
): Promise<{ content: string; usedGhCli: boolean }> {
  const rawUrl = githubToRawUrl(url);

  // Try direct fetch first
  try {
    const content = await directFetch(rawUrl);
    return { content, usedGhCli: false };
  } catch (error) {
    const is403 = error instanceof Error && error.message.includes('HTTP 403');
    if (!is403) {
      throw error;
    }
  }

  // 403 error - try gh CLI fallback for GitHub URLs
  const ghContent = await ghCliFetch(rawUrl);
  return { content: ghContent, usedGhCli: true };
}

/**
 * Fetch content directly via HTTP.
 */
async function directFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'tbd-git/1.0',
        Accept: 'text/plain, text/markdown, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch content using `gh api` for authenticated GitHub access.
 *
 * Converts raw.githubusercontent.com URLs to GitHub API content endpoints.
 */
async function ghCliFetch(rawUrl: string): Promise<string> {
  // Convert raw.githubusercontent.com URL to API URL
  const rawMatch = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(
    rawUrl,
  );

  if (rawMatch) {
    const [, owner, repo, ref, path] = rawMatch;
    // Use gh api to fetch file contents
    try {
      const { stdout } = await execFileAsync('gh', [
        'api',
        `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
        '--jq',
        '.content',
        '-H',
        'Accept: application/vnd.github.v3+json',
      ]);

      // GitHub API returns base64-encoded content
      const base64Content = stdout.trim();
      return Buffer.from(base64Content, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error(
        `Failed to fetch via gh CLI: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // For non-GitHub URLs, try a simple curl-like approach via gh
  try {
    const { stdout } = await execFileAsync('gh', ['api', rawUrl]);
    return stdout;
  } catch (error) {
    throw new Error(
      `Failed to fetch via gh CLI: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// =============================================================================
// Content Validation
// =============================================================================

/**
 * Validate that fetched content looks like a reasonable markdown document.
 *
 * @throws If content fails sanity checks
 */
export function validateDocContent(content: string, name: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error(`Fetched content for "${name}" is empty`);
  }

  if (content.length < 10) {
    throw new Error(`Fetched content for "${name}" is too short (${content.length} chars)`);
  }

  // Check for HTML error pages
  if (content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<html')) {
    throw new Error(
      `Fetched content for "${name}" appears to be an HTML page, not a markdown document`,
    );
  }

  // Check for binary content (high ratio of non-printable characters)
  const nonPrintable = content.split('').filter((c) => {
    const code = c.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  }).length;
  if (nonPrintable / content.length > 0.1) {
    throw new Error(`Fetched content for "${name}" appears to be binary, not a text document`);
  }
}

// =============================================================================
// Doc Type to Path Mapping
// =============================================================================

/**
 * Get the destination subdirectory for a doc type.
 */
export function getDocTypeSubdir(docType: DocType): string {
  switch (docType) {
    case 'guideline':
      return 'guidelines';
    case 'shortcut':
      return 'shortcuts/standard';
    case 'template':
      return 'templates';
  }
}

// =============================================================================
// Main Add Function
// =============================================================================

/**
 * Add an external document to the tbd doc cache.
 *
 * This function:
 * 1. Converts GitHub blob URLs to raw URLs
 * 2. Fetches the content (with gh CLI fallback on 403)
 * 3. Validates the content looks like markdown
 * 4. Writes the file to .tbd/docs/{type}/{name}.md
 * 5. Atomically updates the config to include the new source
 *
 * @throws If fetching, validation, or config update fails
 */
export async function addDoc(tbdRoot: string, options: AddDocOptions): Promise<AddDocResult> {
  const { url, name, docType } = options;

  // Normalize name (strip .md if provided)
  const cleanName = name.endsWith('.md') ? name.slice(0, -3) : name;
  const filename = `${cleanName}.md`;
  const subdir = getDocTypeSubdir(docType);
  const destPath = `${subdir}/${filename}`;
  const rawUrl = githubToRawUrl(url);

  // Fetch content
  const { content, usedGhCli } = await fetchWithGhFallback(url);

  // Validate content
  validateDocContent(content, cleanName);

  // Write file to .tbd/docs/{subdir}/{name}.md
  const fullPath = join(tbdRoot, TBD_DOCS_DIR, destPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);

  // Atomically update config
  const config = await readConfig(tbdRoot);
  config.docs_cache ??= { files: {}, lookup_path: [] };
  config.docs_cache.files ??= {};
  config.docs_cache.files[destPath] = rawUrl;

  // Ensure the lookup_path includes the subdir
  const lookupDir = `.tbd/docs/${subdir}`;
  if (!config.docs_cache.lookup_path.includes(lookupDir)) {
    config.docs_cache.lookup_path.push(lookupDir);
  }

  await writeConfig(tbdRoot, config);

  return { destPath, rawUrl, usedGhCli };
}
