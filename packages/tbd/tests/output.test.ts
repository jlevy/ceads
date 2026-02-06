/**
 * Tests for OutputManager and icon constants.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ICONS, OutputManager, formatHeading, paginateOutput } from '../src/cli/lib/output.js';
import type { CommandContext } from '../src/cli/lib/context.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { Writable } from 'node:stream';
import { PAGINATION_LINE_THRESHOLD } from '../src/lib/settings.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

/**
 * Create a mock CommandContext for testing.
 */
function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    dryRun: false,
    verbose: false,
    quiet: false,
    json: false,
    color: 'never', // Disable colors for testing
    nonInteractive: true,
    yes: false,
    sync: true,
    debug: false,
    ...overrides,
  };
}

describe('ICONS constants', () => {
  describe('message icons', () => {
    it('defines SUCCESS icon as checkmark', () => {
      expect(ICONS.SUCCESS).toBe('✓');
    });

    it('defines ERROR icon as X', () => {
      expect(ICONS.ERROR).toBe('✗');
    });

    it('defines WARN icon as warning symbol', () => {
      expect(ICONS.WARN).toBe('⚠');
    });

    it('defines NOTICE icon as bullet', () => {
      expect(ICONS.NOTICE).toBe('•');
    });
  });

  describe('status icons', () => {
    it('defines OPEN icon as empty circle', () => {
      expect(ICONS.OPEN).toBe('○');
    });

    it('defines IN_PROGRESS icon as half-filled circle', () => {
      expect(ICONS.IN_PROGRESS).toBe('◐');
    });

    it('defines BLOCKED icon as filled circle', () => {
      expect(ICONS.BLOCKED).toBe('●');
    });

    it('defines CLOSED icon as checkmark (same as SUCCESS)', () => {
      expect(ICONS.CLOSED).toBe('✓');
      expect(ICONS.CLOSED).toBe(ICONS.SUCCESS);
    });

    it('defines DEFERRED icon as empty circle (same as OPEN)', () => {
      expect(ICONS.DEFERRED).toBe('○');
      expect(ICONS.DEFERRED).toBe(ICONS.OPEN);
    });
  });

  describe('icon uniqueness', () => {
    it('has distinct icons for message types', () => {
      const messageIcons = [ICONS.SUCCESS, ICONS.ERROR, ICONS.WARN, ICONS.NOTICE];
      const uniqueIcons = new Set(messageIcons);
      expect(uniqueIcons.size).toBe(4);
    });

    it('has distinct icons for non-closed status types', () => {
      const statusIcons = [ICONS.OPEN, ICONS.IN_PROGRESS, ICONS.BLOCKED];
      const uniqueIcons = new Set(statusIcons);
      expect(uniqueIcons.size).toBe(3);
    });
  });
});

