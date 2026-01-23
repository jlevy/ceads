/**
 * CLI error types and helpers for structured error handling.
 *
 * See: research-modern-typescript-cli-patterns.md#3-base-command-pattern
 */

import { findTbdRoot } from '../../file/config.js';

/**
 * Find and return the tbd repository root, starting from the given directory.
 * Walks up the directory tree to find .tbd/.
 *
 * @param cwd - Working directory to start from (defaults to process.cwd())
 * @returns The tbd repository root path
 * @throws NotInitializedError if tbd is not initialized in any parent directory
 */
export async function requireInit(cwd: string = process.cwd()): Promise<string> {
  const tbdRoot = await findTbdRoot(cwd);
  if (!tbdRoot) {
    throw new NotInitializedError();
  }
  return tbdRoot;
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
  constructor(message = "Not a tbd repository (run 'tbd setup --auto --prefix=<name>' first)") {
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
