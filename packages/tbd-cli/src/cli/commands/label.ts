/**
 * `tbd label` - Label management commands.
 *
 * See: tbd-design-v3.md §4.5 Label Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

// Add label
class LabelAddHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
    if (this.checkDryRun('Would add labels', { id, labels })) {
      return;
    }
    // TODO: Implement label add
    this.output.success(`Added labels to ${id}: ${labels.join(', ')}`);
  }
}

// Remove label
class LabelRemoveHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
    if (this.checkDryRun('Would remove labels', { id, labels })) {
      return;
    }
    // TODO: Implement label remove
    this.output.success(`Removed labels from ${id}: ${labels.join(', ')}`);
  }
}

// List labels
class LabelListHandler extends BaseCommand {
  async run(): Promise<void> {
    // TODO: Implement label list - enumerate all labels in use
    const mockLabels = ['backend', 'frontend', 'security', 'docs'];
    this.output.data(mockLabels, () => {
      for (const label of mockLabels) {
        console.log(label);
      }
    });
  }
}

const addCommand = new Command('add')
  .description('Add labels to an issue')
  .argument('<id>', 'Issue ID')
  .argument('<labels...>', 'Labels to add')
  .action(async (id, labels, _options, command) => {
    const handler = new LabelAddHandler(command);
    await handler.run(id, labels);
  });

const removeCommand = new Command('remove')
  .description('Remove labels from an issue')
  .argument('<id>', 'Issue ID')
  .argument('<labels...>', 'Labels to remove')
  .action(async (id, labels, _options, command) => {
    const handler = new LabelRemoveHandler(command);
    await handler.run(id, labels);
  });

const listLabelCommand = new Command('list')
  .description('List all labels in use')
  .action(async (_options, command) => {
    const handler = new LabelListHandler(command);
    await handler.run();
  });

export const labelCommand = new Command('label')
  .description('Manage issue labels')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listLabelCommand);