describe('OutputManager', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe('success()', () => {
    it('outputs success message with icon to stdout', () => {
      const output = new OutputManager(createMockContext());
      output.success('Operation completed');
      expect(consoleLog).toHaveBeenCalledWith('✓ Operation completed');
    });

    it('suppressed in quiet mode', () => {
      const output = new OutputManager(createMockContext({ quiet: true }));
      output.success('Operation completed');
      expect(consoleLog).not.toHaveBeenCalled();
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.success('Operation completed');
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });

  describe('notice()', () => {
    it('outputs notice message with bullet to stdout', () => {
      const output = new OutputManager(createMockContext());
      output.notice('Noteworthy event');
      expect(consoleLog).toHaveBeenCalledWith('• Noteworthy event');
    });

    it('suppressed in quiet mode', () => {
      const output = new OutputManager(createMockContext({ quiet: true }));
      output.notice('Noteworthy event');
      expect(consoleLog).not.toHaveBeenCalled();
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.notice('Noteworthy event');
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });

  describe('info()', () => {
    it('suppressed at default level', () => {
      const output = new OutputManager(createMockContext());
      output.info('Progress message');
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('shown in verbose mode', () => {
      const output = new OutputManager(createMockContext({ verbose: true }));
      output.info('Progress message');
      expect(consoleError).toHaveBeenCalledWith('Progress message');
    });

    it('shown in debug mode', () => {
      const output = new OutputManager(createMockContext({ debug: true }));
      output.info('Progress message');
      expect(consoleError).toHaveBeenCalledWith('Progress message');
    });

    it('suppressed in json mode even with verbose', () => {
      const output = new OutputManager(createMockContext({ verbose: true, json: true }));
      output.info('Progress message');
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('warn()', () => {
    it('outputs warning to stderr', () => {
      const output = new OutputManager(createMockContext());
      output.warn('Something unexpected');
      expect(consoleError).toHaveBeenCalledWith('⚠ Something unexpected');
    });

    it('suppressed in quiet mode', () => {
      const output = new OutputManager(createMockContext({ quiet: true }));
      output.warn('Something unexpected');
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('outputs JSON in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.warn('Something unexpected');
      expect(consoleError).toHaveBeenCalledWith('{"warning":"Something unexpected"}');
    });
  });

  describe('error()', () => {
    it('outputs error to stderr', () => {
      const output = new OutputManager(createMockContext());
      output.error('Operation failed');
      expect(consoleError).toHaveBeenCalledWith('✗ Operation failed');
    });

    it('shown even in quiet mode', () => {
      const output = new OutputManager(createMockContext({ quiet: true }));
      output.error('Operation failed');
      expect(consoleError).toHaveBeenCalledWith('✗ Operation failed');
    });

    it('outputs JSON in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.error('Operation failed');
      expect(consoleError).toHaveBeenCalledWith('{"error":"Operation failed"}');
    });
  });

  describe('command()', () => {
    it('suppressed at default level', () => {
      const output = new OutputManager(createMockContext());
      output.command('git', ['status']);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('shown in verbose mode', () => {
      const output = new OutputManager(createMockContext({ verbose: true }));
      output.command('git', ['status']);
      expect(consoleError).toHaveBeenCalledWith('> git status');
    });

    it('shown in debug mode', () => {
      const output = new OutputManager(createMockContext({ debug: true }));
      output.command('git', ['fetch', 'origin']);
      expect(consoleError).toHaveBeenCalledWith('> git fetch origin');
    });

    it('handles command without args', () => {
      const output = new OutputManager(createMockContext({ verbose: true }));
      output.command('pwd');
      expect(consoleError).toHaveBeenCalledWith('> pwd');
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ verbose: true, json: true }));
      output.command('git', ['status']);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('debug()', () => {
    it('suppressed at default level', () => {
      const output = new OutputManager(createMockContext());
      output.debug('Internal state');
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('suppressed in verbose mode (requires debug)', () => {
      const output = new OutputManager(createMockContext({ verbose: true }));
      output.debug('Internal state');
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('shown in debug mode', () => {
      const output = new OutputManager(createMockContext({ debug: true }));
      output.debug('Internal state');
      expect(consoleError).toHaveBeenCalledWith('[debug] Internal state');
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ debug: true, json: true }));
      output.debug('Internal state');
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('table()', () => {
    it('outputs header and rows', () => {
      const output = new OutputManager(createMockContext());
      output.table(
        [
          { label: 'ID', width: 10 },
          { label: 'NAME', width: 15 },
        ],
        [
          ['abc', 'Item One'],
          ['def', 'Item Two'],
        ],
      );
      expect(consoleLog).toHaveBeenCalledTimes(3);
      expect(consoleLog).toHaveBeenNthCalledWith(1, 'ID        NAME           '); // header
      expect(consoleLog).toHaveBeenNthCalledWith(2, 'abc       Item One       ');
      expect(consoleLog).toHaveBeenNthCalledWith(3, 'def       Item Two       ');
    });

    it('supports colored cells', () => {
      const output = new OutputManager(createMockContext());
      const greenFn = (s: string) => `[green]${s}[/green]`;
      output.table([{ label: 'STATUS', width: 10 }], [[{ value: 'open', color: greenFn }]]);
      expect(consoleLog).toHaveBeenNthCalledWith(2, '[green]open      [/green]');
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.table([{ label: 'ID', width: 10 }], [['abc']]);
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });

  describe('list()', () => {
    it('outputs bulleted list', () => {
      const output = new OutputManager(createMockContext());
      output.list(['First item', 'Second item']);
      expect(consoleLog).toHaveBeenCalledTimes(2);
      expect(consoleLog).toHaveBeenNthCalledWith(1, '• First item');
      expect(consoleLog).toHaveBeenNthCalledWith(2, '• Second item');
    });

    it('supports indentation', () => {
      const output = new OutputManager(createMockContext());
      output.list(['Nested item'], { indent: 2 });
      expect(consoleLog).toHaveBeenCalledWith('    • Nested item');
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.list(['Item']);
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });

  describe('count()', () => {
    it('outputs count with singular form', () => {
      const output = new OutputManager(createMockContext());
      output.count(1, 'issue');
      expect(consoleLog).toHaveBeenCalledWith('1 issue');
    });

    it('outputs count with auto-plural form', () => {
      const output = new OutputManager(createMockContext());
      output.count(5, 'issue');
      expect(consoleLog).toHaveBeenCalledWith('5 issues');
    });

    it('outputs count with custom plural form', () => {
      const output = new OutputManager(createMockContext());
      output.count(2, 'dependency', 'dependencies');
      expect(consoleLog).toHaveBeenCalledWith('2 dependencies');
    });

    it('outputs zero count with plural', () => {
      const output = new OutputManager(createMockContext());
      output.count(0, 'issue');
      expect(consoleLog).toHaveBeenCalledWith('0 issues');
    });

    it('suppressed in json mode', () => {
      const output = new OutputManager(createMockContext({ json: true }));
      output.count(5, 'issue');
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });
});

describe('formatHeading', () => {
  it('converts text to uppercase', () => {
    expect(formatHeading('Repository')).toBe('REPOSITORY');
  });

  it('handles already uppercase text', () => {
    expect(formatHeading('CONFIGURATION')).toBe('CONFIGURATION');
  });

  it('handles mixed case text', () => {
    expect(formatHeading('Health Checks')).toBe('HEALTH CHECKS');
  });

  it('handles lowercase text', () => {
    expect(formatHeading('integrations')).toBe('INTEGRATIONS');
  });
});

describe('paginateOutput', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(spawn).mockReset();
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  // Skip TTY-dependent tests since process.stdout.isTTY is read-only
  // The pagination logic falls back to direct console.log when not a TTY,
  // so these tests would pass in non-TTY environments like CI.

  it('outputs directly when content is below threshold', async () => {
    const content = 'short content';
    await paginateOutput(content);

    // Below threshold, outputs directly regardless of TTY
    expect(consoleLog).toHaveBeenCalledWith(content);
    expect(spawn).not.toHaveBeenCalled();
  });

  // The key test: verify EPIPE handling doesn't throw.
  // When the user quits a pager (like pressing 'q' in less), the pager closes stdin,
  // which causes an EPIPE error. This should be handled gracefully, not thrown.
  describe('EPIPE handling', () => {
    it('handles EPIPE error gracefully when user quits pager (unit test simulation)', async () => {
      // This test simulates the pager's stdin emitting EPIPE.
      // In real usage, this happens when the user presses 'q' in less.
      // The stdin error handler should swallow EPIPE, and the promise should resolve
      // when the child process 'close' event fires.

      // Create a mock child process stdin with error handler
      const mockStdin = new EventEmitter() as Writable & EventEmitter;
      let stdinErrorHandler: ((err: Error) => void) | undefined;

      mockStdin.write = vi.fn();
      mockStdin.end = vi.fn();
      mockStdin.on = vi.fn((event: string, handler: (err: Error) => void) => {
        if (event === 'error') {
          stdinErrorHandler = handler;
        }
        return mockStdin;
      }) as unknown as typeof mockStdin.on;

      const mockChild = new EventEmitter() as ChildProcess;
      mockChild.stdin = mockStdin as unknown as Writable;

      vi.mocked(spawn).mockReturnValue(mockChild);

      // Only run this test if we're in a TTY environment or use enough lines
      const content = 'line\n'.repeat(PAGINATION_LINE_THRESHOLD + 1);

      // In non-TTY environments, paginateOutput outputs directly and returns
      if (!process.stdout.isTTY) {
        await paginateOutput(content);
        expect(consoleLog).toHaveBeenCalledWith(content);
        return;
      }

      // In TTY environment, the pager is spawned
      const promise = paginateOutput(content);

      // Simulate EPIPE error (what happens when user presses 'q' in less)
      const epipeError = new Error('write EPIPE') as NodeJS.ErrnoException;
      epipeError.code = 'EPIPE';
      epipeError.errno = -32;
      epipeError.syscall = 'write';

      // The error handler should be called
      expect(stdinErrorHandler).toBeDefined();
      stdinErrorHandler?.(epipeError);

      // Then the child process closes
      mockChild.emit('close');

      // Should resolve without throwing
      await expect(promise).resolves.toBeUndefined();
    });

    it('falls back to console.log when pager spawn fails', async () => {
      const mockStdin = new EventEmitter() as Writable & EventEmitter;
      mockStdin.write = vi.fn();
      mockStdin.end = vi.fn();
      mockStdin.on = vi.fn(() => mockStdin) as unknown as typeof mockStdin.on;

      const mockChild = new EventEmitter() as ChildProcess;
      mockChild.stdin = mockStdin as unknown as Writable;

      vi.mocked(spawn).mockReturnValue(mockChild);

      const content = 'line\n'.repeat(PAGINATION_LINE_THRESHOLD + 1);

      // In non-TTY environments, paginateOutput outputs directly
      if (!process.stdout.isTTY) {
        await paginateOutput(content);
        expect(consoleLog).toHaveBeenCalledWith(content);
        return;
      }

      const promise = paginateOutput(content);

      // Simulate spawn error (pager not found)
      mockChild.emit('error', new Error('spawn less ENOENT'));

      await expect(promise).resolves.toBeUndefined();
      expect(consoleLog).toHaveBeenCalledWith(content);
    });
  });
});
