/**
 * YAML utility functions.
 *
 * Provides centralized YAML parsing and serialization with:
 * - Merge conflict detection for user-editable files
 * - Consistent, readable formatting defaults
 * - Proper handling of special characters (colons, quotes, etc.)
 *
 * IMPORTANT: Always use these utilities instead of raw yaml package functions.
 * This ensures consistent formatting and proper error handling across the codebase.
 */

import { parse as parseYaml, stringify } from 'yaml';

import {
  YAML_LINE_WIDTH,
  YAML_STRINGIFY_OPTIONS,
  YAML_STRINGIFY_OPTIONS_COMPACT,
  type YamlStringifyOptions,
} from '../lib/settings.js';

// Re-export for convenience
export { YAML_LINE_WIDTH, YAML_STRINGIFY_OPTIONS, YAML_STRINGIFY_OPTIONS_COMPACT };

// =============================================================================
// Serialization Functions
// =============================================================================

/**
 * Serialize data to YAML with readable formatting.
 *
 * Uses consistent defaults:
 * - No forced quoting (YAML only quotes when necessary)
 * - lineWidth of 88 provides reasonable wrapping for long strings
 * - Plain keys without quotes
 * - Sorted keys for deterministic output
 *
 * @param data - Data to serialize
 * @param options - Optional overrides for default options
 * @returns YAML string
 */
export function stringifyYaml(data: unknown, options?: Partial<YamlStringifyOptions>): string {
  return stringify(data, { ...YAML_STRINGIFY_OPTIONS, ...options });
}

/**
 * Serialize data to YAML without line wrapping (compact mode).
 * Useful for frontmatter where values should stay on single lines.
 *
 * @param data - Data to serialize
 * @returns YAML string with no line wrapping
 */
export function stringifyYamlCompact(data: unknown): string {
  return stringify(data, YAML_STRINGIFY_OPTIONS_COMPACT);
}

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
