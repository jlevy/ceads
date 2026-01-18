/**
 * Storage layer for issue files.
 *
 * Provides atomic file operations and issue CRUD operations.
 * All operations work on the hidden worktree at .tbd/data-sync/issues/.
 *
 * See: tbd-design-spec.md §3.2 Storage Layer
 */

import { readFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'atomically';

import type { Issue } from '../lib/types.js';
import { parseIssue, serializeIssue } from './parser.js';

/**
 * Get the path to an issue file.
 */
function getIssuePath(baseDir: string, id: string): string {
  return join(baseDir, 'issues', `${id}.md`);
}

/**
 * Read an issue from the worktree.
 * @throws If the issue file doesn't exist or is invalid.
 */
export async function readIssue(baseDir: string, id: string): Promise<Issue> {
  const filePath = getIssuePath(baseDir, id);
  const content = await readFile(filePath, 'utf-8');
  return parseIssue(content);
}

/**
 * Write an issue to the worktree.
 * Uses atomic write to prevent corruption.
 */
export async function writeIssue(baseDir: string, issue: Issue): Promise<void> {
  const filePath = getIssuePath(baseDir, issue.id);
  const content = serializeIssue(issue);
  await writeFile(filePath, content);
}

/**
 * List all issues in the worktree.
 * Returns empty array if issues directory doesn't exist.
 */
export async function listIssues(baseDir: string): Promise<Issue[]> {
  const issuesDir = join(baseDir, 'issues');

  let files: string[];
  try {
    files = await readdir(issuesDir);
  } catch {
    // Directory doesn't exist - return empty
    return [];
  }

  const issues: Issue[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const id = file.slice(0, -3); // Remove .md extension
    try {
      const issue = await readIssue(baseDir, id);
      issues.push(issue);
    } catch (error) {
      // Skip invalid files with a warning (in production, would log this)
      console.warn(`Skipping invalid issue file: ${file}`, error);
    }
  }

  return issues;
}

/**
 * Delete an issue from the worktree.
 * Does not throw if issue doesn't exist.
 */
export async function deleteIssue(baseDir: string, id: string): Promise<void> {
  const filePath = getIssuePath(baseDir, id);
  try {
    await unlink(filePath);
  } catch (error) {
    // Ignore ENOENT (file doesn't exist)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
