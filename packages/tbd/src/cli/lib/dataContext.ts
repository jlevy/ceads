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
 */

import type { IdMapping } from '../../file/idMapping.js';
import { loadIdMapping } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';
import type { Config } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';

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
