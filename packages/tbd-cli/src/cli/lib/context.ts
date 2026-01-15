/**
 * Command context and global options management.
 *
 * See: research-modern-typescript-cli-patterns.md#9-global-options
 */

import type { Command } from 'commander';

/**
 * Output format options.
 */
export type OutputFormat = 'text' | 'json';

/**
 * Color output options.
 */
export type ColorOption = 'auto' | 'always' | 'never';

/**
 * Global command context extracted from Commander options.
 */
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: ColorOption;
  nonInteractive: boolean;
  yes: boolean;
  sync: boolean;
}

/**
 * Extract command context from a Commander command.
 * Handles inheritance of global options through the command hierarchy.
 */
export function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals();
  const isCI = Boolean(process.env.CI);

  return {
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    json: opts.json ?? false,
    color: (opts.color as ColorOption) ?? 'auto',
    nonInteractive: opts.nonInteractive ?? (!process.stdin.isTTY || isCI),
    yes: opts.yes ?? false,
    sync: opts.sync !== false, // --no-sync sets this to false
  };
}

/**
 * Determine if output should be colorized based on options and environment.
 */
export function shouldColorize(colorOption: ColorOption): boolean {
  // NO_COLOR takes precedence (unless --color=always explicitly set)
  if (process.env.NO_COLOR && colorOption !== 'always') {
    return false;
  }
  if (colorOption === 'always') {
    return true;
  }
  if (colorOption === 'never') {
    return false;
  }
  return process.stdout.isTTY ?? false;
}

/**
 * Check if running in interactive mode.
 */
export function isInteractive(ctx: CommandContext): boolean {
  return !ctx.nonInteractive && process.stdin.isTTY === true && !process.env.CI;
}
