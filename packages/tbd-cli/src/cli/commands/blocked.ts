/**
 * `tbd blocked` - List blocked issues.
 *
 * See: tbd-design-v3.md §4.4 Blocked
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface BlockedOptions {
  limit?: string;
}

class BlockedHandler extends BaseCommand {
  async run(options: BlockedOptions): Promise<void> {
    // TODO: Implement blocked
    // Find issues with status=blocked or unresolved blocking dependencies

    const mockIssues = [
      { id: 'bd-c3d4e5', title: 'Write tests', blockedBy: ['bd-f14c (Add OAuth)'] },
    ];

    this.output.data(mockIssues, () => {
      const colors = this.output.getColors();
      console.log(
        `${colors.dim('ISSUE'.padEnd(12))}${colors.dim('TITLE'.padEnd(25))}${colors.dim('BLOCKED BY')}`,
      );
      for (const issue of mockIssues) {
        console.log(
          `${colors.id(issue.id.padEnd(12))}${issue.title.padEnd(25)}${issue.blockedBy.join(', ')}`,
        );
      }
    });
  }
}

export const blockedCommand = new Command('blocked')
  .description('List blocked issues')
  .option('--limit <n>', 'Limit results')
  .action(async (options, command) => {
    const handler = new BlockedHandler(command);
    await handler.run(options);
  });
