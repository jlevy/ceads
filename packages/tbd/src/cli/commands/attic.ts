/**
 * `tbd attic` - Attic (conflict archive) commands.
 *
 * See: tbd-design.md §4.11 Attic Commands
 */

import { Command } from 'commander';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { normalizeIssueId, formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveDataSyncDir, resolveAtticDir } from '../../lib/paths.js';
import { formatTimestampAgo } from '../../lib/format-utils.js';
import { now } from '../../utils/time-utils.js';
import { loadIdMapping } from '../../file/id-mapping.js';
import { readConfig } from '../../file/config.js';
import type { AtticEntry } from '../../lib/types.js';

/**
 * Get attic entry filename from components.
 */
function getAtticFilename(entityId: string, timestamp: string, field: string): string {
  // Convert timestamp colons to hyphens for filesystem safety
  const safeTimestamp = timestamp.replace(/:/g, '-');
  return `${entityId}_${safeTimestamp}_${field}.yml`;
}

/**
 * Parse attic entry filename to components.
 */
function parseAtticFilename(
  filename: string,
): { entityId: string; timestamp: string; field: string } | null {
  // Format: is-abc123_2025-01-07T10-30-00Z_description.yml
  const match = /^(is-[a-f0-9]+)_(.+)_([^_]+)\.yml$/.exec(filename);
  if (!match) return null;
  const [, entityId, timestamp, field] = match;
  // Convert hyphens back to colons in timestamp
  const isoTimestamp = timestamp!.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  return { entityId: entityId!, timestamp: isoTimestamp, field: field! };
}

/**
 * List all attic entries.
 */
async function listAtticEntries(filterById?: string): Promise<AtticEntry[]> {
  const atticPath = await resolveAtticDir();
  let files: string[];

  try {
    files = await readdir(atticPath);
  } catch {
    // Attic directory doesn't exist - return empty
    return [];
  }

  const entries: AtticEntry[] = [];

  for (const file of files) {
    if (!file.endsWith('.yml')) continue;

    const parsed = parseAtticFilename(file);
    if (!parsed) continue;

    // Filter by ID if specified
    if (filterById && parsed.entityId !== filterById) continue;

    try {
      const content = await readFile(join(atticPath, file), 'utf-8');
      const entry = parseYaml(content) as AtticEntry;
      entries.push(entry);
    } catch {
      // Skip invalid files
    }
  }

  // Sort by timestamp descending (most recent first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return entries;
}

/**
 * Save an attic entry.
 */
export async function saveAtticEntry(entry: AtticEntry): Promise<void> {
  const atticPath = await resolveAtticDir();
  await mkdir(atticPath, { recursive: true });

  const filename = getAtticFilename(entry.entity_id, entry.timestamp, entry.field);
  const filepath = join(atticPath, filename);
  const content = stringifyYaml(entry, { sortMapEntries: true });

  await writeFile(filepath, content);
}

