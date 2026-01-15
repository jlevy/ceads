/**
 * CLI program setup using Commander.js
 *
 * See: research-modern-typescript-cli-patterns.md
 */

import { Command } from 'commander';

import { VERSION } from '../index.js';
import { initCommand } from './commands/init.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { showCommand } from './commands/show.js';
import { updateCommand } from './commands/update.js';
import { closeCommand } from './commands/close.js';
import { reopenCommand } from './commands/reopen.js';
import { readyCommand } from './commands/ready.js';
import { blockedCommand } from './commands/blocked.js';
import { staleCommand } from './commands/stale.js';
import { labelCommand } from './commands/label.js';
import { dependsCommand } from './commands/depends.js';
import { syncCommand } from './commands/sync.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { statsCommand } from './commands/stats.js';
import { doctorCommand } from './commands/doctor.js';
import { configCommand } from './commands/config.js';
import { atticCommand } from './commands/attic.js';
import { importCommand } from './commands/import.js';
import { CLIError } from './lib/errors.js';

/**
 * Create and configure the CLI program.
 */
function createProgram(): Command {
  const program = new Command()
    .name('tbd')
    .description('Git-native issue tracking for AI agents and humans')
    .version(VERSION, '-V, --version', 'Show version number')
    .showHelpAfterError('(add --help for additional information)');

  // Global options
  program
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .option('--json', 'Output as JSON')
    .option('--color <when>', 'Colorize output: auto, always, never', 'auto')
    .option('--non-interactive', 'Disable all prompts, fail if input required')
    .option('--yes', 'Assume yes to confirmation prompts')
    .option('--no-sync', 'Skip automatic sync after write operations');

  // Add commands
  program.addCommand(initCommand);
  program.addCommand(createCommand);
  program.addCommand(listCommand);
  program.addCommand(showCommand);
  program.addCommand(updateCommand);
  program.addCommand(closeCommand);
  program.addCommand(reopenCommand);
  program.addCommand(readyCommand);
  program.addCommand(blockedCommand);
  program.addCommand(staleCommand);
  program.addCommand(labelCommand);
  program.addCommand(dependsCommand);
  program.addCommand(syncCommand);
  program.addCommand(searchCommand);
  program.addCommand(infoCommand);
  program.addCommand(statsCommand);
  program.addCommand(doctorCommand);
  program.addCommand(configCommand);
  program.addCommand(atticCommand);
  program.addCommand(importCommand);

  return program;
}

/**
 * Run the CLI. This is the main entry point.
 */
export async function runCli(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CLIError) {
      process.exit(error.exitCode);
    }
    // Unexpected error
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.error('\nInterrupted');
  process.exit(130); // 128 + SIGINT(2)
});
