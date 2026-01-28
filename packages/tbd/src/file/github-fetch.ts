/**
 * GitHub URL utilities and content fetching with `gh` CLI fallback.
 *
 * Consolidates all GitHub-specific URL handling and fetching logic:
 * - GitHub blob URL → raw URL conversion
 * - Direct HTTP fetch with timeout
 * - Fallback to `gh api` on 403 errors (common in restricted environments)
 *
 * This module is reusable across doc-sync, doc-add, and any future code
 * that needs to fetch content from GitHub.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
 * Regular expression to match raw.githubusercontent.com URLs.
 *
 * Matches patterns like:
 *   https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}
 */
const RAW_GITHUB_RE = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;

/**
 * Convert a GitHub blob URL to a raw.githubusercontent.com URL.
 *
 * If the URL is already a raw URL or not a GitHub blob URL, returns it unchanged.
 *
 * @example
 * githubBlobToRawUrl('https://github.com/org/repo/blob/main/docs/file.md')
 * // => 'https://raw.githubusercontent.com/org/repo/main/docs/file.md'
 *
 * @example
 * githubBlobToRawUrl('https://raw.githubusercontent.com/org/repo/main/docs/file.md')
 * // => 'https://raw.githubusercontent.com/org/repo/main/docs/file.md' (unchanged)
 */
export function githubBlobToRawUrl(url: string): string {
  const match = GITHUB_BLOB_RE.exec(url);
  if (!match) {
    return url;
  }
  const [, owner, repo, ref, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

/**
 * Check if a URL is a GitHub-hosted URL (github.com or raw.githubusercontent.com).
 */
export function isGitHubUrl(url: string): boolean {
  return /^https?:\/\/(github\.com|raw\.githubusercontent\.com)\//.test(url);
}

/**
 * Parse a raw.githubusercontent.com URL into its components.
 *
 * @returns The parsed components, or null if not a raw GitHub URL
 */
export function parseRawGitHubUrl(
  url: string,
): { owner: string; repo: string; ref: string; path: string } | null {
  const match = RAW_GITHUB_RE.exec(url);
  if (!match) {
    return null;
  }
  return {
    owner: match[1]!,
    repo: match[2]!,
    ref: match[3]!,
    path: match[4]!,
  };
}

// =============================================================================
// HTTP Fetching
// =============================================================================

/** Default timeout for URL fetches in milliseconds */
const DEFAULT_FETCH_TIMEOUT = 30000;

/**
 * Options for fetching content.
 */
export interface FetchOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Result of a fetch operation.
 */
export interface FetchResult {
  /** The fetched content */
  content: string;
  /** Whether the gh CLI was used as a fallback */
  usedGhCli: boolean;
}

/**
 * Fetch content from a URL via direct HTTP.
 *
 * @throws If the request fails or returns a non-OK status
 */
export async function directFetch(url: string, options?: FetchOptions): Promise<string> {
  const timeout = options?.timeout ?? DEFAULT_FETCH_TIMEOUT;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'get-tbd/1.0',
        Accept: 'text/plain, text/markdown, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// gh CLI Fetching
// =============================================================================

/**
 * Fetch content from a GitHub raw URL using `gh api`.
 *
 * Converts raw.githubusercontent.com URLs to GitHub API content endpoints
 * and decodes the base64-encoded response.
 *
 * @throws If the URL is not a GitHub URL or gh CLI fails
 */
export async function ghCliFetch(rawUrl: string): Promise<string> {
  const parsed = parseRawGitHubUrl(rawUrl);

  if (parsed) {
    try {
      const { stdout } = await execFileAsync('gh', [
        'api',
        `/repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path}?ref=${parsed.ref}`,
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

  // For non-raw-GitHub URLs, attempt a direct gh api call
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
// Combined Fetch with Fallback
// =============================================================================

/**
 * Fetch content from a URL, falling back to `gh` CLI on 403 errors.
 *
 * GitHub.com and raw.githubusercontent.com may block requests from
 * certain environments (e.g., CI runners, corporate proxies). When
 * a 403 is received, we retry using `gh api` which authenticates
 * via the user's GitHub CLI token.
 *
 * This function also auto-converts GitHub blob URLs to raw URLs.
 *
 * @returns The fetched content and whether gh CLI was used
 * @throws If both direct fetch and gh CLI fallback fail
 */
export async function fetchWithGhFallback(
  url: string,
  options?: FetchOptions,
): Promise<FetchResult> {
  const rawUrl = githubBlobToRawUrl(url);

  // Try direct fetch first
  try {
    const content = await directFetch(rawUrl, options);
    return { content, usedGhCli: false };
  } catch (error) {
    const is403 = error instanceof Error && error.message.includes('HTTP 403');
    if (!is403) {
      throw error;
    }
  }

  // 403 error - try gh CLI fallback
  const content = await ghCliFetch(rawUrl);
  return { content, usedGhCli: true };
}
