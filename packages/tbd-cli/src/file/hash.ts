/**
 * Content hashing for conflict detection.
 *
 * Uses SHA-256 hash of canonical YAML representation.
 * Canonical format ensures same content produces same hash regardless of:
 * - Field ordering in source
 * - Array element ordering (sorted)
 * - Whitespace variations
 *
 * See: tbd-design-spec.md §2.4 Content Hashing
 */

import { createHash } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';

import type { Issue } from '../lib/types.js';

/**
 * Fields excluded from content hash.
 * Version is excluded because it's informational only and incremented locally.
 */
const HASH_EXCLUDED_FIELDS = new Set(['version']);

/**
 * Canonicalize an issue for hashing.
 *
 * Rules:
 * - Keys sorted alphabetically at each level
 * - Arrays sorted: labels lexicographically, dependencies by target
 * - Timestamps in ISO8601 with Z suffix (already required by schema)
 * - Null values explicit (not omitted)
 * - Undefined values omitted
 * - LF line endings (no CR)
 */
export function canonicalizeForHash(issue: Issue): string {
  // Create a copy without excluded fields
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(issue)) {
    if (HASH_EXCLUDED_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    data[key] = value;
  }

  // Sort arrays
  if (Array.isArray(data.labels)) {
    data.labels = [...(data.labels as string[])].sort();
  }

  if (Array.isArray(data.dependencies)) {
    data.dependencies = [...(data.dependencies as { type: string; target: string }[])].sort(
      (a, b) => a.target.localeCompare(b.target),
    );
  }

  // Serialize to YAML with canonical options
  const yaml = stringifyYaml(data, {
    sortMapEntries: true, // Sort keys alphabetically
    lineWidth: 0, // No wrapping
    nullStr: 'null', // Explicit nulls
  });

  // Ensure LF line endings (should already be the case, but be explicit)
  return yaml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Compute SHA-256 content hash for an issue.
 * Returns lowercase hex string (64 characters).
 */
export function computeContentHash(issue: Issue): string {
  const canonical = canonicalizeForHash(issue);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
