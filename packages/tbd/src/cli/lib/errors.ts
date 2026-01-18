/**
 * CLI error types and helpers for structured error handling.
 *
 * See: research-modern-typescript-cli-patterns.md#3-base-command-pattern
 */

import { isInitialized } from '../../file/config.js';

/**
 * Check if tbd is initialized in the current directory.
 * Throws NotInitializedError if not.
 *
 * @param cwd - Working directory to check (defaults to process.cwd())
 * @throws NotInitializedError if tbd is not initialized
 */
export async function requireInit(cwd: string = process.cwd()): Promise<void> {
  if (!(await isInitialized(cwd))) {
    throw new NotInitializedError();
  }
}

/**
 * Base CLI error. Thrown for operational errors that should exit
 * with a specific code but don't need stack traces.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode = 1,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Validation error for usage/argument issues.
 * Exit code 2 follows Unix convention.
 */
export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, 2);
    this.name = 'ValidationError';
  }
}

/**
 * Not initialized error - tbd repository not found.
 * Uses the stable error message defined in design spec §5.6.
 */
export class NotInitializedError extends CLIError {
  constructor(
    message = "Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)",
  ) {
    super(message, 1);
    this.name = 'NotInitializedError';
  }
}

/**
 * Entity not found error (issue, config, etc.).
 */
export class NotFoundError extends CLIError {
  constructor(entityType: string, id: string) {
    super(`${entityType} not found: ${id}`, 1);
    this.name = 'NotFoundError';
  }
}

/**
 * Sync/conflict error.
 */
export class SyncError extends CLIError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'SyncError';
  }
}
