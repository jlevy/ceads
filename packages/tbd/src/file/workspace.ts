/**
 * Workspace operations for sync failure recovery, backups, and bulk editing.
 *
 * Workspaces are directories under .tbd/workspaces/ that store issue data.
 * They mirror the data-sync directory structure:
 *   .tbd/workspaces/{name}/
 *     issues/
 *     mappings/
 *     attic/
 *
 * See: plan-2026-01-30-workspace-sync-alt.md
 */

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'atomically';

import { stringifyYaml } from '../utils/yaml-utils.js';

import { listIssues, writeIssue, readIssue } from './storage.js';
import { parseIssue } from './parser.js';
import { mergeIssues, deepEqual, git, type ConflictEntry } from './git.js';
import { loadIdMapping, saveIdMapping, addIdMapping } from './id-mapping.js';
import {
  WORKSPACES_DIR,
  getWorkspaceDir,
  isValidWorkspaceName,
  DATA_SYNC_DIR,
} from '../lib/paths.js';
import { extractUlidFromInternalId } from '../lib/ids.js';
import { now } from '../utils/time-utils.js';
import { noopLogger } from '../lib/types.js';
import type { AtticEntry, Issue, OperationLogger } from '../lib/types.js';

/**
 * Options for saveToWorkspace.
 * One of workspace, dir, or outbox must be specified.
 */
export interface SaveOptions {
  /** Named workspace under .tbd/workspaces/ */
  workspace?: string;
  /** Arbitrary directory path */
  dir?: string;
  /** Shortcut for --workspace=outbox --updates-only */
  outbox?: boolean;
  /** Only save issues modified since last sync */
  updatesOnly?: boolean;
  /** Optional logger for progress reporting */
  logger?: OperationLogger;
}

/**
 * Result from saveToWorkspace operation.
 */
export interface SaveResult {
  /** Number of issues saved */
  saved: number;
  /** Number of conflicts (went to attic) */
  conflicts: number;
  /** Target directory where issues were saved */
  targetDir: string;
  /** Total issues in source before filtering (for informational messages) */
  totalSource: number;
  /** Whether filtering was applied (updatesOnly or outbox) */
  filtered: boolean;
}

/**
 * Options for importFromWorkspace.
 * One of workspace, dir, or outbox must be specified.
 */
export interface ImportOptions {
  /** Named workspace under .tbd/workspaces/ */
  workspace?: string;
  /** Arbitrary directory path */
  dir?: string;
  /** Shortcut for --workspace=outbox --clear-on-success */
  outbox?: boolean;
  /** Delete workspace after successful import */
  clearOnSuccess?: boolean;
  /** Optional logger for progress reporting */
  logger?: OperationLogger;
}

/**
 * Result from importFromWorkspace operation.
 */
export interface ImportResult {
  /** Number of issues imported */
  imported: number;
  /** Number of conflicts (went to attic) */
  conflicts: number;
  /** Source directory where issues were imported from */
  sourceDir: string;
  /** Whether the source was deleted after import */
  cleared: boolean;
}

/**
 * Compare local issues with remote issues and return only those that are new or modified.
 *
 * An issue is considered "updated" if:
 * - It doesn't exist in the remote (new issue)
 * - Its content differs from the remote version (modified issue)
 *
 * @param localIssues - Issues from the local worktree
 * @param remoteIssues - Issues from the remote tbd-sync branch
 * @returns Issues that are new or modified compared to remote
 */
export function getUpdatedIssues(localIssues: Issue[], remoteIssues: Issue[]): Issue[] {
  // Build a map of remote issues by ID for quick lookup
  const remoteById = new Map<string, Issue>();
  for (const issue of remoteIssues) {
    remoteById.set(issue.id, issue);
  }

  // Filter local issues to only those that are new or different
  return localIssues.filter((local) => {
    const remote = remoteById.get(local.id);

    // New issue - not in remote
    if (!remote) {
      return true;
    }

    // Modified issue - content differs from remote
    return !deepEqual(local, remote);
  });
}

/**
 * Ensure a directory exists.
 */
