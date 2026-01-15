/**
 * `tbd show` - Show issue details.
 *
 * See: tbd-design-v3.md §4.4 Show
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

class ShowHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    // TODO: Implement show
    // 1. Resolve partial ID to full ID
    // 2. Load issue from worktree
    // 3. Format as YAML+Markdown or JSON

    const mockIssue = {
      type: 'is',
      id: 'is-a1b2c3',
      version: 3,
      kind: 'bug',
      title: 'Fix authentication timeout',
      status: 'in_progress',
      priority: 1,
      assignee: 'alice',
      labels: ['backend', 'security'],
      dependencies: [],
      parent_id: null,
      created_at: '2025-01-07T10:00:00Z',
      updated_at: '2025-01-08T14:30:00Z',
      created_by: 'alice',
      closed_at: null,
      close_reason: null,
      due_date: null,
      deferred_until: null,
      extensions: {},
      description: 'Users are being logged out after exactly 5 minutes of inactivity.',
      notes: 'Found the issue in session.ts line 42. Working on fix.',
    };

    this.output.data(mockIssue, () => {
      // Output as YAML+Markdown format
      console.log('---');
      console.log(`type: ${mockIssue.type}`);
      console.log(`id: ${mockIssue.id}`);
      console.log(`version: ${mockIssue.version}`);
      console.log(`kind: ${mockIssue.kind}`);
      console.log(`title: ${mockIssue.title}`);
      console.log(`status: ${mockIssue.status}`);
      console.log(`priority: ${mockIssue.priority}`);
      console.log(`assignee: ${mockIssue.assignee}`);
      console.log('labels:');
      for (const label of mockIssue.labels) {
        console.log(`  - ${label}`);
      }
      console.log('---');
      console.log('');
      console.log(mockIssue.description);
      if (mockIssue.notes) {
        console.log('');
        console.log('## Notes');
        console.log('');
        console.log(mockIssue.notes);
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
