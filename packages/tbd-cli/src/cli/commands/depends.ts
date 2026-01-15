/**
 * `tbd depends` - Dependency management commands.
 *
 * See: tbd-design-v3.md §4.6 Dependency Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

// Add dependency
class DependsAddHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    if (this.checkDryRun('Would add dependency', { id, targetId })) {
      return;
    }
    // TODO: Implement depends add
    this.output.success(`${id} now blocks ${targetId}`);
  }
}

// Remove dependency
class DependsRemoveHandler extends BaseCommand {
  async run(id: string, targetId: string): Promise<void> {
    if (this.checkDryRun('Would remove dependency', { id, targetId })) {
      return;
    }
    // TODO: Implement depends remove
    this.output.success(`Removed dependency: ${id} no longer blocks ${targetId}`);
  }
}

// List dependencies
class DependsListHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    // TODO: Implement depends list
    const mockDeps = { blocks: ['bd-f14c3d'], blockedBy: [] };
    this.output.data(mockDeps, () => {
      const colors = this.output.getColors();
      if (mockDeps.blocks.length > 0) {
        console.log(`${colors.bold('Blocks:')} ${mockDeps.blocks.join(', ')}`);
      }
      if (mockDeps.blockedBy.length > 0) {
        console.log(`${colors.bold('Blocked by:')} ${mockDeps.blockedBy.join(', ')}`);
      }
      if (mockDeps.blocks.length === 0 && mockDeps.blockedBy.length === 0) {
        console.log('No dependencies');
      }
    });
  }
}

const addCommand = new Command('add')
  .description('Add a blocks dependency')
  .argument('<id>', 'Issue ID that blocks')
  .argument('<target>', 'Issue ID that is blocked')
  .action(async (id, target, _options, command) => {
    const handler = new DependsAddHandler(command);
    await handler.run(id, target);
  });

const removeCommand = new Command('remove')
  .description('Remove a blocks dependency')
  .argument('<id>', 'Issue ID')
  .argument('<target>', 'Target issue ID')
  .action(async (id, target, _options, command) => {
    const handler = new DependsRemoveHandler(command);
    await handler.run(id, target);
  });

const listDepsCommand = new Command('list')
  .description('List dependencies for an issue')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new DependsListHandler(command);
    await handler.run(id);
  });

export const dependsCommand = new Command('depends')
  .description('Manage issue dependencies')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listDepsCommand);
