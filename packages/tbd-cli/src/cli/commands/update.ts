/**
 * `tbd update` - Update an issue.
 *
 * See: tbd-design-v3.md §4.4 Update
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface UpdateOptions {
  fromFile?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  description?: string;
  notes?: string;
  notesFile?: string;
  due?: string;
  defer?: string;
  addLabel?: string[];
  removeLabel?: string[];
  parent?: string;
}

class UpdateHandler extends BaseCommand {
  async run(id: string, options: UpdateOptions): Promise<void> {
    if (this.checkDryRun('Would update issue', { id, ...options })) {
      return;
    }

    // TODO: Implement update
    // 1. Load existing issue
    // 2. Apply updates
    // 3. Save and sync

    this.output.success(`Updated ${id}`);
  }
}

export const updateCommand = new Command('update')
  .description('Update an issue')
  .argument('<id>', 'Issue ID')
  .option('--from-file <path>', 'Update all fields from YAML+Markdown file')
  .option('--status <status>', 'Set status')
  .option('--type <type>', 'Set type')
  .option('--priority <0-4>', 'Set priority')
  .option('--assignee <name>', 'Set assignee')
  .option('--description <text>', 'Set description')
  .option('--notes <text>', 'Set working notes')
  .option('--notes-file <path>', 'Set notes from file')
  .option('--due <date>', 'Set due date')
  .option('--defer <date>', 'Set deferred until date')
  .option('--add-label <label>', 'Add label', (val, prev: string[] = []) => [...prev, val])
  .option('--remove-label <label>', 'Remove label', (val, prev: string[] = []) => [...prev, val])
  .option('--parent <id>', 'Set parent')
  .action(async (id, options, command) => {
    const handler = new UpdateHandler(command);
    await handler.run(id, options);
  });
