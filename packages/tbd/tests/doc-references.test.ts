/**
 * Tests that all tbd doc commands referenced in README.md actually work.
 * Extracts `tbd shortcut`, `tbd guidelines`, `tbd template` commands and runs them.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const README_PATH = join(__dirname, '..', '..', '..', 'README.md');
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');
const MONOREPO_ROOT = join(__dirname, '..', '..', '..');

/**
 * Extract all tbd shortcut|guidelines|template <name> commands from content.
 * Handles both code blocks and inline backticks.
 */
function extractDocCommands(content: string): string[] {
  // Normalize: join lines, collapse whitespace
  const normalized = content.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Match: tbd shortcut|guidelines|template <name> (not --list or flags)
  const pattern = /tbd (shortcut|guidelines|template) ([a-z][a-z0-9-]*)/g;
  const commands: string[] = [];
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const cmd = match[1];
    const name = match[2];
    // Skip flags like --list, --all
    if (cmd && name && !name.startsWith('-')) {
      commands.push(`tbd ${cmd} ${name}`);
    }
  }

  return [...new Set(commands)]; // dedupe
}

describe('README doc references', () => {
  // Ensure docs are installed before running tests
  beforeAll(() => {
    // Run tbd setup --auto to install docs (they're gitignored so not present in CI)
    execSync(`node ${TBD_BIN} setup --auto`, {
      cwd: MONOREPO_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  });

  it('extracts doc commands from README', async () => {
    const readme = await readFile(README_PATH, 'utf-8');
    const commands = extractDocCommands(readme);

    expect(commands.length).toBeGreaterThan(0);
    expect(commands).toContain('tbd shortcut new-plan-spec');
    expect(commands).toContain('tbd guidelines typescript-rules');
    expect(commands).toContain('tbd template plan-spec');
  });

  it('all referenced doc commands work', async () => {
    const readme = await readFile(README_PATH, 'utf-8');
    const commands = extractDocCommands(readme);

    const failures: string[] = [];

    for (const cmd of commands) {
      try {
        const fullCmd = cmd.replace('tbd', `node ${TBD_BIN}`);
        const output = execSync(fullCmd, { encoding: 'utf-8', stdio: 'pipe' });
        // Check for "not found" messages (commands exit 0 but print error)
        if (output.includes('No ') && output.includes(' found')) {
          failures.push(`${cmd}: not found`);
        }
      } catch (error) {
        failures.push(`${cmd}: ${(error as Error).message}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
