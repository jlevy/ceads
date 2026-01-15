/**
 * `tbd close` - Close an issue.
 *
 * See: tbd-design-v3.md §4.4 Close
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface CloseOptions {
  reason?: string;
}

class CloseHandler extends BaseCommand {
  async run(id: string, options: CloseOptions): Promise<void> {
    if (this.checkDryRun('Would close issue', { id, ...options })) {
      return;
    }

    // TODO: Implement close
    // 1. Load issue
    // 2. Set status to closed, set closed_at
    // 3. Save and sync

    this.output.success(`Closed ${id}`);
  }
}

export const closeCommand = new Command('close')
  .description('Close an issue')
  .argument('<id>', 'Issue ID')
  .option('--reason <text>', 'Close reason')
  .action(async (id, options, command) => {
    const handler = new CloseHandler(command);
    await handler.run(id, options);
  });
