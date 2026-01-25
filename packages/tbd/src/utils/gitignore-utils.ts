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

  // Determine which patterns need to be added
  const added: string[] = [];
  const skipped: string[] = [];

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    // Always add comments and blank lines (for formatting)
    if (trimmed === '' || trimmed.startsWith('#')) {
      added.push(pattern);
    } else if (hasGitignorePattern(content, trimmed)) {
      skipped.push(trimmed);
    } else {
      added.push(pattern);
    }
  }

  // Filter out comments/blanks to check if we have actual patterns to add
  const actualPatternsToAdd = added.filter((p) => p.trim() && !p.trim().startsWith('#'));

  // If nothing new to add (all skipped), return early
  if (actualPatternsToAdd.length === 0) {
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

  // Add patterns
  newContent += added.join('\n') + '\n';

  // Atomic write
  await writeFile(gitignorePath, newContent);

  return { added: actualPatternsToAdd, skipped, created };
}
