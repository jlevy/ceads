/**
 * Gitignore file utilities for idempotent pattern management.
 */

import { readFile } from 'node:fs/promises';
import { writeFile } from 'atomically';
import { pathExists } from './file-utils.js';

/**
 * Check if a pattern exists in gitignore content.
 * Matches exact lines, normalizing trailing slashes for directories.
 */
export function hasGitignorePattern(content: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/\/+$/, '');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const normalizedLine = trimmed.replace(/\/+$/, '');
    if (normalizedLine === normalizedPattern) {
      return true;
    }
  }
  return false;
}

/**
 * Ensure patterns exist in a .gitignore file.
 * Creates file if missing. Appends only missing patterns.
 * Always uses atomic write.
 *
 * @param gitignorePath - Path to .gitignore file
 * @param patterns - Patterns to ensure exist (can include comments)
 * @param header - Optional header comment for new patterns section
 */
export async function ensureGitignorePatterns(
  gitignorePath: string,
  patterns: string[],
  header?: string,
): Promise<{ added: string[]; skipped: string[]; created: boolean }> {
  // Read existing content or empty string
  let content = '';
  let created = false;

  if (await pathExists(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8');
  } else {
    created = true;
  }

  // Group patterns into entries: each entry is leading comments/blanks followed by
  // one or more actual patterns. Comments are only included if their associated
  // pattern(s) are new, preventing orphaned comment duplication on upgrades.
  const entries: { preamble: string[]; patterns: string[] }[] = [];
  let currentPreamble: string[] = [];

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      currentPreamble.push(pattern);
    } else {
      entries.push({ preamble: currentPreamble, patterns: [trimmed] });
      currentPreamble = [];
    }
  }
  // Trailing comments/blanks (no associated pattern) form their own entry
  if (currentPreamble.length > 0) {
    entries.push({ preamble: currentPreamble, patterns: [] });
  }

  // Determine which entries have new patterns to add
  const added: string[] = [];
  const skipped: string[] = [];
  const linesToAppend: string[] = [];

  for (const entry of entries) {
    const newPatterns = entry.patterns.filter((p) => !hasGitignorePattern(content, p));
    const existingPatterns = entry.patterns.filter((p) => hasGitignorePattern(content, p));
    skipped.push(...existingPatterns);

    if (newPatterns.length > 0) {
      added.push(...newPatterns);
      // Include preamble comments only when their associated pattern is new
      linesToAppend.push(...entry.preamble, ...newPatterns);
    }
  }

  // If nothing new to add, return early
  if (added.length === 0) {
    return { added: [], skipped, created: false };
  }

  // Build new content
  let newContent = content;

  // Ensure content ends with newline before appending
  if (newContent && !newContent.endsWith('\n')) {
    newContent += '\n';
  }

  // Add blank line separator if file has existing content
  if (newContent && !newContent.endsWith('\n\n')) {
    newContent += '\n';
  }

  // Add header if provided
  if (header) {
    newContent += header + '\n';
  }

  // Add only entries with new patterns
  newContent += linesToAppend.join('\n') + '\n';

  // Atomic write
  await writeFile(gitignorePath, newContent);

  return { added, skipped, created };
}
