/**
 * `tbd sync` - Synchronization commands.
 *
 * See: tbd-design-v3.md §4.7 Sync Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
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

// Base directory for issues
const ISSUES_BASE_DIR = '.tbd-sync';

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
  async run(options: SyncOptions): Promise<void> {
    // Load config to get sync branch
    let config;
    try {
      config = await readConfig(process.cwd());
    } catch {
      this.output.error('Not a tbd repository. Run `tbd init` first.');
      return;
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
      const issues = await listIssues(ISSUES_BASE_DIR);
      // Check for uncommitted changes in the worktree
      if (issues.length > 0) {
        try {
          const status = await git('status', '--porcelain', ISSUES_BASE_DIR);
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
          // Git not available or not a git repo
        }
      }
    } catch {
      // No issues directory
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
        // Branch doesn't exist locally
      }

      try {
        const behindOutput = await git(
          'rev-list',
          '--count',
          `${syncBranch}..${remote}/${syncBranch}`,
        );
        behind = parseInt(behindOutput, 10) || 0;
      } catch {
        // Remote branch doesn't exist
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
      // Remote not available or sync branch doesn't exist
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
        // Branch doesn't exist
      }

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
      const msg = (error as Error).message;
      if (msg.includes('not found') || msg.includes('does not exist')) {
        this.output.info(`Remote branch ${remote}/${syncBranch} does not exist yet`);
      } else {
        this.output.error(`Failed to pull: ${msg}`);
      }
    }
  }

  private async pushChanges(syncBranch: string, remote: string): Promise<void> {
    try {
      // Check if we have any changes to push
      const issues = await listIssues(ISSUES_BASE_DIR);
      if (issues.length === 0) {
        this.output.info('No issues to push');
        return;
      }

      // Use push with retry
      const result = await this.doPushWithRetry(syncBranch, remote);

      if (result.success) {
        this.output.success(`Pushed ${issues.length} issue(s) to ${remote}/${syncBranch}`);
      } else if (result.conflicts && result.conflicts.length > 0) {
        this.output.warn(
          `Push completed with ${result.conflicts.length} conflict(s) (see attic for details)`,
        );
      } else {
        this.output.error(`Failed to push: ${result.error}`);
      }
    } catch (error) {
      this.output.error(`Failed to push: ${(error as Error).message}`);
    }
  }

  private async doPushWithRetry(syncBranch: string, remote: string): Promise<PushResult> {
    return pushWithRetry(syncBranch, remote, async () => {
      // Merge callback - called when we need to merge remote changes
      const conflicts: ConflictEntry[] = [];

      // Get list of issues that need merging
      const localIssues = await listIssues(ISSUES_BASE_DIR);

      for (const localIssue of localIssues) {
        try {
          // Try to get the remote version
          const remoteContent = await git(
            'show',
            `${remote}/${syncBranch}:${ISSUES_BASE_DIR}/issues/${localIssue.id}.md`,
          );

          if (remoteContent) {
            // Parse remote issue and merge
            const remoteIssue = await readIssue(ISSUES_BASE_DIR, localIssue.id);
            const result = mergeIssues(null, localIssue, remoteIssue);

            // Write merged result
            await writeIssue(ISSUES_BASE_DIR, result.merged);
            conflicts.push(...result.conflicts);
          }
        } catch {
          // Issue doesn't exist remotely - no merge needed
        }
      }

      return conflicts;
    });
  }

  private async fullSync(syncBranch: string, remote: string, force?: boolean): Promise<void> {
    let pulled = 0;
    let pushed = 0;
    const conflicts: ConflictEntry[] = [];

    // Pull first
    try {
      await git('fetch', remote, syncBranch);

      // Count commits to pull
      try {
        const behindOutput = await git(
          'rev-list',
          '--count',
          `${syncBranch}..${remote}/${syncBranch}`,
        );
        pulled = parseInt(behindOutput, 10) || 0;
      } catch {
        // Branch doesn't exist
      }

      if (pulled > 0) {
        // Pull changes
        await withIsolatedIndex(async () => {
          await git('read-tree', `${remote}/${syncBranch}`);
          const remoteCommit = await git('rev-parse', `${remote}/${syncBranch}`);
          await git('update-ref', `refs/heads/${syncBranch}`, remoteCommit);
        });
      }
    } catch {
      // Remote not available - that's ok for first sync
    }

    // Check local changes
    try {
      const issues = await listIssues(ISSUES_BASE_DIR);
      pushed = issues.length;

      if (pushed > 0) {
        // Push with retry
        const result = await this.doPushWithRetry(syncBranch, remote);
        if (result.conflicts) {
          conflicts.push(...result.conflicts);
        }
      }
    } catch {
      // No issues
    }

    const forceNote = force ? ' (force)' : '';
    this.output.data({ pulled, pushed, conflicts: conflicts.length }, () => {
      if (pulled === 0 && pushed === 0) {
        this.output.success('Already in sync');
      } else {
        let msg = `Synced: pulled ${pulled}, pushed ${pushed}${forceNote}`;
        if (conflicts.length > 0) {
          msg += ` (${conflicts.length} conflict(s) resolved)`;
        }
        this.output.success(msg);
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
