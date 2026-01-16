/**
 * `tbd show` - Show issue details.
 *
 * See: tbd-design-v3.md §4.4 Show
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { readIssue } from '../../file/storage.js';
import { serializeIssue } from '../../file/parser.js';
import { normalizeIssueId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

class ShowHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    // Normalize the input ID
    const normalizedId = normalizeIssueId(id);

    let issue;
    try {
      const dataSyncDir = await resolveDataSyncDir();
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Create display version with bd- prefix for Beads compatibility
    const displayIssue = {
      ...issue,
      displayId: `bd-${issue.id.slice(3)}`,
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
          const status = line.slice(8).trim();
          const statusColor = this.getStatusColor(status);
          console.log(`${colors.dim('status:')} ${statusColor(status)}`);
        } else if (line.startsWith('priority:')) {
          const priority = line.slice(10).trim();
          const priorityColor = this.getPriorityColor(parseInt(priority, 10));
          console.log(`${colors.dim('priority:')} ${priorityColor(priority)}`);
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

  private getStatusColor(status: string): (s: string) => string {
    const colors = this.output.getColors();
    switch (status) {
      case 'open':
        return colors.info;
      case 'in_progress':
        return colors.success;
      case 'blocked':
        return colors.error;
      case 'deferred':
        return colors.dim;
      case 'closed':
        return colors.dim;
      default:
        return (s) => s;
    }
  }

  private getPriorityColor(priority: number): (s: string) => string {
    const colors = this.output.getColors();
    switch (priority) {
      case 0:
        return colors.error; // Critical
      case 1:
        return colors.warn; // High
      default:
        return (s) => s;
    }
  }
}

export const showCommand = new Command('show')
  .description('Show issue details')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new ShowHandler(command);
    await handler.run(id);
  });
