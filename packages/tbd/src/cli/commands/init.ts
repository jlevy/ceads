/**
 * `tbd init` - Initialize tbd in a repository.
 *
 * See: tbd-design.md §4.3 Initialization
 */

import { Command } from 'commander';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { ensureGitignorePatterns } from '../../utils/gitignore-utils.js';
import { CLIError, ValidationError } from '../lib/errors.js';
import { VERSION } from '../lib/version.js';
import { initConfig } from '../../file/config.js';
import {
  TBD_DIR,
  WORKTREE_DIR_NAME,
  DATA_SYNC_DIR_NAME,
  SYNC_BRANCH,
  TBD_SHORTCUTS_SYSTEM,
  TBD_SHORTCUTS_STANDARD,
  TBD_GUIDELINES_DIR,
  TBD_TEMPLATES_DIR,
  TBD_DOCS_DIR,
} from '../../lib/paths.js';
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
          'Choose a short 2-4 letter prefix for your project (e.g., tbd, myp).\n\n' +
          'For full setup with integrations: tbd setup --auto --prefix=<name>',
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

      // 2. Create .tbd/.gitignore (idempotent)
      // Per spec: Must ignore docs/, data-sync-worktree/, and data-sync/
      await ensureGitignorePatterns(join(cwd, TBD_DIR, '.gitignore'), [
        '# Installed documentation (regenerated on setup)',
        'docs/',
        '',
        '# Hidden worktree for tbd-sync branch',
        `${WORKTREE_DIR_NAME}/`,
        '',
        '# Data sync directory (only exists in worktree)',
        `${DATA_SYNC_DIR_NAME}/`,
        '',
        '# Local state',
        'state.yml',
        '',
        '# Temporary files',
        '*.tmp',
        '*.temp',
      ]);
      this.output.debug(`Created ${TBD_DIR}/.gitignore`);

      // 3. Create docs directories for shortcuts, guidelines, and templates
      await mkdir(join(cwd, TBD_SHORTCUTS_SYSTEM), { recursive: true });
      await mkdir(join(cwd, TBD_SHORTCUTS_STANDARD), { recursive: true });
      await mkdir(join(cwd, TBD_GUIDELINES_DIR), { recursive: true });
      await mkdir(join(cwd, TBD_TEMPLATES_DIR), { recursive: true });
      this.output.debug(`Created ${TBD_DOCS_DIR}/ directories`);

      // 4. Initialize the hidden worktree for tbd-sync branch
      // This creates .tbd/data-sync-worktree/ with the sync branch checkout
      const remote = options.remote ?? 'origin';
      const syncBranch = options.syncBranch ?? SYNC_BRANCH;

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

    this.output.data({ initialized: true, version: VERSION, prefix: options.prefix }, () => {
      this.output.success(`Initialized tbd repository (prefix: ${options.prefix})`);
      // Only show next steps if not in quiet mode
      if (!this.output.isQuiet()) {
        console.log('');
        console.log('Next steps:');
        console.log('  git add .tbd/ && git commit -m "Initialize tbd"');
        console.log('  tbd setup --auto   # Optional: configure agent integrations');
      }
    });
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
