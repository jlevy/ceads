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
import { renderStatisticsSection, renderFooter } from '../lib/sections.js';

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

    // Count by kind
    const byKind: Record<IssueKindType, number> = {
      bug: 0,
      feature: 0,
      task: 0,
      epic: 0,
      chore: 0,
    };

    // Count by priority
    const byPriority: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    };

    // Build set of blocked issue IDs (issues that have open blockers)
    const blockedIds = new Set<string>();
    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          // The target issue is blocked by this issue
          const blockedIssue = issues.find((i) => i.id === dep.target);
          if (blockedIssue && blockedIssue.status !== 'closed') {
            blockedIds.add(dep.target);
          }
        }
      }
    }

    // Count ready issues (open and not blocked)
    let readyCount = 0;

    // Accumulate counts
    for (const issue of issues) {
      byStatus[issue.status]++;
      byKind[issue.kind]++;
      if (issue.priority >= 0 && issue.priority <= 4) {
        byPriority[issue.priority]!++;
      }
      // Count ready: open and not blocked
      if (issue.status === 'open' && !blockedIds.has(issue.id)) {
        readyCount++;
      }
    }

    const stats = {
      total: issues.length,
      ready: readyCount,
      blocked: blockedIds.size,
      byStatus,
      byKind,
      byPriority,
    };

    this.output.data(stats, () => {
      const colors = this.output.getColors();

      // Summary heading (stats uses "Summary:" while doctor uses "STATISTICS")
      console.log(colors.bold('Summary:'));

      // STATISTICS section (shared with doctor command)
      renderStatisticsSection(
        {
          ready: stats.ready,
          inProgress: stats.byStatus.in_progress,
          blocked: stats.blocked,
          open: stats.byStatus.open,
          total: stats.total,
        },
        colors,
        { showHeading: false }, // stats doesn't need the STATISTICS heading since it has Summary
      );

      if (stats.total === 0) {
        renderFooter(
          [
            { command: 'tbd status', description: 'setup info' },
            { command: 'tbd doctor', description: 'health checks' },
          ],
          colors,
        );
        return;
      }

      console.log('');
      console.log(colors.bold('By status:'));
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) {
          console.log(`  ${status.padEnd(14)} ${count}`);
        }
      }

      console.log('');
      console.log(colors.bold('By kind:'));
      for (const [kind, count] of Object.entries(stats.byKind)) {
        if (count > 0) {
          console.log(`  ${kind.padEnd(14)} ${count}`);
        }
      }

      console.log('');
      console.log(colors.bold('By priority:'));
      const priorityLabels = ['Critical', 'High', 'Medium', 'Low', 'Lowest'];
      for (let i = 0; i <= 4; i++) {
        const count = stats.byPriority[i];
        if (count !== undefined && count > 0) {
          console.log(`  ${formatPriority(i)} (${priorityLabels[i]!.padEnd(8)}) ${count}`);
        }
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
