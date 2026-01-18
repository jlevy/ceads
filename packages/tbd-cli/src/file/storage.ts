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
 *
 * Uses parallel file reading for better performance with many issues.
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

  // Filter to only .md files
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  // Read all files in parallel for better I/O performance
  const fileContents = await Promise.all(
    mdFiles.map(async (file) => {
      const filePath = join(issuesDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        return { file, content };
      } catch {
        return { file, content: null };
      }
    }),
  );

  // Parse issues (filter out failed reads)
  const issues: Issue[] = [];
  for (const { file, content } of fileContents) {
    if (content === null) continue;
    try {
      const issue = parseIssue(content);
      issues.push(issue);
    } catch (error) {
      // Skip invalid files with a warning
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
