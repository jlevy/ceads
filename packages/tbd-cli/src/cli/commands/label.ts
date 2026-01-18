/**
 * `tbd label` - Label management commands.
 *
 * See: tbd-design-spec.md §4.5 Label Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotFoundError, NotInitializedError } from '../lib/errors.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';

// Add label
class LabelAddHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
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

    if (this.checkDryRun('Would add labels', { id: internalId, labels })) {
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
    issue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping, prefix)
      : formatDisplayId(issue.id, mapping, prefix);

    this.output.data({ id: displayId, addedLabels: labels }, () => {
      this.output.success(`Added labels to ${displayId}: ${labels.join(', ')}`);
    });
  }
}

// Remove label
class LabelRemoveHandler extends BaseCommand {
  async run(id: string, labels: string[]): Promise<void> {
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

    if (this.checkDryRun('Would remove labels', { id: internalId, labels })) {
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
    issue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping, prefix)
      : formatDisplayId(issue.id, mapping, prefix);

    this.output.data({ id: displayId, removedLabels: labels }, () => {
      this.output.success(`Removed labels from ${displayId}: ${labels.join(', ')}`);
    });
  }
}

// List labels
class LabelListHandler extends BaseCommand {
  async run(): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load all issues and collect unique labels
    let issues;
    try {
      issues = await listIssues(dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
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
