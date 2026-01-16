/**
 * `tbd close` - Close an issue.
 *
 * See: tbd-design-v3.md §4.4 Close
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { normalizeIssueId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

interface CloseOptions {
  reason?: string;
}

class CloseHandler extends BaseCommand {
  async run(id: string, options: CloseOptions): Promise<void> {
    const normalizedId = normalizeIssueId(id);
    const dataSyncDir = await resolveDataSyncDir();

    // Load existing issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Check if already closed
    if (issue.status === 'closed') {
      this.output.error(`Issue ${id} is already closed`);
      return;
    }

    if (this.checkDryRun('Would close issue', { id: normalizedId, reason: options.reason })) {
      return;
    }

    // Update issue
    issue.status = 'closed';
    issue.closed_at = new Date().toISOString();
    issue.close_reason = options.reason ?? null;
    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    // Save
    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to close issue');

    const displayId = `bd-${issue.id.slice(3)}`;
    this.output.data({ id: displayId, closed: true }, () => {
      this.output.success(`Closed ${displayId}`);
    });
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
