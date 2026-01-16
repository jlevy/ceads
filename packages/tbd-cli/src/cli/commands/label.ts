/**
 * `tbd label` - Label management commands.
 *
 * See: tbd-design-v3.md §4.5 Label Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { normalizeIssueId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

// Add label
class LabelAddHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
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

    if (this.checkDryRun('Would add labels', { id: normalizedId, labels })) {
      return;
    }

    // Add labels (avoiding duplicates)
    const labelsSet = new Set(issue.labels);
    let added = 0;
    for (const label of labels) {
      if (!labelsSet.has(label)) {
        labelsSet.add(label);
        added++;
      }
    }

    if (added === 0) {
      this.output.info('All labels already present');
      return;
    }

    issue.labels = [...labelsSet];
    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    const displayId = `bd-${issue.id.slice(3)}`;
    this.output.data({ id: displayId, addedLabels: labels }, () => {
      this.output.success(`Added labels to ${displayId}: ${labels.join(', ')}`);
    });
  }
}

// Remove label
class LabelRemoveHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
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

    if (this.checkDryRun('Would remove labels', { id: normalizedId, labels })) {
      return;
    }

    // Remove labels
    const removeSet = new Set(labels);
    const originalCount = issue.labels.length;
    issue.labels = issue.labels.filter((l) => !removeSet.has(l));
    const removed = originalCount - issue.labels.length;

    if (removed === 0) {
      this.output.info('No matching labels found');
      return;
    }

    issue.version += 1;
    issue.updated_at = new Date().toISOString();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    const displayId = `bd-${issue.id.slice(3)}`;
    this.output.data({ id: displayId, removedLabels: labels }, () => {
      this.output.success(`Removed labels from ${displayId}: ${labels.join(', ')}`);
    });
  }
}

// List labels
class LabelListHandler extends BaseCommand {
  async run(): Promise<void> {
    const dataSyncDir = await resolveDataSyncDir();

    // Load all issues and collect unique labels
    let issues;
    try {
      issues = await listIssues(dataSyncDir);
    } catch {
      this.output.error('No issue store found. Run `tbd init` first.');
      return;
    }

    // Collect labels with counts
    const labelCounts = new Map<string, number>();
    for (const issue of issues) {
      for (const label of issue.labels) {
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }
    }

    // Sort by count (descending), then alphabetically
    const sortedLabels = [...labelCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

    const output = sortedLabels.map(([label, count]) => ({ label, count }));

    this.output.data(output, () => {
      if (output.length === 0) {
        this.output.info('No labels in use');
        return;
      }

      const colors = this.output.getColors();
      console.log(`${colors.dim('LABEL'.padEnd(24))}${colors.dim('COUNT')}`);
      for (const { label, count } of output) {
        console.log(`${colors.label(label.padEnd(24))}${count}`);
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
