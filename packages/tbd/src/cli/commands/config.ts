/**
 * `tbd config` - Configuration management.
 *
 * See: tbd-design.md §4.9 Config
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotInitializedError, ValidationError } from '../lib/errors.js';
import { readConfig, writeConfig } from '../../file/config.js';
import type { Config } from '../../lib/types.js';

// Show config
class ConfigShowHandler extends BaseCommand {
  async run(): Promise<void> {
    const tbdRoot = await requireInit();

    let config: Config;
    try {
      config = await readConfig(tbdRoot);
    } catch {
      throw new NotInitializedError('No configuration found. Run `tbd init` first.');
    }

    this.output.data(config, () => {
      // Output as YAML format
      const colors = this.output.getColors();
      console.log(`${colors.dim('tbd_version:')} ${config.tbd_version}`);
      console.log(`${colors.dim('sync:')}`);
      console.log(`  ${colors.dim('branch:')} ${config.sync.branch}`);
      console.log(`  ${colors.dim('remote:')} ${config.sync.remote}`);
      console.log(`${colors.dim('display:')}`);
      console.log(`  ${colors.dim('id_prefix:')} ${config.display.id_prefix}`);
      console.log(`${colors.dim('settings:')}`);
      console.log(`  ${colors.dim('auto_sync:')} ${config.settings.auto_sync}`);
    });
  }
}

// Set config value
class ConfigSetHandler extends BaseCommand {
  async run(key: string, value: string): Promise<void> {
    const tbdRoot = await requireInit();

    let config: Config;
    try {
      config = await readConfig(tbdRoot);
    } catch {
      throw new NotInitializedError('No configuration found. Run `tbd init` first.');
    }

    if (this.checkDryRun('Would set config', { key, value })) {
      return;
    }

    // Parse the key path and set value
    const keys = key.split('.');
    const parsedValue = this.parseValue(value);

    try {
      this.setNestedValue(config, keys, parsedValue);
    } catch {
      throw new ValidationError(`Invalid key: ${key}`);
    }

    await this.execute(async () => {
      await writeConfig(tbdRoot, config);
    }, 'Failed to write config');

    this.output.success(`Set ${key} = ${value}`);
  }

  private parseValue(value: string): unknown {
    // Parse boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    // Parse number
    const num = Number(value);
    if (!isNaN(num)) return num;
    // Return as string
    return value;
  }

  private setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (typeof current[key] !== 'object' || current[key] === null) {
        throw new Error(`Invalid path: ${keys.slice(0, i + 1).join('.')}`);
      }
      current = current[key] as Record<string, unknown>;
    }
    const lastKey = keys[keys.length - 1]!;
    if (!(lastKey in current)) {
      throw new Error(`Unknown key: ${keys.join('.')}`);
    }
    current[lastKey] = value;
  }
}

// Get config value
class ConfigGetHandler extends BaseCommand {
  async run(key: string): Promise<void> {
    const tbdRoot = await requireInit();

    let config: Config;
    try {
      config = await readConfig(tbdRoot);
    } catch {
      throw new NotInitializedError('No configuration found. Run `tbd init` first.');
    }

    const keys = key.split('.');
    let value: unknown = config;

    for (const k of keys) {
      if (typeof value !== 'object' || value === null || !(k in value)) {
        throw new ValidationError(`Unknown key: ${key}`);
      }
      value = (value as Record<string, unknown>)[k];
    }

    this.output.data({ key, value }, () => {
      console.log(String(value));
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