// List attic entries
class AtticListHandler extends BaseCommand {
  async run(id?: string): Promise<void> {
    const tbdRoot = await requireInit();

    const filterId = id ? normalizeIssueId(id) : undefined;
    const entries = await listAtticEntries(filterId);

    // Load ID mapping and config for display
    const dataSyncDir = await resolveDataSyncDir(tbdRoot);
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(tbdRoot);
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;

    const output = entries.map((e) => ({
      id: showDebug
        ? formatDebugId(e.entity_id, mapping, prefix)
        : formatDisplayId(e.entity_id, mapping, prefix),
      timestamp: e.timestamp,
      field: e.field,
      winner: e.winner_source,
    }));

    this.output.data(output, () => {
      const colors = this.output.getColors();
      if (output.length === 0) {
        console.log('No attic entries');
        return;
      }
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('WHEN'.padEnd(14))}${colors.dim('FIELD'.padEnd(14))}${colors.dim('WINNER')}`,
      );
      for (const entry of output) {
        const when = formatTimestampAgo(entry.timestamp) ?? entry.timestamp;
        console.log(
          `${colors.id(entry.id.padEnd(12))}${when.padEnd(14)}${entry.field.padEnd(14)}${entry.winner}`,
        );
      }
    });
  }
}

// Show attic entry
class AtticShowHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    const tbdRoot = await requireInit();

    const normalizedId = normalizeIssueId(id);
    const entries = await listAtticEntries(normalizedId);

    // Find entry matching timestamp (approximate match for different formats)
    const entry = entries.find(
      (e) => e.timestamp === timestamp || e.timestamp.replace(/:/g, '-') === timestamp,
    );

    if (!entry) {
      throw new NotFoundError('Attic entry', `${id} at ${timestamp}`);
    }

    // Load ID mapping and config for display
    const dataSyncDir = await resolveDataSyncDir(tbdRoot);
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(tbdRoot);
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(entry.entity_id, mapping, prefix)
      : formatDisplayId(entry.entity_id, mapping, prefix);

    this.output.data(entry, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('Entity:')} ${displayId}`);
      console.log(`${colors.bold('Timestamp:')} ${entry.timestamp}`);
      console.log(`${colors.bold('Field:')} ${entry.field}`);
      console.log(`${colors.bold('Winner:')} ${entry.winner_source}`);
      console.log(`${colors.bold('Loser:')} ${entry.loser_source}`);
      console.log('');
      console.log(`${colors.bold('Lost value:')}`);
      console.log(entry.lost_value);
      console.log('');
      console.log(`${colors.bold('Context:')}`);
      console.log(`  Local version: ${entry.context.local_version}`);
      console.log(`  Remote version: ${entry.context.remote_version}`);
      const localAgo = formatTimestampAgo(entry.context.local_updated_at);
      const remoteAgo = formatTimestampAgo(entry.context.remote_updated_at);
      console.log(`  Local updated: ${localAgo ?? entry.context.local_updated_at}`);
      console.log(`  Remote updated: ${remoteAgo ?? entry.context.remote_updated_at}`);
    });
  }
}

// Restore from attic
class AtticRestoreHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    const tbdRoot = await requireInit();

    const normalizedId = normalizeIssueId(id);
    const entries = await listAtticEntries(normalizedId);

    // Find entry matching timestamp
    const entry = entries.find(
      (e) => e.timestamp === timestamp || e.timestamp.replace(/:/g, '-') === timestamp,
    );

    if (!entry) {
      throw new NotFoundError('Attic entry', `${id} at ${timestamp}`);
    }

    if (this.checkDryRun('Would restore from attic', { id: normalizedId, field: entry.field })) {
      return;
    }

    // Load the current issue
    const dataSyncDir = await resolveDataSyncDir(tbdRoot);
    let issue;
    try {
      issue = await readIssue(dataSyncDir, normalizedId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Restore the field value
    const field = entry.field as keyof typeof issue;
    if (field === 'description' || field === 'notes' || field === 'title') {
      (issue as Record<string, unknown>)[field] = entry.lost_value;
    } else {
      throw new ValidationError(`Cannot restore field: ${entry.field}`);
    }

    issue.version += 1;
    issue.updated_at = now();

    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to restore from attic');

    // Load ID mapping and config for display
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(tbdRoot);
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(normalizedId, mapping, prefix)
      : formatDisplayId(normalizedId, mapping, prefix);

    this.output.success(`Restored ${entry.field} for ${displayId} from attic entry ${timestamp}`);
  }
}

interface AtticListOptions {
  since?: string;
  limit?: string;
}

const listAtticCommand = new Command('list')
  .description('List attic entries')
  .argument('[id]', 'Filter by issue ID')
  .option('--since <date>', 'Entries since date')
  .option('--limit <n>', 'Limit results')
  .action(async (id, options: AtticListOptions, command) => {
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
