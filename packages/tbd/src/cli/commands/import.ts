/**
 * `tbd import` - Import from Beads or other sources.
 *
 * See: tbd-design.md §5.1 Import Strategy
 */

import { Command } from 'commander';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, ValidationError, NotFoundError } from '../lib/errors.js';
import { writeIssue, listIssues } from '../../file/storage.js';
import {
  generateInternalId,
  extractShortId,
  extractUlidFromInternalId,
  makeInternalId,
  extractPrefix,
} from '../../lib/ids.js';
import {
  loadIdMapping,
  saveIdMapping,
  addIdMapping,
  hasShortId,
  generateUniqueShortId,
} from '../../file/id-mapping.js';
import { IssueStatus, IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueStatusType, IssueKindType, DependencyType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now, normalizeTimestamp } from '../../utils/time-utils.js';
import { readConfig, writeConfig } from '../../file/config.js';
import {
  importFromWorkspace,
  type ImportOptions as WorkspaceImportOptions,
} from '../../file/workspace.js';

interface ImportOptions {
  beadsDir?: string;
  merge?: boolean;
  verbose?: boolean;
  validate?: boolean;
  // Workspace import options
  workspace?: string;
  dir?: string;
  outbox?: boolean;
  clearOnSuccess?: boolean;
}

interface ValidationIssue {
  beadsId: string;
  tbdId?: string;
  issue: string;
  severity: 'error' | 'warning';
}

/**
 * Beads issue structure (from JSONL export).
 */
interface BeadsIssue {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  type?: string;
  issue_type?: string;
  status: string;
  priority?: number;
  assignee?: string;
  labels?: string[];
  dependencies?: { type: string; target: string }[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  due?: string;
  defer?: string;
  parent?: string;
}

/**
 * BeadsTotbd mapping: maps beads external ID to tbd internal ID.
 * This is a local structure used during import processing.
 */
type BeadsTotbdMapping = Record<string, string>;

/**
 * Map Beads status to tbd status.
 */
function mapStatus(beadsStatus: string): IssueStatusType {
  const statusMap: Record<string, IssueStatusType> = {
    open: 'open',
    in_progress: 'in_progress',
    blocked: 'blocked',
    deferred: 'deferred',
    done: 'closed', // Beads uses 'done' for completed items
    closed: 'closed',
    tombstone: 'closed',
  };
  const result = IssueStatus.safeParse(statusMap[beadsStatus] ?? beadsStatus);
  return result.success ? result.data : 'open';
}

/**
 * Map Beads issue type to tbd kind.
 */
function mapKind(beadsType?: string): IssueKindType {
  const kindMap: Record<string, IssueKindType> = {
    bug: 'bug',
    feature: 'feature',
    task: 'task',
    epic: 'epic',
    chore: 'chore',
  };
  if (!beadsType) return 'task';
  const result = IssueKind.safeParse(kindMap[beadsType] ?? beadsType);
  return result.success ? result.data : 'task';
}

/**
 * Convert Beads issue to tbd issue.
 */
function convertIssue(beads: BeadsIssue, tbdId: string, depMapping: BeadsTotbdMapping): Issue {
  // Convert dependencies, translating IDs
  const dependencies: DependencyType[] = [];
  if (beads.dependencies) {
    for (const dep of beads.dependencies) {
      if (dep.type === 'blocks' || dep.type === 'blocked_by') {
        const targetId = depMapping[dep.target];
        if (targetId) {
          // "blocked_by" in Beads means the target blocks this issue
          // In tbd, we only have "blocks", so we need to handle this carefully
          // For now, we store "blocks" dependencies directly
          if (dep.type === 'blocks') {
            dependencies.push({ type: 'blocks', target: targetId });
          }
          // Note: blocked_by would need to be added to the target issue's dependencies
        }
      }
    }
  }

  return {
    type: 'is',
    id: tbdId,
    version: 1,
    kind: mapKind(beads.type ?? beads.issue_type),
    title: beads.title,
    description: beads.description,
    notes: beads.notes,
    status: mapStatus(beads.status),
    priority: beads.priority ?? 2,
    assignee: beads.assignee,
    labels: beads.labels ?? [],
    dependencies,
    created_at: normalizeTimestamp(beads.created_at) ?? now(),
    updated_at: normalizeTimestamp(beads.updated_at) ?? now(),
    closed_at: normalizeTimestamp(beads.closed_at),
    close_reason: beads.close_reason ?? null,
    due_date: normalizeTimestamp(beads.due),
    deferred_until: normalizeTimestamp(beads.defer),
    parent_id: beads.parent ? depMapping[beads.parent] : null,
    extensions: {
      beads: {
        original_id: beads.id,
        imported_at: now(),
      },
    },
  };
}

class ImportHandler extends BaseCommand {
  private dataSyncDir = '';

