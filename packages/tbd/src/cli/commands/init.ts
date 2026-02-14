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
import { isValidPrefix, isRecommendedPrefix } from '../lib/prefix-detection.js';
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
import {
  initWorktree,
  checkGitVersion,
  checkWorktreeHealth,
  findGitRoot,
  isInGitRepo,
  MIN_GIT_VERSION,
} from '../../file/git.js';

interface InitOptions {
  prefix?: string;
  force?: boolean;
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    // Require git repository and resolve to git root
    const inGitRepo = await isInGitRepo();
    if (!inGitRepo) {
      throw new CLIError('Not a git repository. Run `git init` first.');
    }

    const gitRoot = await findGitRoot();
    if (!gitRoot) {
      throw new CLIError('Could not determine git repository root.');
    }

    // Use git root as the working directory (ensures .tbd/ is always at repo root)
    const cwd = gitRoot;

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
          'Choose a short 2-8 letter prefix for your project (e.g., tbd, myp, proj).\n\n' +
          'For full setup with integrations: tbd setup --auto --prefix=<name>',
      );
    }

    const prefix = options.prefix;

    // Hard validation: always enforced
    if (!isValidPrefix(prefix)) {
      throw new ValidationError(
        'Invalid prefix format.\n' +
          'Prefix must be 1-20 lowercase characters:\n' +
          '  - Must start with a letter (a-z)\n' +
          '  - Must end with alphanumeric (a-z, 0-9)\n' +
          '  - Middle characters can include dots (.) and underscores (_)\n' +
          '  - No dashes allowed (breaks ID syntax)\n\n' +
          'Example:\n' +
          '  tbd init --prefix=tbd',
      );
    }

    // Soft validation: recommended format (2-8 alphabetic)
    if (!isRecommendedPrefix(prefix) && !options.force) {
      throw new ValidationError(
        `Prefix "${prefix}" is not recommended.\n` +
          'Recommended prefixes are 2-8 alphabetic characters (e.g., "tbd", "myp", "proj").\n\n' +
          'If you really want to use this prefix, add --force to override.\n\n' +
          'Example:\n' +
          `  tbd init --prefix=${prefix} --force`,
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
        '# Cached external repo checkouts',
        'repo-cache/',
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
        '# Migration backups (local only, not synced)',
        'backups/',
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

        // Verify worktree health after creation (prevents silent failures)
        const health = await checkWorktreeHealth(cwd);
        if (!health.valid) {
          this.output.warn(
            `Worktree created but failed verification (status: ${health.status}). ` +
              `Run 'tbd doctor' to diagnose.`,
          );
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
  .option('--prefix <name>', 'Project prefix for display IDs (2-8 alphabetic recommended)')
  .option('--force', 'Allow non-recommended prefix format')
  .option('--sync-branch <name>', 'Sync branch name (default: tbd-sync)')
  .option('--remote <name>', 'Remote name (default: origin)')
  .action(async (options, command) => {
    const handler = new InitHandler(command);
    await handler.run(options);
  });
