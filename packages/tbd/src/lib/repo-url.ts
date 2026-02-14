/**
 * Repository URL normalization and slugification.
 *
 * Accepts all common repo URL formats (short, HTTPS, SSH) and normalizes
 * them to a canonical form for consistent handling.
 */

/** Normalized repo URL components. */
export interface NormalizedRepoUrl {
  host: string;
  owner: string;
  repo: string;
}

/**
 * Normalize a repo URL to its canonical components.
 *
 * Accepts:
 * - Short: `github.com/org/repo`
 * - HTTPS: `https://github.com/org/repo` or `https://github.com/org/repo.git`
 * - SSH: `git@github.com:org/repo.git`
 */
export function normalizeRepoUrl(url: string): NormalizedRepoUrl {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Repository URL cannot be empty');
  }

  let host: string;
  let pathPart: string;

  // SSH format: git@github.com:org/repo.git
  const sshMatch = /^git@([^:]+):(.+)$/.exec(trimmed);
  if (sshMatch) {
    host = sshMatch[1]!.toLowerCase();
    pathPart = sshMatch[2]!;
  } else {
    // Strip protocol
    let cleaned = trimmed;
    if (cleaned.startsWith('https://') || cleaned.startsWith('http://')) {
      cleaned = cleaned.replace(/^https?:\/\//, '');
    }

    // Split host from path
    const slashIndex = cleaned.indexOf('/');
    if (slashIndex === -1) {
      throw new Error(`Invalid repository URL: ${url} (missing owner/repo path)`);
    }
    host = cleaned.slice(0, slashIndex).toLowerCase();
    pathPart = cleaned.slice(slashIndex + 1);
  }

  // Clean up path: strip .git suffix and trailing slashes
  pathPart = pathPart.replace(/\.git$/, '').replace(/\/+$/, '');

  const parts = pathPart.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid repository URL: ${url} (need owner/repo)`);
  }

  return {
    host,
    owner: parts[0]!,
    repo: parts[1]!,
  };
}

/**
 * Convert a repo URL to a filesystem-safe slug for cache directories.
 *
 * All URL formats produce the same deterministic slug:
 * `github.com-jlevy-speculate`
 */
export function repoUrlToSlug(url: string): string {
  const { host, owner, repo } = normalizeRepoUrl(url);
  return `${host}-${owner}-${repo}`;
}

/**
 * Get the HTTPS clone URL for a repo.
 */
export function getCloneUrl(url: string): string {
  const { host, owner, repo } = normalizeRepoUrl(url);
  return `https://${host}/${owner}/${repo}.git`;
}
