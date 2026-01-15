/**
 * `tbd ready` - List issues ready to work on.
 *
 * See: tbd-design-v3.md §4.4 Ready
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface ReadyOptions {
  type?: string;
  limit?: string;
}

class ReadyHandler extends BaseCommand {
  async run(options: ReadyOptions): Promise<void> {
    // TODO: Implement ready
    // Algorithm:
    // - Status = open
    // - No assignee set
    // - No blocking dependencies (where dependency.status != 'closed')

    const mockIssues = [{ id: 'bd-a1b2c3', priority: 1, title: 'Fix auth bug' }];

    this.output.data(mockIssues, () => {
      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('PRI'.padEnd(5))}${colors.dim('TITLE')}`,
      );
      for (const issue of mockIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${String(issue.priority).padEnd(5)}${issue.title}`,
        );
      }
    });
  }
}

export const readyCommand = new Command('ready')
  .description('List issues ready to work on (open, unblocked, unclaimed)')
  .option('--type <type>', 'Filter by type')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new ReadyHandler(command);
    await handler.run(options);
  });
