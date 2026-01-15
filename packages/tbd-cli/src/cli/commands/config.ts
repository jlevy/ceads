/**
 * `tbd config` - Configuration management.
 *
 * See: tbd-design-v3.md §4.9 Config
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

// Show config
class ConfigShowHandler extends BaseCommand {
  async run(): Promise<void> {
    // TODO: Implement config show
    const config = {
      tbd_version: '3.0.0',
      sync: { branch: 'tbd-sync', remote: 'origin' },
      display: { id_prefix: 'bd' },
      settings: { auto_sync: false, index_enabled: true },
    };

    this.output.data(config, () => {
      // Output as YAML
      console.log('tbd_version:', config.tbd_version);
      console.log('sync:');
      console.log('  branch:', config.sync.branch);
      console.log('  remote:', config.sync.remote);
      console.log('display:');
      console.log('  id_prefix:', config.display.id_prefix);
      console.log('settings:');
      console.log('  auto_sync:', config.settings.auto_sync);
      console.log('  index_enabled:', config.settings.index_enabled);
    });
  }
}

// Set config value
class ConfigSetHandler extends BaseCommand {
  async run(key: string, value: string): Promise<void> {
    if (this.checkDryRun('Would set config', { key, value })) {
      return;
    }
    // TODO: Implement config set
    this.output.success(`Set ${key} = ${value}`);
  }
}

// Get config value
class ConfigGetHandler extends BaseCommand {
  async run(key: string): Promise<void> {
    // TODO: Implement config get
    const value = 'tbd-sync'; // mock
    this.output.data({ key, value }, () => {
      console.log(value);
    });
  }
}

const showConfigCommand = new Command('show')
  .description('Show all configuration')
  .action(async (_options, command) => {
    const handler = new ConfigShowHandler(command);
    await handler.run();
  });

const setConfigCommand = new Command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g., sync.branch)')
  .argument('<value>', 'Value to set')
  .action(async (key, value, _options, command) => {
    const handler = new ConfigSetHandler(command);
    await handler.run(key, value);
  });

const getConfigCommand = new Command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action(async (key, _options, command) => {
    const handler = new ConfigGetHandler(command);
    await handler.run(key);
  });

export const configCommand = new Command('config')
  .description('Manage configuration')
  .addCommand(showConfigCommand)
  .addCommand(setConfigCommand)
  .addCommand(getConfigCommand);
