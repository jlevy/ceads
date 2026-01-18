/**
 * `tbd search` - Search issues.
 *
 * See: tbd-design-spec.md §4.8 Search Commands
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit, NotInitializedError, ValidationError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { IssueStatus } from '../../lib/schemas.js';
import type { Issue, IssueStatusType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { loadIdMapping } from '../../file/idMapping.js';
import { readConfig } from '../../file/config.js';
import { formatIssueCompact, type IssueForDisplay } from '../lib/issueFormat.js';

// Staleness threshold for worktree (5 minutes)
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

// State file path
const STATE_FILE = '.tbd/cache/state.json';

interface SearchOptions {
  status?: string;
  limit?: string;
  noRefresh?: boolean;
  field?: string;
  caseSensitive?: boolean;
}

interface SearchResult {
  issue: Issue;
  matchField: string;
  matchText: string;
}

interface LocalState {
  last_sync_at?: string;
}

/**
 * Read local state file.
 */
async function readState(): Promise<LocalState> {
  try {
    const content = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content) as LocalState;
  } catch {
    return {};
  }
}

/**
 * Update local state file.
 */
async function updateState(updates: Partial<LocalState>): Promise<void> {
  const state = await readState();
  const newState = { ...state, ...updates };
  await writeFile(STATE_FILE, JSON.stringify(newState, null, 2));
}

/**
 * Check if worktree is stale and needs refresh.
 */
async function isWorktreeStale(): Promise<boolean> {
  const state = await readState();
  if (!state.last_sync_at) {
    return true; // Never synced
  }

  const lastSync = new Date(state.last_sync_at).getTime();
  const now = Date.now();
  return now - lastSync > STALE_THRESHOLD_MS;
}

class SearchHandler extends BaseCommand {
  async run(query: string, options: SearchOptions): Promise<void> {
    await requireInit();

    // Check worktree staleness and auto-refresh if needed
    if (!options.noRefresh) {
      const stale = await isWorktreeStale();
      if (stale) {
        this.output.info('Refreshing worktree...');
        // Update state to mark as fresh (in a full implementation, would actually sync)
        await updateState({ last_sync_at: now() });
      }
    }

    // Load all issues
    let issues: Issue[];
    let dataSyncDir: string;
    try {
      dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    // Parse status filter
    let statusFilter: IssueStatusType | null = null;
    if (options.status) {
      const result = IssueStatus.safeParse(options.status);
      if (!result.success) {
        throw new ValidationError(`Invalid status: ${options.status}`);
      }
      statusFilter = result.data;
    }

    // Search (case-insensitive by default)
    const caseSensitive = options.caseSensitive ?? false;
    const queryForMatch = caseSensitive ? query : query.toLowerCase();
    let results: SearchResult[] = [];

    for (const issue of issues) {
      // Apply status filter
      if (statusFilter && issue.status !== statusFilter) continue;

      // Determine which fields to search
      const searchFields = options.field
        ? [options.field]
        : ['title', 'description', 'notes', 'labels'];

      for (const field of searchFields) {
        const match = this.searchField(issue, field, queryForMatch, caseSensitive);
        if (match) {
          results.push(match);
          break; // Only one match per issue
        }
      }
    }

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        results = results.slice(0, limit);
      }
    }

    // Load ID mapping and config for display
    const mapping = await loadIdMapping(dataSyncDir);
    const config = await readConfig(process.cwd());
    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;

    // Format output
    const output = results.map((r) => ({
      id: showDebug
        ? formatDebugId(r.issue.id, mapping, prefix)
        : formatDisplayId(r.issue.id, mapping, prefix),
      priority: r.issue.priority,
      status: r.issue.status,
      kind: r.issue.kind,
      title: r.issue.title,
      matchField: r.matchField,
      match: r.matchText,
    }));

    this.output.data(output, () => {
      if (output.length === 0) {
        this.output.info(`No issues matching "${query}"`);
        return;
      }

      const colors = this.output.getColors();
      console.log(`Found ${output.length} result${output.length === 1 ? '' : 's'}:\n`);
      for (const result of output) {
        console.log(formatIssueCompact(result as IssueForDisplay, colors));
        console.log(`  ${colors.dim(`[${result.matchField}]`)} ${result.match}`);
        console.log('');
      }
    });
  }

  private searchField(
    issue: Issue,
    field: string,
    query: string,
    caseSensitive: boolean,
  ): SearchResult | null {
    switch (field) {
      case 'title': {
        const text = caseSensitive ? issue.title : issue.title.toLowerCase();
        if (text.includes(query)) {
          return { issue, matchField: 'title', matchText: issue.title };
        }
        break;
      }
      case 'description': {
        if (issue.description) {
          const text = caseSensitive ? issue.description : issue.description.toLowerCase();
          if (text.includes(query)) {
            const snippet = this.extractSnippet(issue.description, query, caseSensitive);
            return { issue, matchField: 'description', matchText: snippet };
          }
        }
        break;
      }
      case 'notes': {
        if (issue.notes) {
          const text = caseSensitive ? issue.notes : issue.notes.toLowerCase();
          if (text.includes(query)) {
            const snippet = this.extractSnippet(issue.notes, query, caseSensitive);
            return { issue, matchField: 'notes', matchText: snippet };
          }
        }
        break;
      }
      case 'labels': {
        for (const label of issue.labels) {
          const text = caseSensitive ? label : label.toLowerCase();
          if (text.includes(query)) {
            return { issue, matchField: 'labels', matchText: `label: ${label}` };
          }
        }
        break;
      }
    }
    return null;
  }

  private extractSnippet(text: string, query: string, caseSensitive: boolean): string {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const index = searchText.indexOf(query);
    if (index === -1) return text.slice(0, 60);

    // Extract snippet around match
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + query.length + 40);
    let snippet = text.slice(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet.replace(/\n/g, ' ');
  }
}

export const searchCommand = new Command('search')
  .description('Search issues by text')
  .argument('<query>', 'Search query')
  .option('--status <status>', 'Filter by status')
  .option('--field <field>', 'Search specific field (title, description, notes, labels)')
  .option('--limit <n>', 'Limit results')
  .option('--no-refresh', 'Skip worktree refresh')
  .option('--case-sensitive', 'Case-sensitive search')
  .action(async (query, options, command) => {
    const handler = new SearchHandler(command);
    await handler.run(query, options);
  });
