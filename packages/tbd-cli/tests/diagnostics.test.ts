/**
 * Tests for diagnostic output utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  type DiagnosticResult,
  renderDiagnostic,
  renderDiagnostics,
} from '../src/cli/lib/diagnostics.js';
import { createColors } from '../src/cli/lib/output.js';

describe('DiagnosticResult', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  // Use non-colorizing colors for predictable test output
  const colors = createColors('never');

  describe('renderDiagnostic()', () => {
    describe('basic status rendering', () => {
      it('renders ok status with checkmark icon', () => {
        const result: DiagnosticResult = {
          name: 'Config file',
          status: 'ok',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✓ Config file');
      });

      it('renders warn status with warning icon', () => {
        const result: DiagnosticResult = {
          name: 'Dependencies',
          status: 'warn',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('⚠ Dependencies');
      });

      it('renders error status with X icon', () => {
        const result: DiagnosticResult = {
          name: 'Issue validity',
          status: 'error',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✗ Issue validity');
      });
    });

    describe('with message', () => {
      it('appends message after dash', () => {
        const result: DiagnosticResult = {
          name: 'Git version',
          status: 'ok',
          message: '2.42.0',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✓ Git version - 2.42.0');
      });

      it('shows error message', () => {
        const result: DiagnosticResult = {
          name: 'Config file',
          status: 'error',
          message: 'not found',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✗ Config file - not found');
      });
    });

    describe('with path', () => {
      it('shows path in parentheses after name', () => {
        const result: DiagnosticResult = {
          name: 'Config file',
          status: 'ok',
          path: '.tbd/config.yml',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✓ Config file (.tbd/config.yml)');
      });

      it('shows path with message', () => {
        const result: DiagnosticResult = {
          name: 'Skill file',
          status: 'warn',
          message: 'outdated',
          path: '.claude/skills/tbd/SKILL.md',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith(
          '⚠ Skill file - outdated (.claude/skills/tbd/SKILL.md)',
        );
      });
    });

    describe('with details', () => {
      it('shows details as indented lines', () => {
        const result: DiagnosticResult = {
          name: 'Dependencies',
          status: 'warn',
          message: '2 orphaned reference(s)',
          details: ['tbd-abc1 -> tbd-xyz9 (missing)', 'tbd-def2 -> tbd-uvw8 (missing)'],
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(3);
        expect(consoleLog).toHaveBeenNthCalledWith(1, '⚠ Dependencies - 2 orphaned reference(s)');
        expect(consoleLog).toHaveBeenNthCalledWith(2, '    tbd-abc1 -> tbd-xyz9 (missing)');
        expect(consoleLog).toHaveBeenNthCalledWith(3, '    tbd-def2 -> tbd-uvw8 (missing)');
      });

      it('does not show details when status is ok', () => {
        const result: DiagnosticResult = {
          name: 'Dependencies',
          status: 'ok',
          details: ['should not show'],
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(1);
        expect(consoleLog).toHaveBeenCalledWith('✓ Dependencies');
      });
    });

    describe('with suggestion', () => {
      it('shows suggestion as indented line for non-ok status', () => {
        const result: DiagnosticResult = {
          name: 'Skill file',
          status: 'warn',
          message: 'not installed',
          suggestion: 'Run: tbd setup claude',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(2);
        expect(consoleLog).toHaveBeenNthCalledWith(1, '⚠ Skill file - not installed');
        expect(consoleLog).toHaveBeenNthCalledWith(2, '    Run: tbd setup claude');
      });

      it('does not show suggestion when status is ok', () => {
        const result: DiagnosticResult = {
          name: 'Skill file',
          status: 'ok',
          suggestion: 'should not show',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(1);
      });

      it('shows suggestion after details', () => {
        const result: DiagnosticResult = {
          name: 'Dependencies',
          status: 'warn',
          message: '1 orphaned',
          details: ['tbd-abc1 -> tbd-xyz9 (missing)'],
          suggestion: 'Run: tbd doctor --fix',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(3);
        expect(consoleLog).toHaveBeenNthCalledWith(1, '⚠ Dependencies - 1 orphaned');
        expect(consoleLog).toHaveBeenNthCalledWith(2, '    tbd-abc1 -> tbd-xyz9 (missing)');
        expect(consoleLog).toHaveBeenNthCalledWith(3, '    Run: tbd doctor --fix');
      });
    });

    describe('with fixable flag', () => {
      it('shows [fixable] suffix for non-ok status', () => {
        const result: DiagnosticResult = {
          name: 'Temp files',
          status: 'warn',
          message: '3 orphaned temp file(s)',
          fixable: true,
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('⚠ Temp files - 3 orphaned temp file(s) [fixable]');
      });

      it('does not show [fixable] for ok status', () => {
        const result: DiagnosticResult = {
          name: 'Temp files',
          status: 'ok',
          fixable: true,
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledWith('✓ Temp files');
      });
    });

    describe('complete example', () => {
      it('renders all fields correctly', () => {
        const result: DiagnosticResult = {
          name: 'Issue validity',
          status: 'error',
          message: '2 invalid issue(s)',
          path: '.tbd/issues',
          details: ["tbd-aaa1: missing required field 'title'", 'tbd-bbb2: invalid priority 5'],
          fixable: false,
          suggestion: 'Manually fix issues or delete them',
        };
        renderDiagnostic(result, colors);
        expect(consoleLog).toHaveBeenCalledTimes(4);
        expect(consoleLog).toHaveBeenNthCalledWith(
          1,
          '✗ Issue validity - 2 invalid issue(s) (.tbd/issues)',
        );
        expect(consoleLog).toHaveBeenNthCalledWith(
          2,
          "    tbd-aaa1: missing required field 'title'",
        );
        expect(consoleLog).toHaveBeenNthCalledWith(3, '    tbd-bbb2: invalid priority 5');
        expect(consoleLog).toHaveBeenNthCalledWith(4, '    Manually fix issues or delete them');
      });
    });
  });

  describe('renderDiagnostics()', () => {
    it('renders multiple diagnostics', () => {
      const results: DiagnosticResult[] = [
        { name: 'Git version', status: 'ok', message: '2.42.0' },
        { name: 'Config file', status: 'ok', path: '.tbd/config.yml' },
      ];
      renderDiagnostics(results, colors);
      expect(consoleLog).toHaveBeenCalledTimes(2);
      expect(consoleLog).toHaveBeenNthCalledWith(1, '✓ Git version - 2.42.0');
      expect(consoleLog).toHaveBeenNthCalledWith(2, '✓ Config file (.tbd/config.yml)');
    });

    it('handles empty array', () => {
      renderDiagnostics([], colors);
      expect(consoleLog).not.toHaveBeenCalled();
    });
  });
});
