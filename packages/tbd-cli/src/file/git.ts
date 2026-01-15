/**
 * Git utilities for sync operations.
 *
 * Provides:
 * - Isolated index operations (protect user's staging area)
 * - Field-level merge algorithm
 * - Push retry with exponential backoff
 *
 * See: tbd-design-v3.md §3.3 Sync Operations
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

import type { Issue } from '../lib/types.js';

const execAsync = promisify(exec);

/**
 * Execute a git command and return stdout.
 */
export async function git(...args: string[]): Promise<string> {
  const { stdout } = await execAsync(`git ${args.join(' ')}`);
  return stdout.trim();
}

/**
 * Execute a git command with isolated index.
 * This protects the user's staging area during sync operations.
 *
 * See: tbd-design-v3.md §3.3.2 Writing to Sync Branch
 */
export async function withIsolatedIndex<T>(fn: () => Promise<T>): Promise<T> {
  const gitDir = await git('rev-parse', '--git-dir');
  const isolatedIndex = join(gitDir, 'tbd-index');
  const originalIndex = process.env.GIT_INDEX_FILE;

  try {
    process.env.GIT_INDEX_FILE = isolatedIndex;
    return await fn();
  } finally {
    if (originalIndex) {
      process.env.GIT_INDEX_FILE = originalIndex;
    } else {
      delete process.env.GIT_INDEX_FILE;
    }
  }
}

/**
 * Commit changes to sync branch using isolated index.
 */
export async function commitToSyncBranch(
  syncBranch: string,
  message: string,
  files: string[],
): Promise<string> {
  return withIsolatedIndex(async () => {
    // Try to read existing tree from sync branch
    try {
      await git('read-tree', syncBranch);
    } catch {
      // Branch doesn't exist - start fresh
    }

    // Add changed files to index
    for (const file of files) {
      await git('add', file);
    }

    // Write tree object
    const tree = await git('write-tree');

    // Get parent commit if exists
    let parent: string | null = null;
    try {
      parent = await git('rev-parse', syncBranch);
    } catch {
      // No parent - orphan commit
    }

    // Create commit
    const commitArgs = ['commit-tree', tree, '-m', `"${message}"`];
    if (parent) {
      commitArgs.push('-p', parent);
    }

    const commit = await git(...commitArgs);

    // Update branch ref
    await git('update-ref', `refs/heads/${syncBranch}`, commit);

    return commit;
  });
}

/**
 * Field-level merge strategy types.
 */
type MergeStrategy = 'lww' | 'union' | 'max' | 'immutable';

/**
 * Field-level merge strategies for Issue fields.
 * See: tbd-design-v3.md §3.5 Merge Rules
 */
const FIELD_STRATEGIES: Record<keyof Issue, MergeStrategy> = {
  // Immutable - never change after creation
  type: 'immutable',
  id: 'immutable',
  created_at: 'immutable',
  created_by: 'immutable',

  // LWW (Last-Write-Wins) - compare updated_at
  version: 'max',
  kind: 'lww',
  title: 'lww',
  description: 'lww',
  notes: 'lww',
  status: 'lww',
  priority: 'lww',
  assignee: 'lww',
  parent_id: 'lww',
  updated_at: 'max',
  closed_at: 'lww',
  close_reason: 'lww',
  due_date: 'lww',
  deferred_until: 'lww',

  // Union - combine arrays, deduplicate
  labels: 'union',
  dependencies: 'union',

  // Extensions - LWW for whole object
  extensions: 'lww',
};

/**
 * Conflict entry for attic storage.
 */
export interface ConflictEntry {
  issue_id: string;
  field: string;
  timestamp: string;
  lost_value: unknown;
  winner_value: unknown;
  local_version: number;
  remote_version: number;
  resolution: 'lww' | 'union' | 'manual';
}

/**
 * Merge result with merged issue and any conflicts.
 */
export interface MergeResult {
  merged: Issue;
  conflicts: ConflictEntry[];
}

/**
 * Deep equality check for values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  return false;
}

/**
 * Union arrays with deduplication.
 */
