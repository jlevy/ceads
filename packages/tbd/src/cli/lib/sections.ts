/**
 * Shared section rendering functions for CLI output.
 *
 * These functions ensure identical output formatting across commands that
 * share sections (status, doctor, stats). When doctor subsumes status,
 * it calls the same rendering functions to guarantee consistency.
 *
 * See: plan-2026-01-29-terminal-design-system.md
 */

import type { createColors } from './output.js';
import { ICONS, formatHeading } from './output.js';
import { MIN_GIT_VERSION } from '../../file/git.js';

/**
 * Repository section data for rendering.
 */
export interface RepositorySectionData {
  version: string;
  workingDirectory: string;
  initialized: boolean;
  gitRepository: boolean;
  gitBranch: string | null;
  gitVersion: string | null;
  gitVersionSupported: boolean;
}

/**
 * Config section data for rendering.
 */
export interface ConfigSectionData {
  syncBranch: string | null;
  remote: string | null;
  displayPrefix: string | null;
}

/**
 * Integration check result for rendering.
 */
export interface IntegrationCheck {
  name: string;
  installed: boolean;
  path: string;
}

/**
 * Statistics section data for rendering.
 */
export interface StatisticsSectionData {
  ready: number;
  inProgress: number;
  blocked: number;
  open: number;
  total: number;
}

/**
 * Render the REPOSITORY section.
 *
 * Used by: status, doctor
 *
 * Shows:
 * - tbd version
 * - Repository path
 * - Initialization status
 * - Git repository status and branch
 * - Git version (with support warning if needed)
 *
 * @param data - Repository data to render
 * @param colors - Color functions
 * @param options - Rendering options
 */
export function renderRepositorySection(
  data: RepositorySectionData,
  colors: ReturnType<typeof createColors>,
  options?: { showHeading?: boolean },
): void {
  // Show heading if requested (doctor uses heading, status doesn't)
  if (options?.showHeading) {
    console.log(colors.bold(formatHeading('Repository')));
  }

  // Version line
  console.log(`${colors.bold('tbd')} v${data.version}`);

  // Repository path
  console.log(`Repository: ${data.workingDirectory}`);

  // Initialization status
  if (data.initialized) {
    console.log(`  ${colors.success(ICONS.SUCCESS)} Initialized (.tbd/)`);
  } else {
    console.log(`  ${colors.error(ICONS.ERROR)} Not initialized`);
  }

  // Git repository status
  if (data.gitRepository) {
    const branchInfo = data.gitBranch ? ` (${data.gitBranch})` : '';
    console.log(`  ${colors.success(ICONS.SUCCESS)} Git repository${branchInfo}`);

    // Git version
    if (data.gitVersion) {
      const versionIcon = data.gitVersionSupported
        ? colors.success(ICONS.SUCCESS)
        : colors.warn(ICONS.WARN);
      const versionNote = data.gitVersionSupported
        ? ''
        : ` ${colors.dim(`(requires ${MIN_GIT_VERSION}+)`)}`;
      console.log(`  ${versionIcon} Git ${data.gitVersion}${versionNote}`);
    }
  } else {
    console.log(`  ${colors.error(ICONS.ERROR)} Git repository not found`);
  }
}

/**
 * Render the CONFIG section (sync branch, remote, prefix).
 *
 * Used by: status, doctor
 *
 * Shows key-value pairs with dim keys.
 *
 * @param data - Config data to render
 * @param colors - Color functions
 */
export function renderConfigSection(
  data: ConfigSectionData,
  colors: ReturnType<typeof createColors>,
): void {
  if (!data.syncBranch && !data.remote && !data.displayPrefix) {
    return;
  }

  console.log('');

  if (data.syncBranch) {
    console.log(`${colors.dim('Sync branch:')} ${data.syncBranch}`);
  }
  if (data.remote) {
    console.log(`${colors.dim('Remote:')} ${data.remote}`);
  }
  if (data.displayPrefix) {
    console.log(`${colors.dim('ID prefix:')} ${data.displayPrefix}-`);
  }
}

