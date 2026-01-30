/**
 * `tbd update` - Update an issue.
 *
 * See: tbd-design.md §4.4 Update
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError, CLIError } from '../lib/errors.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { parseMarkdownWithFrontmatter } from '../../file/parser.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { IssueStatus, IssueKind } from '../../lib/schemas.js';
import { parsePriority } from '../../lib/priority.js';
import type { IssueStatusType, IssueKindType, PriorityType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/time-utils.js';
import { loadIdMapping, resolveToInternalId, type IdMapping } from '../../file/id-mapping.js';
import { readConfig } from '../../file/config.js';
import { resolveAndValidatePath, getPathErrorMessage } from '../../lib/project-paths.js';

interface UpdateOptions {
  fromFile?: string;
  title?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  description?: string;
  notes?: string;
  notesFile?: string;
  due?: string;
  defer?: string;
  addLabel?: string[];
  removeLabel?: string[];
  parent?: string;
  spec?: string;
  childOrder?: string;
}

class UpdateHandler extends BaseCommand {
  async run(id: string, options: UpdateOptions): Promise<void> {
    const tbdRoot = await requireInit();

    const dataSyncDir = await resolveDataSyncDir(tbdRoot);

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load existing issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Parse and validate options
    const updates = await this.parseUpdates(options, mapping, tbdRoot);
    if (updates === null) return;

    if (this.checkDryRun('Would update issue', { id: internalId, ...updates })) {
      return;
    }

    // Capture old spec_path before applying updates (for propagation)
    const oldSpecPath = issue.spec_path;

    // Apply updates
    if (updates.title !== undefined) issue.title = updates.title;
    if (updates.status !== undefined) issue.status = updates.status;
    if (updates.kind !== undefined) issue.kind = updates.kind;
    if (updates.priority !== undefined) issue.priority = updates.priority;
    if (updates.assignee !== undefined) issue.assignee = updates.assignee;
    if (updates.description !== undefined) issue.description = updates.description;
    if (updates.notes !== undefined) issue.notes = updates.notes;
    if (updates.due_date !== undefined) issue.due_date = updates.due_date;
    if (updates.deferred_until !== undefined) issue.deferred_until = updates.deferred_until;
    if (updates.parent_id !== undefined) issue.parent_id = updates.parent_id;
    if (updates.spec_path !== undefined) issue.spec_path = updates.spec_path;
    if (updates.child_order_hints !== undefined)
      issue.child_order_hints = updates.child_order_hints;

    // Inherit spec_path from new parent when re-parenting without explicit --spec
    if (updates.parent_id && options.spec === undefined && !issue.spec_path) {
      try {
        const parentIssue = await readIssue(dataSyncDir, updates.parent_id);
        if (parentIssue.spec_path) {
          issue.spec_path = parentIssue.spec_path;
        }
      } catch {
        // Parent not found — skip inheritance
      }
    }

    // Handle full labels replacement (from --from-file)
    if (updates.labels !== undefined) {
      issue.labels = updates.labels;
    }

    // Handle label updates
    if (updates.addLabels && updates.addLabels.length > 0) {
      const labelsSet = new Set(issue.labels);
      for (const label of updates.addLabels) {
        labelsSet.add(label);
      }
      issue.labels = [...labelsSet];
    }
    if (updates.removeLabels && updates.removeLabels.length > 0) {
      const removeSet = new Set(updates.removeLabels);
      issue.labels = issue.labels.filter((l) => !removeSet.has(l));
    }

    // Update metadata
    issue.version += 1;
    issue.updated_at = now();

    // Save
    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to update issue');

    // When setting a new parent, append child to parent's child_order_hints
    if (updates.parent_id) {
      try {
        const parentIssue = await readIssue(dataSyncDir, updates.parent_id);
        const hints = parentIssue.child_order_hints ?? [];

        // Only append if not already in hints
        if (!hints.includes(internalId)) {
          parentIssue.child_order_hints = [...hints, internalId];
          parentIssue.version += 1;
          parentIssue.updated_at = now();
          await writeIssue(dataSyncDir, parentIssue);
        }
      } catch {
        // Parent not found or other error - skip order hint update
      }
    }

    // Propagate spec_path to children when parent's spec changes
    if (updates.spec_path !== undefined && issue.spec_path && issue.spec_path !== oldSpecPath) {
      const allIssues = await listIssues(dataSyncDir);
      const children = allIssues.filter((i) => i.parent_id === issue.id);
      const timestamp = now();
      for (const child of children) {
        if (!child.spec_path || child.spec_path === oldSpecPath) {
          child.spec_path = issue.spec_path;
          child.version += 1;
          child.updated_at = timestamp;
          await writeIssue(dataSyncDir, child);
        }
      }
    }

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const config = await readConfig(tbdRoot);
    const prefix = config.display.id_prefix;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping, prefix)
      : formatDisplayId(issue.id, mapping, prefix);

    this.output.data({ id: displayId, updated: true }, () => {
      this.output.success(`Updated ${displayId}`);
    });
  }

  private async parseUpdates(
    options: UpdateOptions,
    mapping: IdMapping,
    tbdRoot: string,
  ): Promise<{
    title?: string;
    status?: IssueStatusType;
    kind?: IssueKindType;
    priority?: PriorityType;
    assignee?: string | null;
    description?: string | null;
    notes?: string | null;
    due_date?: string | null;
    deferred_until?: string | null;
    parent_id?: string | null;
    spec_path?: string | null;
    child_order_hints?: string[] | null;
    addLabels?: string[];
    removeLabels?: string[];
    labels?: string[];
  } | null> {
    const updates: {
      title?: string;
      status?: IssueStatusType;
      kind?: IssueKindType;
      priority?: PriorityType;
      assignee?: string | null;
      description?: string | null;
      notes?: string | null;
      due_date?: string | null;
      deferred_until?: string | null;
      parent_id?: string | null;
      spec_path?: string | null;
      child_order_hints?: string[] | null;
      addLabels?: string[];
      removeLabels?: string[];
      labels?: string[];
    } = {};

    // Handle --from-file: read all mutable fields from YAML+Markdown file
    if (options.fromFile) {
      let content: string;
      try {
        content = await readFile(options.fromFile, 'utf-8');
      } catch {
        throw new CLIError(`Failed to read file: ${options.fromFile}`);
      }

      try {
        const { frontmatter, description, notes } = parseMarkdownWithFrontmatter(content);

        // Extract mutable fields from frontmatter
        if (typeof frontmatter.title === 'string') {
          updates.title = frontmatter.title;
        }
        if (typeof frontmatter.status === 'string') {
          const result = IssueStatus.safeParse(frontmatter.status);
          if (result.success) {
            updates.status = result.data;
          }
        }
        if (typeof frontmatter.kind === 'string') {
          const result = IssueKind.safeParse(frontmatter.kind);
          if (result.success) {
            updates.kind = result.data;
          }
        }
        if (typeof frontmatter.priority === 'number') {
          const priority = parsePriority(String(frontmatter.priority));
          if (priority !== undefined) {
            updates.priority = priority;
          }
        }
        if (frontmatter.assignee !== undefined) {
          updates.assignee = typeof frontmatter.assignee === 'string' ? frontmatter.assignee : null;
        }
        if (frontmatter.due_date !== undefined) {
          updates.due_date = typeof frontmatter.due_date === 'string' ? frontmatter.due_date : null;
        }
        if (frontmatter.deferred_until !== undefined) {
          updates.deferred_until =
            typeof frontmatter.deferred_until === 'string' ? frontmatter.deferred_until : null;
        }
        if (frontmatter.parent_id !== undefined) {
          updates.parent_id =
            typeof frontmatter.parent_id === 'string' ? frontmatter.parent_id : null;
        }
        if (frontmatter.spec_path !== undefined) {
          if (typeof frontmatter.spec_path === 'string' && frontmatter.spec_path) {
            // Validate and normalize the spec path from file
            try {
              const resolved = await resolveAndValidatePath(
                frontmatter.spec_path,
                tbdRoot,
                process.cwd(),
              );
              updates.spec_path = resolved.relativePath;
            } catch (error) {
              throw new ValidationError(getPathErrorMessage(error));
            }
          } else {
            updates.spec_path = null;
          }
        }
        if (Array.isArray(frontmatter.labels)) {
          updates.labels = frontmatter.labels.filter((l): l is string => typeof l === 'string');
        }

        // Set description and notes from body
        updates.description = description || null;
        updates.notes = notes || null;
      } catch (error) {
        throw new CLIError(
          `Failed to parse file: ${options.fromFile}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return updates;
    }

    if (options.title !== undefined) {
      if (!options.title.trim()) {
        throw new ValidationError('Title cannot be empty');
      }
      updates.title = options.title;
    }

    if (options.status) {
      const result = IssueStatus.safeParse(options.status);
      if (!result.success) {
        throw new ValidationError(`Invalid status: ${options.status}`);
      }
      updates.status = result.data;
    }

    if (options.type) {
      const result = IssueKind.safeParse(options.type);
      if (!result.success) {
        throw new ValidationError(`Invalid type: ${options.type}`);
      }
      updates.kind = result.data;
    }

    if (options.priority) {
      // Use shared parsePriority which accepts both "P1" and "1" formats
      const priority = parsePriority(options.priority);
      if (priority === undefined) {
        throw new ValidationError(`Invalid priority: ${options.priority}. Use P0-P4 or 0-4.`);
      }
      updates.priority = priority;
    }

    if (options.assignee !== undefined) {
      updates.assignee = options.assignee || null;
    }

    if (options.description !== undefined) {
      updates.description = options.description || null;
    }

    if (options.notes !== undefined) {
      updates.notes = options.notes || null;
    }

    if (options.notesFile) {
      try {
        updates.notes = await readFile(options.notesFile, 'utf-8');
      } catch {
        throw new CLIError(`Failed to read notes from file: ${options.notesFile}`);
      }
    }

    if (options.due !== undefined) {
      updates.due_date = options.due || null;
    }

    if (options.defer !== undefined) {
      updates.deferred_until = options.defer || null;
    }

    if (options.parent !== undefined) {
      if (options.parent) {
        try {
          updates.parent_id = resolveToInternalId(options.parent, mapping);
        } catch {
          throw new ValidationError(`Invalid parent ID: ${options.parent}`);
        }
      } else {
        updates.parent_id = null;
      }
    }

    if (options.spec !== undefined) {
      if (options.spec) {
        // Non-empty spec path: validate and normalize
        try {
          const resolved = await resolveAndValidatePath(options.spec, tbdRoot, process.cwd());
          updates.spec_path = resolved.relativePath;
        } catch (error) {
          throw new ValidationError(getPathErrorMessage(error));
        }
      } else {
        // Empty string: clear the spec path (no validation needed)
        updates.spec_path = null;
      }
    }

    if (options.addLabel && options.addLabel.length > 0) {
      updates.addLabels = options.addLabel;
    }

    if (options.removeLabel && options.removeLabel.length > 0) {
      updates.removeLabels = options.removeLabel;
    }

    // Handle --child-order: set the ordering hints for children
    if (options.childOrder !== undefined) {
      if (options.childOrder === '' || options.childOrder === '""') {
        // Empty string: clear the hints
        updates.child_order_hints = null;
      } else {
        // Parse comma-separated short IDs and resolve to internal IDs
        const shortIds = options.childOrder.split(',').map((s) => s.trim());
        const internalIds: string[] = [];
        for (const shortId of shortIds) {
          if (!shortId) continue; // Skip empty strings
          try {
            const internalId = resolveToInternalId(shortId, mapping);
            internalIds.push(internalId);
          } catch {
            throw new ValidationError(`Invalid ID in --child-order: ${shortId}`);
          }
        }
        updates.child_order_hints = internalIds.length > 0 ? internalIds : null;
      }
    }

    return updates;
  }
}

export const updateCommand = new Command('update')
  .description('Update an issue')
  .argument('<id>', 'Issue ID')
  .option('--from-file <path>', 'Update all fields from YAML+Markdown file')
  .option('--title <text>', 'Set title')
  .option('--status <status>', 'Set status')
  .option('--type <type>', 'Set type')
  .option('--priority <0-4>', 'Set priority')
  .option('--assignee <name>', 'Set assignee')
  .option('--description <text>', 'Set description')
  .option('--notes <text>', 'Set working notes')
  .option('--notes-file <path>', 'Set notes from file')
  .option('--due <date>', 'Set due date')
  .option('--defer <date>', 'Set deferred until date')
  .option('--add-label <label>', 'Add label', (val, prev: string[] = []) => [...prev, val])
  .option('--remove-label <label>', 'Remove label', (val, prev: string[] = []) => [...prev, val])
  .option('--parent <id>', 'Set parent')
  .option('--spec <path>', 'Set or clear spec path (empty string clears)')
  .option('--child-order <ids>', 'Set child ordering hints (comma-separated IDs)')
  .action(async (id, options, command) => {
    const handler = new UpdateHandler(command);
    await handler.run(id, options);
  });
