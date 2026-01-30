/**
 * `tbd show` - Show issue details.
 *
 * See: tbd-design.md §4.4 Show
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { NotFoundError } from '../lib/errors.js';
import { loadFullContext } from '../lib/data-context.js';
import { readIssue } from '../../file/storage.js';
import { serializeIssue } from '../../file/parser.js';
import { formatPriority, getPriorityColor } from '../../lib/priority.js';
import { getStatusColor } from '../../lib/status.js';
import type { IssueStatusType } from '../../lib/types.js';

interface ShowOptions {
  showOrder?: boolean;
}

class ShowHandler extends BaseCommand {
  async run(id: string, command: Command, options: ShowOptions): Promise<void> {
    // Load unified context with data and helpers
    const ctx = await loadFullContext(command);

    // Resolve input ID to internal ID using helper
    const internalId = ctx.resolveId(id);

    let issue;
    try {
      issue = await readIssue(ctx.dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Format display ID using helper (respects debug mode automatically)
    const displayId = ctx.displayId(issue.id);

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
        } else if (line.startsWith('spec_path:')) {
          console.log(`${colors.dim('spec_path:')} ${colors.id(line.slice(11))}`);
        } else if (line.startsWith('## Notes')) {
          console.log(colors.bold(line));
        } else if (line.startsWith('  - ')) {
          console.log(`  - ${colors.label(line.slice(4))}`);
        } else {
          console.log(line);
        }
      }

      // Show child_order_hints if --show-order is specified
      if (options.showOrder) {
        console.log('');
        console.log(colors.dim('child_order_hints:'));
        if (issue.child_order_hints && issue.child_order_hints.length > 0) {
          for (const hintId of issue.child_order_hints) {
            const shortId = ctx.displayId(hintId);
            console.log(`  - ${colors.id(shortId)}`);
          }
        } else {
          console.log(`  ${colors.dim('(none)')}`);
        }
      }
    });
  }
}

export const showCommand = new Command('show')
  .description('Show issue details')
  .argument('<id>', 'Issue ID')
  .option('--show-order', 'Display children ordering hints')
  .action(async (id, options, command) => {
    const handler = new ShowHandler(command);
    await handler.run(id, command, options);
  });
