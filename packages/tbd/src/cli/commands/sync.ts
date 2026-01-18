/**
 * `tbd sync` - Synchronization commands.
 *
 * See: tbd-design-spec.md §4.7 Sync Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotInitializedError, SyncError } from '../lib/errors.js';
import { readConfig } from '../../file/config.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import {
  git,
  withIsolatedIndex,
  mergeIssues,
  pushWithRetry,
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
} from '../../lib/syncSummary.js';

interface SyncOptions {
  push?: boolean;
  pull?: boolean;
  status?: boolean;
  force?: boolean;
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

  async run(options: SyncOptions): Promise<void> {
    await requireInit();

    this.dataSyncDir = await resolveDataSyncDir();

    // Load config to get sync branch
    let config;
    try {
      config = await readConfig(process.cwd());
    } catch {
      throw new NotInitializedError('Not a tbd repository. Run `tbd init` first.');
    }

    const syncBranch = config.sync.branch;
    const remote = config.sync.remote;

    if (options.status) {
      await this.showStatus(syncBranch, remote);
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
      await this.fullSync(syncBranch, remote, options.force);
    }
  }

  private async showStatus(syncBranch: string, remote: string): Promise<void> {
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

    // Check for local issues
    try {
      const issues = await listIssues(this.dataSyncDir);
      // Check for uncommitted changes in the worktree
      if (issues.length > 0) {
        try {
          const status = await git('status', '--porcelain', DATA_SYNC_DIR);
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
          this.output.debug('Git not available or not a git repo');
        }
      }
    } catch {
      this.output.debug('No issues directory');
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
    const worktreePath = join(process.cwd(), WORKTREE_DIR);

    try {
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
    return pushWithRetry(syncBranch, remote, async () => {
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
    });
  }

  /**
   * Show git log --stat output in debug mode.
   * Used to display commits that were synced.
   */
  private async showGitLogDebug(range: string, label: string): Promise<void> {
    try {
      const logOutput = await git('log', '--stat', '--oneline', range);
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

  private async fullSync(syncBranch: string, remote: string, _force?: boolean): Promise<void> {
    const spinner = this.output.spinner('Syncing with remote...');
    const summary: SyncSummary = emptySummary();
    const conflicts: ConflictEntry[] = [];
    const worktreePath = join(process.cwd(), WORKTREE_DIR);

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
          if (headBeforeMerge) {
            await this.showGitLogDebug(`${headBeforeMerge}..HEAD`, 'Commits received');
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

          // Stage resolved files and complete merge
          await git('-C', worktreePath, 'add', '-A');
          try {
            await git('-C', worktreePath, 'commit', '-m', 'tbd sync: resolved merge conflicts');
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
    if (aheadCommits > 0) {
      this.output.debug(`Pushing ${aheadCommits} commit(s) to remote`);
      const result = await this.doPushWithRetry(syncBranch, remote);
      if (result.conflicts) {
        conflicts.push(...result.conflicts);
      }
      if (!result.success) {
        this.output.debug(`Push failed: ${result.error}`);
      } else {
        // Show pushed commits in debug mode
        await this.showGitLogDebug(`-${aheadCommits}`, 'Commits sent');
      }
    } else {
      this.output.debug('No commits to push');
    }

    summary.conflicts = conflicts.length;
    spinner.stop();

    this.output.data({ summary, conflicts: conflicts.length }, () => {
      const summaryText = formatSyncSummary(summary);
      if (!summaryText) {
        this.output.success('Already in sync');
      } else {
        this.output.success(`Synced: ${summaryText}`);
      }
    });
  }
}

export const syncCommand = new Command('sync')
  .description('Synchronize with remote')
  .option('--push', 'Push local changes only')
  .option('--pull', 'Pull remote changes only')
  .option('--status', 'Show sync status')
  .option('--force', 'Force sync (overwrite conflicts)')
  .action(async (options, command) => {
    const handler = new SyncHandler(command);
    await handler.run(options);
  });
