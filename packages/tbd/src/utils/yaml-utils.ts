/**
 * YAML utility functions.
 *
 * Provides helpers for parsing YAML with better error detection,
 * particularly for merge conflict markers.
 */

import { parse as parseYaml } from 'yaml';

/**
 * Error thrown when YAML content contains unresolved merge conflict markers.
 */
export class MergeConflictError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = 'MergeConflictError';
  }
}

/**
 * Regex patterns for git merge conflict markers.
 */
const CONFLICT_PATTERNS = {
  start: /^<<<<<<< /m,
  separator: /^=======/m,
  end: /^>>>>>>> /m,
};

/**
 * Check if content contains git merge conflict markers.
 */
export function hasMergeConflictMarkers(content: string): boolean {
  return (
    CONFLICT_PATTERNS.start.test(content) ||
    CONFLICT_PATTERNS.separator.test(content) ||
    CONFLICT_PATTERNS.end.test(content)
  );
}

/**
 * Parse YAML content with merge conflict detection.
 *
 * If the content contains merge conflict markers, throws a MergeConflictError
 * with a helpful message instead of a cryptic YAML parse error.
 *
 * @param content - The YAML content to parse
 * @param filePath - Optional file path for error messages
 * @returns Parsed YAML data
 * @throws MergeConflictError if content has conflict markers
 * @throws Error if YAML is invalid for other reasons
 */
export function parseYamlWithConflictDetection<T = unknown>(content: string, filePath?: string): T {
  // Check for merge conflict markers first
  if (hasMergeConflictMarkers(content)) {
    const location = filePath ? ` in ${filePath}` : '';
    throw new MergeConflictError(
      `File${location} contains unresolved git merge conflict markers.\n` +
        `This usually happens when 'tbd sync' encountered conflicts that weren't properly resolved.\n` +
        `To fix: manually edit the file to resolve conflicts, or run 'tbd doctor --fix'.`,
      filePath,
    );
  }

  return parseYaml(content) as T;
}
