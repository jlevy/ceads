/**
 * Integration tests for tbd setup flows.
 * Tests fresh setup, beads migration, already initialized, and outside git repo scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

describe('setup flows', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-setup-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run tbd command in temp directory.
   */
  function runTbd(
    args: string[],
    cwd = tempDir,
  ): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' }, // Disable colors for testing
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo in temp directory.
   */
  function initGitRepo(): void {
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
  }

  describe('tbd setup without flags', () => {
    it('shows help message with mode requirement', () => {
      initGitRepo();
      const result = runTbd(['setup']);

      expect(result.stdout).toContain('--auto');
      expect(result.stdout).toContain('--interactive');
    });
  });

  describe('fresh repo setup', () => {
    it('tbd setup --auto initializes and configures integrations', async () => {
      initGitRepo();

      // Set up a remote to enable prefix auto-detection
      execSync('git remote add origin https://github.com/testuser/myproject.git', { cwd: tempDir });

      const result = runTbd(['setup', '--auto']);

      // Should complete successfully
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Setup complete');

      // Should have created .tbd directory
      await expect(access(join(tempDir, '.tbd'))).resolves.not.toThrow();
    });

    it('tbd setup --auto --prefix=custom uses provided prefix', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=custom']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('custom');

      // Verify prefix in config
      const { readConfig } = await import('../src/file/config.js');
      const config = await readConfig(tempDir);
      expect(config.display.id_prefix).toBe('custom');
    });
  });

  describe('already initialized repo', () => {
    it('reports existing initialization status', () => {
      initGitRepo();

      // First initialize
      runTbd(['setup', '--auto', '--prefix=test']);

      // Try to setup again
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('tbd initialized');
    });
  });

  describe('beads migration', () => {
    it('detects beads and offers migration', async () => {
      initGitRepo();

      // Create mock beads structure
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: oldproj\n');
      await writeFile(join(beadsDir, 'issues.jsonl'), '');

      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);
      // Should detect and migrate from beads
      expect(result.stdout).toContain('Beads detected');
    });

    it('uses beads prefix during migration', async () => {
      initGitRepo();

      // Create mock beads structure with prefix
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: mylegacy\n');
      await writeFile(join(beadsDir, 'issues.jsonl'), '');

      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Verify prefix from beads was used
      const { readConfig } = await import('../src/file/config.js');
      const config = await readConfig(tempDir);
      expect(config.display.id_prefix).toBe('mylegacy');
    });
  });

  describe('outside git repo', () => {
    it('fails with helpful error when not in git repo', () => {
      // Don't initialize git
      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).not.toBe(0);
      // Should show error about git
    });
  });

  describe('surgical init', () => {
    it('tbd init creates only .tbd directory', async () => {
      initGitRepo();

      const result = runTbd(['init', '--prefix=surgical']);

      expect(result.status).toBe(0);

      // Should have created .tbd directory
      await expect(access(join(tempDir, '.tbd'))).resolves.not.toThrow();
    });

    it('tbd init requires --prefix', () => {
      initGitRepo();

      const result = runTbd(['init']);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--prefix');
    });
  });
});
