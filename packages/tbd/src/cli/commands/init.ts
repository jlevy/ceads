/**
 * `tbd init` - Initialize tbd in a repository.
 *
 * See: tbd-design-spec.md §4.3 Initialization
 */

import { Command } from 'commander';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { CLIError, ValidationError } from '../lib/errors.js';
import { VERSION } from '../lib/version.js';
import { initConfig } from '../../file/config.js';
import { TBD_DIR, CACHE_DIR, WORKTREE_DIR_NAME, DATA_SYNC_DIR_NAME } from '../../lib/paths.js';
import { initWorktree, checkGitVersion, MIN_GIT_VERSION } from '../../file/git.js';

interface InitOptions {
  prefix?: string;
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    const cwd = process.cwd();

    // Check if already initialized
    try {
      await stat(join(cwd, TBD_DIR));
      throw new CLIError('tbd is already initialized in this directory');
    } catch (error) {
      // Not initialized - continue (unless it's our CLIError)
      if (error instanceof CLIError) throw error;
    }

    // Validate prefix is provided
    if (!options.prefix) {
      throw new ValidationError(
        'The --prefix option is required\n\n' +
          'Usage: tbd init --prefix=<name>\n\n' +
          'The prefix is used for display IDs (e.g., proj-a7k2, myapp-b3m9)\n' +
          'Choose a short, memorable prefix for your project.\n\n' +
          "If importing from beads, use 'tbd import --from-beads' instead\n" +
          '(the beads prefix will be automatically detected).',
      );
    }

    if (this.checkDryRun('Would initialize tbd repository', options)) {
      return;
    }

    await this.execute(async () => {
      // 1. Create .tbd/ directory with config.yml
      // Note: options.prefix is validated to be non-null above
      await initConfig(cwd, VERSION, options.prefix!);
      this.output.debug(`Created ${TBD_DIR}/config.yml with prefix '${options.prefix}'`);

      // 2. Create .tbd/.gitignore
      // Per spec §2.3: Must ignore cache/, data-sync-worktree/, and data-sync/
      const gitignoreContent = [
        '# Local cache (not shared)',
        'cache/',
        '',
        '# Hidden worktree for tbd-sync branch',
        `${WORKTREE_DIR_NAME}/`,
        '',
        '# Data sync directory (only exists in worktree)',
        `${DATA_SYNC_DIR_NAME}/`,
        '',
        '# Temporary files',
        '*.tmp',
        '',
      ].join('\n');
      await writeFile(join(cwd, TBD_DIR, '.gitignore'), gitignoreContent);
      this.output.debug(`Created ${TBD_DIR}/.gitignore`);

      // 3. Create .tbd/cache/ directory
      await mkdir(join(cwd, CACHE_DIR), { recursive: true });
      this.output.debug(`Created ${CACHE_DIR}/`);

      // 4. Initialize the hidden worktree for tbd-sync branch
      // This creates .tbd/data-sync-worktree/ with the sync branch checkout
      const remote = options.remote ?? 'origin';
      const syncBranch = options.syncBranch ?? 'tbd-sync';

      // Check Git version before attempting worktree creation
      // Git 2.42+ is required for --orphan worktree support
      try {
        const { version, supported } = await checkGitVersion();
        if (!supported) {
          const versionStr = `${version.major}.${version.minor}.${version.patch}`;
          throw new CLIError(
            `Git ${versionStr} detected. Git ${MIN_GIT_VERSION}+ is required for tbd.\n\n` +
              `tbd requires Git 2.42+ for orphan worktree support.\n` +
              `Please upgrade Git: https://git-scm.com/downloads`,
          );
        }
        this.output.debug(`Git version ${version.major}.${version.minor}.${version.patch} OK`);
      } catch (error) {
        // If git is not installed at all, let worktree init handle it
        if (error instanceof CLIError) throw error;
        this.output.debug(`Git version check skipped: ${(error as Error).message}`);
      }

      const worktreeResult = await initWorktree(cwd, remote, syncBranch);

      if (worktreeResult.success) {
        if (worktreeResult.created) {
          this.output.debug(`Created hidden worktree at ${TBD_DIR}/${WORKTREE_DIR_NAME}/`);
        } else {
          this.output.debug(`Worktree already exists at ${TBD_DIR}/${WORKTREE_DIR_NAME}/`);
        }
      } else {
        // Worktree creation failed - this is ok if not in a git repo
        // Log warning but don't fail init (supports non-git usage)
        this.output.debug(`Note: Worktree not created (${worktreeResult.error})`);
      }
    }, 'Failed to initialize tbd');

    this.output.data({ initialized: true, version: VERSION }, () => {
      this.output.success('Initialized tbd repository');
    });

    // Auto-configure detected coding agents (skip in quiet mode)
    if (!this.ctx.quiet) {
      console.log('');
      spawnSync('tbd', ['setup', 'auto'], { stdio: 'inherit' });

      // Show status with next steps
      console.log('');
      spawnSync('tbd', ['status'], { stdio: 'inherit' });
    }
  }
}

export const initCommand = new Command('init')
  .description('Initialize tbd in a git repository')
  .option('--prefix <name>', 'Project prefix for display IDs (e.g., "proj", "myapp")')
  .option('--sync-branch <name>', 'Sync branch name (default: tbd-sync)')
  .option('--remote <name>', 'Remote name (default: origin)')
  .action(async (options, command) => {
    const handler = new InitHandler(command);
    await handler.run(options);
  });
