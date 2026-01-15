/**
 * `tbd search` - Search issues.
 *
 * See: tbd-design-v3.md §4.8 Search Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';

interface SearchOptions {
  status?: string;
  limit?: string;
}

class SearchHandler extends BaseCommand {
  async run(query: string, options: SearchOptions): Promise<void> {
    // TODO: Implement search
    // Uses ripgrep via the hidden worktree for fast full-text search

    const mockResults = [
      { id: 'bd-a1b2c3', title: 'Fix auth bug', match: 'authentication timeout' },
    ];

    this.output.data(mockResults, () => {
      const colors = this.output.getColors();
      for (const result of mockResults) {
        console.log(`${colors.id(result.id)} ${result.title}`);
        console.log(`  ${colors.dim(result.match)}`);
      }
    });
  }
}

export const searchCommand = new Command('search')
  .description('Search issues by text')
  .argument('<query>', 'Search query')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Limit results')
  .action(async (query, options, command) => {
    const handler = new SearchHandler(command);
    await handler.run(query, options);
  });
