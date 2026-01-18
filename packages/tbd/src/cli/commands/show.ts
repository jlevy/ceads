/**
 * `tbd show` - Show issue details.
 *
 * See: tbd-design-spec.md §4.4 Show
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotFoundError } from '../lib/errors.js';
import { readIssue } from '../../file/storage.js';
import { serializeIssue } from '../../file/parser.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';
import { formatPriority, getPriorityColor } from '../../lib/priority.js';
import { getStatusColor } from '../../lib/status.js';
import type { IssueStatusType } from '../../lib/types.js';

class ShowHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution and display
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping, prefix)
      : formatDisplayId(issue.id, mapping, prefix);

    // Create display version with short display ID
    const displayIssue = {
      ...issue,
      displayId,
    };

    this.output.data(displayIssue, () => {
      const colors = this.output.getColors();

      // Output as YAML+Markdown format (same as storage format)
      const serialized = serializeIssue(issue);

      // Add some color highlighting for text output
      const lines = serialized.split('\n');
      for (const line of lines) {
        if (line === '---') {
          console.log(colors.dim(line));
        } else if (line.startsWith('id:')) {
          console.log(`${colors.dim('id:')} ${colors.id(line.slice(4))}`);
        } else if (line.startsWith('status:')) {
          const status = line.slice(8).trim() as IssueStatusType;
          const statusColor = getStatusColor(status, colors);
          console.log(`${colors.dim('status:')} ${statusColor(status)}`);
        } else if (line.startsWith('priority:')) {
          const priority = parseInt(line.slice(10).trim(), 10);
          const priorityColor = getPriorityColor(priority, colors);
          console.log(`${colors.dim('priority:')} ${priorityColor(formatPriority(priority))}`);
        } else if (line.startsWith('title:')) {
          console.log(`${colors.dim('title:')} ${colors.bold(line.slice(7))}`);
        } else if (line.startsWith('## Notes')) {
          console.log(colors.bold(line));
        } else if (line.startsWith('  - ')) {
          console.log(`  - ${colors.label(line.slice(4))}`);
        } else {
          console.log(line);
        }
      }
    });
  }
}

export const showCommand = new Command('show')
  .description('Show issue details')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new ShowHandler(command);
    await handler.run(id);
  });