  async run(file: string | undefined, options: ImportOptions): Promise<void> {
    // Check if this is a workspace import
    const isWorkspaceImport =
      options.workspace != null || options.dir != null || options.outbox === true;

    if (isWorkspaceImport) {
      await this.importFromWorkspaceCmd(options);
      return;
    }

    // Validate input first
    if (!file && !options.validate) {
      throw new ValidationError(
        'Provide a JSONL file path to import.\n\n' +
          'For Beads migration, use: tbd setup --from-beads\n' +
          'For workspace import, use: tbd import --workspace=<name> or --outbox',
      );
    }

    // Handle validation mode - requires init
    if (options.validate) {
      await requireInit();
      this.dataSyncDir = await resolveDataSyncDir();
      await this.validateImport(options);
      return;
    }

    // File import requires initialization
    if (file) {
      await requireInit();
      this.dataSyncDir = await resolveDataSyncDir();
      await this.importFromFile(file, options);
    }
  }

  /**
   * Import issues from a workspace.
   */
  private async importFromWorkspaceCmd(options: ImportOptions): Promise<void> {
    const tbdRoot = await requireInit();
    this.dataSyncDir = await resolveDataSyncDir(tbdRoot);

    const wsOptions: WorkspaceImportOptions = {
      workspace: options.workspace,
      dir: options.dir,
      outbox: options.outbox,
      clearOnSuccess: options.clearOnSuccess,
    };

    if (this.checkDryRun('Would import from workspace', wsOptions)) {
      return;
    }

    const spinner = this.output.spinner('Importing from workspace...');

    const result = await this.execute(async () => {
      return await importFromWorkspace(tbdRoot, this.dataSyncDir, wsOptions);
    }, 'Failed to import from workspace');

    spinner.stop();

    if (!result) {
      return;
    }

    // Format output
    const sourceName = options.outbox ? 'outbox' : (options.workspace ?? options.dir ?? 'unknown');

    this.output.data(
      {
        imported: result.imported,
        conflicts: result.conflicts,
        source: sourceName,
        cleared: result.cleared,
      },
      () => {
        if (result.imported === 0) {
          this.output.info('No issues to import');
        } else {
          this.output.success(`Imported ${result.imported} issue(s) from ${sourceName}`);
          if (result.conflicts > 0) {
            this.output.warn(`${result.conflicts} conflict(s) moved to attic`);
          }
          if (result.cleared) {
            this.output.info(`Workspace "${sourceName}" cleared`);
          }
          // Suggest next step
          this.output.info('Run `tbd sync` to commit and push imported issues');
        }
      },
    );
  }

