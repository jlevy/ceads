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

import { parse as parseYaml, stringify, parseDocument } from 'yaml';

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

/**
 * Result from parsing YAML with duplicate key handling.
 */
export interface ParseWithDuplicatesResult<T> {
  data: T;
  /** Keys that appeared more than once (empty if no duplicates). */
  duplicateKeys: string[];
}

/**
 * Detect duplicate top-level keys in YAML content.
 *
 * Scans lines for `key: value` patterns and finds keys that appear more than once.
 * Only checks top-level keys (no indentation).
 */
export function detectDuplicateYamlKeys(content: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const line of content.split('\n')) {
    // Match top-level keys: no leading whitespace, key followed by colon
    const match = /^([^\s#][^:]*?):\s/.exec(line);
    if (match?.[1]) {
      const key = match[1];
      if (seen.has(key)) {
        duplicates.add(key);
      }
      seen.add(key);
    }
  }

  return Array.from(duplicates);
}

/**
 * Parse YAML content tolerating duplicate keys.
 *
 * This is specifically designed for files like ids.yml that may end up with
 * duplicate keys after a git merge conflict resolution that kept entries from
 * both sides. Instead of crashing with "Map keys must be unique", this function:
 *
 * 1. Checks for merge conflict markers (throws MergeConflictError)
 * 2. Detects duplicate keys in the raw content
 * 3. Parses with `uniqueKeys: false` so the last occurrence wins
 * 4. Returns both the parsed data and the list of duplicate keys found
 *
 * Callers should warn about duplicates and re-save the file to fix it.
 */
export function parseYamlToleratingDuplicateKeys<T = unknown>(
  content: string,
  filePath?: string,
): ParseWithDuplicatesResult<T> {
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

  // Detect duplicate keys before parsing
  const duplicateKeys = detectDuplicateYamlKeys(content);

  if (duplicateKeys.length === 0) {
    // No duplicates — use standard parse for maximum safety
    return {
      data: parseYaml(content) as T,
      duplicateKeys: [],
    };
  }

  // Parse with uniqueKeys: false to tolerate duplicates (last occurrence wins)
  const doc = parseDocument(content, { uniqueKeys: false });

  // Check for other (non-duplicate-key) parse errors
  if (doc.errors.length > 0) {
    const location = filePath ? ` in ${filePath}` : '';
    throw new Error(`YAML parse error${location}: ${doc.errors.map((e) => e.message).join('; ')}`);
  }

  return {
    data: doc.toJSON() as T,
    duplicateKeys,
  };
}
