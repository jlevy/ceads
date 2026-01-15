/**
 * `tbd stale` - List stale issues.
 *
 * See: tbd-design-v3.md §4.4 Stale
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface StaleOptions {
  days?: string;
  status?: string;
  limit?: string;
}

class StaleHandler extends BaseCommand {
  async run(options: StaleOptions): Promise<void> {
    // TODO: Implement stale - filter by days not updated
    void options.days; // Will be used for filtering

    const mockIssues = [
      { id: 'bd-a1b2c3', days: 12, status: 'in_progress', title: 'Fix auth bug' },
    ];

    this.output.data(mockIssues, () => {
      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ISSUE'.padEnd(12))}${colors.dim('DAYS'.padEnd(6))}${colors.dim('STATUS'.padEnd(14))}${colors.dim('TITLE')}`,
      );
      for (const issue of mockIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.days).padEnd(6)}${issue.status.padEnd(14)}${issue.title}`,
        );
      }
    });
  }
}

export const staleCommand = new Command('stale')
  .description('List issues not updated recently')
  .option('--days <n>', 'Days since last update (default: 7)')
  .option('--status <status>', 'Filter by status (default: open, in_progress)')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new StaleHandler(command);
    await handler.run(options);
  });
