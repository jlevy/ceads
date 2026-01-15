/**
 * `tbd attic` - Attic (conflict archive) commands.
 *
 * See: tbd-design-v3.md §4.11 Attic Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

// List attic entries
class AtticListHandler extends BaseCommand {
  async run(id?: string): Promise<void> {
    // TODO: Implement attic list
    const entries = [
      {
        id: 'is-a1b2c3',
        timestamp: '2025-01-07T10:30:00Z',
        field: 'description',
        winner: 'remote',
      },
    ];

    this.output.data(entries, () => {
      const colors = this.output.getColors();
      if (entries.length === 0) {
        console.log('No attic entries');
        return;
      }
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('TIMESTAMP'.padEnd(22))}${colors.dim('FIELD'.padEnd(14))}${colors.dim('WINNER')}`,
      );
      for (const entry of entries) {
        console.log(
          `${colors.id(entry.id.padEnd(12))}${entry.timestamp.padEnd(22)}${entry.field.padEnd(14)}${entry.winner}`,
        );
      }
    });
  }
}

// Show attic entry
class AtticShowHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    // TODO: Implement attic show
    const entry = {
      entity_id: id,
      timestamp,
      field: 'description',
      lost_value: 'Original description content that was overwritten.',
      winner_source: 'remote',
      loser_source: 'local',
      context: {
        local_version: 3,
        remote_version: 3,
        local_updated_at: '2025-01-07T10:25:00Z',
        remote_updated_at: '2025-01-07T10:28:00Z',
      },
    };

    this.output.data(entry, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('Entity:')} ${entry.entity_id}`);
      console.log(`${colors.bold('Timestamp:')} ${entry.timestamp}`);
      console.log(`${colors.bold('Field:')} ${entry.field}`);
      console.log(`${colors.bold('Winner:')} ${entry.winner_source}`);
      console.log(`${colors.bold('Lost value:')}`);
      console.log(entry.lost_value);
    });
  }
}

// Restore from attic
class AtticRestoreHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    if (this.checkDryRun('Would restore from attic', { id, timestamp })) {
      return;
    }
    // TODO: Implement attic restore
    this.output.success(`Restored ${id} from attic entry ${timestamp}`);
  }
}

const listAtticCommand = new Command('list')
  .description('List attic entries')
  .argument('[id]', 'Filter by issue ID')
  .action(async (id, _options, command) => {
    const handler = new AtticListHandler(command);
    await handler.run(id);
  });

const showAtticCommand = new Command('show')
  .description('Show attic entry details')
  .argument('<id>', 'Issue ID')
  .argument('<timestamp>', 'Entry timestamp')
  .action(async (id, timestamp, _options, command) => {
    const handler = new AtticShowHandler(command);
    await handler.run(id, timestamp);
  });

const restoreAtticCommand = new Command('restore')
  .description('Restore lost value from attic')
  .argument('<id>', 'Issue ID')
  .argument('<timestamp>', 'Entry timestamp')
  .action(async (id, timestamp, _options, command) => {
    const handler = new AtticRestoreHandler(command);
    await handler.run(id, timestamp);
  });

export const atticCommand = new Command('attic')
  .description('Manage conflict archive (attic)')
  .addCommand(listAtticCommand)
  .addCommand(showAtticCommand)
  .addCommand(restoreAtticCommand);
