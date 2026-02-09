/**
 * `tbd sync` - Synchronization commands.
 *
 * See: tbd-design.md §4.7 Sync Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import {
  requireInit,
  NotInitializedError,
  SyncError,
  WorktreeMissingError,
  WorktreeCorruptedError,
  classifySyncError,
} from '../lib/errors.js';
import { readConfig } from '../../file/config.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import {
  git,
  withIsolatedIndex,
  mergeIssues,
  pushWithRetry,
  checkWorktreeHealth,
  repairWorktree,
  ensureWorktreeAttached,
  type ConflictEntry,
  type PushResult,
} from '../../file/git.js';
import { resolveDataSyncDir, DATA_SYNC_DIR, WORKTREE_DIR } from '../../lib/paths.js';
import { join } from 'node:path';
import {
  type SyncSummary,
  type SyncTallies,
  emptySummary,
  emptyTallies,
  hasTallies,
  formatSyncSummary,
  parseGitStatus,
  parseGitDiff,
} from '../../lib/sync-summary.js';
import { syncDocsWithDefaults, type SyncDocsResult } from '../../file/doc-sync.js';
import { ValidationError } from '../lib/errors.js';
import {
  loadIdMapping,
  saveIdMapping,
  mergeIdMappings,
  parseIdMappingFromYaml,
} from '../../file/id-mapping.js';
import {
  saveToWorkspace,
  workspaceExists,
  importFromWorkspace,
  deleteWorkspace,
} from '../../file/workspace.js';

interface SyncOptions {
  push?: boolean;
  pull?: boolean;
  status?: boolean;
  force?: boolean;
  fix?: boolean;
  issues?: boolean;
  docs?: boolean;
  noAutoSave?: boolean;
  noOutbox?: boolean;
}

interface SyncStatus {
  synced: boolean;
  localChanges: string[];
  remoteChanges: string[];
  syncBranch: string;
  remote: string;
  ahead: number;
  behind: number;
}

class SyncHandler extends BaseCommand {
  private dataSyncDir = '';
  private tbdRoot = '';

  async run(options: SyncOptions): Promise<void> {
    const tbdRoot = await requireInit();
    this.tbdRoot = tbdRoot;

    // Validate mutually exclusive options
    // --push/--pull only apply to issues (network operations)
    if ((options.push || options.pull) && options.docs) {
      throw new ValidationError('--push/--pull only work with issue sync, not --docs');
    }

    // Determine what to sync:
    // - If neither --issues nor --docs specified, sync both
    // - If --push or --pull specified (without --issues/--docs), sync only issues
    const hasExclusiveIssueFlag = Boolean(options.push) || Boolean(options.pull);
    const hasSelectiveFlag = Boolean(options.issues) || Boolean(options.docs);

    // Sync docs: explicit --docs, or default (no selective flags and no push/pull)
    const syncDocs = Boolean(options.docs) || (!hasSelectiveFlag && !hasExclusiveIssueFlag);
    // Sync issues: explicit --issues, push/pull flags, or default (no selective flags)
    const syncIssues = Boolean(options.issues) || hasExclusiveIssueFlag || !hasSelectiveFlag;

    // STEP 1: Sync docs first (fast, local operations)
    // This ensures docs are updated even if issue sync fails
    if (syncDocs) {
      await this.syncDocs(options.status);

      // If only doing docs, return after doc sync
      if (!syncIssues) {
        return;
      }
    }

    // STEP 2: Sync issues (network operations)
    // Check worktree health before any issue sync operations
    // See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
    let worktreeHealth = await checkWorktreeHealth(tbdRoot);
    if (!worktreeHealth.valid) {
      // Auto-create worktree if it's simply missing (normal for fresh clones)
      // Only require --fix for corrupted/prunable states that need repair
      if (worktreeHealth.status === 'missing') {
        // Auto-create worktree - this is the expected state on fresh clones
        await this.doRepairWorktree(tbdRoot, 'missing');
        worktreeHealth = await checkWorktreeHealth(tbdRoot);
        if (!worktreeHealth.valid) {
          throw new WorktreeCorruptedError(
            `Failed to create worktree. Status: ${worktreeHealth.status}. Run 'tbd doctor' for diagnostics.`,
          );
        }
      } else if (options.fix) {
        // Attempt repair when --fix is provided for corrupted/prunable states
        await this.doRepairWorktree(tbdRoot, worktreeHealth.status as 'prunable' | 'corrupted');
        // Re-check health after repair
        worktreeHealth = await checkWorktreeHealth(tbdRoot);
        if (!worktreeHealth.valid) {
          throw new WorktreeCorruptedError(
            `Worktree repair failed. Status: ${worktreeHealth.status}. Run 'tbd doctor' for diagnostics.`,
          );
        }
      } else {
        // No --fix flag, throw appropriate error for corrupted/prunable states
        if (worktreeHealth.status === 'prunable') {
          throw new WorktreeMissingError(
            "Worktree directory was deleted but git still tracks it. Run 'tbd sync --fix' or 'tbd doctor --fix' to repair.",
          );
        }
        if (worktreeHealth.status === 'corrupted') {
          throw new WorktreeCorruptedError(
            `Worktree is corrupted: ${worktreeHealth.error ?? 'unknown error'}. Run 'tbd sync --fix' or 'tbd doctor --fix' to repair.`,
          );
        }
      }
    }

    this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

    // Load config to get sync branch
    let config;
    try {
      config = await readConfig(tbdRoot);
    } catch {
      throw new NotInitializedError('Not a tbd repository. Run `tbd init` first.');
    }

    const syncBranch = config.sync.branch;
    const remote = config.sync.remote;

    if (options.status) {
      await this.showIssueStatus(syncBranch, remote);
      return;
    }

    if (this.checkDryRun('Would sync repository', { syncBranch, remote })) {
      return;
    }

    if (options.pull) {
      await this.pullChanges(syncBranch, remote);
    } else if (options.push) {
      await this.pushChanges(syncBranch, remote);
    } else {
      // Full sync: pull then push
      await this.fullSync(syncBranch, remote, {
        force: options.force,
        noAutoSave: options.noAutoSave,
        noOutbox: options.noOutbox,
      });
    }
  }

  /**
   * Sync docs from bundled sources and config.
   * This is a fast, local operation (no network required).
   */
  private async syncDocs(statusOnly?: boolean): Promise<SyncDocsResult> {
    if (statusOnly) {
      // Show status without making changes
      const result = await syncDocsWithDefaults(this.tbdRoot, { dryRun: true });
      this.showDocStatus(result);
      return result;
    }

    const spinner = this.output.spinner('Syncing docs...');
    const result = await syncDocsWithDefaults(this.tbdRoot);
    spinner.stop();

    // Report results
    this.showDocSyncResult(result);
    return result;
  }

  /**
   * Show doc sync status (what would change).
   */
  private showDocStatus(result: SyncDocsResult): void {
    const colors = this.output.getColors();
    const hasChanges =
      result.added.length > 0 ||
      result.updated.length > 0 ||
      result.removed.length > 0 ||
      result.pruned.length > 0;

    if (!hasChanges) {
      this.output.success('Docs up to date');
      return;
    }

    console.log(colors.bold('Docs:'));
    if (result.added.length > 0) {
      console.log(`  ${colors.success(`+${result.added.length}`)} new doc(s) available`);
    }
    if (result.updated.length > 0) {
      console.log(`  ${colors.warn(`~${result.updated.length}`)} doc(s) to update`);
    }
    if (result.removed.length > 0) {
      console.log(`  ${colors.error(`-${result.removed.length}`)} doc(s) to remove`);
    }
    if (result.pruned.length > 0) {
      console.log(`  ${colors.dim(`${result.pruned.length}`)} stale config entry/entries`);
    }
  }

  /**
   * Show doc sync result after sync.
   */
  private showDocSyncResult(result: SyncDocsResult): void {
    const hasChanges =
      result.added.length > 0 ||
      result.updated.length > 0 ||
      result.removed.length > 0 ||
      result.pruned.length > 0;

    if (!hasChanges) {
      this.output.success('Docs up to date');
      return;
    }

    // Build summary string
    const parts: string[] = [];
    if (result.added.length > 0) {
      parts.push(`+${result.added.length}`);
    }
    if (result.updated.length > 0) {
      parts.push(`~${result.updated.length}`);
    }
    if (result.removed.length > 0) {
      parts.push(`-${result.removed.length}`);
    }

    if (parts.length > 0) {
      this.output.success(`Synced docs: ${parts.join(' ')} doc(s)`);
    }

    // Report pruned entries
    if (result.pruned.length > 0) {
      this.output.info(`Removed ${result.pruned.length} stale config entry/entries`);
    }

    // Report errors
    for (const err of result.errors) {
      this.output.warn(`Doc sync error: ${err.path}: ${err.error}`);
    }
  }

  /**
   * Attempt to repair an unhealthy worktree.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
   */
  private async doRepairWorktree(
    tbdRoot: string,
    status: 'missing' | 'prunable' | 'corrupted',
  ): Promise<void> {
    const spinner = this.output.spinner(`Repairing worktree (${status})...`);

    try {
      // Use shared repairWorktree from git.ts
      const result = await repairWorktree(tbdRoot, status);

      spinner.stop();

      if (!result.success) {
        throw new WorktreeCorruptedError(`Failed to repair worktree: ${result.error}`);
      }

      if (result.backedUp) {
        this.output.info(`Corrupted worktree backed up to: ${result.backedUp}`);
      }
      this.output.success('Worktree repaired successfully');
    } catch (error) {
      spinner.stop();
      if (error instanceof WorktreeCorruptedError) throw error;
      throw new WorktreeCorruptedError(`Failed to repair worktree: ${(error as Error).message}`);
    }
  }

  private async showIssueStatus(syncBranch: string, remote: string): Promise<void> {
    const status = await this.getSyncStatus(syncBranch, remote);

    this.output.data(status, () => {
      const colors = this.output.getColors();

      if (status.synced) {
        this.output.success('Repository is in sync');
        return;
      }

      console.log(colors.bold(`Sync status: ${syncBranch} ↔ ${remote}/${syncBranch}`));
      console.log('');

      if (status.ahead > 0) {
        console.log(`  ${colors.id(`↑ ${status.ahead}`)} commit(s) ahead (to push)`);
      }
      if (status.behind > 0) {
        console.log(`  ${colors.dim(`↓ ${status.behind}`)} commit(s) behind (to pull)`);
      }

      if (status.localChanges.length > 0) {
        console.log('');
        console.log(colors.bold('Local changes (not yet pushed):'));
        for (const change of status.localChanges) {
          console.log(`  ${change}`);
        }
      }

      if (status.remoteChanges.length > 0) {
        console.log('');
        console.log(colors.bold('Remote changes (not yet pulled):'));
        for (const change of status.remoteChanges) {
          console.log(`  ${change}`);
        }
      }
    });
  }

  private async getSyncStatus(syncBranch: string, remote: string): Promise<SyncStatus> {
    const localChanges: string[] = [];
    const remoteChanges: string[] = [];
    let ahead = 0;
    let behind = 0;

    // Check for uncommitted changes in the worktree
    // FIX Bug 2: Previously ran git status on main branch where data-sync/ is gitignored.
    // Now check worktree status directly.
    // See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
    try {
      const worktreePath = join(this.tbdRoot, WORKTREE_DIR);
      const status = await git('-C', worktreePath, 'status', '--porcelain');
      if (status) {
        for (const line of status.split('\n')) {
          if (!line) continue;
          const statusCode = line.slice(0, 2).trim();
          const file = line.slice(3);
          if (statusCode === 'M') {
            localChanges.push(`modified: ${file}`);
          } else if (statusCode === 'A' || statusCode === '??') {
            localChanges.push(`new: ${file}`);
          } else if (statusCode === 'D') {
            localChanges.push(`deleted: ${file}`);
          }
        }
      }
    } catch {
      this.output.debug('Git worktree not available');
    }

    // Check for remote changes
    try {
      await git('fetch', remote, syncBranch);

      // Count commits ahead/behind
      try {
        const aheadOutput = await git(
          'rev-list',
          '--count',
          `${remote}/${syncBranch}..${syncBranch}`,
        );
        ahead = parseInt(aheadOutput, 10) || 0;
      } catch {
        this.output.debug('Branch does not exist locally');
      }

      try {
        const behindOutput = await git(
          'rev-list',
          '--count',
          `${syncBranch}..${remote}/${syncBranch}`,
        );
        behind = parseInt(behindOutput, 10) || 0;
      } catch {
        this.output.debug('Remote branch does not exist');
      }

      // Get commit messages for remote changes
      if (behind > 0) {
        const logOutput = await git(
          'log',
          '--oneline',
          `${syncBranch}..${remote}/${syncBranch}`,
          '--limit=10',
        );
        for (const line of logOutput.split('\n')) {
          if (line) {
            remoteChanges.push(line);
          }
        }
      }
    } catch {
      this.output.debug('Remote not available or sync branch does not exist');
    }

    return {
      synced:
        localChanges.length === 0 && remoteChanges.length === 0 && ahead === 0 && behind === 0,
      localChanges,
      remoteChanges,
      syncBranch,
      remote,
      ahead,
      behind,
    };
  }

  private async pullChanges(syncBranch: string, remote: string): Promise<void> {
    const spinner = this.output.spinner('Pulling from remote...');
    try {
      await git('fetch', remote, syncBranch);

      // Get list of changed files
      let behind = 0;
      try {
        const behindOutput = await git(
          'rev-list',
          '--count',
          `${syncBranch}..${remote}/${syncBranch}`,
        );
        behind = parseInt(behindOutput, 10) || 0;
      } catch {
        this.output.debug('Branch does not exist');
      }

      spinner.stop();
      if (behind === 0) {
        this.output.success('Already up to date');
        return;
      }

      // Merge changes using isolated index
      await withIsolatedIndex(async () => {
        // Read the remote tree
        await git('read-tree', `${remote}/${syncBranch}`);

        // Update local branch to remote
        const remoteCommit = await git('rev-parse', `${remote}/${syncBranch}`);
        await git('update-ref', `refs/heads/${syncBranch}`, remoteCommit);
      });

      this.output.success(`Pulled ${behind} change(s) from ${remote}/${syncBranch}`);
    } catch (error) {
      spinner.stop();
      const msg = (error as Error).message;
      if (msg.includes('not found') || msg.includes('does not exist')) {
        this.output.info(`Remote branch ${remote}/${syncBranch} does not exist yet`);
      } else {
        throw new SyncError(`Failed to pull: ${msg}`);
      }
    }
  }

  /**
   * Commit any uncommitted changes in the worktree to the sync branch.
   * This must be called before pushing to ensure changes are captured.
   *
   * @returns Tallies of new/updated/deleted files committed
   */
  private async commitWorktreeChanges(): Promise<SyncTallies> {
    // Use tbdRoot to derive worktree path consistently
    // FIX Bug 1: Previously used process.cwd() which fails if not in repo root
    // See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
    const worktreePath = join(this.tbdRoot, WORKTREE_DIR);

    try {
      // Ensure worktree is attached to sync branch (repair old tbd repos)
      await ensureWorktreeAttached(worktreePath);

      // Check for uncommitted changes (untracked, modified, or deleted)
      const status = await git('-C', worktreePath, 'status', '--porcelain');
      if (!status || status.trim() === '') {
        return emptyTallies(); // Nothing to commit
      }

      // Parse status to get tallies
      const tallies = parseGitStatus(status);
      const fileCount = tallies.new + tallies.updated + tallies.deleted;

      // Stage all changes
      await git('-C', worktreePath, 'add', '-A');

      // Commit the changes
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      await git(
        '-C',
        worktreePath,
        'commit',
        '-m',
        `tbd sync: ${timestamp} (${fileCount} file${fileCount === 1 ? '' : 's'})`,
      );

      return tallies;
    } catch (error) {
      // If commit fails (e.g., nothing to commit after staging), that's ok
      const msg = (error as Error).message;
      if (msg.includes('nothing to commit')) {
        return emptyTallies();
      }
      throw error;
    }
  }

  private async pushChanges(syncBranch: string, remote: string): Promise<void> {
    const spinner = this.output.spinner('Pushing to remote...');
    try {
      // Commit any uncommitted changes in the worktree before pushing
      const committedTallies = await this.commitWorktreeChanges();
      const committedCount =
        committedTallies.new + committedTallies.updated + committedTallies.deleted;
      if (committedCount > 0) {
        this.output.info(`Committed ${committedCount} file(s) to sync branch`);
      }

      // Check how many commits we're ahead of remote
      let ahead = 0;
      try {
        await git('fetch', remote, syncBranch);
        const aheadOutput = await git(
          'rev-list',
          '--count',
          `${remote}/${syncBranch}..${syncBranch}`,
        );
        ahead = parseInt(aheadOutput, 10) || 0;
        this.output.debug(`Ahead of remote by ${ahead} commit(s)`);
      } catch {
        // Remote branch doesn't exist - count all local commits
        try {
          const countOutput = await git('rev-list', '--count', syncBranch);
          ahead = parseInt(countOutput, 10) || 0;
          this.output.debug(`Remote branch not found, ${ahead} local commit(s) to push`);
        } catch {
          ahead = 0;
          this.output.debug('Could not count local commits');
        }
      }

      if (ahead === 0) {
        spinner.stop();
        this.output.success('Already up to date');
        return;
      }

      // Use push with retry
      const result = await this.doPushWithRetry(syncBranch, remote);
      spinner.stop();

      if (result.success) {
        this.output.success(`Pushed ${ahead} commit(s) to ${remote}/${syncBranch}`);
      } else if (result.conflicts && result.conflicts.length > 0) {
        this.output.warn(
          `Push completed with ${result.conflicts.length} conflict(s) (see attic for details)`,
        );
      } else {
        throw new SyncError(`Failed to push: ${result.error}`);
      }
    } catch (error) {
      spinner.stop();
      if (error instanceof SyncError) throw error;
      throw new SyncError(`Failed to push: ${(error as Error).message}`);
    }
  }

  private async doPushWithRetry(syncBranch: string, remote: string): Promise<PushResult> {
    return pushWithRetry(
      syncBranch,
      remote,
      async () => {
        // Merge callback - called when we need to merge remote changes
        const conflicts: ConflictEntry[] = [];

        // Get list of issues that need merging
        const localIssues = await listIssues(this.dataSyncDir);

        for (const localIssue of localIssues) {
          try {
            // Try to get the remote version (use relative path for git show)
            const remoteContent = await git(
              'show',
              `${remote}/${syncBranch}:${DATA_SYNC_DIR}/issues/${localIssue.id}.md`,
            );

            if (remoteContent) {
              // Parse remote issue and merge
              const remoteIssue = await readIssue(this.dataSyncDir, localIssue.id);
              const result = mergeIssues(null, localIssue, remoteIssue);

              // Write merged result
              await writeIssue(this.dataSyncDir, result.merged);
              conflicts.push(...result.conflicts);
            }
          } catch {
            // Issue doesn't exist remotely - no merge needed
            this.output.debug(`Issue ${localIssue.id} not on remote, no merge needed`);
          }
        }

        return conflicts;
      },
      this.tbdRoot,
    );
  }

  /**
   * Show git log --stat output in debug mode.
   * Used to display commits that were synced.
   *
   * @param label - Label for the debug output (e.g., "Commits sent")
   * @param args - Arguments to pass to `git log` after `--stat --oneline`
   *   Must include explicit branch/ref to avoid showing commits from the wrong branch.
   */
  private async showGitLogDebug(label: string, ...args: string[]): Promise<void> {
    try {
      const logOutput = await git('log', '--stat', '--oneline', ...args);
      if (logOutput.trim()) {
        this.output.debug(`${label}:`);
        for (const line of logOutput.split('\n')) {
          this.output.debug(`  ${line}`);
        }
      }
    } catch {
      // Ignore errors - log is just for debugging
    }
  }

  private async fullSync(
    syncBranch: string,
    remote: string,
    options: { force?: boolean; noAutoSave?: boolean; noOutbox?: boolean } = {},
  ): Promise<void> {
    const spinner = this.output.spinner('Syncing with remote...');
    const summary: SyncSummary = emptySummary();
    const conflicts: ConflictEntry[] = [];
    // Use tbdRoot for consistent path resolution
    const worktreePath = join(this.tbdRoot, WORKTREE_DIR);

    try {
      // STEP 1: Commit local changes FIRST (before pulling)
      // This ensures local work is preserved before we incorporate remote changes.
      const committedTallies = await this.commitWorktreeChanges();
      // Add committed changes to sent tallies
      summary.sent.new += committedTallies.new;
      summary.sent.updated += committedTallies.updated;
      summary.sent.deleted += committedTallies.deleted;
      if (hasTallies(committedTallies)) {
        const count = committedTallies.new + committedTallies.updated + committedTallies.deleted;
        this.output.debug(`Committed ${count} file(s) to sync branch`);
      }

      // STEP 2: Fetch remote
      await git('fetch', remote, syncBranch);

      // Get file-level changes from remote using git diff
      let behindCommits = 0;
      try {
        const behindOutput = await git(
          'rev-list',
          '--count',
          `${syncBranch}..${remote}/${syncBranch}`,
        );
        behindCommits = parseInt(behindOutput, 10) || 0;
        this.output.debug(`Behind remote by ${behindCommits} commit(s)`);

        // Get file-level tallies for received changes
        if (behindCommits > 0) {
          try {
            const diffOutput = await git(
              'diff',
              '--name-status',
              `${syncBranch}..${remote}/${syncBranch}`,
            );
            const receivedTallies = parseGitDiff(diffOutput);
            summary.received.new += receivedTallies.new;
            summary.received.updated += receivedTallies.updated;
            summary.received.deleted += receivedTallies.deleted;
          } catch {
            // If we can't get detailed diff, just track commit count
            this.output.debug('Could not get detailed diff for received changes');
          }
        }
      } catch {
        // Branch doesn't exist on remote
        this.output.debug('Remote sync branch does not exist yet');
      }

      // STEP 3: If remote has changes, merge them in
      if (behindCommits > 0) {
        // Track HEAD before merge for debug log
        let headBeforeMerge = '';
        try {
          headBeforeMerge = (await git('-C', worktreePath, 'rev-parse', 'HEAD')).trim();
        } catch {
          // Ignore - just won't show debug log
        }

        // Merge remote into local using worktree
        // This is a proper git merge that preserves both local and remote changes
        try {
          await git(
            '-C',
            worktreePath,
            'merge',
            `${remote}/${syncBranch}`,
            '-m',
            'tbd sync: merge remote changes',
          );
          this.output.debug(`Merged ${behindCommits} commit(s) from remote`);

          // Show received commits in debug mode
          // Use syncBranch explicitly — bare `HEAD` would resolve to the user's
          // current working branch, not the tbd-sync branch in the worktree.
          if (headBeforeMerge) {
            await this.showGitLogDebug('Commits received', `${headBeforeMerge}..${syncBranch}`);
          }
        } catch {
          // Merge conflict - try to resolve at file level
          this.output.info(`Merge conflict, attempting file-level resolution`);

          // For each conflicted issue, do field-level merge
          const localIssues = await listIssues(this.dataSyncDir);
          for (const localIssue of localIssues) {
            try {
              const remoteContent = await git(
                'show',
                `${remote}/${syncBranch}:${DATA_SYNC_DIR}/issues/${localIssue.id}.md`,
              );
              if (remoteContent) {
                const remoteIssue = await readIssue(this.dataSyncDir, localIssue.id);
                const result = mergeIssues(null, localIssue, remoteIssue);
                await writeIssue(this.dataSyncDir, result.merged);
                conflicts.push(...result.conflicts);
              }
            } catch {
              // Issue doesn't exist remotely - keep local version
              this.output.debug(`Issue ${localIssue.id} not on remote, keeping local`);
            }
          }

          // Merge ids.yml (ID mappings are always additive, so we union both sides)
          try {
            const remoteIdsContent = await git(
              'show',
              `${remote}/${syncBranch}:${DATA_SYNC_DIR}/mappings/ids.yml`,
            );
            if (remoteIdsContent) {
              const localMapping = await loadIdMapping(this.dataSyncDir);
              const remoteMapping = parseIdMappingFromYaml(remoteIdsContent);
              const mergedMapping = mergeIdMappings(localMapping, remoteMapping);
              await saveIdMapping(this.dataSyncDir, mergedMapping);
              this.output.debug(
                `Merged ID mappings: ${localMapping.shortToUlid.size} local + ${remoteMapping.shortToUlid.size} remote = ${mergedMapping.shortToUlid.size} total`,
              );
            }
          } catch (error) {
            // Remote ids.yml doesn't exist or can't be parsed - keep local
            this.output.debug(`Could not merge ids.yml: ${(error as Error).message}`);
          }

          // Stage resolved files and complete merge
          // Use --no-verify to bypass parent repo hooks (lefthook, husky, etc.)
          await git('-C', worktreePath, 'add', '-A');

          // SAFETY CHECK: Never commit files with unresolved merge conflict markers
          // This prevents the bug where ids.yml or other files get committed with
          // <<<<<<< HEAD markers still present
          const conflictCheck = await git(
            '-C',
            worktreePath,
            'diff',
            '--cached',
            '-S<<<<<<< ',
            '--name-only',
          );
          if (conflictCheck.trim()) {
            const conflictedFiles = conflictCheck.trim().split('\n');
            throw new SyncError(
              `Cannot commit: ${conflictedFiles.length} file(s) still have merge conflict markers:\n` +
                conflictedFiles.map((f) => `  - ${f}`).join('\n') +
                `\n\nThis is a bug in tbd sync. Please report it and manually resolve conflicts in:\n` +
                `  ${worktreePath}`,
            );
          }

          try {
            await git(
              '-C',
              worktreePath,
              'commit',
              '--no-verify',
              '-m',
              'tbd sync: resolved merge conflicts',
            );
          } catch {
            // May fail if no conflicts needed resolving
            this.output.debug('No merge commit needed (conflicts already resolved)');
          }
        }
      }
    } catch (error) {
      // Remote not available - that's ok for first sync
      this.output.debug(`Fetch failed (may be first sync): ${(error as Error).message}`);
    }

    // Check how many commits we're ahead of remote (if any)
    let aheadCommits = 0;
    try {
      const aheadOutput = await git(
        'rev-list',
        '--count',
        `${remote}/${syncBranch}..${syncBranch}`,
      );
      aheadCommits = parseInt(aheadOutput, 10) || 0;
      this.output.debug(`Ahead of remote by ${aheadCommits} commit(s)`);
    } catch {
      // Remote branch doesn't exist - count all local commits on sync branch
      try {
        const countOutput = await git('rev-list', '--count', syncBranch);
        aheadCommits = parseInt(countOutput, 10) || 0;
        this.output.debug(`Remote branch not found, ${aheadCommits} local commit(s) to push`);
      } catch {
        aheadCommits = 0;
        this.output.debug('Could not count local commits');
      }
    }

    // Push if we have commits ahead of remote
    let pushFailed = false;
    let pushError = '';
    if (aheadCommits > 0) {
      this.output.debug(`Pushing ${aheadCommits} commit(s) to remote`);
      const result = await this.doPushWithRetry(syncBranch, remote);
      if (result.conflicts) {
        conflicts.push(...result.conflicts);
      }
      if (!result.success) {
        pushFailed = true;
        pushError = result.error ?? 'Unknown push error';
        this.output.debug(`Push failed: ${pushError}`);
      } else {
        // Show pushed commits in debug mode
        // Use syncBranch explicitly — bare `-N` would resolve against the user's
        // current working branch (HEAD), not the tbd-sync branch.
        await this.showGitLogDebug('Commits sent', syncBranch, `-${aheadCommits}`);
      }
    } else {
      this.output.debug('No commits to push');
    }

    summary.conflicts = conflicts.length;
    spinner.stop();

    // Report push failure - classify error and take appropriate action
    if (pushFailed) {
      // Extract meaningful error display string
      let displayError = pushError;
      const httpMatch = /HTTP (\d+)/.exec(pushError);
      const curlMatch = /curl \d+ (.+?)(?:\n|$)/.exec(pushError);
      if (httpMatch) {
        displayError = `HTTP ${httpMatch[1]}${curlMatch ? ` - ${curlMatch[1]}` : ''}`;
      } else {
        // Fall back to first meaningful line (skip "Command failed: git push...")
        const lines = pushError.split('\n').filter((l) => l && !l.startsWith('Command failed'));
        displayError = lines[0] ?? pushError;
      }

      // Classify the error to determine recovery action
      const errorType = classifySyncError(pushError);

      this.output.data(
        {
          summary,
          conflicts: conflicts.length,
          pushFailed,
          pushError,
          unpushedCommits: aheadCommits,
          errorType,
        },
        () => {
          this.output.error(`Push failed: ${displayError}`);
          console.log(`  ${aheadCommits} commit(s) not pushed to remote.`);
        },
      );

      // Handle recovery based on error type (after output.data to avoid async callback)
      // Only show options in non-JSON mode
      if (errorType === 'permanent' && !options.noAutoSave) {
        // Auto-save to outbox on permanent failure
        await this.handlePermanentFailure();
      } else if (!this.ctx.json) {
        if (errorType === 'transient') {
          // Suggest retry for transient failures
          console.log('');
          console.log('  This appears to be a temporary issue. Options:');
          console.log('    • Retry:  tbd sync');
          console.log('    • Save for later:  tbd save --outbox');
        } else {
          // Unknown error - suggest both options
          console.log('');
          console.log('  Options:');
          console.log('    • Retry:  tbd sync');
          console.log("    • Run 'tbd sync --status' to check status");
          console.log('    • Save for later:  tbd save --outbox');
        }
      }
      return;
    }

    // After successful push, import from outbox if it has data
    if (!options.noOutbox) {
      await this.maybeImportOutbox(syncBranch, remote);
    }

    this.output.data({ summary, conflicts: conflicts.length }, () => {
      const summaryText = formatSyncSummary(summary);
      if (!summaryText) {
        this.output.success('Already in sync');
      } else {
        this.output.success(`Synced: ${summaryText}`);
      }
    });
  }

  /**
   * Handle permanent push failure by auto-saving to outbox.
   * Called when push fails with a permanent error (e.g., HTTP 403).
   */
  private async handlePermanentFailure(): Promise<void> {
    // Count issues in worktree to see if there's anything to save
    const worktreeIssues = await listIssues(this.dataSyncDir);
    if (worktreeIssues.length === 0) {
      console.log('');
      console.log('  No unsynced issues to save (already in sync with remote).');
      return;
    }

    // Check existing outbox count before save
    let existingOutboxCount = 0;
    if (await workspaceExists(this.tbdRoot, 'outbox')) {
      const outboxPath = join(this.tbdRoot, '.tbd', 'workspaces', 'outbox');
      try {
        const existingIssues = await listIssues(outboxPath);
        existingOutboxCount = existingIssues.length;
      } catch {
        // Outbox exists but couldn't read - will be handled by saveToWorkspace
      }
    }

    try {
      // Auto-save to outbox (merges with existing outbox data via updatesOnly)
      const result = await saveToWorkspace(this.tbdRoot, this.dataSyncDir, { outbox: true });

      if (result.saved === 0) {
        // Nothing new to save - issues already in outbox from previous failure
        console.log('');
        console.log('  Issues already saved to outbox from previous sync attempt.');
        console.log('');
        console.log('  Your issues are safe. To recover later:');
        console.log("    1. Commit:  git add .tbd/workspaces && git commit -m 'tbd: save outbox'");
        console.log('    2. Push your working branch:  git push');
        console.log("    3. Run 'tbd sync' when push access is available");
      } else {
        // Show saved count and total in outbox
        const totalInOutbox = existingOutboxCount + result.saved;
        if (existingOutboxCount > 0) {
          console.log('');
          this.output.success(
            `Saved ${result.saved} issue(s) to outbox (${totalInOutbox} total in outbox)`,
          );
        } else {
          console.log('');
          this.output.success(`Saved ${result.saved} issue(s) to outbox (automatic backup)`);
        }
        console.log('');
        console.log('  Your issues are safe. To recover later:');
        console.log("    1. Commit:  git add .tbd/workspaces && git commit -m 'tbd: save outbox'");
        console.log('    2. Push your working branch:  git push');
        console.log("    3. Run 'tbd sync' when push access is available");
        console.log('       (outbox will be imported automatically on successful sync)');
      }
    } catch (saveError) {
      // Auto-save failed - report both errors
      const saveErrorMsg = saveError instanceof Error ? saveError.message : String(saveError);
      console.log('');
      this.output.error(`Auto-save to outbox also failed: ${saveErrorMsg}`);
      console.log('');
      console.log("  Run 'tbd save --outbox' manually, or 'tbd doctor' to diagnose.");
    }
  }

  /**
   * Import pending issues from outbox after a successful push.
   * Uses two-phase sync: import → commit → push → clear.
   * Only clears the outbox if all steps succeed.
   *
   * @param syncBranch - The sync branch name
   * @param remote - The remote name
   */
  private async maybeImportOutbox(syncBranch: string, remote: string): Promise<void> {
    // Check if outbox exists and has issues
    if (!(await workspaceExists(this.tbdRoot, 'outbox'))) {
      return; // No outbox - nothing to import
    }

    const outboxPath = join(this.tbdRoot, '.tbd', 'workspaces', 'outbox');
    let outboxIssues: Awaited<ReturnType<typeof listIssues>> = [];
    try {
      outboxIssues = await listIssues(outboxPath);
    } catch {
      return; // Can't read outbox - skip silently
    }

    if (outboxIssues.length === 0) {
      return; // Outbox is empty - nothing to import
    }

    try {
      // Step 1: Import from outbox (don't clear yet)
      const importResult = await importFromWorkspace(this.tbdRoot, this.dataSyncDir, {
        outbox: true,
        clearOnSuccess: false, // We'll clear manually after push succeeds
      });

      if (importResult.imported === 0) {
        return; // Nothing was actually imported
      }

      // Step 2: Commit the imported issues
      const committedTallies = await this.commitWorktreeChanges();
      if (committedTallies.new + committedTallies.updated + committedTallies.deleted === 0) {
        // Nothing to commit - issues were already in worktree
        // This can happen if outbox data was identical to worktree
        // Still clear the outbox since the data is already synced
        await deleteWorkspace(this.tbdRoot, 'outbox');
        return;
      }

      // Step 3: Push the imported issues
      const pushResult = await this.doPushWithRetry(syncBranch, remote);
      if (!pushResult.success) {
        // Secondary push failed - DON'T clear outbox
        // The issues are now in the worktree, so they'll be synced next time
        this.output.warn(
          `Could not push imported outbox issues: ${pushResult.error ?? 'unknown error'}`,
        );
        console.log('  Outbox preserved. Issues are in worktree and will sync next time.');
        return;
      }

      // Step 4: All succeeded - now clear the outbox
      await deleteWorkspace(this.tbdRoot, 'outbox');

      this.output.success(`Imported ${importResult.imported} issue(s) from outbox (also synced)`);
    } catch (err) {
      // Don't fail the whole sync - primary sync already succeeded
      const errMsg = err instanceof Error ? err.message : String(err);
      this.output.warn(`Could not sync outbox: ${errMsg}`);
      console.log('  Outbox preserved. Will retry on next sync.');
    }
  }
}

export const syncCommand = new Command('sync')
  .description('Synchronize issues and docs (both by default)')
  .option('--issues', 'Sync only issues (not docs)')
  .option('--docs', 'Sync only docs (not issues)')
  .option('--push', 'Push local issue changes only')
  .option('--pull', 'Pull remote issue changes only')
  .option('--status', 'Show sync status')
  .option('--force', 'Force sync (overwrite conflicts)')
  .option('--fix', 'Attempt to repair unhealthy worktree before syncing')
  .option('--no-auto-save', 'Skip auto-save to outbox on permanent failure')
  .option('--no-outbox', 'Skip auto-import from outbox on success')
  .action(async (options, command) => {
    const handler = new SyncHandler(command);
    await handler.run(options);
  });
