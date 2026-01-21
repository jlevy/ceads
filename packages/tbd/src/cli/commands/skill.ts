/**
 * `tbd skill` - Output AI agent skill file content.
 *
 * See: tbd-design.md §Prime-First Design
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BaseCommand } from '../lib/base-command.js';

interface SkillOptions {
  brief?: boolean;
}

/**
 * Get the path to a bundled doc file.
 */
function getDocPath(filename: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When bundled, runs from dist/bin.mjs or dist/cli.mjs
  // Docs are at dist/docs/ (same level as the bundle)
  return join(__dirname, 'docs', filename);
}

/**
 * Load a doc file content.
 */
async function loadDocContent(filename: string): Promise<string> {
  // Try bundled location first
  try {
    return await readFile(getDocPath(filename), 'utf-8');
  } catch {
    // Fallback for development
  }

  // Fallback: try to read from source location during development
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const devPath = join(__dirname, '..', '..', 'docs', filename);
    return await readFile(devPath, 'utf-8');
  } catch {
    // Fallback: try repo-level docs
  }

  // Last fallback: repo-level docs
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const repoPath = join(__dirname, '..', '..', '..', '..', '..', 'docs', filename);
    return await readFile(repoPath, 'utf-8');
  } catch {
    throw new Error(`${filename} not found. Please rebuild the CLI.`);
  }
}

class SkillHandler extends BaseCommand {
  async run(options: SkillOptions): Promise<void> {
    await this.execute(async () => {
      const filename = options.brief ? 'skill-brief.md' : 'SKILL.md';
      const content = await loadDocContent(filename);
      console.log(content);
    }, 'Failed to output skill content');
  }
}

export const skillCommand = new Command('skill')
  .description('Output AI agent skill file content')
  .option('--brief', 'Output condensed workflow rules only')
  .action(async (options: SkillOptions, command) => {
    const handler = new SkillHandler(command);
    await handler.run(options);
  });