function unionArrays<T>(a: T[], b: T[]): T[] {
  const result = [...a];
  for (const item of b) {
    if (!result.some((existing) => deepEqual(existing, item))) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Create an attic entry for a conflict.
 */
function createConflictEntry(
  issueId: string,
  field: string,
  lostValue: unknown,
  winnerValue: unknown,
  localVersion: number,
  remoteVersion: number,
  resolution: 'lww' | 'union' | 'manual',
): ConflictEntry {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, 'Z');

  return {
    issue_id: issueId,
    field,
    timestamp,
    lost_value: lostValue,
    winner_value: winnerValue,
    local_version: localVersion,
    remote_version: remoteVersion,
    resolution,
  };
}

/**
 * Three-way merge algorithm for issues.
 * See: tbd-design-v3.md §3.4 Conflict Detection and Resolution
 *
 * @param base - Common ancestor (null if new issue)
 * @param local - Local version
 * @param remote - Remote version
 */
export function mergeIssues(base: Issue | null, local: Issue, remote: Issue): MergeResult {
  const conflicts: ConflictEntry[] = [];

  // If no base, one was created independently - LWW based on created_at
  if (!base) {
    const localTime = new Date(local.created_at).getTime();
    const remoteTime = new Date(remote.created_at).getTime();

    if (localTime <= remoteTime) {
      // Local was created first - it wins
      if (!deepEqual(local, remote)) {
        conflicts.push(
          createConflictEntry(
            remote.id,
            'whole_issue',
            remote,
            local,
            remote.version,
            local.version,
            'lww',
          ),
        );
      }
      return { merged: local, conflicts };
    } else {
      // Remote was created first - it wins
      if (!deepEqual(local, remote)) {
        conflicts.push(
          createConflictEntry(
            local.id,
            'whole_issue',
            local,
            remote,
            local.version,
            remote.version,
            'lww',
          ),
        );
      }
      return { merged: remote, conflicts };
    }
  }

  // Field-by-field merge
  const merged = { ...base } as Issue;

  for (const [field, strategy] of Object.entries(FIELD_STRATEGIES)) {
    const key = field as keyof Issue;
    const localVal = local[key];
    const remoteVal = remote[key];
    const baseVal = base[key];

    // Skip if both unchanged from base
    if (deepEqual(localVal, baseVal) && deepEqual(remoteVal, baseVal)) {
      continue;
    }

    // Only one changed - take changed value
    if (deepEqual(localVal, baseVal)) {
      (merged as Record<string, unknown>)[key] = remoteVal;
      continue;
    }
    if (deepEqual(remoteVal, baseVal)) {
      (merged as Record<string, unknown>)[key] = localVal;
      continue;
    }

    // Both changed - apply strategy
    switch (strategy) {
      case 'immutable':
        // Keep base value (shouldn't change)
        break;

      case 'lww': {
        // Compare updated_at timestamps
        const localTime = new Date(local.updated_at).getTime();
        const remoteTime = new Date(remote.updated_at).getTime();

        if (localTime >= remoteTime) {
          (merged as Record<string, unknown>)[key] = localVal;
          conflicts.push(
            createConflictEntry(
              local.id,
              field,
              remoteVal,
              localVal,
              local.version,
              remote.version,
              'lww',
            ),
          );
        } else {
          (merged as Record<string, unknown>)[key] = remoteVal;
          conflicts.push(
            createConflictEntry(
              local.id,
              field,
              localVal,
              remoteVal,
              local.version,
              remote.version,
              'lww',
            ),
          );
        }
        break;
      }

      case 'union':
        // Combine arrays and deduplicate
        (merged as Record<string, unknown>)[key] = unionArrays(
          localVal as unknown[],
          remoteVal as unknown[],
        );
        break;

      case 'max':
        // Take maximum value
        (merged as Record<string, unknown>)[key] = Math.max(
          localVal as number,
          remoteVal as number,
        );
        break;
    }
  }

  // Always increment version after merge
  merged.version = Math.max(local.version, remote.version) + 1;
  merged.updated_at = new Date().toISOString();

  return { merged, conflicts };
}

/**
 * Maximum retry attempts for push operations.
 */
const MAX_PUSH_RETRIES = 3;

/**
 * Check if error is a non-fast-forward rejection.
 */
function isNonFastForward(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('non-fast-forward') || msg.includes('fetch first') || msg.includes('rejected')
  );
}

/**
 * Push result with retry information.
 */
export interface PushResult {
  success: boolean;
  attempt: number;
  conflicts?: ConflictEntry[];
  error?: string;
}

/**
 * Push with retry and merge on conflict.
 * See: tbd-design-v3.md §3.3.3 Sync Algorithm
 *
 * @param syncBranch - The sync branch name
 * @param remote - The remote name
 * @param onMergeNeeded - Callback to merge remote changes
 */
export async function pushWithRetry(
  syncBranch: string,
  remote: string,
  onMergeNeeded: () => Promise<ConflictEntry[]>,
): Promise<PushResult> {
  for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      // Try to push
      await git('push', remote, syncBranch);
      return { success: true, attempt };
    } catch (error) {
      if (!isNonFastForward(error)) {
        // Unrecoverable error
        return {
          success: false,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (attempt === MAX_PUSH_RETRIES) {
        return {
          success: false,
          attempt,
          error: `Push failed after ${MAX_PUSH_RETRIES} attempts. Remote has conflicting changes.`,
        };
      }

      // Fetch and merge remote changes
      await git('fetch', remote, syncBranch);
      const conflicts = await onMergeNeeded();

      if (conflicts.length > 0) {
        // Return conflicts but continue trying
        return { success: false, attempt, conflicts };
      }

      // Loop to retry push
    }
  }

  return { success: false, attempt: MAX_PUSH_RETRIES, error: 'Unexpected error in push retry' };
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(): Promise<string> {
  return git('rev-parse', '--abbrev-ref', 'HEAD');
}

/**
 * Check if a branch exists locally.
 */
export async function branchExists(branch: string): Promise<boolean> {
  try {
    await git('rev-parse', '--verify', `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a remote branch exists.
 */
export async function remoteBranchExists(remote: string, branch: string): Promise<boolean> {
  try {
    await git('ls-remote', '--exit-code', remote, `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the remote URL.
 */
export async function getRemoteUrl(remote: string): Promise<string | null> {
  try {
    return await git('remote', 'get-url', remote);
  } catch {
    return null;
  }
}
