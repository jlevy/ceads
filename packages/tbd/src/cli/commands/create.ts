/**
 * `tbd create` - Create a new issue.
 *
 * See: tbd-design.md §4.4 Create
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, ValidationError, CLIError } from '../lib/errors.js';
import type { Issue, IssueKindType, PriorityType } from '../../lib/types.js';
import { generateInternalId, extractUlidFromInternalId } from '../../lib/ids.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import {
  loadIdMapping,
  saveIdMapping,
  generateUniqueShortId,
  addIdMapping,
  resolveToInternalId,
} from '../../file/id-mapping.js';
import { IssueKind } from '../../lib/schemas.js';
import { parsePriority } from '../../lib/priority.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/time-utils.js';
import { readConfig } from '../../file/config.js';
import { resolveAndValidatePath, getPathErrorMessage } from '../../lib/project-paths.js';

interface CreateOptions {
  fromFile?: string;
  type?: string;
  priority?: string;
  description?: string;
  file?: string;
  assignee?: string;
  due?: string;
  defer?: string;
  parent?: string;
  label?: string[];
  spec?: string;
}

class CreateHandler extends BaseCommand {
  async run(title: string | undefined, options: CreateOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Validate title is provided (unless --from-file)
    if (!title && !options.fromFile) {
      throw new ValidationError('Title is required. Use: tbd create "Issue title"');
    }

    // Parse and validate options
    const kind = this.parseKind(options.type ?? 'task');
    const priority = this.validatePriority(options.priority ?? '2');

    // Read description from file if specified
    let description = options.description;
    if (options.file) {
      try {
        description = await readFile(options.file, 'utf-8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CLIError(`Failed to read description from file '${options.file}': ${message}`);
      }
    }

    // Validate and normalize spec path if provided
    let specPath: string | undefined;
    if (options.spec) {
      try {
        const resolved = await resolveAndValidatePath(options.spec, tbdRoot, process.cwd());
        specPath = resolved.relativePath;
      } catch (error) {
        throw new ValidationError(getPathErrorMessage(error));
      }
    }

    if (
      this.checkDryRun('Would create issue', { title, kind, priority, spec: specPath, ...options })
    ) {
      return;
    }

    const timestamp = now();
    const id = generateInternalId();
    const ulid = extractUlidFromInternalId(id);

    let shortId: string;
    let prefix: string;
    let issue: Issue;
    await this.execute(async () => {
      const dataSyncDir = await resolveDataSyncDir(tbdRoot);

      // Read config for display prefix
      const config = await readConfig(tbdRoot);
      prefix = config.display.id_prefix;

      // Load mapping, generate unique short ID, and save
      const mapping = await loadIdMapping(dataSyncDir);
      shortId = generateUniqueShortId(mapping);
      addIdMapping(mapping, ulid, shortId);

      // Resolve parent ID if provided (convert display ID to internal ID)
      let parentId: string | undefined;
      if (options.parent) {
        try {
          parentId = resolveToInternalId(options.parent, mapping);
        } catch {
          throw new ValidationError(`Invalid parent ID: ${options.parent}`);
        }
      }

      // Inherit spec_path from parent if not explicitly provided
      if (!specPath && parentId) {
        const parentIssue = await readIssue(dataSyncDir, parentId);
        if (parentIssue.spec_path) {
          specPath = parentIssue.spec_path;
        }
      }

      issue = {
        type: 'is',
        id,
        version: 1,
        title: title!,
        kind,
        status: 'open',
        priority,
        labels: options.label ?? [],
        dependencies: [],
        created_at: timestamp,
        updated_at: timestamp,
        description: description ?? undefined,
        assignee: options.assignee ?? undefined,
        due_date: options.due ?? undefined,
        deferred_until: options.defer ?? undefined,
        parent_id: parentId,
        spec_path: specPath,
      };

      // Write both the issue and the mapping
      await writeIssue(dataSyncDir, issue);
      await saveIdMapping(dataSyncDir, mapping);

      // When creating with a parent, append child to parent's child_order_hints
      if (parentId) {
        try {
          const parentIssue = await readIssue(dataSyncDir, parentId);
          const hints = parentIssue.child_order_hints ?? [];

          // Only append if not already in hints (shouldn't happen for new issue, but safe)
          if (!hints.includes(id)) {
            parentIssue.child_order_hints = [...hints, id];
            parentIssue.version += 1;
            parentIssue.updated_at = timestamp;
            await writeIssue(dataSyncDir, parentIssue);
          }
        } catch {
          // Parent not found or other error - skip order hint update
        }
      }
    }, 'Failed to create issue');

    // Output with display ID (prefix + short ID)
    const displayId = `${prefix!}-${shortId!}`;
    this.output.data({ id: displayId, internalId: id, title }, () => {
      this.output.success(`Created ${displayId}: ${title}`);
    });
  }

  private parseKind(value: string): IssueKindType {
    const result = IssueKind.safeParse(value);
    if (!result.success) {
      throw new ValidationError(`Invalid type: ${value}. Must be: bug, feature, task, epic, chore`);
    }
    return result.data;
  }

  private validatePriority(value: string): PriorityType {
    // Use shared parsePriority which accepts both "P1" and "1" formats
    const num = parsePriority(value);
    if (num === undefined) {
      throw new ValidationError(`Invalid priority: ${value}. Use P0-P4 or 0-4.`);
    }
    return num;
  }
}

export const createCommand = new Command('create')
  .description('Create a new issue')
  .argument('[title]', 'Issue title')
  .option('--from-file <path>', 'Create from YAML+Markdown file')
  .option('-t, --type <type>', 'Issue type: bug, feature, task, epic, chore', 'task')
  .option('-p, --priority <0-4>', 'Priority (0=critical, 4=lowest)', '2')
  .option('-d, --description <text>', 'Description')
  .option('-f, --file <path>', 'Read description from file')
  .option('--assignee <name>', 'Assignee')
  .option('--due <date>', 'Due date (ISO8601)')
  .option('--defer <date>', 'Defer until date (ISO8601)')
  .option('--parent <id>', 'Parent issue ID')
  .option('--spec <path>', 'Link to spec document (relative path)')
  .option('-l, --label <label>', 'Add label (repeatable)', (val, prev: string[] = []) => [
    ...prev,
    val,
  ])
  .action(async (title, options, command) => {
    const handler = new CreateHandler(command);
    await handler.run(title, options);
  });
