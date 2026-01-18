/**
 * `tbd dep` - Dependency management commands.
 *
 * See: tbd-design-spec.md §4.6 Dependency Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';

// Add dependency: "A depends on B" means B blocks A
class DependsAddHandler extends BaseCommand {
  async run(issueId: string, dependsOnId: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve both IDs to internal IDs
    // issueId = the issue that depends on something
    // dependsOnId = the issue it depends on (the blocker)
    let internalIssueId: string;
    let internalDependsOnId: string;
    try {
      internalIssueId = resolveToInternalId(issueId, mapping);
    } catch {
      throw new NotFoundError('Issue', issueId);
    }
    try {
      internalDependsOnId = resolveToInternalId(dependsOnId, mapping);
    } catch {
      throw new NotFoundError('Issue', dependsOnId);
    }

    // Verify issueId exists
    try {
      await readIssue(dataSyncDir, internalIssueId);
    } catch {
      throw new NotFoundError('Issue', issueId);
    }

    // Load the blocking issue (dependsOnId) - this is where we add the dependency
    let blockerIssue;
    try {
      blockerIssue = await readIssue(dataSyncDir, internalDependsOnId);
    } catch {
      throw new NotFoundError('Issue', dependsOnId);
    }

    // Check for self-reference
    if (internalIssueId === internalDependsOnId) {
      throw new ValidationError('Issue cannot depend on itself');
    }

    if (
      this.checkDryRun('Would add dependency', {
        issue: internalIssueId,
        dependsOn: internalDependsOnId,
      })
    ) {
      return;
    }

    // Check if dependency already exists (dependsOnId blocks issueId)
    const exists = blockerIssue.dependencies.some(
      (dep) => dep.type === 'blocks' && dep.target === internalIssueId,
    );
    if (exists) {
      this.output.info('Dependency already exists');
      return;
    }

    // Add the dependency: dependsOnId blocks issueId
    blockerIssue.dependencies.push({ type: 'blocks', target: internalIssueId });
    blockerIssue.version += 1;
    blockerIssue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, blockerIssue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayIssueId = showDebug
      ? formatDebugId(internalIssueId, mapping, prefix)
      : formatDisplayId(internalIssueId, mapping, prefix);
    const displayDependsOnId = showDebug
      ? formatDebugId(internalDependsOnId, mapping, prefix)
      : formatDisplayId(internalDependsOnId, mapping, prefix);

    this.output.data({ issue: displayIssueId, dependsOn: displayDependsOnId }, () => {
      this.output.success(`${displayIssueId} now depends on ${displayDependsOnId}`);
    });
  }
}

// Remove dependency: "A no longer depends on B" means B no longer blocks A
class DependsRemoveHandler extends BaseCommand {
  async run(issueId: string, dependsOnId: string): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve both IDs to internal IDs
    let internalIssueId: string;
    let internalDependsOnId: string;
    try {
      internalIssueId = resolveToInternalId(issueId, mapping);
    } catch {
      throw new NotFoundError('Issue', issueId);
    }
    try {
      internalDependsOnId = resolveToInternalId(dependsOnId, mapping);
    } catch {
      throw new NotFoundError('Issue', dependsOnId);
    }

    // Load the blocker issue (dependsOnId) - this is where the dependency is stored
    let blockerIssue;
    try {
      blockerIssue = await readIssue(dataSyncDir, internalDependsOnId);
    } catch {
      throw new NotFoundError('Issue', dependsOnId);
    }

    if (
      this.checkDryRun('Would remove dependency', {
        issue: internalIssueId,
        dependsOn: internalDependsOnId,
      })
    ) {
      return;
    }

    // Find and remove the dependency (dependsOnId blocks issueId)
    const initialLength = blockerIssue.dependencies.length;
    blockerIssue.dependencies = blockerIssue.dependencies.filter(
      (dep) => !(dep.type === 'blocks' && dep.target === internalIssueId),
    );

    if (blockerIssue.dependencies.length === initialLength) {
      this.output.info('Dependency not found');
      return;
    }

    blockerIssue.version += 1;
    blockerIssue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, blockerIssue);
    }, 'Failed to update issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const displayIssueId = showDebug
      ? formatDebugId(internalIssueId, mapping, prefix)
      : formatDisplayId(internalIssueId, mapping, prefix);
    const displayDependsOnId = showDebug
      ? formatDebugId(internalDependsOnId, mapping, prefix)
      : formatDisplayId(internalDependsOnId, mapping, prefix);

    this.output.data({ issue: displayIssueId, removed: displayDependsOnId }, () => {
      this.output.success(`${displayIssueId} no longer depends on ${displayDependsOnId}`);
    });
  }
}

// List dependencies
class DependsListHandler extends BaseCommand {
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

    // Load the issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load all issues to find reverse dependencies
    let allIssues: Issue[];
    try {
      allIssues = await listIssues(dataSyncDir);
    } catch {
      allIssues = [];
    }

    const showDebug = this.ctx.debug;
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;

    // Find what this issue blocks (from its dependencies)
    const blocks = issue.dependencies
      .filter((dep) => dep.type === 'blocks')
      .map((dep) =>
        showDebug
          ? formatDebugId(dep.target, mapping, prefix)
          : formatDisplayId(dep.target, mapping, prefix),
      );

    // Find what blocks this issue (reverse lookup)
    const blockedBy: string[] = [];
    for (const other of allIssues) {
      for (const dep of other.dependencies) {
        if (dep.type === 'blocks' && dep.target === internalId) {
          blockedBy.push(
            showDebug
              ? formatDebugId(other.id, mapping, prefix)
              : formatDisplayId(other.id, mapping, prefix),
          );
        }
      }
    }

    const deps = { blocks, blockedBy };
    this.output.data(deps, () => {
      const colors = this.output.getColors();
      if (deps.blocks.length > 0) {
        console.log(`${colors.bold('Blocks:')} ${deps.blocks.join(', ')}`);
      }
      if (deps.blockedBy.length > 0) {
        console.log(`${colors.bold('Blocked by:')} ${deps.blockedBy.join(', ')}`);
      }
      if (deps.blocks.length === 0 && deps.blockedBy.length === 0) {
        console.log('No dependencies');
      }
    });
  }
}

const addCommand = new Command('add')
  .description('Add dependency (issue depends on depends-on)')
  .argument('<issue>', 'Issue ID that depends on something')
  .argument('<depends-on>', 'Issue ID that must be completed first')
  .action(async (issue, dependsOn, _options, command) => {
    const handler = new DependsAddHandler(command);
    await handler.run(issue, dependsOn);
  });

const removeCommand = new Command('remove')
  .description('Remove dependency (issue no longer depends on depends-on)')
  .argument('<issue>', 'Issue ID')
  .argument('<depends-on>', 'Issue ID it depended on')
  .action(async (issue, dependsOn, _options, command) => {
    const handler = new DependsRemoveHandler(command);
    await handler.run(issue, dependsOn);
  });

const listDepsCommand = new Command('list')
  .description('List dependencies for an issue')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new DependsListHandler(command);
    await handler.run(id);
  });

export const depCommand = new Command('dep')
  .description('Manage issue dependencies')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listDepsCommand);