async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Read issues from a git ref (e.g., origin/tbd-sync).
 *
 * @param baseDir - The base directory of the git repo
 * @param remote - The remote name (e.g., 'origin')
 * @param branch - The branch name (e.g., 'tbd-sync')
 * @returns Array of issues from the remote ref
 */
async function readRemoteIssues(baseDir: string, remote: string, branch: string): Promise<Issue[]> {
  const ref = `${remote}/${branch}`;
  const issuesPath = `${DATA_SYNC_DIR}/issues`;

  // List all issue files from the remote ref
  let fileList: string;
  try {
    fileList = await git('-C', baseDir, 'ls-tree', '-r', '--name-only', ref, issuesPath);
  } catch {
    // Remote branch doesn't exist or has no issues
    return [];
  }

  const issueFiles = fileList
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('.md'));
  const issues: Issue[] = [];

  for (const filepath of issueFiles) {
    try {
      // Read file content from the remote ref
      const content = await git('-C', baseDir, 'show', `${ref}:${filepath}`);
      const issue = parseIssue(content);
      issues.push(issue);
    } catch {
      // Skip files that can't be parsed
    }
  }

  return issues;
}

/**
 * Convert ConflictEntry to AtticEntry format and save to workspace attic.
 */
async function saveConflictToAttic(
  atticDir: string,
  conflict: ConflictEntry,
  winnerSource: 'local' | 'remote',
): Promise<void> {
  const timestamp = now();

  // Convert lost_value to string - handle objects, primitives, and nullish
  const lostValueStr =
    conflict.lost_value == null
      ? ''
      : typeof conflict.lost_value === 'object'
        ? JSON.stringify(conflict.lost_value)
        : JSON.stringify(conflict.lost_value);

  const entry: AtticEntry = {
    entity_id: conflict.issue_id,
    timestamp,
    field: conflict.field,
    lost_value: lostValueStr,
    winner_source: winnerSource,
    loser_source: winnerSource === 'local' ? 'remote' : 'local',
    context: {
      local_version: conflict.local_version,
      remote_version: conflict.remote_version,
      local_updated_at: timestamp,
      remote_updated_at: timestamp,
    },
  };

  // Create filename: {entity_id}_{timestamp}_{field}.yml
  const safeTimestamp = timestamp.replace(/:/g, '-');
  const filename = `${conflict.issue_id}_${safeTimestamp}_${conflict.field}.yml`;
  const filepath = join(atticDir, filename);

  // Uses default options which include sortMapEntries: true
  const content = stringifyYaml(entry);
  await writeFile(filepath, content);
}

/**
 * Get the target/source directory for workspace operations.
 */
function resolveWorkspaceDir(
  tbdRoot: string,
  options: { workspace?: string; dir?: string; outbox?: boolean },
): string {
  if (options.dir) {
    return options.dir;
  }

  const workspaceName = options.outbox ? 'outbox' : options.workspace;
  if (!workspaceName) {
    throw new Error('One of --workspace, --dir, or --outbox is required');
  }

  if (!isValidWorkspaceName(workspaceName)) {
    throw new Error(`Invalid workspace name: ${workspaceName}`);
  }

  return join(tbdRoot, getWorkspaceDir(workspaceName));
}

/**
 * Get the target directory for save operation.
 * @deprecated Use resolveWorkspaceDir instead
 */
function getTargetDir(tbdRoot: string, options: SaveOptions): string {
  return resolveWorkspaceDir(tbdRoot, options);
}

/**
 * Save issues from data-sync directory to a workspace or directory.
 *
 * Uses mergeIssues() for proper conflict detection when an issue exists
 * in both source (worktree) and target (workspace). Conflicts are saved
 * to the workspace's attic.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param dataSyncDir - The data-sync directory containing source issues
 * @param options - Save options (workspace name, directory, or outbox)
 * @returns Save result with counts
 */
