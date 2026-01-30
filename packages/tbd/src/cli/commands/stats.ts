/**
 * `tbd stats` - Show repository statistics.
 *
 * See: tbd-design.md §4.9 Stats
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotInitializedError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { formatPriority } from '../../lib/priority.js';
import { renderFooter } from '../lib/sections.js';
import { getStatusIcon, getStatusColor } from '../../lib/status.js';

/**
 * Active statuses (non-closed).
 */
const ACTIVE_STATUSES: IssueStatusType[] = ['open', 'in_progress', 'blocked', 'deferred'];

/**
 * All statuses in display order.
 */
const STATUS_ORDER: IssueStatusType[] = ['open', 'in_progress', 'blocked', 'deferred', 'closed'];

/**
 * All kinds in display order.
 */
const KIND_ORDER: IssueKindType[] = ['bug', 'feature', 'task', 'epic', 'chore'];

/**
 * Priority labels for display.
 */
const PRIORITY_LABELS = ['Critical', 'High', 'Medium', 'Low', 'Lowest'];

class StatsHandler extends BaseCommand {
  async run(): Promise<void> {
    await requireInit();

    // Load all issues
    let issues: Issue[];
    try {
      const dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    // Count by status
    const byStatus: Record<IssueStatusType, number> = {
      open: 0,
      in_progress: 0,
      blocked: 0,
      deferred: 0,
      closed: 0,
    };

    // Count by kind (active vs closed)
    const byKindActive: Record<IssueKindType, number> = {
      bug: 0,
      feature: 0,
      task: 0,
      epic: 0,
      chore: 0,
    };
    const byKindClosed: Record<IssueKindType, number> = {
      bug: 0,
      feature: 0,
      task: 0,
      epic: 0,
      chore: 0,
    };

    // Count by priority (active vs closed)
    const byPriorityActive: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const byPriorityClosed: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    // Accumulate counts
    for (const issue of issues) {
      byStatus[issue.status]++;

      const isActive = issue.status !== 'closed';
      if (isActive) {
        byKindActive[issue.kind]++;
        if (issue.priority >= 0 && issue.priority <= 4) {
          byPriorityActive[issue.priority]!++;
        }
      } else {
        byKindClosed[issue.kind]++;
        if (issue.priority >= 0 && issue.priority <= 4) {
          byPriorityClosed[issue.priority]!++;
        }
      }
    }

    // Calculate totals
    const activeTotal = ACTIVE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
    const closedTotal = byStatus.closed;
    const total = issues.length;

    const stats = {
      total,
      active: activeTotal,
      closed: closedTotal,
      byStatus,
      byKindActive,
      byKindClosed,
      byPriorityActive,
      byPriorityClosed,
    };

    this.output.data(stats, () => {
      const colors = this.output.getColors();

      if (stats.total === 0) {
        console.log(colors.dim('No issues found.'));
        renderFooter(
          [
            { command: 'tbd status', description: 'setup info' },
            { command: 'tbd doctor', description: 'health checks' },
          ],
          colors,
        );
        return;
      }

      // Column width for counts (right-aligned)
      const countWidth = 6;

      // === BY STATUS SECTION ===
      console.log(colors.bold('By status:'));

      // Find max count for determining column alignment
      const maxStatusCount = Math.max(...Object.values(stats.byStatus), activeTotal, total);
      const statusCountWidth = Math.max(countWidth, String(maxStatusCount).length + 2);

      // Show each status with icon and color
      for (const status of STATUS_ORDER) {
        const count = stats.byStatus[status];
        if (status === 'closed') continue; // Show closed after subtotal
        const icon = getStatusIcon(status);
        const colorFn = getStatusColor(status, colors);
        const countStr = String(count).padStart(statusCountWidth);
        console.log(`  ${colorFn(icon)} ${status.padEnd(14)}${countStr}`);
      }

      // Subtotal separator and active total
      console.log(`  ${'─'.repeat(16 + statusCountWidth)}`);
      console.log(`    ${'active'.padEnd(14)}${String(activeTotal).padStart(statusCountWidth)}`);

      // Closed with icon
      const closedIcon = getStatusIcon('closed');
      const closedColorFn = getStatusColor('closed', colors);
      console.log(
        `  ${closedColorFn(closedIcon)} ${'closed'.padEnd(14)}${String(closedTotal).padStart(statusCountWidth)}`,
      );

      // Total separator and total
      console.log(`  ${'═'.repeat(16 + statusCountWidth)}`);
      console.log(`    ${'total'.padEnd(14)}${String(total).padStart(statusCountWidth)}`);

      // === BY KIND SECTION ===
      console.log('');
      const kindHeader = `${'By kind:'.padEnd(18)}${'active'.padStart(countWidth + 2)}${'closed'.padStart(countWidth + 2)}${'total'.padStart(countWidth + 2)}`;
      console.log(colors.bold(kindHeader));

      for (const kind of KIND_ORDER) {
        const active = stats.byKindActive[kind];
        const closed = stats.byKindClosed[kind];
        const kindTotal = active + closed;
        if (kindTotal === 0) continue;

        const line = `  ${kind.padEnd(16)}${String(active).padStart(countWidth + 2)}${String(closed).padStart(countWidth + 2)}${String(kindTotal).padStart(countWidth + 2)}`;
        console.log(line);
      }

      // === BY PRIORITY SECTION ===
      console.log('');
      const priorityHeader = `${'By priority:'.padEnd(18)}${'active'.padStart(countWidth + 2)}${'closed'.padStart(countWidth + 2)}${'total'.padStart(countWidth + 2)}`;
      console.log(colors.bold(priorityHeader));

      for (let i = 0; i <= 4; i++) {
        const active = stats.byPriorityActive[i] ?? 0;
        const closed = stats.byPriorityClosed[i] ?? 0;
        const priorityTotal = active + closed;
        if (priorityTotal === 0) continue;

        const label = `${formatPriority(i)} (${PRIORITY_LABELS[i]})`;
        const line = `  ${label.padEnd(16)}${String(active).padStart(countWidth + 2)}${String(closed).padStart(countWidth + 2)}${String(priorityTotal).padStart(countWidth + 2)}`;
        console.log(line);
      }

      // Footer (shared format)
      renderFooter(
        [
          { command: 'tbd status', description: 'setup info' },
          { command: 'tbd doctor', description: 'health checks' },
        ],
        colors,
      );
    });
  }
}

export const statsCommand = new Command('stats')
  .description('Show repository statistics')
  .action(async (_options, command) => {
    const handler = new StatsHandler(command);
    await handler.run();
  });
