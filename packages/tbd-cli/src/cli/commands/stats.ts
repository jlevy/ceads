/**
 * `tbd stats` - Show repository statistics.
 *
 * See: tbd-design-v3.md §4.9 Stats
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { listIssues } from '../../file/storage.js';
import type { IssueStatusType, IssueKindType } from '../../lib/types.js';

// Base directory for issues
const ISSUES_BASE_DIR = '.tbd-sync';

class StatsHandler extends BaseCommand {
  async run(): Promise<void> {
    // Load all issues
    let issues;
    try {
      issues = await listIssues(ISSUES_BASE_DIR);
    } catch {
      this.output.error('No issue store found. Run `tbd init` first.');
      return;
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

    // Accumulate counts
    for (const issue of issues) {
      byStatus[issue.status]++;
      byKind[issue.kind]++;
      if (issue.priority >= 0 && issue.priority <= 4) {
        byPriority[issue.priority]!++;
      }
    }

    const stats = {
      total: issues.length,
      byStatus,
      byKind,
      byPriority,
    };

    this.output.data(stats, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('Total issues:')} ${stats.total}`);

      if (stats.total === 0) {
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
          console.log(`  ${i} (${priorityLabels[i]!.padEnd(8)}) ${count}`);
        }
      }
    });
  }
}

export const statsCommand = new Command('stats')
  .description('Show repository statistics')
  .action(async (_options, command) => {
    const handler = new StatsHandler(command);
    await handler.run();
  });
