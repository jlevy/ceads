/**
 * Prefix validation and beads prefix extraction module.
 *
 * Provides functions to validate prefixes and extract prefix from beads config.
 * Used by setup commands to validate user-provided prefixes and migrate from beads.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

/** Maximum length for a valid prefix */
const MAX_PREFIX_LENGTH = 10;

/** Minimum length for a valid prefix */
const MIN_PREFIX_LENGTH = 1;

/**
 * Normalize a prefix string.
 * - Lowercases
 * - Removes invalid characters (keeps only alphanumeric)
 * - Truncates to max length
 */
export function normalizePrefix(s: string): string {
  if (!s) return '';

  // Lowercase and remove non-alphanumeric characters
  const normalized = s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Truncate to max length
  return normalized.slice(0, MAX_PREFIX_LENGTH);
}

/**
 * Check if a prefix is valid.
 * - Must be 1-10 characters
 * - Must start with a letter
 * - Must be alphanumeric only (lowercase)
 */
export function isValidPrefix(s: string): boolean {
  if (!s) return false;
  if (s.length < MIN_PREFIX_LENGTH || s.length > MAX_PREFIX_LENGTH) return false;

  // Must match: starts with letter, followed by alphanumeric (lowercase)
  return /^[a-z][a-z0-9]*$/.test(s);
}

/**
 * Get prefix from existing beads config.
 *
 * Looks for .beads/config.yaml and extracts display.id_prefix
 *
 * @param cwd Current working directory
 * @returns The beads prefix, or null if not found
 */
export async function getBeadsPrefix(cwd: string): Promise<string | null> {
  try {
    const configPath = join(cwd, '.beads', 'config.yaml');
    const content = await readFile(configPath, 'utf-8');
    const config = parseYaml(content) as Record<string, unknown>;

    const display = config?.display as Record<string, unknown> | undefined;
    const prefix = display?.id_prefix;

    if (typeof prefix === 'string' && isValidPrefix(prefix)) {
      return prefix;
    }

    return null;
  } catch {
    return null;
  }
}
