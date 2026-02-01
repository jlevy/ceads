/**
 * `tbd uninstall` - Remove tbd from a repository.
 *
 * Removes the .tbd directory, worktree, and optionally the sync branch.
 */

import { Command } from 'commander';
import { rm, access, readdir, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { NotInitializedError, CLIError } from '../lib/errors.js';
import { readConfig } from '../../file/config.js';
import { SYNC_BRANCH } from '../../lib/paths.js';

interface UninstallOptions {
  confirm?: boolean;
  keepBranch?: boolean;
  removeRemote?: boolean;
}

class UninstallHandler extends BaseCommand {
  async run(options: UninstallOptions): Promise<void> {
    const colors = this.output.getColors();

    // Check if tbd is initialized
    try {
      await access('.tbd');
    } catch {
      throw new NotInitializedError('No .tbd directory found. Nothing to uninstall.');
    }

    // Read config to get branch info
    let config;
    try {
      config = await readConfig('.');
    } catch {
      config = null;
    }

    const syncBranch = config?.sync.branch ?? SYNC_BRANCH;
    const remote = config?.sync.remote ?? 'origin';
    const worktreePath = join('.tbd', 'data-sync-worktree');

    // Check what exists
    const items: string[] = [];

    // Check worktree
    let worktreeExists = false;
    try {
      await access(worktreePath);
      worktreeExists = true;
      const worktreeStats = await this.getDirectoryStats(worktreePath);
      items.push(`  - Worktree: ${worktreePath} (${worktreeStats.files} files)`);
    } catch {
      // Worktree doesn't exist
    }

    // Check local sync branch
    let localBranchExists = false;
    try {
      execSync(`git rev-parse --verify ${syncBranch}`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      localBranchExists = true;
      if (!options.keepBranch) {
        items.push(`  - Local branch: ${syncBranch}`);
      }
    } catch {
      // Branch doesn't exist
    }

    // Check remote sync branch
    let remoteBranchExists = false;
    if (options.removeRemote) {
      try {
        execSync(`git rev-parse --verify ${remote}/${syncBranch}`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        remoteBranchExists = true;
        items.push(`  - Remote branch: ${remote}/${syncBranch}`);
      } catch {
        // Remote branch doesn't exist
      }
    }

    // Count .tbd contents
    const tbdStats = await this.getDirectoryStats('.tbd');
    items.push(`  - Directory: .tbd/ (${tbdStats.files} files)`);

    // Show what will be removed
    console.log(colors.bold('The following will be removed:'));
    console.log('');
    for (const item of items) {
      console.log(colors.warn(item));
    }
    console.log('');

    if (!options.confirm) {
      console.log(`This action is ${colors.bold('irreversible')}.`);
      console.log('');
      console.log(`To confirm, run: ${colors.dim('tbd uninstall --confirm')}`);
      if (!options.keepBranch && localBranchExists) {
        console.log(
          `To keep the sync branch: ${colors.dim('tbd uninstall --confirm --keep-branch')}`,
        );
      }
      if (!options.removeRemote) {
        console.log(
          `To also remove from remote: ${colors.dim('tbd uninstall --confirm --remove-remote')}`,
        );
      }
      return;
    }

    // Check dry-run
    if (this.checkDryRun('Would remove tbd from repository', { items })) {
      return;
    }

    // Perform uninstall
    this.output.info('Uninstalling tbd...');

    // 1. Remove worktree first (git worktree remove)
    if (worktreeExists) {
      try {
        // First try to remove the worktree through git
        execSync(`git worktree remove --force "${worktreePath}"`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        console.log(`  ${colors.success('✓')} Removed git worktree`);
      } catch {
        // If git worktree remove fails, force delete the directory
        try {
          await rm(worktreePath, { recursive: true, force: true });
          console.log(`  ${colors.success('✓')} Removed worktree directory`);
        } catch {
          console.log(`  ${colors.warn('⚠')} Could not remove worktree directory`);
        }
      }
    }

    // 2. Remove local sync branch
    if (localBranchExists && !options.keepBranch) {
      try {
        execSync(`git branch -D ${syncBranch}`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        console.log(`  ${colors.success('✓')} Removed local branch: ${syncBranch}`);
      } catch {
        console.log(`  ${colors.warn('⚠')} Could not remove local branch: ${syncBranch}`);
      }
    }

    // 3. Remove remote sync branch
    if (remoteBranchExists && options.removeRemote) {
      try {
        execSync(`git push ${remote} --delete ${syncBranch}`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        console.log(`  ${colors.success('✓')} Removed remote branch: ${remote}/${syncBranch}`);
      } catch {
        console.log(
          `  ${colors.warn('⚠')} Could not remove remote branch: ${remote}/${syncBranch}`,
        );
      }
    }

    // 4. Clean up orphaned worktree references
    try {
      execSync('git worktree prune', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      // Ignore errors
    }

    // 5. Remove .tbd directory
    try {
      await rm('.tbd', { recursive: true, force: true });
      console.log(`  ${colors.success('✓')} Removed .tbd directory`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CLIError(`Failed to remove .tbd directory: ${message}`);
    }

    console.log('');
    this.output.success('tbd has been uninstalled from this repository.');

    if (options.keepBranch && localBranchExists) {
      console.log('');
      console.log(colors.dim(`Note: The ${syncBranch} branch was preserved. Delete it with:`));
      console.log(colors.dim(`  git branch -D ${syncBranch}`));
    }

    if (!options.removeRemote && remoteBranchExists) {
      console.log('');
      console.log(
        colors.dim(
          `Note: The remote ${remote}/${syncBranch} branch was preserved. Delete it with:`,
        ),
      );
      console.log(colors.dim(`  git push ${remote} --delete ${syncBranch}`));
    }
  }

  /**
   * Get stats about a directory (file count, size).
   */
  private async getDirectoryStats(dirPath: string): Promise<{ files: number; size: number }> {
    let files = 0;
    let size = 0;

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            files++;
            try {
              const stats = await stat(fullPath);
              size += stats.size;
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await walk(dirPath);
    return { files, size };
  }
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove tbd from this repository')
  .option('--confirm', 'Confirm removal (required to proceed)')
  .option('--keep-branch', 'Keep the local sync branch')
  .option('--remove-remote', 'Also remove the remote sync branch')
  .action(async (options, command) => {
    const handler = new UninstallHandler(command);
    await handler.run(options);
  });
