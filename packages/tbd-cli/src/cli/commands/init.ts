/**
 * `tbd init` - Initialize tbd in a repository.
 *
 * See: tbd-design-v3.md §4.3 Initialization
 */

import { Command } from 'commander';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { VERSION } from '../../index.js';
import { initConfig } from '../../file/config.js';
import { TBD_DIR, CACHE_DIR, WORKTREE_DIR_NAME, DATA_SYNC_DIR_NAME } from '../../lib/paths.js';
import { initWorktree } from '../../file/git.js';

interface InitOptions {
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    const cwd = process.cwd();

    // Check if already initialized
    try {
      await stat(join(cwd, TBD_DIR));
      this.output.error('tbd is already initialized in this directory');
      return;
    } catch {
      // Not initialized - continue
    }

    if (this.checkDryRun('Would initialize tbd repository', options)) {
      return;
    }

    await this.execute(async () => {
      // 1. Create .tbd/ directory with config.yml
      await initConfig(cwd, VERSION);
      this.output.debug(`Created ${TBD_DIR}/config.yml`);

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
      this.output.info('');
      this.output.info('To complete setup, commit the config files:');
      this.output.info(`  git add ${TBD_DIR}/`);
      this.output.info('  git commit -m "Initialize tbd"');
    });
  }
}

export const initCommand = new Command('init')
  .description('Initialize tbd in a git repository')
  .option('--sync-branch <name>', 'Sync branch name (default: tbd-sync)')
  .option('--remote <name>', 'Remote name (default: origin)')
  .action(async (options, command) => {
    const handler = new InitHandler(command);
    await handler.run(options);
  });
