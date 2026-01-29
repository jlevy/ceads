/**
 * Terminal Design System Tests
 *
 * Tests that verify consistent output formatting across commands that share
 * sections. When doctor subsumes status, they must produce identical output
 * for shared sections.
 *
 * See: plan-2026-01-29-terminal-design-system.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderRepositorySection,
  renderConfigSection,
  renderIntegrationsSection,
  renderStatisticsSection,
  renderFooter,
  type RepositorySectionData,
  type ConfigSectionData,
  type IntegrationCheck,
  type StatisticsSectionData,
} from '../src/cli/lib/sections.js';
import {
  formatCommandHeader,
  formatKeyValue,
  formatStatBlock,
  formatWarningBlock,
  formatFooter,
  createColors,
} from '../src/cli/lib/output.js';

// Mock console.log to capture output
let consoleOutput: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

// Create colors with color disabled for consistent test output
const colors = createColors('never');

describe('Terminal Design System', () => {
  describe('Component Helper Functions', () => {
    describe('formatCommandHeader', () => {
      it('formats command header with bold name and version', () => {
        const result = formatCommandHeader('tbd', '0.1.9', colors);
        expect(result).toBe('tbd v0.1.9');
      });
    });

    describe('formatKeyValue', () => {
      it('formats key-value with dim key', () => {
        const result = formatKeyValue('Sync branch', 'tbd-sync', colors);
        expect(result).toBe('Sync branch: tbd-sync');
      });

      it('handles empty value', () => {
        const result = formatKeyValue('Remote', '', colors);
        expect(result).toBe('Remote: ');
      });
    });

    describe('formatStatBlock', () => {
      it('formats aligned statistics with values right-aligned', () => {
        const stats = [
          { label: 'Ready', value: 12 },
          { label: 'In progress', value: 4 },
          { label: 'Total', value: 100 },
        ];
        const result = formatStatBlock(stats, colors);

        expect(result).toHaveLength(3);
        // Values should be right-aligned (padding is after colon, before value)
        // The format is "  {label}:{padding}{value}"
        // where padding aligns the value column
        expect(result[0]).toContain('Ready:');
        expect(result[1]).toContain('In progress:');
        expect(result[2]).toContain('Total:');
        // Verify all lines have the proper 2-space indent
        expect(result.every((line) => line.startsWith('  '))).toBe(true);
      });

      it('handles single item', () => {
        const stats = [{ label: 'Total', value: 42 }];
        const result = formatStatBlock(stats, colors);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain('Total:');
        expect(result[0]).toContain('42');
      });
    });

    describe('formatWarningBlock', () => {
      it('formats warning with headline and details', () => {
        const result = formatWarningBlock(
          'Something is wrong',
          ['Detail line 1', 'Detail line 2'],
          undefined,
          colors,
        );

        expect(result).toHaveLength(3);
        expect(result[0]).toContain('⚠');
        expect(result[0]).toContain('Something is wrong');
        expect(result[1]).toBe('Detail line 1');
        expect(result[2]).toBe('Detail line 2');
      });

      it('includes suggestion with command', () => {
        const result = formatWarningBlock(
          'Something is wrong',
          ['Detail line'],
          { text: 'Run', command: 'tbd fix' },
          colors,
        );

        expect(result).toHaveLength(3);
        expect(result[2]).toContain('Run');
        expect(result[2]).toContain('tbd fix');
      });
    });

    describe('formatFooter', () => {
      it('formats single suggestion', () => {
        const result = formatFooter([{ command: 'tbd stats', description: 'statistics' }], colors);
        expect(result).toBe("Use 'tbd stats' for statistics.");
      });

      it('formats multiple suggestions', () => {
        const result = formatFooter(
          [
            { command: 'tbd stats', description: 'statistics' },
            { command: 'tbd doctor', description: 'health checks' },
          ],
          colors,
        );
        expect(result).toBe("Use 'tbd stats' for statistics, 'tbd doctor' for health checks.");
      });

      it('returns empty string for no suggestions', () => {
        const result = formatFooter([], colors);
        expect(result).toBe('');
      });
    });
  });

  describe('Shared Section Renderers', () => {
    describe('renderRepositorySection', () => {
      const baseData: RepositorySectionData = {
        version: '0.1.9',
        workingDirectory: '/test/repo',
        initialized: true,
        gitRepository: true,
        gitBranch: 'main',
        gitVersion: '2.43.0',
        gitVersionSupported: true,
      };

      it('renders version line', () => {
        renderRepositorySection(baseData, colors);
        expect(consoleOutput.some((line) => line.includes('tbd v0.1.9'))).toBe(true);
      });

      it('renders repository path', () => {
        renderRepositorySection(baseData, colors);
        expect(consoleOutput.some((line) => line.includes('/test/repo'))).toBe(true);
      });

      it('renders initialized status with checkmark', () => {
        renderRepositorySection(baseData, colors);
        expect(
          consoleOutput.some((line) => line.includes('✓') && line.includes('Initialized')),
        ).toBe(true);
      });

      it('renders git repository with branch', () => {
        renderRepositorySection(baseData, colors);
        expect(
          consoleOutput.some(
            (line) =>
              line.includes('✓') && line.includes('Git repository') && line.includes('main'),
          ),
        ).toBe(true);
      });

      it('renders git version when supported', () => {
        renderRepositorySection(baseData, colors);
        expect(
          consoleOutput.some((line) => line.includes('✓') && line.includes('Git 2.43.0')),
        ).toBe(true);
      });

      it('renders warning for unsupported git version', () => {
        const data = { ...baseData, gitVersionSupported: false };
        renderRepositorySection(data, colors);
        expect(
          consoleOutput.some((line) => line.includes('⚠') && line.includes('Git 2.43.0')),
        ).toBe(true);
      });

      it('renders REPOSITORY heading when showHeading is true', () => {
        consoleOutput = [];
        renderRepositorySection(baseData, colors, { showHeading: true });
        expect(consoleOutput[0]).toBe('REPOSITORY');
      });

      it('does not render heading by default', () => {
        consoleOutput = [];
        renderRepositorySection(baseData, colors);
        expect(consoleOutput[0]).not.toBe('REPOSITORY');
      });
    });

    describe('renderConfigSection', () => {
      it('renders sync branch, remote, and prefix', () => {
        const data: ConfigSectionData = {
          syncBranch: 'tbd-sync',
          remote: 'origin',
          displayPrefix: 'test',
        };
        renderConfigSection(data, colors);

        expect(
          consoleOutput.some((line) => line.includes('Sync branch:') && line.includes('tbd-sync')),
        ).toBe(true);
        expect(
          consoleOutput.some((line) => line.includes('Remote:') && line.includes('origin')),
        ).toBe(true);
        expect(
          consoleOutput.some((line) => line.includes('ID prefix:') && line.includes('test-')),
        ).toBe(true);
      });

      it('renders nothing when all values are null', () => {
        const data: ConfigSectionData = {
          syncBranch: null,
          remote: null,
          displayPrefix: null,
        };
        renderConfigSection(data, colors);
        // Should only have empty line or nothing
        expect(consoleOutput.filter((line) => line.trim() !== '').length).toBe(0);
      });
    });

    describe('renderIntegrationsSection', () => {
      it('renders INTEGRATIONS heading', () => {
        const checks: IntegrationCheck[] = [
          { name: 'Claude Code', installed: true, path: '~/.claude' },
        ];
        renderIntegrationsSection(checks, colors);
        expect(consoleOutput.some((line) => line === 'INTEGRATIONS')).toBe(true);
      });

      it('renders checkmark for installed integrations', () => {
        const checks: IntegrationCheck[] = [
          { name: 'Claude Code', installed: true, path: '~/.claude' },
        ];
        renderIntegrationsSection(checks, colors);
        expect(
          consoleOutput.some((line) => line.includes('✓') && line.includes('Claude Code')),
        ).toBe(true);
      });

      it('renders X for missing integrations', () => {
        const checks: IntegrationCheck[] = [
          { name: 'Claude Code', installed: false, path: '~/.claude' },
        ];
        renderIntegrationsSection(checks, colors);
        expect(
          consoleOutput.some((line) => line.includes('✗') && line.includes('Claude Code')),
        ).toBe(true);
      });

      it('returns true when integrations are missing', () => {
        const checks: IntegrationCheck[] = [
          { name: 'Claude Code', installed: false, path: '~/.claude' },
        ];
        const hasMissing = renderIntegrationsSection(checks, colors);
        expect(hasMissing).toBe(true);
      });

      it('returns false when all integrations are installed', () => {
        const checks: IntegrationCheck[] = [
          { name: 'Claude Code', installed: true, path: '~/.claude' },
        ];
        const hasMissing = renderIntegrationsSection(checks, colors);
        expect(hasMissing).toBe(false);
      });
    });

    describe('renderStatisticsSection', () => {
      const data: StatisticsSectionData = {
        ready: 12,
        inProgress: 4,
        blocked: 2,
        open: 10,
        total: 100,
      };

      it('renders STATISTICS heading by default', () => {
        renderStatisticsSection(data, colors);
        expect(consoleOutput.some((line) => line === 'STATISTICS')).toBe(true);
      });

      it('does not render heading when showHeading is false', () => {
        consoleOutput = [];
        renderStatisticsSection(data, colors, { showHeading: false });
        expect(consoleOutput.some((line) => line === 'STATISTICS')).toBe(false);
      });

      it('renders all statistics', () => {
        renderStatisticsSection(data, colors);
        expect(consoleOutput.some((line) => line.includes('Ready:') && line.includes('12'))).toBe(
          true,
        );
        expect(
          consoleOutput.some((line) => line.includes('In progress:') && line.includes('4')),
        ).toBe(true);
        expect(consoleOutput.some((line) => line.includes('Blocked:') && line.includes('2'))).toBe(
          true,
        );
        expect(consoleOutput.some((line) => line.includes('Open:') && line.includes('10'))).toBe(
          true,
        );
        expect(consoleOutput.some((line) => line.includes('Total:') && line.includes('100'))).toBe(
          true,
        );
      });
    });

    describe('renderFooter', () => {
      it('renders footer with suggestions', () => {
        renderFooter(
          [
            { command: 'tbd stats', description: 'statistics' },
            { command: 'tbd doctor', description: 'health checks' },
          ],
          colors,
        );
        expect(
          consoleOutput.some(
            (line) => line.includes("'tbd stats'") && line.includes("'tbd doctor'"),
          ),
        ).toBe(true);
      });
    });
  });

  describe('Subsumption Consistency', () => {
    describe('doctor ⊃ status (shared sections)', () => {
      const repoData: RepositorySectionData = {
        version: '0.1.9',
        workingDirectory: '/test/repo',
        initialized: true,
        gitRepository: true,
        gitBranch: 'main',
        gitVersion: null, // doctor shows git version in health checks
        gitVersionSupported: true,
      };

      const configData: ConfigSectionData = {
        syncBranch: 'tbd-sync',
        remote: 'origin',
        displayPrefix: 'test',
      };

      it('produces identical REPOSITORY section output', () => {
        // Render from "status" perspective (no heading)
        consoleOutput = [];
        renderRepositorySection(repoData, colors);
        const statusOutput = [...consoleOutput];

        // Render from "doctor" perspective (with heading) - skip the heading for comparison
        consoleOutput = [];
        renderRepositorySection(repoData, colors, { showHeading: true });
        const doctorOutput = consoleOutput.slice(1); // Skip heading

        // Content should be identical
        expect(statusOutput).toEqual(doctorOutput);
      });

      it('produces identical CONFIG section output', () => {
        // Render from "status"
        consoleOutput = [];
        renderConfigSection(configData, colors);
        const statusOutput = [...consoleOutput];

        // Render from "doctor"
        consoleOutput = [];
        renderConfigSection(configData, colors);
        const doctorOutput = [...consoleOutput];

        expect(statusOutput).toEqual(doctorOutput);
      });
    });

    describe('doctor ⊃ stats (shared sections)', () => {
      const statsData: StatisticsSectionData = {
        ready: 12,
        inProgress: 4,
        blocked: 2,
        open: 10,
        total: 100,
      };

      it('produces identical STATISTICS content (excluding heading)', () => {
        // Render from "stats" perspective (no heading)
        consoleOutput = [];
        renderStatisticsSection(statsData, colors, { showHeading: false });
        const statsOutput = [...consoleOutput];

        // Render from "doctor" perspective (with heading) - skip the heading and blank line
        consoleOutput = [];
        renderStatisticsSection(statsData, colors);
        // Filter out heading and blank lines for comparison
        const doctorContentLines = consoleOutput.filter(
          (line) => line !== 'STATISTICS' && line !== '',
        );

        // Find stats content lines (skip blank line at start if present)
        const statsContentLines = statsOutput.filter((line) => line !== '');

        expect(statsContentLines).toEqual(doctorContentLines);
      });
    });
  });
});