/**
 * Render the INTEGRATIONS section.
 *
 * Used by: status, doctor
 *
 * Shows diagnostic lines for each integration check.
 *
 * @param checks - Array of integration checks
 * @param colors - Color functions
 * @returns Whether any integrations are missing (for follow-up suggestions)
 */
export function renderIntegrationsSection(
  checks: IntegrationCheck[],
  colors: ReturnType<typeof createColors>,
): boolean {
  console.log('');
  console.log(colors.bold(formatHeading('Integrations')));

  let hasMissing = false;

  for (const check of checks) {
    const icon = check.installed ? colors.success(ICONS.SUCCESS) : colors.dim(ICONS.ERROR);
    const pathDim = colors.dim(`(${check.path})`);
    console.log(`  ${icon} ${check.name} ${pathDim}`);

    if (!check.installed) {
      hasMissing = true;
    }
  }

  return hasMissing;
}

/**
 * Render the STATISTICS section.
 *
 * Used by: stats, doctor
 *
 * Shows aligned statistic block with labels and values.
 *
 * @param data - Statistics data to render
 * @param colors - Color functions
 * @param options - Rendering options
 */
export function renderStatisticsSection(
  data: StatisticsSectionData,
  colors: ReturnType<typeof createColors>,
  options?: { showHeading?: boolean },
): void {
  if (options?.showHeading !== false) {
    console.log('');
    console.log(colors.bold(formatHeading('Statistics')));
  }

  // Calculate padding for alignment
  const labels = ['Ready', 'In progress', 'Blocked', 'Open', 'Total'];
  const maxLabelLen = Math.max(...labels.map((l) => l.length));

  const formatLine = (label: string, value: number): string => {
    const padding = ' '.repeat(maxLabelLen - label.length + 1);
    return `  ${label}:${padding}${value}`;
  };

  console.log(formatLine('Ready', data.ready));
  console.log(formatLine('In progress', data.inProgress));
  console.log(formatLine('Blocked', data.blocked));
  console.log(formatLine('Open', data.open));
  console.log(formatLine('Total', data.total));
}

/**
 * Render a warning block about beads coexistence.
 *
 * Used by: status
 *
 * @param colors - Color functions
 */
export function renderBeadsWarning(colors: ReturnType<typeof createColors>): void {
  console.log('');
  console.log(`${colors.warn(ICONS.WARN)} Beads directory detected alongside tbd`);
  console.log('This may cause confusion for AI agents.');
  console.log(`Run ${colors.bold('tbd setup beads --disable')} for migration options`);
}

/**
 * Render worktree status line.
 *
 * Used by: status
 *
 * @param path - Worktree path
 * @param healthy - Whether worktree is healthy
 * @param colors - Color functions
 */
export function renderWorktreeStatus(
  path: string,
  healthy: boolean,
  colors: ReturnType<typeof createColors>,
): void {
  console.log('');
  if (healthy) {
    console.log(`${colors.dim('Worktree:')} ${path} (healthy)`);
  } else {
    console.log(`${colors.warn('Worktree:')} ${path} (${colors.error('unhealthy')})`);
    console.log('  Run: tbd doctor --fix');
  }
}

/**
 * Render footer with command suggestions.
 *
 * Used by: status, doctor, stats
 *
 * @param suggestions - Array of {command, description} pairs
 * @param colors - Color functions
 */
export function renderFooter(
  suggestions: { command: string; description: string }[],
  colors: ReturnType<typeof createColors>,
): void {
  console.log('');

  if (suggestions.length === 0) {
    return;
  }

  const parts = suggestions.map((s) => `${colors.bold(`'${s.command}'`)} for ${s.description}`);

  if (parts.length === 1) {
    console.log(`Use ${parts[0]}.`);
  } else {
    console.log(`Use ${parts.join(', ')}.`);
  }
}
