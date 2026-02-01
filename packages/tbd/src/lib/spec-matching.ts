/**
 * Spec path matching utilities.
 *
 * Provides gradual path matching for linking beads to spec documents.
 * Supports matching by filename, partial path suffix, or full path.
 *
 * See: plan-2026-01-26-spec-linking.md §Gradual Path Matching Algorithm
 */

import { basename } from 'node:path';

/**
 * Check if a stored spec path matches a query path using gradual matching.
 *
 * Matching rules (in order of precedence):
 * 1. Exact match after normalization
 * 2. Suffix match: stored path ends with query path at a path separator
 * 3. Filename match: query matches the filename portion of stored path
 *
 * @param storedPath - The spec_path stored in the issue (e.g., "docs/specs/plan-feature.md")
 * @param queryPath - The path to match against (e.g., "plan-feature.md" or "specs/plan-feature.md")
 * @returns true if the paths match
 *
 * @example
 * // All these queries match stored path "docs/project/specs/active/plan-2026-01-26-feature.md":
 * matchesSpecPath(stored, "plan-2026-01-26-feature.md")           // filename match
 * matchesSpecPath(stored, "feature.md")                           // partial filename - NO MATCH (too ambiguous)
 * matchesSpecPath(stored, "active/plan-2026-01-26-feature.md")    // suffix match
 * matchesSpecPath(stored, "docs/project/specs/active/plan-2026-01-26-feature.md")  // exact match
 */
export function matchesSpecPath(storedPath: string, queryPath: string): boolean {
  // Handle empty/null cases
  if (!storedPath || !queryPath) {
    return false;
  }

  // Normalize paths: remove leading ./ and trailing /
  const normalizedStored = normalizePath(storedPath);
  const normalizedQuery = normalizePath(queryPath);

  // Empty after normalization
  if (!normalizedStored || !normalizedQuery) {
    return false;
  }

  // 1. Exact match
  if (normalizedStored === normalizedQuery) {
    return true;
  }

  // 2. Suffix match: stored path ends with /query
  // This handles partial path matches like "active/plan.md" matching "docs/specs/active/plan.md"
  if (normalizedStored.endsWith('/' + normalizedQuery)) {
    return true;
  }

  // 3. Filename match: query is just a filename that matches stored's filename
  const storedFilename = basename(normalizedStored);
  const queryFilename = basename(normalizedQuery);

  // Only do filename match if query has no directory components
  // (otherwise it would have matched in suffix check above)
  if (!normalizedQuery.includes('/') && storedFilename === normalizedQuery) {
    return true;
  }

  // Also match if both have same filename and query is just a filename
  if (!normalizedQuery.includes('/') && storedFilename === queryFilename) {
    return true;
  }

  return false;
}

/**
 * Normalize a path for comparison.
 * - Removes leading ./
 * - Removes trailing /
 * - Collapses multiple slashes
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\.\//, '') // Remove leading ./
    .replace(/\/+$/, '') // Remove trailing /
    .replace(/\/+/g, '/'); // Collapse multiple slashes
}
