/**
 * Shared data context for tbd commands.
 *
 * Provides a single point to load common data needed by most commands:
 * - dataSyncDir: the path to the data sync directory
 * - mapping: the ID mapping (ULID to short ID)
 * - config: the project configuration
 * - prefix: the display prefix (from config.display.id_prefix)
 *
 * This eliminates the repetitive pattern of loading these individually in each command.
 *
 * For unified CLI + data context with helper methods, use FullCommandContext and
 * loadFullContext() which adds displayId() and other conveniences.
 */

import type { Command } from 'commander';
import type { IdMapping } from '../../file/id-mapping.js';
import { loadIdMapping, resolveToInternalId } from '../../file/id-mapping.js';
import { readConfig } from '../../file/config.js';
import type { Config } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { CommandContext } from './context.js';
import { getCommandContext } from './context.js';
import { requireInit, NotFoundError } from './errors.js';

/**
 * Data context containing commonly needed data for tbd commands.
 */
export interface TbdDataContext {
  /** Path to the data sync directory */
  dataSyncDir: string;
  /** ID mapping (ULID to short ID and vice versa) */
  mapping: IdMapping;
  /** Project configuration */
  config: Config;
  /** Display prefix from config (convenience accessor) */
  prefix: string;
}

/**
 * Full command context combining CLI options with data context.
 * Provides unified access to all command needs with helper methods.
 */
export interface FullCommandContext extends TbdDataContext {
  /** CLI options (dryRun, verbose, json, debug, etc.) */
  cli: CommandContext;
  /**
   * Format an internal issue ID for display.
   * Automatically respects debug mode to show full internal ID.
   */
  displayId(internalId: string): string;
  /**
   * Resolve user input ID to internal ID.
   * @throws NotFoundError if the ID cannot be resolved
   */
  resolveId(inputId: string): string;
}

/**
 * Load all common data context needed by tbd commands.
 *
 * This loads:
 * - dataSyncDir from resolveDataSyncDir()
 * - mapping from loadIdMapping()
 * - config from readConfig()
 * - prefix from config.display.id_prefix
 *
 * Call this once at the start of a command handler instead of
 * loading each piece separately.
 *
 * @throws Error if any of the resources fail to load
 */
export async function loadDataContext(): Promise<TbdDataContext> {
  const dataSyncDir = await resolveDataSyncDir();
  const [mapping, config] = await Promise.all([
    loadIdMapping(dataSyncDir),
    readConfig(process.cwd()),
  ]);

  return {
    dataSyncDir,
    mapping,
    config,
    prefix: config.display.id_prefix,
  };
}

/**
 * Load unified command context with CLI options, data, and helper methods.
 *
 * This is the recommended way to initialize command context. It:
 * 1. Checks that tbd is initialized (calls requireInit)
 * 2. Loads data context (dataSyncDir, mapping, config, prefix)
 * 3. Extracts CLI context from Commander
 * 4. Provides helper methods like displayId() and resolveId()
 *
 * Usage:
 * ```ts
 * class MyHandler extends BaseCommand {
 *   async run(id: string): Promise<void> {
 *     const ctx = await loadFullContext(this.command);
 *     const internalId = ctx.resolveId(id);
 *     const issue = await readIssue(ctx.dataSyncDir, internalId);
 *     console.log(ctx.displayId(issue.id));
 *   }
 * }
 * ```
 *
 * @param command - The Commander command instance
 * @throws Error if tbd is not initialized or resources fail to load
 */
export async function loadFullContext(command: Command): Promise<FullCommandContext> {
  await requireInit();

  const cli = getCommandContext(command);
  const dataCtx = await loadDataContext();

  return {
    ...dataCtx,
    cli,
    displayId(internalId: string): string {
      return cli.debug
        ? formatDebugId(internalId, dataCtx.mapping, dataCtx.prefix)
        : formatDisplayId(internalId, dataCtx.mapping, dataCtx.prefix);
    },
    resolveId(inputId: string): string {
      try {
        return resolveToInternalId(inputId, dataCtx.mapping);
      } catch {
        throw new NotFoundError('Issue', inputId);
      }
    },
  };
}
