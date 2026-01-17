/**
 * `tbd import` - Import from Beads or other sources.
 *
 * See: tbd-design-v3.md §5.1 Import Strategy
 */

import { Command } from 'commander';
import { readFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import { writeIssue, listIssues } from '../../file/storage.js';
import {
  generateInternalId,
  extractShortId,
  extractUlidFromInternalId,
  makeInternalId,
} from '../../lib/ids.js';
import {
  loadIdMapping,
  saveIdMapping,
  addIdMapping,
  hasShortId,
  type IdMapping as ShortIdMapping,
} from '../../file/idMapping.js';
import { IssueStatus, IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueStatusType, IssueKindType, DependencyType } from '../../lib/types.js';
import {
  resolveDataSyncDir,
  TBD_DIR,
  CACHE_DIR,
  WORKTREE_DIR_NAME,
  DATA_SYNC_DIR_NAME,
} from '../../lib/paths.js';
import { now, normalizeTimestamp } from '../../utils/timeUtils.js';
import { initConfig, isInitialized } from '../../file/config.js';
import { initWorktree } from '../../file/git.js';
import { VERSION } from '../../index.js';

interface ImportOptions {
  fromBeads?: boolean;
  beadsDir?: string;
  merge?: boolean;
  verbose?: boolean;
  validate?: boolean;
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
    // Validate input first
    if (!file && !options.fromBeads && !options.validate) {
      this.output.error('Provide a file path or use --from-beads');
      return;
    }

    // Handle validation mode - requires init
    if (options.validate) {
      await requireInit();
      this.dataSyncDir = await resolveDataSyncDir();
      await this.validateImport(options);
      return;
    }

    // --from-beads auto-initializes if needed
    if (options.fromBeads) {
      await this.importFromBeads(options);
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
   * Validate import by comparing Beads source with imported tbd issues.
   * Reports any discrepancies or missing issues.
   */
  private async validateImport(options: ImportOptions): Promise<void> {
    const beadsDir = options.beadsDir ?? '.beads';
    const jsonlPath = join(beadsDir, 'issues.jsonl');

    try {
      await access(jsonlPath);
    } catch {
      this.output.error(`Beads database not found at ${beadsDir}`);
      this.output.info('Use --beads-dir to specify the Beads directory');
      return;
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
      this.output.error(`File not found: ${filePath}`);
      return;
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
        const newShortId = this.generateUniqueShortId(shortIdMapping);
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

  private async importFromBeads(options: ImportOptions): Promise<void> {
    const cwd = process.cwd();
    const beadsDir = options.beadsDir ?? '.beads';
    const jsonlPath = join(beadsDir, 'issues.jsonl');

    try {
      await access(jsonlPath);
    } catch {
      this.output.error(`Beads database not found at ${beadsDir}`);
      this.output.info('Use `bd export > issues.jsonl` to create an export file');
      return;
    }

    // Auto-initialize if not already initialized (per spec §5.6)
    if (!(await isInitialized(cwd))) {
      if (this.checkDryRun('Would initialize tbd and import from Beads')) {
        return;
      }

      this.output.info('Initializing tbd repository...');

      // Initialize config and directories (same as init command)
      await initConfig(cwd, VERSION);

      // Create .tbd/.gitignore
      const gitignoreContent = [
        '# Local cache (not shared)',
        'cache/',
        '',
        '# Hidden worktree for tbd-sync branch',
        `${WORKTREE_DIR_NAME}/`,
        '',
        '# Data sync directory (only exists in worktree)',
        `${DATA_SYNC_DIR_NAME}/`,
        '',
        '# Temporary files',
        '*.tmp',
        '',
      ].join('\n');
      await writeFile(join(cwd, TBD_DIR, '.gitignore'), gitignoreContent);

      // Create cache directory
      await mkdir(join(cwd, CACHE_DIR), { recursive: true });

      // Initialize worktree
      await initWorktree(cwd, 'origin', 'tbd-sync');

      this.output.success('Initialized tbd repository');
    }

    // Now resolve the data sync dir and import
    this.dataSyncDir = await resolveDataSyncDir();
    await this.importFromFile(jsonlPath, options);

    // Show tip about disabling beads
    console.log();
    console.log('Tip: To disable Beads and prevent agent confusion:');
    console.log('  bd hooks uninstall                 # Remove git hooks');
    console.log('  bd setup claude --remove           # Remove Claude Code hooks');
    console.log('  bd setup <editor> --remove         # cursor, codex, etc.');
  }

  private async loadExistingIssues(): Promise<Issue[]> {
    try {
      return await listIssues(this.dataSyncDir);
    } catch {
      return [];
    }
  }

  /**
   * Generate a unique short ID that doesn't collide with existing ones.
   */
  private generateUniqueShortId(mapping: ShortIdMapping): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const MAX_ATTEMPTS = 20;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      let result = '';
      for (let j = 0; j < 4; j++) {
        result += chars[Math.floor(Math.random() * 36)];
      }
      if (!mapping.shortToUlid.has(result)) {
        return result;
      }
    }

    throw new Error('Failed to generate unique short ID after maximum attempts');
  }
}

export const importCommand = new Command('import')
  .description(
    'Import issues from Beads or JSONL file.\n' +
      'Tip: Run "bd sync" and stop the beads daemon before importing for best results.',
  )
  .argument('[file]', 'JSONL file to import')
  .option('--from-beads', 'Import directly from Beads database')
  .option('--beads-dir <path>', 'Beads data directory')
  .option('--merge', 'Merge with existing issues instead of skipping duplicates')
  .option('--verbose', 'Show detailed import progress')
  .option('--validate', 'Validate existing import against Beads source')
  .action(async (file, options, command) => {
    const handler = new ImportHandler(command);
    await handler.run(file, options);
  });
