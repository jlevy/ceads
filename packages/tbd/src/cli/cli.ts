/**
 * CLI program setup using Commander.js
 *
 * See: research-modern-typescript-cli-patterns.md
 */

import { Command } from 'commander';

import { VERSION } from './lib/version.js';
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
import { closeProtocolCommand } from './commands/closing.js';
import { designCommand } from './commands/design.js';
import { readmeCommand } from './commands/readme.js';
import { uninstallCommand } from './commands/uninstall.js';
import { primeCommand } from './commands/prime.js';
import { skillCommand } from './commands/skill.js';
import { shortcutCommand } from './commands/shortcut.js';
import { guidelinesCommand } from './commands/guidelines.js';
import { templateCommand } from './commands/template.js';
import { referenceCommand } from './commands/reference.js';
import { sourceCommand } from './commands/source.js';
import { setupCommand } from './commands/setup.js';
import { saveCommand } from './commands/save.js';
import { workspaceCommand } from './commands/workspace.js';
import { CLIError } from './lib/errors.js';

/**
 * Create and configure the CLI program.
 */
function createProgram(): Command {
  const program = new Command()
    .name('tbd')
    .description('Git-native issue tracking for AI agents and humans')
    .version(VERSION, '--version', 'Show version number')
    .helpOption('--help', 'Display help for command')
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

  // Add commands in logical groups
  // Note: commandsGroup() sets the heading for all following addCommand() calls

  program.commandsGroup('Documentation:');
  program.addCommand(readmeCommand);
  program.addCommand(primeCommand);
  program.addCommand(skillCommand);
  program.addCommand(shortcutCommand);
  program.addCommand(guidelinesCommand);
  program.addCommand(templateCommand);
  program.addCommand(referenceCommand);
  program.addCommand(closeProtocolCommand);
  program.addCommand(docsCommand);
  program.addCommand(designCommand);

  program.commandsGroup('Setup & Configuration:');
  program.addCommand(initCommand);
  program.addCommand(configCommand);
  program.addCommand(setupCommand);
  program.addCommand(sourceCommand);

  program.commandsGroup('Working With Issues:');

  program.addCommand(createCommand);
  program.addCommand(showCommand);
  program.addCommand(updateCommand);
  program.addCommand(closeCommand);
  program.addCommand(reopenCommand);
  program.addCommand(searchCommand);

  program.commandsGroup('Views and Filtering:');
  program.addCommand(readyCommand);
  program.addCommand(listCommand);
  program.addCommand(blockedCommand);
  program.addCommand(staleCommand);

  program.commandsGroup('Labels and Dependencies:');
  program.addCommand(depCommand);
  program.addCommand(labelCommand);

  program.commandsGroup('Sync and Status:');
  program.addCommand(syncCommand);
  program.addCommand(saveCommand);
  program.addCommand(statusCommand);
  program.addCommand(statsCommand);

  program.commandsGroup('Maintenance:');
  program.addCommand(doctorCommand);
  program.addCommand(atticCommand);
  program.addCommand(workspaceCommand);
  program.addCommand(importCommand);
  program.addCommand(uninstallCommand);

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
 * Check if --json flag is present in argv.
 */
function isJsonMode(): boolean {
  return process.argv.includes('--json');
}

/**
 * Check if --debug flag is present in argv.
 */
function isDebugMode(): boolean {
  return process.argv.includes('--debug');
}

/**
 * Output error in the appropriate format (JSON or text).
 * In debug mode, shows full error details, stack trace, and cause chain.
 */
function outputError(message: string, error?: Error): void {
  const debugMode = isDebugMode();

  if (isJsonMode()) {
    const errorObj: {
      error: string;
      type?: string;
      details?: string;
      stack?: string;
      cause?: string;
    } = {
      error: message,
    };
    if (error instanceof CLIError) {
      errorObj.type = error.name;
    }
    if (error && error.message !== message) {
      errorObj.details = error.message;
    }
    if (debugMode && error?.stack) {
      errorObj.stack = error.stack;
    }
    if (error?.cause instanceof Error) {
      errorObj.cause = error.cause.message;
    }
    console.error(JSON.stringify(errorObj));
  } else {
    console.error(`Error: ${message}`);
    if (debugMode && error?.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
      // Walk the cause chain to show underlying errors
      let cause = error.cause;
      while (cause instanceof Error) {
        console.error('');
        console.error(`Caused by: ${cause.message}`);
        if (cause.stack) {
          console.error(cause.stack);
        }
        cause = cause.cause;
      }
    }
  }
}

/**
 * Check if running with no command (just options or nothing).
 * Returns true if: `tbd`, `tbd --help`, `tbd --version`, `tbd --color never`
 * Returns false if there's a command: `tbd list`, `tbd show foo`
 */
function hasNoCommand(): boolean {
  // process.argv is: [node, script, ...args]
  const rawArgs = process.argv.slice(2);

  // Global options that take a value (space-separated form)
  const optionsWithValues = new Set(['--color']);

  const nonOptionArgs: string[] = [];
  let skipNext = false;

  for (const arg of rawArgs) {
    if (skipNext) {
      // This arg is a value for the previous option, skip it
      skipNext = false;
      continue;
    }

    if (arg.startsWith('-')) {
      // Check if this option takes a value (and doesn't use = syntax)
      const optionName = arg.includes('=') ? arg.split('=')[0] : arg;
      if (optionsWithValues.has(optionName!) && !arg.includes('=')) {
        skipNext = true;
      }
      continue;
    }

    // This is a non-option argument (potential command)
    nonOptionArgs.push(arg);
  }

  return nonOptionArgs.length === 0;
}

/**
 * Run the CLI. This is the main entry point.
 */
export async function runCli(): Promise<void> {
  const program = createProgram();

  // If no command specified (and not help/version), run prime by default
  // But only if no --help or --version flags
  const isHelpOrVersion =
    process.argv.includes('--help') ||
    process.argv.includes('-h') ||
    process.argv.includes('--version') ||
    process.argv.includes('-V');

  // Show help by default when no command given (changed from prime)
  // The help epilog guides agents to run `tbd prime` for full context
  if (hasNoCommand() && !isHelpOrVersion) {
    // Show help instead of defaulting to prime
    process.argv.splice(2, 0, '--help');
  }

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CLIError) {
      outputError(error.message, error);
      process.exit(error.exitCode);
    }
    // Unexpected error
    const message = error instanceof Error ? error.message : String(error);
    outputError(message, error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.error('\nInterrupted');
  process.exit(130); // 128 + SIGINT(2)
});
