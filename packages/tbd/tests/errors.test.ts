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
  classifySyncError,
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
      "Not a tbd repository (run 'tbd setup --auto --prefix=<name>' first)",
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

describe('classifySyncError', () => {
  describe('permanent errors', () => {
    it('classifies HTTP 403 as permanent', () => {
      expect(classifySyncError('HTTP 403 Forbidden')).toBe('permanent');
      expect(classifySyncError('error: HTTP 403')).toBe('permanent');
    });

    it('classifies HTTP 401 as permanent', () => {
      expect(classifySyncError('HTTP 401 Unauthorized')).toBe('permanent');
    });

    it('classifies forbidden messages as permanent', () => {
      expect(classifySyncError('push to tbd-sync forbidden')).toBe('permanent');
      expect(classifySyncError('Access forbidden')).toBe('permanent');
    });

    it('classifies permission denied as permanent', () => {
      expect(classifySyncError('Permission denied (publickey)')).toBe('permanent');
      expect(classifySyncError('permission denied')).toBe('permanent');
    });

    it('classifies protected branch errors as permanent', () => {
      expect(classifySyncError('remote: Protected branch update denied')).toBe('permanent');
    });

    it('classifies remote rejected as permanent', () => {
      expect(classifySyncError('remote rejected')).toBe('permanent');
      expect(classifySyncError('! [remote rejected] tbd-sync -> tbd-sync')).toBe('permanent');
    });

    it('classifies pre-receive hook declined as permanent', () => {
      expect(classifySyncError('pre-receive hook declined')).toBe('permanent');
    });

    it('classifies push declined as permanent', () => {
      expect(classifySyncError('push declined due to branch protection')).toBe('permanent');
    });

    it('classifies not allowed to push as permanent', () => {
      expect(classifySyncError('You are not allowed to push')).toBe('permanent');
    });
  });

  describe('transient errors', () => {
    it('classifies timeout as transient', () => {
      expect(classifySyncError('Connection timed out')).toBe('transient');
      expect(classifySyncError('timeout')).toBe('transient');
    });

    it('classifies connection refused as transient', () => {
      expect(classifySyncError('Connection refused')).toBe('transient');
    });

    it('classifies connection reset as transient', () => {
      expect(classifySyncError('Connection reset by peer')).toBe('transient');
    });

    it('classifies network errors as transient', () => {
      expect(classifySyncError('Network is unreachable')).toBe('transient');
    });

    it('classifies DNS errors as transient', () => {
      expect(classifySyncError('Could not resolve hostname')).toBe('transient');
      expect(classifySyncError('DNS lookup failed')).toBe('transient');
    });

    it('classifies HTTP 5xx as transient', () => {
      expect(classifySyncError('HTTP 500 Internal Server Error')).toBe('transient');
      expect(classifySyncError('HTTP 502 Bad Gateway')).toBe('transient');
      expect(classifySyncError('HTTP 503 Service Unavailable')).toBe('transient');
    });

    it('classifies server error as transient', () => {
      expect(classifySyncError('server error')).toBe('transient');
    });

    it('classifies temporarily unavailable as transient', () => {
      expect(classifySyncError('Service temporarily unavailable')).toBe('transient');
    });

    it('classifies try again messages as transient', () => {
      expect(classifySyncError('Please try again later')).toBe('transient');
    });

    it('classifies no route to host as transient', () => {
      expect(classifySyncError('No route to host')).toBe('transient');
    });

    it('classifies connection closed as transient', () => {
      expect(classifySyncError('Connection closed by remote host')).toBe('transient');
    });
  });

  describe('unknown errors', () => {
    it('classifies ambiguous errors as unknown', () => {
      expect(classifySyncError('Something went wrong')).toBe('unknown');
      expect(classifySyncError('Git push failed')).toBe('unknown');
    });

    it('classifies empty message as unknown', () => {
      expect(classifySyncError('')).toBe('unknown');
    });
  });

  describe('input handling', () => {
    it('accepts Error objects', () => {
      const error = new Error('HTTP 403 Forbidden');
      expect(classifySyncError(error)).toBe('permanent');
    });

    it('accepts string messages', () => {
      expect(classifySyncError('timeout')).toBe('transient');
    });

    it('is case-insensitive', () => {
      expect(classifySyncError('HTTP 403 FORBIDDEN')).toBe('permanent');
      expect(classifySyncError('TIMEOUT')).toBe('transient');
      expect(classifySyncError('Permission Denied')).toBe('permanent');
    });
  });
});
