/**
 * Base command class for CLI handlers.
 *
 * See: research-modern-typescript-cli-patterns.md#3-base-command-pattern
 */

import type { Command } from 'commander';

import type { CommandContext, OutputFormat } from './context.js';
import { getCommandContext } from './context.js';
import { OutputManager } from './output.js';
import { CLIError } from './errors.js';

/**
 * Base class for all CLI command handlers.
 * Provides common functionality for context, output, and error handling.
 */
export abstract class BaseCommand {
  protected ctx: CommandContext;
  protected output: OutputManager;

  constructor(command: Command) {
    this.ctx = getCommandContext(command);
    this.output = new OutputManager(this.ctx);
  }

  /**
   * Execute an async action with error handling.
   * Catches errors and formats them consistently.
   */
  protected async execute<T>(action: () => Promise<T>, errorMessage: string): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof CLIError) {
        this.output.error(error.message);
        throw error;
      }
      this.output.error(errorMessage, error instanceof Error ? error : undefined);
      throw new CLIError(errorMessage);
    }
  }

  /**
   * Check if dry-run mode is enabled and log the action.
   * Returns true if in dry-run mode (caller should skip the actual action).
   */
  protected checkDryRun(message: string, details?: object): boolean {
    if (this.ctx.dryRun) {
      this.output.dryRun(message, details);
      return true;
    }
    return false;
  }

  /**
   * Abstract method that subclasses must implement.
   * Signature varies by command (positional args + options object).
   */
  abstract run(...args: unknown[]): Promise<void>;
}

/**
 * Helper to get output format from context.
 */
export function getOutputFormat(ctx: CommandContext): OutputFormat {
  return ctx.json ? 'json' : 'text';
}
