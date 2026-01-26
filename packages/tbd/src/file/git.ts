/**
 * Git utilities for sync operations.
 *
 * Provides:
 * - Isolated index operations (protect user's staging area)
 * - Field-level merge algorithm
 * - Push retry with exponential backoff
 *
 * See: tbd-design.md §3.3 Sync Operations
 */

import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import type { Issue } from '../lib/types.js';
import { now, nowFilenameTimestamp } from '../utils/time-utils.js';

const execFileAsync = promisify(execFile);

/**
 * Execute a git command and return stdout.
 * Uses execFile for security - prevents shell injection attacks.
 */
export async function git(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args);
  return stdout.trim();
}

// =============================================================================
// Git Version Detection
// See: plan spec §3.4 Git Integration Architecture
// =============================================================================

/**
 * Minimum Git version required.
 * Git 2.42 (August 2023) introduced `git worktree add --orphan` which tbd requires.
 */
export const MIN_GIT_VERSION = '2.42.0';

/**
 * Parsed Git version information.
 */
/**
 * Check if the current directory is inside a git repository.
 */
export async function isInGitRepo(cwd?: string): Promise<boolean> {
  try {
    const args = ['rev-parse', '--is-inside-work-tree'];
    if (cwd) {
      args.unshift('-C', cwd);
    }
    const result = await git(...args);
    return result === 'true';
  } catch {
    return false;
  }
}

export interface GitVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Get the installed Git version.
 *
 * @returns Parsed version information
 * @throws Error if git is not installed or version cannot be parsed
 */
export async function getGitVersion(): Promise<GitVersion> {
  const versionOutput = await git('--version');
  // Output format: "git version 2.42.0" or "git version 2.42.0.windows.1"
  const versionRegex = /git version (\d+)\.(\d+)\.(\d+)/;
  const match = versionRegex.exec(versionOutput);

  const major = match?.[1];
  const minor = match?.[2];
  const patch = match?.[3];

  if (!major || !minor || !patch) {
    throw new Error(`Unable to parse git version from: ${versionOutput}`);
  }

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    raw: versionOutput,
  };
}

/**
 * Compare two version strings.
 *
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: GitVersion, b: string): number {
  const parts = b.split('.');
  const bMajor = parseInt(parts[0] ?? '0', 10);
  const bMinor = parseInt(parts[1] ?? '0', 10);
  const bPatch = parseInt(parts[2] ?? '0', 10);

  if (a.major !== bMajor) return a.major < bMajor ? -1 : 1;
  if (a.minor !== bMinor) return a.minor < bMinor ? -1 : 1;
  if (a.patch !== bPatch) return a.patch < bPatch ? -1 : 1;
  return 0;
}

/**
 * Check if the installed Git version meets minimum requirements.
 *
 * @returns Object with version info and whether it meets requirements
 * @throws Error with upgrade instructions if Git version is too old
 */
export async function checkGitVersion(): Promise<{
  version: GitVersion;
  supported: boolean;
}> {
  const version = await getGitVersion();
  const supported = compareVersions(version, MIN_GIT_VERSION) >= 0;
  return { version, supported };
}

/**
 * Require minimum Git version, throwing an error if not met.
 */
export async function requireGitVersion(): Promise<GitVersion> {
  const { version, supported } = await checkGitVersion();
  if (!supported) {
    throw new Error(getUpgradeInstructions(version));
  }
  return version;
}

/**
 * Get platform-specific upgrade instructions.
 * Points to official documentation rather than detailed commands for easier maintenance.
 */