export async function saveToWorkspace(
  tbdRoot: string,
  dataSyncDir: string,
  options: SaveOptions,
): Promise<SaveResult> {
  const log = options.logger ?? noopLogger;
  const targetDir = getTargetDir(tbdRoot, options);
  log.debug(`Target directory: ${targetDir}`);
  log.debug(`Source directory: ${dataSyncDir}`);

  // Create target directory structure
  const atticDir = join(targetDir, 'attic');

  await ensureDir(join(targetDir, 'issues'));
  await ensureDir(join(targetDir, 'mappings'));
  await ensureDir(atticDir);

  // List all issues in source (worktree)
  log.progress('Loading issues from worktree...');
  const allSourceIssues = await listIssues(dataSyncDir);
  const totalSource = allSourceIssues.length;
  log.info(`Loaded ${totalSource} issue(s) from worktree`);
  let sourceIssues = allSourceIssues;

  // Filter to only updated issues if requested
  const isUpdatesOnly = options.updatesOnly ?? options.outbox;
  if (isUpdatesOnly) {
    try {
      // Fetch and compare with remote tbd-sync
      log.progress('Fetching remote for comparison...');
      await git('-C', tbdRoot, 'fetch', 'origin', 'tbd-sync');
      log.debug('Fetch succeeded, reading remote issues...');
      const remoteIssues = await readRemoteIssues(tbdRoot, 'origin', 'tbd-sync');
      log.info(`Loaded ${remoteIssues.length} remote issue(s) for comparison`);
      sourceIssues = getUpdatedIssues(allSourceIssues, remoteIssues);
      log.info(`Filtered to ${sourceIssues.length} updated issue(s) (of ${totalSource} total)`);
    } catch (fetchError) {
      // If fetch fails (offline, remote doesn't exist, etc.), save all issues
      // This is the fallback behavior mentioned in the spec
      const fetchMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      log.info(`Fetch failed (${fetchMsg}), falling back to saving all ${totalSource} issues`);
    }
  }

  let saved = 0;
  let conflicts = 0;

  log.progress(`Saving ${sourceIssues.length} issue(s)...`);
  // Save each issue to target, merging if needed
  for (const sourceIssue of sourceIssues) {
    // Check if issue already exists in workspace
    let targetIssue = null;
    try {
      targetIssue = await readIssue(targetDir, sourceIssue.id);
    } catch {
      // Issue doesn't exist in target - will be created
    }

    if (targetIssue) {
      // Issue exists in both - merge using field-level LWW
      // Pass older version as "base" to trigger field-by-field merge instead of whole_issue conflict
      const sourceTime = new Date(sourceIssue.updated_at).getTime();
      const targetTime = new Date(targetIssue.updated_at).getTime();

      // Use older version as base for field-by-field merge
      let result;
      let winnerSource: 'local' | 'remote';

      if (sourceTime !== targetTime) {
        // Different timestamps - clear ordering, use older as base
        const older = sourceTime > targetTime ? targetIssue : sourceIssue;
        winnerSource = sourceTime > targetTime ? 'local' : 'remote';
        result = mergeIssues(older, sourceIssue, targetIssue);
      } else {
        // Equal timestamps - concurrent edits
        // Create synthetic base to force field-by-field comparison
        const syntheticBase = {
          ...sourceIssue,
          version: 0,
          updated_at: '1970-01-01T00:00:00.000Z',
        } as Issue;
        winnerSource = 'local'; // Arbitrary since timestamps are equal
        result = mergeIssues(syntheticBase, sourceIssue, targetIssue);
      }

      // Save merged issue
      await writeIssue(targetDir, result.merged);
      saved++;
      log.debug(`Merged issue ${sourceIssue.id} (${result.conflicts.length} field conflict(s))`);

      // Save any conflicts to workspace attic
      for (const conflict of result.conflicts) {
        await saveConflictToAttic(atticDir, conflict, winnerSource);
        conflicts++;
      }
    } else {
      // New issue - just save
      await writeIssue(targetDir, sourceIssue);
      saved++;
    }

    // Log progress periodically for large saves
    if (saved % 100 === 0 && saved > 0) {
      log.progress(`Saving issues... (${saved}/${sourceIssues.length})`);
    }
  }

  log.info(`Saved ${saved} issue(s), ${conflicts} conflict(s)`);

  // Copy ID mappings from source to target (only for saved issues)
  // Build set of saved issue ULIDs (without prefix) to filter mappings
  log.debug('Merging ID mappings...');
  const savedIssueUlids = new Set(sourceIssues.map((issue) => extractUlidFromInternalId(issue.id)));

  const sourceMapping = await loadIdMapping(dataSyncDir);
  const targetMapping = await loadIdMapping(targetDir);

  // Merge: add source mappings to target (only for saved issues, don't overwrite existing)
  for (const [shortId, ulid] of sourceMapping.shortToUlid) {
    // Only copy mapping if the ULID corresponds to a saved issue
    if (savedIssueUlids.has(ulid) && !targetMapping.shortToUlid.has(shortId)) {
      addIdMapping(targetMapping, ulid, shortId);
    }
  }
  await saveIdMapping(targetDir, targetMapping);

  return {
    saved,
    conflicts,
    targetDir,
    totalSource,
    filtered: isUpdatesOnly ?? false,
  };
}

