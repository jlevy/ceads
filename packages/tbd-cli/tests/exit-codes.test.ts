/**
 * Tests for CLI exit codes.
 *
 * Verifies that errors from commands properly propagate non-zero exit codes.
 * This is a regression test for tbd-wyy6: "Exit codes return 0 on errors".
 *
 * The fix ensures that commands throw CLIError subclasses instead of calling
 * `this.output.error()` and returning, which would exit with code 0.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import {
  CLIError,
  NotFoundError,
  ValidationError,
  NotInitializedError,
  SyncError,
} from '../src/cli/lib/errors.js';
import { runCli } from '../src/cli/cli.js';

// Capture process.exit calls for testing
let exitCode: number | null = null;
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalExit = process.exit;
const originalArgv = process.argv;

/**
 * Helper to run CLI with specific arguments.
 */
async function runCliWithArgs(args: string[]): Promise<void> {
  process.argv = args;
  return runCli();
}

describe('exit codes', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-exit-test-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    exitCode = null;
    // Mock process.exit to capture exit code instead of actually exiting
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(async () => {
    process.exit = originalExit;
    process.argv = originalArgv;
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  describe('error class exit codes', () => {
    it('CLIError has exit code 1 by default', () => {
      const error = new CLIError('test');
      expect(error.exitCode).toBe(1);
    });

    it('CLIError accepts custom exit code', () => {
      const error = new CLIError('test', 42);
      expect(error.exitCode).toBe(42);
    });

    it('NotFoundError has exit code 1', () => {
      const error = new NotFoundError('Issue', 'test-id');
      expect(error.exitCode).toBe(1);
      expect(error.message).toBe('Issue not found: test-id');
    });

    it('ValidationError has exit code 2', () => {
      const error = new ValidationError('Invalid input');
      expect(error.exitCode).toBe(2);
    });

    it('NotInitializedError has exit code 1', () => {
      const error = new NotInitializedError();
      expect(error.exitCode).toBe(1);
    });

    it('SyncError has exit code 1', () => {
      const error = new SyncError('Sync failed');
      expect(error.exitCode).toBe(1);
    });

    it('all error types are instances of CLIError', () => {
      expect(new NotFoundError('X', 'y')).toBeInstanceOf(CLIError);
      expect(new ValidationError('x')).toBeInstanceOf(CLIError);
      expect(new NotInitializedError()).toBeInstanceOf(CLIError);
      expect(new SyncError('x')).toBeInstanceOf(CLIError);
    });
  });

  describe('integration: NotInitializedError', () => {
    it('returns exit code 1 when not initialized', async () => {
      // No .tbd directory - should trigger NotInitializedError
      try {
        await runCliWithArgs(['node', 'tbd', 'list']);
      } catch (e) {
        // Expected: our mocked process.exit throws to stop execution
        // The actual exit code is captured in the exitCode variable
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('process.exit')) {
          console.error('Unexpected error in exit code test:', msg);
          throw e; // Re-throw unexpected errors
        }
      }

      expect(exitCode).toBe(1);
    });

    it('returns exit code 1 for show in uninitialized repo', async () => {
      try {
        await runCliWithArgs(['node', 'tbd', 'show', 'test-123']);
      } catch (e) {
        // Expected: our mocked process.exit throws to stop execution
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('process.exit')) {
          console.error('Unexpected error in exit code test:', msg);
          throw e; // Re-throw unexpected errors
        }
      }

      expect(exitCode).toBe(1);
    });
  });

  describe('integration: NotFoundError', () => {
    it('returns exit code 1 for issue not found', async () => {
      // Initialize a minimal tbd repo
      await mkdir(join(testDir, '.tbd'), { recursive: true });
      await writeFile(
        join(testDir, '.tbd', 'config.yml'),
        'tbd_version: "1"\nsync:\n  branch: tbd-sync\n  remote: origin\ndisplay:\n  id_prefix: tbd\nsettings:\n  auto_sync: false\n  index_enabled: false\n',
      );
      await mkdir(join(testDir, '.tbd', 'data-sync-worktree', '.tbd', 'data-sync', 'issues'), {
        recursive: true,
      });
      // Create empty id-mapping.yml
      await writeFile(
        join(testDir, '.tbd', 'data-sync-worktree', '.tbd', 'data-sync', 'id-mapping.yml'),
        'short_to_ulid: {}\nulid_to_short: {}\n',
      );

      try {
        await runCliWithArgs(['node', 'tbd', 'show', 'nonexistent-id']);
      } catch (e) {
        // Expected: our mocked process.exit throws to stop execution
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('process.exit')) {
          console.error('Unexpected error in exit code test:', msg);
          throw e; // Re-throw unexpected errors
        }
      }

      expect(exitCode).toBe(1);
    });
  });
});
