/**
 * `tbd reference` - Find and output reference documents.
 *
 * References are API docs, data model docs, and other reference material.
 * Give a name or description and tbd will find the matching reference.
 */

import { Command } from 'commander';

import { DocCommandHandler, type DocCommandOptions } from '../lib/doc-command-handler.js';
import { CLIError } from '../lib/errors.js';
import { getDefaultDocPaths } from '../../lib/paths.js';

class ReferenceHandler extends DocCommandHandler {
  constructor(command: Command) {
    super(command, {
      typeName: 'reference',
      typeNamePlural: 'references',
      paths: getDefaultDocPaths('reference'),
      docType: 'reference',
    });
  }

  async run(query: string | undefined, options: DocCommandOptions): Promise<void> {
    await this.execute(async () => {
      // Add mode
      if (options.add) {
        if (!options.name) {
          throw new CLIError('--name is required when using --add');
        }
        await this.handleAdd(options.add, options.name);
        return;
      }

      await this.initCache();

      // List mode
      if (options.list) {
        await this.handleList(options.all);
        return;
      }

      // No query: show help
      if (!query) {
        await this.handleNoQuery();
        return;
      }

      // Query provided: try exact match first, then fuzzy
      await this.handleQuery(query);
    }, 'Failed to find reference');
  }
}

export const referenceCommand = new Command('reference')
  .description('Find and output reference documents')
  .argument('[query]', 'Reference name or description to search for')
  .option('--list', 'List all available references')
  .option('--all', 'Include shadowed references (use with --list)')
  .option('--add <url>', 'Add a reference from a URL')
  .option('--name <name>', 'Name for the added reference (required with --add)')
  .action(async (query: string | undefined, options: DocCommandOptions, command) => {
    const handler = new ReferenceHandler(command);
    await handler.run(query, options);
  });