function getUpgradeInstructions(currentVersion: GitVersion): string {
  const platform = process.platform;
  const versionStr = `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;

  let upgradeUrl: string;
  switch (platform) {
    case 'darwin':
      upgradeUrl = 'https://git-scm.com/download/mac';
      break;
    case 'linux':
      upgradeUrl = 'https://git-scm.com/download/linux';
      break;
    case 'win32':
      upgradeUrl = 'https://git-scm.com/download/win';
      break;
    default:
      upgradeUrl = 'https://git-scm.com/downloads';
  }

  return `Git ${versionStr} detected. Git ${MIN_GIT_VERSION}+ required for tbd.\nUpgrade: ${upgradeUrl}`;
}

/**
 * Execute a git command with isolated index.
 * This protects the user's staging area during sync operations.
 *
 * See: tbd-design.md §3.3.2 Writing to Sync Branch
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
    // Note: With execFile, we pass the message directly without shell quoting
    const commitArgs = ['commit-tree', tree, '-m', message];
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
 * See: tbd-design.md §3.5 Merge Rules
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
  spec_path: 'lww',

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
  const timestamp = nowFilenameTimestamp();

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
 * See: tbd-design.md §3.4 Conflict Detection and Resolution
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
  merged.updated_at = now();

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
 * See: tbd-design.md §3.3.3 Sync Algorithm
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

// =============================================================================
// Worktree Management
// See: tbd-design.md §2.3 Hidden Worktree Model
// =============================================================================

import { access, rm } from 'node:fs/promises';
import { WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME, SYNC_BRANCH } from '../lib/paths.js';

/**
 * Check if the hidden worktree exists and is valid.
 */
export async function worktreeExists(baseDir: string): Promise<boolean> {
  const worktreePath = join(baseDir, WORKTREE_DIR);
  try {
    await access(worktreePath);
    // Also verify it's a valid git worktree by checking for .git file
    await access(join(worktreePath, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Worktree health status.
 */
export interface WorktreeHealth {
  exists: boolean;
  valid: boolean;
  branch: string | null;
  commit: string | null;
  error?: string;
}

/**
 * Check worktree health and return status.
 * See: tbd-design.md §2.3 Worktree Lifecycle
 */
export async function checkWorktreeHealth(baseDir: string): Promise<WorktreeHealth> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  // Check if worktree directory exists
  try {
    await access(worktreePath);
  } catch {
    return { exists: false, valid: false, branch: null, commit: null };
  }

  // Check if it's a valid git worktree
  try {
    await access(join(worktreePath, '.git'));
  } catch {
    return {
      exists: true,
      valid: false,
      branch: null,
      commit: null,
      error: 'Worktree directory exists but is not a valid git worktree',
    };
  }

  // Get current commit and branch info
  try {
    const commit = await git('-C', worktreePath, 'rev-parse', 'HEAD');
    let branch: string | null = null;

    try {
      // Check if we're on detached HEAD pointing to tbd-sync
      const refName = await git('-C', worktreePath, 'symbolic-ref', '-q', 'HEAD');
      branch = refName.replace('refs/heads/', '');
    } catch {
      // Detached HEAD - expected state
      branch = null;
    }

    return { exists: true, valid: true, branch, commit };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      branch: null,
      commit: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Initialize the hidden worktree for the tbd-sync branch.
 * Follows the decision tree from tbd-design.md §2.3.
 *
 * @param baseDir - The base directory of the repository
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns Path to the worktree or error message
 */
export async function initWorktree(
  baseDir: string,
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<{ success: boolean; path?: string; created?: boolean; error?: string }> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  // Check if worktree already exists and is valid
  if (await worktreeExists(baseDir)) {
    return { success: true, path: worktreePath, created: false };
  }

  // Remove any stale worktree directory
  try {
    await rm(worktreePath, { recursive: true, force: true });
  } catch {
    // Ignore errors - directory might not exist
  }

  try {
    // Check if local branch exists
    const localExists = await branchExists(syncBranch);
    if (localExists) {
      // Create worktree from local branch with detached HEAD
      await git('-C', baseDir, 'worktree', 'add', worktreePath, syncBranch, '--detach');
      return { success: true, path: worktreePath, created: true };
    }

    // Check if remote branch exists
    const remoteExists = await remoteBranchExists(remote, syncBranch);
    if (remoteExists) {
      // Fetch and create worktree from remote branch
      await git('-C', baseDir, 'fetch', remote, syncBranch);
      await git(
        '-C',
        baseDir,
        'worktree',
        'add',
        worktreePath,
        `${remote}/${syncBranch}`,
        '--detach',
      );
      return { success: true, path: worktreePath, created: true };
    }

    // No branch exists - create orphan worktree (requires Git 2.42+)
    // Syntax: git worktree add --orphan -b <branch> <path>
    await requireGitVersion();
    await git('-C', baseDir, 'worktree', 'add', '--orphan', '-b', syncBranch, worktreePath);

    // Initialize the data-sync directory structure in the worktree
    const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
    await mkdir(join(dataSyncPath, 'issues'), { recursive: true });
    await mkdir(join(dataSyncPath, 'mappings'), { recursive: true });
    await mkdir(join(dataSyncPath, 'attic', 'conflicts'), { recursive: true });

    // Create initial commit in worktree
    await writeFile(join(dataSyncPath, 'meta.yml'), 'schema_version: 1\n');
    await writeFile(join(dataSyncPath, 'issues', '.gitkeep'), '');
    await writeFile(join(dataSyncPath, 'mappings', '.gitkeep'), '');

    // Stage and commit the initial structure
    await git('-C', worktreePath, 'add', '.');
    await git('-C', worktreePath, 'commit', '-m', 'Initialize tbd-sync branch');

    return { success: true, path: worktreePath, created: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update the hidden worktree to latest sync branch state.
 * Called after sync operations to ensure worktree reflects current state.
 *
 * @param baseDir - The base directory of the repository
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 */
export async function updateWorktree(
  baseDir: string,
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<{ success: boolean; error?: string }> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  // Ensure worktree exists
  if (!(await worktreeExists(baseDir))) {
    const initResult = await initWorktree(baseDir, remote, syncBranch);
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
  }

  try {
    // Fetch latest from remote
    try {
      await git('-C', baseDir, 'fetch', remote, syncBranch);
    } catch {
      // Remote fetch may fail if offline - that's ok
    }

    // Get the latest commit on the sync branch
    let targetCommit: string;
    try {
      // Try local branch first
      targetCommit = await git('-C', baseDir, 'rev-parse', `refs/heads/${syncBranch}`);
    } catch {
      try {
        // Fall back to remote tracking branch
        targetCommit = await git(
          '-C',
          baseDir,
          'rev-parse',
          `refs/remotes/${remote}/${syncBranch}`,
        );
      } catch {
        // No remote either - worktree is already at latest
        return { success: true };
      }
    }

    // Update worktree to that commit (detached HEAD)
    await git('-C', worktreePath, 'checkout', '--detach', targetCommit);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove the hidden worktree.
 * Used by doctor --fix when worktree is corrupted.
 */
export async function removeWorktree(
  baseDir: string,
): Promise<{ success: boolean; error?: string }> {
  const worktreePath = join(baseDir, WORKTREE_DIR);

  try {
    // First try to properly remove via git
    try {
      await git('-C', baseDir, 'worktree', 'remove', worktreePath, '--force');
    } catch {
      // If git worktree remove fails, just delete the directory
      await rm(worktreePath, { recursive: true, force: true });
    }

    // Prune stale worktree references
    await git('-C', baseDir, 'worktree', 'prune');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
