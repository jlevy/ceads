/**
 * `tbd init` - Initialize tbd in a repository.
 *
 * See: tbd-design-v3.md §4.3 Initialization
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface InitOptions {
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    if (this.checkDryRun('Would initialize tbd repository', options)) {
      return;
    }

    // TODO: Implement initialization
    // 1. Create .tbd/ directory with config.yml and .gitignore
    // 2. Create .tbd/cache/
    // 3. Create tbd-sync branch with .tbd-sync/ structure
    // 4. Push sync branch to origin (if remote exists)
    // 5. Return to original branch
    // 6. Output instructions to commit config

    this.output.success('Initialized tbd repository');
    this.output.info('To complete setup, commit the config files:');
    this.output.info('  git add .tbd/config.yml .tbd/.gitignore');
    this.output.info('  git commit -m "Initialize tbd"');
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