/**
 * Import issues from a workspace or directory to the data-sync directory.
 *
 * Uses mergeIssues() for proper conflict detection when an issue exists
 * in both source (workspace) and target (worktree). Conflicts are saved
 * to the worktree's attic.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param dataSyncDir - The data-sync directory to import into
 * @param options - Import options (workspace name, directory, or outbox)
 * @returns Import result with counts
 */
export async function importFromWorkspace(
  tbdRoot: string,
  dataSyncDir: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const log = options.logger ?? noopLogger;
  const sourceDir = resolveWorkspaceDir(tbdRoot, options);
  log.debug(`Source directory: ${sourceDir}`);
  log.debug(`Target directory: ${dataSyncDir}`);

  // Determine if we should clear on success
  // --outbox implies --clear-on-success
  const shouldClear = options.clearOnSuccess ?? options.outbox ?? false;

  // Create attic directory in target (worktree)
  const atticDir = join(dataSyncDir, 'attic');
  await ensureDir(atticDir);

  // List all issues in source workspace
  log.progress('Loading issues from workspace...');
  const sourceIssues = await listIssues(sourceDir);
  log.info(`Loaded ${sourceIssues.length} issue(s) from workspace`);

  let imported = 0;
  let conflicts = 0;

  log.progress(`Importing ${sourceIssues.length} issue(s)...`);
  // Import each issue to data-sync, merging if needed
  for (const sourceIssue of sourceIssues) {
    // Check if issue already exists in worktree
    let targetIssue = null;
    try {
      targetIssue = await readIssue(dataSyncDir, sourceIssue.id);
    } catch {
      // Issue doesn't exist in target - will be created
    }

    if (targetIssue) {
      // Issue exists in both - merge using field-level LWW
      // Pass older version as "base" to trigger field-by-field merge instead of whole_issue conflict
      const sourceTime = new Date(sourceIssue.updated_at).getTime();
      const targetTime = new Date(targetIssue.updated_at).getTime();

      // Use older version as base for field-by-field merge
      let result;
      let winnerSource: 'local' | 'remote';

      if (sourceTime !== targetTime) {
        // Different timestamps - clear ordering, use older as base
        const older = sourceTime > targetTime ? targetIssue : sourceIssue;
        winnerSource = sourceTime > targetTime ? 'local' : 'remote';
        result = mergeIssues(older, sourceIssue, targetIssue);
      } else {
        // Equal timestamps - concurrent edits
        // Create synthetic base to force field-by-field comparison
        const syntheticBase = {
          ...sourceIssue,
          version: 0,
          updated_at: '1970-01-01T00:00:00.000Z',
        } as Issue;
        winnerSource = 'local'; // Arbitrary since timestamps are equal
        result = mergeIssues(syntheticBase, sourceIssue, targetIssue);
      }

      // Save merged issue
      await writeIssue(dataSyncDir, result.merged);
      imported++;
      log.debug(`Merged issue ${sourceIssue.id} (${result.conflicts.length} field conflict(s))`);

      // Save any conflicts to worktree attic
      for (const conflict of result.conflicts) {
        await saveConflictToAttic(atticDir, conflict, winnerSource);
        conflicts++;
      }
    } else {
      // New issue - just save
      await writeIssue(dataSyncDir, sourceIssue);
      imported++;
    }

    // Log progress periodically for large imports
    if (imported % 100 === 0 && imported > 0) {
      log.progress(`Importing issues... (${imported}/${sourceIssues.length})`);
    }
  }

  log.info(`Imported ${imported} issue(s), ${conflicts} conflict(s)`);

  // Merge ID mappings from source (workspace) to target (worktree) - union operation
  log.debug('Merging ID mappings...');
  const sourceMapping = await loadIdMapping(sourceDir);
  const targetMapping = await loadIdMapping(dataSyncDir);

  // Merge: add source mappings to target (don't overwrite existing)
  for (const [shortId, ulid] of sourceMapping.shortToUlid) {
    if (!targetMapping.shortToUlid.has(shortId)) {
      addIdMapping(targetMapping, ulid, shortId);
    }
  }
  await saveIdMapping(dataSyncDir, targetMapping);

  // Clear source workspace if requested
  let cleared = false;
  if (shouldClear && imported > 0) {
    const workspaceName = options.outbox ? 'outbox' : options.workspace;
    if (workspaceName) {
      await deleteWorkspace(tbdRoot, workspaceName);
      cleared = true;
    }
  }

  return {
    imported,
    conflicts,
    sourceDir,
    cleared,
  };
}

