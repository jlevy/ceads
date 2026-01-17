/**
 * `tbd create` - Create a new issue.
 *
 * See: tbd-design-v3.md §4.4 Create
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import type { Issue, IssueKindType, PriorityType } from '../../lib/types.js';
import { generateInternalId, extractUlidFromInternalId } from '../../lib/ids.js';
import { writeIssue } from '../../file/storage.js';
import {
  loadIdMapping,
  saveIdMapping,
  generateUniqueShortId,
  addIdMapping,
} from '../../file/idMapping.js';
import { IssueKind, Priority } from '../../lib/schemas.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';

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
}

class CreateHandler extends BaseCommand {
  async run(title: string | undefined, options: CreateOptions): Promise<void> {
    await requireInit();

    // Validate title is provided (unless --from-file)
    if (!title && !options.fromFile) {
      this.output.error('Title is required. Use: tbd create "Issue title"');
      return;
    }

    // Parse and validate options
    const kind = this.parseKind(options.type ?? 'task');
    if (!kind) return;

    const priority = this.parsePriority(options.priority ?? '2');
    if (priority === null) return;

    // Read description from file if specified
    let description = options.description;
    if (options.file) {
      try {
        description = await readFile(options.file, 'utf-8');
      } catch {
        this.output.error(`Failed to read description from file: ${options.file}`);
        return;
      }
    }

    if (this.checkDryRun('Would create issue', { title, kind, priority, ...options })) {
      return;
    }

    const timestamp = now();
    const id = generateInternalId();
    const ulid = extractUlidFromInternalId(id);

    const issue: Issue = {
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
      parent_id: options.parent ?? undefined,
    };

    let shortId: string;
    await this.execute(async () => {
      const dataSyncDir = await resolveDataSyncDir();

      // Load mapping, generate unique short ID, and save
      const mapping = await loadIdMapping(dataSyncDir);
      shortId = generateUniqueShortId(mapping);
      addIdMapping(mapping, ulid, shortId);

      // Write both the issue and the mapping
      await writeIssue(dataSyncDir, issue);
      await saveIdMapping(dataSyncDir, mapping);
    }, 'Failed to create issue');

    // Output with display ID (bd- prefix + 4-char short ID)
    const displayId = `bd-${shortId!}`;
    this.output.data({ id: displayId, internalId: id, title }, () => {
      this.output.success(`Created ${displayId}: ${title}`);
    });
  }

  private parseKind(value: string): IssueKindType | undefined {
    const result = IssueKind.safeParse(value);
    if (!result.success) {
      this.output.error(`Invalid type: ${value}. Must be: bug, feature, task, epic, chore`);
      return undefined;
    }
    return result.data;
  }

  private parsePriority(value: string): PriorityType | null {
    const num = parseInt(value, 10);
    const result = Priority.safeParse(num);
    if (!result.success) {
      this.output.error(`Invalid priority: ${value}. Must be 0-4`);
      return null;
    }
    return result.data;
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
  .option('-l, --label <label>', 'Add label (repeatable)', (val, prev: string[] = []) => [
    ...prev,
    val,
  ])
  .action(async (title, options, command) => {
    const handler = new CreateHandler(command);
    await handler.run(title, options);
  });
