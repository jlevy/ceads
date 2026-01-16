/**
 * `tbd reopen` - Reopen a closed issue.
 *
 * See: tbd-design-v3.md §4.4 Reopen
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { normalizeIssueId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

interface ReopenOptions {
  reason?: string;
}

class ReopenHandler extends BaseCommand {
  async run(id: string, options: ReopenOptions): Promise<void> {
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

    // Check if not closed
    if (issue.status !== 'closed') {
      this.output.error(`Issue ${id} is not closed (status: ${issue.status})`);
      return;
    }

    if (this.checkDryRun('Would reopen issue', { id: normalizedId, reason: options.reason })) {
      return;
    }

    // Update issue
    issue.status = 'open';
    issue.closed_at = null;
    issue.close_reason = null;
    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    // Optionally store reopen reason in notes if provided
    if (options.reason) {
      const reopenNote = `Reopened: ${options.reason}`;
      issue.notes = issue.notes ? `${issue.notes}\n\n${reopenNote}` : reopenNote;
    }

    // Save
    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to reopen issue');

    const displayId = `bd-${issue.id.slice(3)}`;
    this.output.data({ id: displayId, reopened: true }, () => {
      this.output.success(`Reopened ${displayId}`);
    });
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
