/**
 * CLI program setup using Commander.js
 *
 * See: research-modern-typescript-cli-patterns.md
 */

import { Command } from 'commander';

import { VERSION } from '../index.js';
import {
  configureColoredHelp,
  createColoredHelpConfig,
  createHelpEpilog,
  getColorOptionFromArgv,
} from './lib/output.js';
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
import { depCommand } from './commands/dep.js';
import { syncCommand } from './commands/sync.js';
import { searchCommand } from './commands/search.js';
import { statusCommand } from './commands/status.js';
import { statsCommand } from './commands/stats.js';
import { doctorCommand } from './commands/doctor.js';
import { configCommand } from './commands/config.js';
import { atticCommand } from './commands/attic.js';
import { importCommand } from './commands/import.js';
import { docsCommand } from './commands/docs.js';
import { readmeCommand } from './commands/readme.js';
import { uninstallCommand } from './commands/uninstall.js';
import { primeCommand } from './commands/prime.js';
import { setupCommand } from './commands/setup.js';
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

  // Configure colored help output (respects --color option)
  configureColoredHelp(program);

  // Global options
  program
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .option('--json', 'Output as JSON')
    .option('--color <when>', 'Colorize output: auto, always, never', 'auto')
    .option('--non-interactive', 'Disable all prompts, fail if input required')
    .option('--yes', 'Assume yes to confirmation prompts')
    .option('--no-sync', 'Skip automatic sync after write operations')
    .option('--debug', 'Show internal IDs alongside public IDs for debugging');

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
  program.addCommand(depCommand);
  program.addCommand(syncCommand);
  program.addCommand(searchCommand);
  program.addCommand(statusCommand);
  program.addCommand(statsCommand);
  program.addCommand(doctorCommand);
  program.addCommand(configCommand);
  program.addCommand(atticCommand);
  program.addCommand(importCommand);
  program.addCommand(docsCommand);
  program.addCommand(readmeCommand);
  program.addCommand(uninstallCommand);
  program.addCommand(primeCommand);
  program.addCommand(setupCommand);

  // Apply colored help to all commands recursively
  // Note: addCommand() does NOT inherit parent's configureHelp settings,
  // unlike command() which does inherit. So we must apply manually.
  applyColoredHelpToAllCommands(program);

  return program;
}

/**
 * Apply colored help configuration and epilog to all commands recursively.
 * This is needed because Commander.js's addCommand() does not inherit
 * configureHelp settings from the parent command.
 */
function applyColoredHelpToAllCommands(program: Command): void {
  const colorOption = getColorOptionFromArgv();
  const helpConfig = createColoredHelpConfig(colorOption);
  const epilog = createHelpEpilog(colorOption);

  // Add epilog to main program only - it shows for all help including subcommands
  program.addHelpText('afterAll', `\n${epilog}`);

  const applyRecursively = (cmd: Command) => {
    cmd.configureHelp(helpConfig);
    for (const sub of cmd.commands) {
      applyRecursively(sub);
    }
  };

  for (const cmd of program.commands) {
    applyRecursively(cmd);
  }
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
      console.error(`Error: ${error.message}`);
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
