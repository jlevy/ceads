/**
 * Tests for CLI error types.
 *
 * These error classes provide structured error handling with
 * specific exit codes following Unix conventions.
 */

import { describe, it, expect } from 'vitest';
import {
  CLIError,
  ValidationError,
  NotInitializedError,
  NotFoundError,
  SyncError,
} from '../src/cli/lib/errors.js';

describe('CLIError', () => {
  it('creates error with message and default exit code', () => {
    const error = new CLIError('Something went wrong');

    expect(error.message).toBe('Something went wrong');
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('CLIError');
  });

  it('accepts custom exit code', () => {
    const error = new CLIError('Custom error', 42);

    expect(error.exitCode).toBe(42);
  });

  it('is instance of Error', () => {
    const error = new CLIError('Test');

    expect(error).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('creates error with exit code 2', () => {
    const error = new ValidationError('Invalid argument');

    expect(error.message).toBe('Invalid argument');
    expect(error.exitCode).toBe(2);
    expect(error.name).toBe('ValidationError');
  });

  it('is instance of CLIError', () => {
    const error = new ValidationError('Test');

    expect(error).toBeInstanceOf(CLIError);
  });
});

describe('NotInitializedError', () => {
  it('creates error with default message', () => {
    const error = new NotInitializedError();

    expect(error.message).toBe(
      "Not a tbd repository (run 'tbd init' or 'tbd import --from-beads' first)",
    );
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('NotInitializedError');
  });

  it('accepts custom message', () => {
    const error = new NotInitializedError('Custom init message');

    expect(error.message).toBe('Custom init message');
  });

  it('is instance of CLIError', () => {
    const error = new NotInitializedError();

    expect(error).toBeInstanceOf(CLIError);
  });
});

describe('NotFoundError', () => {
  it('creates error with entity type and id', () => {
    const error = new NotFoundError('Issue', 'is-abc123');

    expect(error.message).toBe('Issue not found: is-abc123');
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('NotFoundError');
  });

  it('works with different entity types', () => {
    const issueError = new NotFoundError('Issue', 'is-123');
    const configError = new NotFoundError('Config', 'some.key');

    expect(issueError.message).toBe('Issue not found: is-123');
    expect(configError.message).toBe('Config not found: some.key');
  });

  it('is instance of CLIError', () => {
    const error = new NotFoundError('Test', 'id');

    expect(error).toBeInstanceOf(CLIError);
  });
});

describe('SyncError', () => {
  it('creates error with message', () => {
    const error = new SyncError('Remote rejected push');

    expect(error.message).toBe('Remote rejected push');
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe('SyncError');
  });

  it('is instance of CLIError', () => {
    const error = new SyncError('Test');

    expect(error).toBeInstanceOf(CLIError);
  });
});
