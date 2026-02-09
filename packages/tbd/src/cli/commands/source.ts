/**
 * `tbd source` - Manage doc sources (repos and internal bundles).
 *
 * Subcommands:
 * - add: Add an external repo source
 * - list: List configured sources
 * - remove: Remove a source by prefix
 *
 * See: docs/project/specs/active/plan-2026-02-02-external-docs-repos.md
 */

import { Command } from 'commander';
import pc from 'picocolors';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, CLIError } from '../lib/errors.js';
import { readConfig, writeConfig } from '../../file/config.js';
import { getAllDocTypeDirectories } from '../../lib/doc-types.js';

// =============================================================================
// Source Management Functions (exported for testing)
// =============================================================================

export interface AddSourceOptions {
  url: string;
  prefix: string;
  ref?: string;
  paths?: string[];
}

/**
 * Add an external repo source to config.
 */
export async function addSource(tbdRoot: string, options: AddSourceOptions): Promise<void> {
  const { url, prefix, ref = 'main', paths } = options;

  // Validate prefix format (1-16 lowercase alphanumeric + dash)
  if (!/^[a-z0-9-]+$/.test(prefix) || prefix.length < 1 || prefix.length > 16) {
    throw new CLIError(
      `Invalid prefix "${prefix}": must be 1-16 lowercase alphanumeric characters or dashes`,
    );
  }

  const config = await readConfig(tbdRoot);
  config.docs_cache ??= { files: {}, lookup_path: [] };
  config.docs_cache.sources ??= [];

  // Check for duplicate prefix
  if (config.docs_cache.sources.some((s) => s.prefix === prefix)) {
    throw new CLIError(`Source with prefix "${prefix}" already exists`);
  }

  // Default paths to all doc type directories
  const sourcePaths = paths ?? getAllDocTypeDirectories();

  config.docs_cache.sources.push({
    type: 'repo',
    prefix,
    url,
    ref,
    paths: sourcePaths,
  });

  await writeConfig(tbdRoot, config);
}

/**
 * List all configured sources.
 */
export async function listSources(
  tbdRoot: string,
): Promise<{ type: string; prefix: string; url?: string; ref?: string; paths: string[] }[]> {
  const config = await readConfig(tbdRoot);
  return config.docs_cache?.sources ?? [];
}

/**
 * Remove a source by prefix.
 */
export async function removeSource(tbdRoot: string, prefix: string): Promise<void> {
  const config = await readConfig(tbdRoot);
  const sources = config.docs_cache?.sources ?? [];

  const idx = sources.findIndex((s) => s.prefix === prefix);
  if (idx === -1) {
    throw new CLIError(`No source with prefix "${prefix}" found`);
  }

  if (sources[idx]!.type === 'internal') {
    throw new CLIError(
      `Cannot remove internal source "${prefix}". Only repo sources can be removed.`,
    );
  }

  sources.splice(idx, 1);
  await writeConfig(tbdRoot, config);
}

// =============================================================================
// CLI Command Handlers
// =============================================================================

class SourceAddHandler extends BaseCommand {
  async run(url: string, options: { prefix: string; ref?: string; paths?: string }): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();

      const paths = options.paths ? options.paths.split(',').map((p) => p.trim()) : undefined;

      await addSource(tbdRoot, {
        url,
        prefix: options.prefix,
        ref: options.ref,
        paths,
      });

      console.log(pc.green(`Added source "${options.prefix}" from ${url}`));
      console.log(pc.dim(`  ref: ${options.ref ?? 'main'}`));
      console.log(pc.dim(`  paths: ${paths ? paths.join(', ') : 'all doc types'}`));
      console.log('');
      console.log('Run `tbd setup --auto` to sync docs from this source.');
    }, 'Failed to add source');
  }
}

class SourceListHandler extends BaseCommand {
  async run(): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      const sources = await listSources(tbdRoot);

      if (sources.length === 0) {
        console.log('No sources configured.');
        return;
      }

      this.output.data(sources, () => {
        for (const source of sources) {
          const typeLabel = source.type === 'internal' ? pc.dim('[internal]') : pc.cyan('[repo]');
          const hidden = (source as { hidden?: boolean }).hidden ? pc.dim(' (hidden)') : '';
          console.log(`${pc.bold(source.prefix)} ${typeLabel}${hidden}`);
          if (source.url) {
            console.log(pc.dim(`  url: ${source.url}`));
          }
          if (source.ref) {
            console.log(pc.dim(`  ref: ${source.ref}`));
          }
          console.log(pc.dim(`  paths: ${source.paths.join(', ')}`));
        }
      });
    }, 'Failed to list sources');
  }
}

class SourceRemoveHandler extends BaseCommand {
  async run(prefix: string): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      await removeSource(tbdRoot, prefix);
      console.log(pc.green(`Removed source "${prefix}"`));
      console.log('Run `tbd setup --auto` to update docs.');
    }, 'Failed to remove source');
  }
}

// =============================================================================
// Command Registration
// =============================================================================

const addCommand = new Command('add')
  .description('Add an external repo source')
  .argument('<url>', 'Repository URL (e.g., github.com/org/repo)')
  .requiredOption('--prefix <prefix>', 'Namespace prefix for this source')
  .option('--ref <ref>', 'Git ref to checkout (default: main)')
  .option('--paths <paths>', 'Comma-separated doc type directories to include')
  .action(async (url: string, options, command) => {
    const handler = new SourceAddHandler(command);
    await handler.run(url, options);
  });

const listCommand = new Command('list')
  .description('List configured doc sources')
  .action(async (_options, command) => {
    const handler = new SourceListHandler(command);
    await handler.run();
  });

const removeCommand = new Command('remove')
  .description('Remove a source by prefix')
  .argument('<prefix>', 'Prefix of the source to remove')
  .action(async (prefix: string, _options, command) => {
    const handler = new SourceRemoveHandler(command);
    await handler.run(prefix);
  });

export const sourceCommand = new Command('source')
  .description('Manage doc sources (repos and internal bundles)')
  .addCommand(addCommand)
  .addCommand(listCommand)
  .addCommand(removeCommand);
