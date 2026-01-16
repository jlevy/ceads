/**
 * `tbd import` - Import from Beads or other sources.
 *
 * See: tbd-design-v3.md §5.1 Import Strategy
 */

import { Command } from 'commander';
import { readFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { writeIssue, listIssues } from '../../file/storage.js';
import { generateInternalId } from '../../lib/ids.js';
import { IssueStatus, IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueStatusType, IssueKindType, DependencyType } from '../../lib/types.js';
import { resolveDataSyncDir, resolveMappingsDir } from '../../lib/paths.js';

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
 * ID mapping file structure.
 */
type IdMapping = Record<string, string>;

/**
 * Load existing ID mapping.
 */
async function loadMapping(): Promise<IdMapping> {
  const mappingsDir = await resolveMappingsDir();
  const mappingPath = join(mappingsDir, 'beads.yml');
  try {
    const content = await readFile(mappingPath, 'utf-8');
    return (parseYaml(content) as IdMapping) ?? {};
  } catch {
    return {};
  }
}

/**
 * Save ID mapping.
 */
async function saveMapping(mapping: IdMapping): Promise<void> {
  const mappingsDir = await resolveMappingsDir();
  await mkdir(mappingsDir, { recursive: true });
  const mappingPath = join(mappingsDir, 'beads.yml');
  const content = stringifyYaml(mapping, { sortMapEntries: true });
  await writeFile(mappingPath, content);
}

/**
 * Map Beads status to Tbd status.
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
 * Map Beads issue type to Tbd kind.
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
 * Convert Beads issue to Tbd issue.
 */
function convertIssue(beads: BeadsIssue, tbdId: string, depMapping: IdMapping): Issue {
  // Convert dependencies, translating IDs
  const dependencies: DependencyType[] = [];
  if (beads.dependencies) {
    for (const dep of beads.dependencies) {
      if (dep.type === 'blocks' || dep.type === 'blocked_by') {
        const targetId = depMapping[dep.target];
        if (targetId) {
          // "blocked_by" in Beads means the target blocks this issue
          // In Tbd, we only have "blocks", so we need to handle this carefully
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
    created_at: beads.created_at,
    updated_at: beads.updated_at,
    closed_at: beads.closed_at ?? null,
    close_reason: beads.close_reason ?? null,
    due_date: beads.due ?? null,
    deferred_until: beads.defer ?? null,
    parent_id: beads.parent ? depMapping[beads.parent] : null,
    extensions: {
      beads: {
        original_id: beads.id,
        imported_at: new Date().toISOString(),
      },
    },
  };
}

class ImportHandler extends BaseCommand {
  private dataSyncDir = '';

  async run(file: string | undefined, options: ImportOptions): Promise<void> {
    this.dataSyncDir = await resolveDataSyncDir();

    // Handle validation mode
    if (options.validate) {
      await this.validateImport(options);
      return;
    }

    // Validate input
    if (!file && !options.fromBeads) {
      this.output.error('Provide a file path or use --from-beads');
      return;
    }

    if (options.fromBeads) {
      await this.importFromBeads(options);
    } else if (file) {
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

    // Load tbd issues
    const tbdIssues = await this.loadExistingIssues();
    const mapping = await loadMapping();
    const reverseMapping: Record<string, string> = {};
    for (const [beadsId, tbdId] of Object.entries(mapping)) {
      reverseMapping[tbdId] = beadsId;
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
      const tbdId = mapping[beads.id];

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
          issue: 'TBD issue has mapping but Beads issue no longer exists',
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
    console.log(`Total TBD issues:      ${tbdIssues.length}`);
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

    // Load existing mapping and issues
    const mapping = await loadMapping();
    const existingIssues = await this.loadExistingIssues();
    const existingByBeadsId = new Map<string, Issue>();

    // Build reverse lookup from extensions
    for (const issue of existingIssues) {
      const beadsExt = issue.extensions?.beads as { original_id?: string } | undefined;
      if (beadsExt?.original_id) {
        existingByBeadsId.set(beadsExt.original_id, issue);
      }
    }

    // First pass: assign IDs to all issues (needed for dependency translation)
    for (const beads of beadsIssues) {
      if (!mapping[beads.id]) {
        const existing = existingByBeadsId.get(beads.id);
        if (existing) {
          mapping[beads.id] = existing.id;
        } else {
          mapping[beads.id] = generateInternalId();
        }
      }
    }

    // Second pass: convert and save issues
    let imported = 0;
    let skipped = 0;
    let merged = 0;

    for (const beads of beadsIssues) {
      const tbdId = mapping[beads.id]!;
      const existing = existingByBeadsId.get(beads.id);

      if (existing && !options.merge) {
        // Check if Beads is newer
        if (new Date(beads.updated_at) <= new Date(existing.updated_at)) {
          skipped++;
          continue;
        }
      }

      const issue = convertIssue(beads, tbdId, mapping);

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

    // Save updated mapping
    await saveMapping(mapping);

    const result = { imported, skipped, merged, total: beadsIssues.length };

    this.output.data(result, () => {
      this.output.success(`Import complete from ${filePath}`);
      console.log(`  New issues:   ${imported}`);
      console.log(`  Merged:       ${merged}`);
      console.log(`  Skipped:      ${skipped}`);
    });
  }

  private async importFromBeads(options: ImportOptions): Promise<void> {
    const beadsDir = options.beadsDir ?? '.beads';
    const jsonlPath = join(beadsDir, 'issues.jsonl');

    try {
      await access(jsonlPath);
    } catch {
      this.output.error(`Beads database not found at ${beadsDir}`);
      this.output.info('Use `bd export > issues.jsonl` to create an export file');
      return;
    }

    await this.importFromFile(jsonlPath, options);
  }

  private async loadExistingIssues(): Promise<Issue[]> {
    try {
      return await listIssues(this.dataSyncDir);
    } catch {
      return [];
    }
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
