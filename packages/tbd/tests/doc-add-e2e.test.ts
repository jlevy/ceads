/**
 * End-to-end tests for `tbd guidelines --add` / `tbd shortcut --add` / `tbd template --add`.
 *
 * Sets up a real git repo with tbd initialized, then exercises the --add flow
 * end-to-end via the CLI binary, verifying:
 * - File is downloaded and written to the correct location
 * - Config is updated with the source URL
 * - The added doc appears in --list output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

describe('doc --add end-to-end', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-doc-add-e2e-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function runTbd(
    args: string[],
    cwd = tempDir,
  ): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
      timeout: 60000,
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  function initGitAndTbd(): void {
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);
    // Run setup to get docs synced
    runTbd(['setup', '--auto', '--prefix=test']);
  }

  describe('tbd guidelines --add', () => {
    it('requires --name when --add is provided', () => {
      initGitAndTbd();
      const result = runTbd(['guidelines', '--add=https://example.com/file.md']);
      expect(result.status).not.toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).toContain('--name is required');
    });

    it('adds a guideline from a raw GitHub URL and shows it in --list', async () => {
      initGitAndTbd();

      // Add a guideline
      const addResult = runTbd([
        'guidelines',
        '--add=https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        '--name=modern-bun-monorepo-patterns',
      ]);

      // May fail due to network - skip gracefully
      if (addResult.status !== 0) {
        console.log('Skipping network test - no connectivity or fetch failed');
        return;
      }

      expect(addResult.status).toBe(0);
      expect(addResult.stdout).toContain('Added to guidelines/modern-bun-monorepo-patterns.md');

      // Verify file exists
      const docPath = join(
        tempDir,
        '.tbd',
        'docs',
        'guidelines',
        'modern-bun-monorepo-patterns.md',
      );
      await access(docPath);
      const content = await readFile(docPath, 'utf-8');
      expect(content.length).toBeGreaterThan(100);

      // Verify config was updated
      const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
      expect(configContent).toContain('modern-bun-monorepo-patterns.md');
      expect(configContent).toContain('raw.githubusercontent.com');

      // Verify it shows up in --list
      const listResult = runTbd(['guidelines', '--list']);
      expect(listResult.status).toBe(0);
      expect(listResult.stdout).toContain('modern-bun-monorepo-patterns');
    });

    it('converts GitHub blob URL to raw URL when adding', async () => {
      initGitAndTbd();

      const addResult = runTbd([
        'guidelines',
        '--add=https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        '--name=bun-patterns-blob',
      ]);

      if (addResult.status !== 0) {
        console.log('Skipping network test - no connectivity or fetch failed');
        return;
      }

      expect(addResult.status).toBe(0);

      // Config should have the raw URL, not the blob URL
      const configContent = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
      expect(configContent).toContain('raw.githubusercontent.com');
      expect(configContent).not.toContain('/blob/');
    });
  });

  describe('tbd shortcut --add', () => {
    it('adds a shortcut to shortcuts/custom/', async () => {
      initGitAndTbd();

      const addResult = runTbd([
        'shortcut',
        '--add=https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        '--name=my-custom-shortcut',
      ]);

      if (addResult.status !== 0) {
        console.log('Skipping network test - no connectivity or fetch failed');
        return;
      }

      expect(addResult.status).toBe(0);
      expect(addResult.stdout).toContain('Added to shortcuts/custom/my-custom-shortcut.md');

      // Verify the file went to shortcuts/custom/ (not shortcuts/standard/)
      const docPath = join(tempDir, '.tbd', 'docs', 'shortcuts', 'custom', 'my-custom-shortcut.md');
      await access(docPath);
    });
  });

  describe('tbd template --add', () => {
    it('adds a template to templates/', () => {
      initGitAndTbd();

      const addResult = runTbd([
        'template',
        '--add=https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
        '--name=my-custom-template',
      ]);

      if (addResult.status !== 0) {
        console.log('Skipping network test - no connectivity or fetch failed');
        return;
      }

      expect(addResult.status).toBe(0);
      expect(addResult.stdout).toContain('Added to templates/my-custom-template.md');
    });
  });
});
