/**
 * `tbd reopen` - Reopen a closed issue.
 *
 * See: tbd-design-v3.md §4.4 Reopen
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface ReopenOptions {
  reason?: string;
}

class ReopenHandler extends BaseCommand {
  async run(id: string, options: ReopenOptions): Promise<void> {
    if (this.checkDryRun('Would reopen issue', { id, ...options })) {
      return;
    }

    // TODO: Implement reopen
    // 1. Load issue
    // 2. Set status to open, clear closed_at
    // 3. Save and sync

    this.output.success(`Reopened ${id}`);
  }
}

export const reopenCommand = new Command('reopen')
  .description('Reopen a closed issue')
  .argument('<id>', 'Issue ID')
  .option('--reason <text>', 'Reopen reason')
  .action(async (id, options, command) => {
    const handler = new ReopenHandler(command);
    await handler.run(id, options);
  });
