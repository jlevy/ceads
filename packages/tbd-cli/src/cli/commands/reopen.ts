/**
 * `tbd reopen` - Reopen a closed issue.
 *
 * See: tbd-design-spec.md §4.4 Reopen
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotFoundError, CLIError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';

interface ReopenOptions {
  reason?: string;
}

class ReopenHandler extends BaseCommand {
  async run(id: string, options: ReopenOptions): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load existing issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Check if not closed
    if (issue.status !== 'closed') {
      throw new CLIError(`Issue ${id} is not closed (status: ${issue.status})`);
    }

    if (this.checkDryRun('Would reopen issue', { id: internalId, reason: options.reason })) {
      return;
    }

    // Update issue
    issue.status = 'open';
    issue.closed_at = null;
    issue.close_reason = null;
    issue.version += 1;
    issue.updated_at = now();

    // Optionally store reopen reason in notes if provided
    if (options.reason) {
      const reopenNote = `Reopened: ${options.reason}`;
      issue.notes = issue.notes ? `${issue.notes}\n\n${reopenNote}` : reopenNote;
    }

    // Save
    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to reopen issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping, prefix)
      : formatDisplayId(issue.id, mapping, prefix);

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
