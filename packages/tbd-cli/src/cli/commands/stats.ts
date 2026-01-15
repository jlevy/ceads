/**
 * `tbd stats` - Show repository statistics.
 *
 * See: tbd-design-v3.md §4.9 Stats
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

class StatsHandler extends BaseCommand {
  async run(): Promise<void> {
    // TODO: Implement stats
    // Count issues by status, type, label, etc.

    const stats = {
      total: 42,
      byStatus: {
        open: 15,
        in_progress: 8,
        blocked: 3,
        deferred: 4,
        closed: 12,
      },
      byKind: {
        bug: 10,
        feature: 18,
        task: 12,
        epic: 2,
        chore: 0,
      },
    };

    this.output.data(stats, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('Total issues:')} ${stats.total}`);
      console.log('');
      console.log(colors.bold('By status:'));
      for (const [status, count] of Object.entries(stats.byStatus)) {
        console.log(`  ${status.padEnd(14)} ${count}`);
      }
      console.log('');
      console.log(colors.bold('By kind:'));
      for (const [kind, count] of Object.entries(stats.byKind)) {
        console.log(`  ${kind.padEnd(14)} ${count}`);
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