/**
 * Issue counts by status for a workspace.
 */
export interface WorkspaceIssueCounts {
  open: number;
  in_progress: number;
  closed: number;
  total: number;
}

/**
 * Information about a workspace including issue counts.
 */
export interface WorkspaceInfo {
  name: string;
  counts: WorkspaceIssueCounts;
}

/**
 * List all workspaces in .tbd/workspaces/.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @returns Array of workspace names
 */
export async function listWorkspaces(tbdRoot: string): Promise<string[]> {
  const workspacesDir = join(tbdRoot, WORKSPACES_DIR);

  let entries: string[];
  try {
    entries = await readdir(workspacesDir);
  } catch {
    // Directory doesn't exist
    return [];
  }

  // Filter to directories only
  const workspaces: string[] = [];
  for (const entry of entries) {
    try {
      const entryPath = join(workspacesDir, entry);
      const entryStat = await stat(entryPath);
      if (entryStat.isDirectory()) {
        workspaces.push(entry);
      }
    } catch {
      // Skip entries we can't stat
    }
  }

  return workspaces;
}

/**
 * List all workspaces with issue counts by status.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @returns Array of workspace info with names and counts
 */
export async function listWorkspacesWithCounts(tbdRoot: string): Promise<WorkspaceInfo[]> {
  const workspaceNames = await listWorkspaces(tbdRoot);
  const result: WorkspaceInfo[] = [];

  for (const name of workspaceNames) {
    const workspaceDir = join(tbdRoot, getWorkspaceDir(name));
    let issues: Issue[] = [];

    try {
      issues = await listIssues(workspaceDir);
    } catch {
      // No issues or can't read - counts will be 0
    }

    // Count by status
    const counts: WorkspaceIssueCounts = {
      open: 0,
      in_progress: 0,
      closed: 0,
      total: issues.length,
    };

    for (const issue of issues) {
      if (issue.status === 'open' || issue.status === 'blocked' || issue.status === 'deferred') {
        counts.open++;
      } else if (issue.status === 'in_progress') {
        counts.in_progress++;
      } else if (issue.status === 'closed') {
        counts.closed++;
      }
    }

    result.push({ name, counts });
  }

  return result;
}

/**
 * Delete a workspace.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param name - Workspace name
 */
export async function deleteWorkspace(tbdRoot: string, name: string): Promise<void> {
  const workspaceDir = join(tbdRoot, getWorkspaceDir(name));

  try {
    await rm(workspaceDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if workspace doesn't exist
  }
}

/**
 * Check if a workspace exists.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param name - Workspace name
 * @returns true if the workspace directory exists
 */
export async function workspaceExists(tbdRoot: string, name: string): Promise<boolean> {
  const workspaceDir = join(tbdRoot, getWorkspaceDir(name));

  try {
    const s = await stat(workspaceDir);
    return s.isDirectory();
  } catch {
    return false;
  }
}
