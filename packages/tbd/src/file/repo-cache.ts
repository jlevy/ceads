/**
 * RepoCache: Sparse git checkout caching for external doc repos.
 *
 * Manages local clones of external doc repositories, using shallow sparse
 * checkouts to minimize disk usage. Each repo is cached under
 * .tbd/repo-cache/{slug}/ where slug is derived from the repo URL.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, isAbsolute, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, access, stat, rm } from 'node:fs/promises';
import { repoUrlToSlug, getCloneUrl } from '../lib/repo-url.js';

const execFileAsync = promisify(execFile);

/** A scanned doc file with its relative path and content. */
export interface ScannedDoc {
  relativePath: string;
  content: string;
}

/**
 * Cache for external git repository checkouts.
 *
 * Uses shallow sparse clones to efficiently cache external doc repos
 * under .tbd/repo-cache/.
 */
export class RepoCache {
  readonly cacheDir: string;

  constructor(tbdRoot: string) {
    this.cacheDir = join(tbdRoot, '.tbd', 'repo-cache');
  }

  /**
   * Get the deterministic directory path for a repo URL.
   * Handles both remote URLs and local filesystem paths.
   */
  getRepoDir(url: string): string {
    if (this.isLocalPath(url)) {
      // Local paths: hash to get a deterministic slug
      const hash = createHash('sha256').update(url).digest('hex').slice(0, 12);
      return join(this.cacheDir, `local-${hash}`);
    }
    const slug = repoUrlToSlug(url);
    return join(this.cacheDir, slug);
  }

  /**
   * Ensure a repo is cloned and up-to-date.
   *
   * On first access, performs a shallow clone. On subsequent accesses,
   * fetches and updates to the latest ref.
   *
   * @param url - Repository URL (any format: short, HTTPS, SSH)
   * @param ref - Git ref to checkout (branch/tag, defaults to 'main')
   * @param paths - Directory paths to include in sparse checkout
   * @param onProgress - Optional callback for progress messages
   * @returns Path to the local checkout directory
   */
  async ensureRepo(
    url: string,
    ref: string,
    paths: string[],
    onProgress?: (message: string) => void,
  ): Promise<string> {
    const repoDir = this.getRepoDir(url);
    await mkdir(this.cacheDir, { recursive: true });

    const exists = await this.isCloned(repoDir);

    if (!exists) {
      onProgress?.(`Cloning ${url}...`);
      await this.cloneRepo(url, ref, repoDir, paths);
    } else {
      onProgress?.(`Updating ${url}...`);
      await this.updateRepo(repoDir, ref, paths);
    }

    return repoDir;
  }

  /**
   * Scan a checked-out repo for .md files in specified paths.
   *
   * @param repoDir - Path to the local checkout
   * @param paths - Directory paths to scan (e.g., ['shortcuts/', 'guidelines/'])
   * @returns Array of scanned docs with relative paths and content
   */
  async scanDocs(repoDir: string, paths: string[]): Promise<ScannedDoc[]> {
    const docs: ScannedDoc[] = [];

    for (const pathPattern of paths) {
      const dirPath = join(repoDir, pathPattern);
      try {
        await access(dirPath);
      } catch {
        continue; // Directory doesn't exist, skip
      }

      const entries = await this.findMdFiles(dirPath);
      for (const relativeMdPath of entries) {
        const fullPath = join(dirPath, relativeMdPath);
        const content = await readFile(fullPath, 'utf-8');
        // relativePath is relative to repoDir, always uses forward slashes
        const relativePath = join(pathPattern, relativeMdPath).replace(/\\/g, '/');
        docs.push({ relativePath, content });
      }
    }

    return docs;
  }

  private async isCloned(repoDir: string): Promise<boolean> {
    try {
      const s = await stat(join(repoDir, '.git'));
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  private async cloneRepo(
    url: string,
    ref: string,
    repoDir: string,
    paths: string[],
  ): Promise<void> {
    const cloneUrl = this.resolveCloneUrl(url);

    try {
      // Shallow clone with sparse checkout
      await execFileAsync('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        ref,
        '--sparse',
        cloneUrl,
        repoDir,
      ]);

      // Set sparse checkout paths
      if (paths.length > 0) {
        await execFileAsync('git', ['-C', repoDir, 'sparse-checkout', 'set', '--', ...paths]);
      }
    } catch (err) {
      // Clean up partial clone on failure
      try {
        await rm(repoDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to clone ${url} (ref: ${ref}): ${message}. ` +
          'Check that the URL and ref are correct and you have access.',
      );
    }
  }

  private async updateRepo(repoDir: string, ref: string, paths: string[]): Promise<void> {
    try {
      // Update sparse checkout paths if needed
      if (paths.length > 0) {
        await execFileAsync('git', ['-C', repoDir, 'sparse-checkout', 'set', '--', ...paths]);
      }

      // Fetch latest
      await execFileAsync('git', ['-C', repoDir, 'fetch', '--depth', '1', 'origin', ref]);
      await execFileAsync('git', ['-C', repoDir, 'checkout', 'FETCH_HEAD']);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to update repo cache (ref: ${ref}): ${message}. ` +
          'Try removing the cache directory and re-syncing.',
      );
    }
  }

  /**
   * Check if a URL is a local filesystem path.
   */
  private isLocalPath(url: string): boolean {
    return (
      url.startsWith('/') || url.startsWith('.') || url.startsWith('file://') || isAbsolute(url)
    );
  }

  /**
   * Resolve a URL to a clone-able format.
   * Local paths use file:// protocol to support --depth.
   */
  private resolveCloneUrl(url: string): string {
    // Already a file:// URL
    if (url.startsWith('file://')) {
      return url;
    }
    // Local paths (absolute or relative, including Windows drive letters) - convert to file:// for --depth support
    if (url.startsWith('/') || url.startsWith('.') || isAbsolute(url)) {
      // Resolve relative paths to absolute before creating file:// URL
      const absPath = isAbsolute(url) ? url : resolve(url);
      return `file://${absPath}`;
    }
    // Already a full URL or SSH format
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('git@')) {
      return url;
    }
    // Short format (github.com/org/repo) - convert to HTTPS
    return getCloneUrl(url);
  }

  /**
   * Recursively find all .md files in a directory.
   * Returns paths relative to the given directory.
   */
  private async findMdFiles(dirPath: string): Promise<string[]> {
    const results: string[] = [];

    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subResults = await this.findMdFiles(join(dirPath, entry.name));
        for (const sub of subResults) {
          results.push(join(entry.name, sub));
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(entry.name);
      }
    }

    return results;
  }
}