  /**
   * Validate import by comparing Beads source with imported tbd issues.
   * Reports any discrepancies or missing issues.
   */
  private async validateImport(options: ImportOptions): Promise<void> {
    const beadsDir = options.beadsDir ?? '.beads';
    const jsonlPath = join(beadsDir, 'issues.jsonl');

    try {
      await access(jsonlPath);
    } catch {
      throw new NotFoundError('Beads database', `${beadsDir} (use --beads-dir to specify)`);
    }

    console.log('Validating import...\n');

    // Load Beads issues
    const content = await readFile(jsonlPath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((l) => l);
    const beadsIssues: BeadsIssue[] = [];

    for (const line of lines) {
      try {
        const issue = JSON.parse(line) as BeadsIssue;
        if (issue.id && issue.title) {
          beadsIssues.push(issue);
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Load tbd issues and short ID mapping
    const tbdIssues = await this.loadExistingIssues();
    const shortIdMapping = await loadIdMapping(this.dataSyncDir);

    // Build mapping from beads ID to tbd internal ID using preserved short IDs
    // e.g., "tbd-100" -> extract "100" -> lookup in shortIdMapping -> "is-{ulid}"
    const beadsTotbd: BeadsTotbdMapping = {};
    const reverseMapping: Record<string, string> = {};

    for (const beads of beadsIssues) {
      const shortId = extractShortId(beads.id);
      const ulid = shortIdMapping.shortToUlid.get(shortId);
      if (ulid) {
        const internalId = makeInternalId(ulid);
        beadsTotbd[beads.id] = internalId;
        reverseMapping[internalId] = beads.id;
      }
    }

    // Build lookup by tbd ID
    const tbdById = new Map<string, Issue>();
    for (const issue of tbdIssues) {
      tbdById.set(issue.id, issue);
    }

    // Validate each Beads issue
    const issues: ValidationIssue[] = [];
    let validCount = 0;

    for (const beads of beadsIssues) {
      const tbdId = beadsTotbd[beads.id];

      if (!tbdId) {
        issues.push({
          beadsId: beads.id,
          issue: 'Not imported - no ID mapping exists',
          severity: 'error',
        });
        continue;
      }

      const tbdIssue = tbdById.get(tbdId);
      if (!tbdIssue) {
        issues.push({
          beadsId: beads.id,
          tbdId,
          issue: 'ID mapping exists but issue file not found',
          severity: 'error',
        });
        continue;
      }

      // Validate fields
      const fieldIssues: string[] = [];

      if (tbdIssue.title !== beads.title) {
        fieldIssues.push(`title mismatch: "${tbdIssue.title}" vs "${beads.title}"`);
      }

      const expectedStatus = mapStatus(beads.status);
      if (tbdIssue.status !== expectedStatus) {
        fieldIssues.push(`status mismatch: "${tbdIssue.status}" vs expected "${expectedStatus}"`);
      }

      const expectedKind = mapKind(beads.type ?? beads.issue_type);
      if (tbdIssue.kind !== expectedKind) {
        fieldIssues.push(`kind mismatch: "${tbdIssue.kind}" vs expected "${expectedKind}"`);
      }

      if ((beads.priority ?? 2) !== tbdIssue.priority) {
        fieldIssues.push(`priority mismatch: ${tbdIssue.priority} vs ${beads.priority ?? 2}`);
      }

      // Check labels
      const beadsLabels = new Set(beads.labels ?? []);
      const tbdLabels = new Set(tbdIssue.labels ?? []);
      const missingLabels = [...beadsLabels].filter((l) => !tbdLabels.has(l));
      if (missingLabels.length > 0) {
        fieldIssues.push(`missing labels: ${missingLabels.join(', ')}`);
      }

      if (fieldIssues.length > 0) {
        issues.push({
          beadsId: beads.id,
          tbdId,
          issue: fieldIssues.join('; '),
          severity: 'warning',
        });
      } else {
        validCount++;
      }
    }

    // Check for orphaned tbd issues (not in Beads)
    const beadsIds = new Set(beadsIssues.map((b) => b.id));
    for (const tbdIssue of tbdIssues) {
      const beadsId = reverseMapping[tbdIssue.id];
      if (beadsId && !beadsIds.has(beadsId)) {
        issues.push({
          beadsId,
          tbdId: tbdIssue.id,
          issue: 'tbd issue has mapping but Beads issue no longer exists',
          severity: 'warning',
        });
      }
    }

    // Report results
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    console.log('Validation Results');
    console.log('─'.repeat(60));
    console.log(`Total Beads issues:    ${beadsIssues.length}`);
    console.log(`Total tbd issues:      ${tbdIssues.length}`);
    console.log(`Valid imports:         ${validCount}`);
    console.log(`Errors:                ${errors.length}`);
    console.log(`Warnings:              ${warnings.length}`);
    console.log('─'.repeat(60));

    if (errors.length > 0) {
      console.log('\nErrors:');
      for (const err of errors) {
        console.log(`  ✗ ${err.beadsId}: ${err.issue}`);
      }
    }

    if (warnings.length > 0 && options.verbose) {
      console.log('\nWarnings:');
      for (const warn of warnings) {
        console.log(`  ⚠ ${warn.beadsId}: ${warn.issue}`);
      }
    }

    console.log();
    if (errors.length === 0 && warnings.length === 0) {
      this.output.success('All imports validated successfully!');
    } else if (errors.length === 0) {
      this.output.warn(`Validation complete with ${warnings.length} warnings`);
      if (!options.verbose) {
        console.log('  Use --verbose to see warning details');
      }
    } else {
      this.output.error(`Validation failed with ${errors.length} errors`);
    }

    // Output JSON for programmatic use
    this.output.data({
      valid: validCount,
      errors: errors.length,
      warnings: warnings.length,
      total: beadsIssues.length,
      issues: options.verbose ? issues : undefined,
    });
  }

  private async importFromFile(filePath: string, options: ImportOptions): Promise<void> {
    // Check file exists
    try {
      await access(filePath);
    } catch {
      throw new NotFoundError('File', filePath);
    }

    if (this.checkDryRun('Would import issues', { file: filePath })) {
      // For dry run, still parse and show what would happen
      const content = await readFile(filePath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((l) => l);
      this.output.info(`Would import ${lines.length} issues from ${filePath}`);
      return;
    }

    // Load file content
    const content = await readFile(filePath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((l) => l);

    // Parse JSONL
    const beadsIssues: BeadsIssue[] = [];
    for (const line of lines) {
      try {
        const issue = JSON.parse(line) as BeadsIssue;
        if (issue.id && issue.title) {
          beadsIssues.push(issue);
        }
      } catch {
        if (options.verbose) {
          this.output.warn(`Skipping invalid JSON line`);
        }
      }
    }

    if (beadsIssues.length === 0) {
      this.output.info('No valid issues found in file');
      return;
    }

    // Auto-detect prefix from imported issues and update config if needed
    const detectedPrefix = this.detectPrefixFromIssues(beadsIssues);
    await this.updateConfigPrefixIfNeeded(detectedPrefix);

    // Load existing issues and short ID mapping
    const existingIssues = await this.loadExistingIssues();
    const shortIdMapping = await loadIdMapping(this.dataSyncDir);

    // Build lookup maps
    const existingByBeadsId = new Map<string, Issue>();
    const existingByShortId = new Map<string, Issue>();

    // Build reverse lookup from extensions and from short ID mapping
    for (const issue of existingIssues) {
      const beadsExt = issue.extensions?.beads as { original_id?: string } | undefined;
      if (beadsExt?.original_id) {
        existingByBeadsId.set(beadsExt.original_id, issue);
      }
      // Also track by short ID
      const ulid = extractUlidFromInternalId(issue.id);
      const shortId = shortIdMapping.ulidToShort.get(ulid);
      if (shortId) {
        existingByShortId.set(shortId, issue);
      }
    }

    // Build beads-to-tbd mapping, preserving original short IDs
    // e.g., "tbd-100" preserves "100" as the short ID
    const beadsTotbd: BeadsTotbdMapping = {};

    // First pass: assign IDs to all issues (needed for dependency translation)
    for (const beads of beadsIssues) {
      // Extract the short ID from beads ID (e.g., "tbd-100" -> "100")
      const shortId = extractShortId(beads.id);

      // Check if we already have this issue by beads ID (from previous import)
      const existingByBeads = existingByBeadsId.get(beads.id);
      if (existingByBeads) {
        beadsTotbd[beads.id] = existingByBeads.id;
        continue;
      }

      // Check if we already have a mapping for this short ID
      const existingByShort = existingByShortId.get(shortId);
      if (existingByShort) {
        beadsTotbd[beads.id] = existingByShort.id;
        continue;
      }

      // Check if the short ID is already in the mapping (collision check)
      if (hasShortId(shortIdMapping, shortId)) {
        // Short ID already exists but for a different issue - generate a new one
        if (options.verbose) {
          this.output.warn(
            `Short ID "${shortId}" already exists, generating new ID for ${beads.id}`,
          );
        }
        const internalId = generateInternalId();
        beadsTotbd[beads.id] = internalId;
        // Generate a random short ID since the original is taken
        const ulid = extractUlidFromInternalId(internalId);
        const newShortId = generateUniqueShortId(shortIdMapping);
        addIdMapping(shortIdMapping, ulid, newShortId);
      } else {
        // Create new mapping, preserving the original short ID
        const internalId = generateInternalId();
        beadsTotbd[beads.id] = internalId;
        const ulid = extractUlidFromInternalId(internalId);
        addIdMapping(shortIdMapping, ulid, shortId);
      }
    }

    // Second pass: convert and save issues
    let imported = 0;
    let skipped = 0;
    let merged = 0;

    for (const beads of beadsIssues) {
      const tbdId = beadsTotbd[beads.id]!;
      const existing = existingByBeadsId.get(beads.id);

      if (existing && !options.merge) {
        // Check if Beads is newer
        if (new Date(beads.updated_at) <= new Date(existing.updated_at)) {
          skipped++;
          continue;
        }
      }

      const issue = convertIssue(beads, tbdId, beadsTotbd);

      if (existing) {
        // Merge: keep higher version, update fields
        issue.version = existing.version + 1;
        merged++;
      } else {
        imported++;
      }

      try {
        await writeIssue(this.dataSyncDir, issue);
      } catch (error) {
        if (options.verbose) {
          this.output.warn(`Failed to write issue ${beads.id}: ${(error as Error).message}`);
        }
      }
    }

    // Save updated short ID mapping (no separate beads.yml needed - IDs are preserved)
    await saveIdMapping(this.dataSyncDir, shortIdMapping);

    const result = { imported, skipped, merged, total: beadsIssues.length };

    this.output.data(result, () => {
      this.output.success(`Import complete from ${filePath}`);
      console.log(`  New issues:   ${imported}`);
      console.log(`  Merged:       ${merged}`);
      console.log(`  Skipped:      ${skipped}`);
    });
  }

  private async loadExistingIssues(): Promise<Issue[]> {
    try {
      return await listIssues(this.dataSyncDir);
    } catch {
      return [];
    }
  }

  /**
   * Detect the prefix used by beads issues from a file path.
   * Reads the first few issues and extracts the common prefix pattern.
   * Falls back to 'tbd' if no consistent prefix is found.
   */
  private async detectBeadsPrefix(jsonlPath: string): Promise<string> {
    try {
      const content = await readFile(jsonlPath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((l) => l)
        .slice(0, 10); // Sample first 10 issues

      const issues: BeadsIssue[] = [];
      for (const line of lines) {
        try {
          const issue = JSON.parse(line) as BeadsIssue;
          if (issue.id) {
            issues.push(issue);
          }
        } catch {
          // Skip invalid lines
        }
      }

      return this.detectPrefixFromIssues(issues);
    } catch {
      return 'tbd'; // Default fallback
    }
  }

  /**
   * Detect the prefix used by a list of beads issues.
   * Extracts the common prefix pattern from issue IDs.
   * Falls back to 'tbd' if no consistent prefix is found.
   */
  private detectPrefixFromIssues(issues: BeadsIssue[]): string {
    const prefixes = new Map<string, number>();

    for (const issue of issues.slice(0, 10)) {
      // Sample first 10
      if (issue.id) {
        const prefix = extractPrefix(issue.id);
        if (prefix) {
          prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
        }
      }
    }

    // Find the most common prefix
    let maxCount = 0;
    let mostCommonPrefix = 'tbd';
    for (const [prefix, count] of prefixes) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonPrefix = prefix;
      }
    }

    return mostCommonPrefix;
  }

  /**
   * Update config prefix if it differs from the detected prefix.
   * Returns true if prefix was updated.
   */
  private async updateConfigPrefixIfNeeded(detectedPrefix: string): Promise<boolean> {
    const cwd = process.cwd();
    try {
      const config = await readConfig(cwd);
      if (config.display.id_prefix !== detectedPrefix) {
        const oldPrefix = config.display.id_prefix;
        config.display.id_prefix = detectedPrefix;
        await writeConfig(cwd, config);
        this.output.info(`Updated ID prefix: ${oldPrefix} → ${detectedPrefix}`);
        return true;
      }
      return false;
    } catch {
      // Config doesn't exist or can't be read - skip update
      return false;
    }
  }
}

export const importCommand = new Command('import')
  .description(
    'Import issues from JSONL file or workspace.\n' +
      'For Beads migration, use: tbd setup --from-beads\n' +
      'For workspace import, use: tbd import --workspace=<name> or --outbox',
  )
  .argument('[file]', 'JSONL file to import')
  .option('--beads-dir <path>', 'Beads data directory (for --validate)')
  .option('--merge', 'Merge with existing issues instead of skipping duplicates')
  .option('--verbose', 'Show detailed import progress')
  .option('--validate', 'Validate existing import against Beads source')
  // Workspace import options
  .option('--workspace <name>', 'Import from named workspace under .tbd/workspaces/')
  .option('--dir <path>', 'Import from arbitrary directory')
  .option('--outbox', 'Shortcut for --workspace=outbox --clear-on-success')
  .option('--clear-on-success', 'Delete workspace after successful import')
  .action(async (file, options, command) => {
    const handler = new ImportHandler(command);
    await handler.run(file, options);
  });
