/**
 * `tbd create` - Create a new issue.
 *
 * See: tbd-design-v3.md §4.4 Create
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import type { IssueKindType } from '../../lib/types.js';

interface CreateOptions {
  fromFile?: string;
  type?: IssueKindType;
  priority?: string;
  description?: string;
  file?: string;
  assignee?: string;
  due?: string;
  defer?: string;
  parent?: string;
  label?: string[];
}

class CreateHandler extends BaseCommand {
  async run(title: string | undefined, options: CreateOptions): Promise<void> {
    if (this.checkDryRun('Would create issue', { title, ...options })) {
      return;
    }

    // TODO: Implement issue creation
    // 1. Generate ID
    // 2. Create issue file
    // 3. Sync if enabled

    const mockId = 'bd-a1b2c3';
    this.output.data({ id: mockId, title }, () => {
      this.output.success(`Created ${mockId}: ${title}`);
    });
  }
}

export const createCommand = new Command('create')
  .description('Create a new issue')
  .argument('[title]', 'Issue title')
  .option('--from-file <path>', 'Create from YAML+Markdown file')
  .option('-t, --type <type>', 'Issue type: bug, feature, task, epic, chore', 'task')
  .option('-p, --priority <0-4>', 'Priority (0=critical, 4=lowest)', '2')
  .option('-d, --description <text>', 'Description')
  .option('-f, --file <path>', 'Read description from file')
  .option('--assignee <name>', 'Assignee')
  .option('--due <date>', 'Due date (ISO8601)')
  .option('--defer <date>', 'Defer until date (ISO8601)')
  .option('--parent <id>', 'Parent issue ID')
  .option('-l, --label <label>', 'Add label (repeatable)', (val, prev: string[] = []) => [
    ...prev,
    val,
  ])
  .action(async (title, options, command) => {
    const handler = new CreateHandler(command);
    await handler.run(title, options);
  });
