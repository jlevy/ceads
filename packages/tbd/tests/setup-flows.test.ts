/**
 * Integration tests for tbd setup flows.
 * Tests fresh setup, beads migration, already initialized, and outside git repo scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

describe('setup flows', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    // Use realpath to resolve any symlinks (important for macOS where /tmp is symlinked)
    const rawTempDir = await mkdtemp(join(tmpdir(), 'tbd-setup-test-'));
    tempDir = await realpath(rawTempDir);
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
    it('tbd setup --auto requires --prefix flag', () => {
      initGitRepo();

      // No --prefix provided, no beads to migrate from
      const result = runTbd(['setup', '--auto']);

      // Should fail with helpful error message
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--prefix');
      expect(result.stderr).toContain('required');
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

    it("shows What's Next section after setup", () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).toBe(0);
      // Should show What's Next guidance with natural language framing
      expect(result.stdout).toContain("WHAT'S NEXT");
      expect(result.stdout).toContain('Try saying things like:');
      expect(result.stdout).toContain("There's a bug where");
      expect(result.stdout).toContain("Let's plan a new feature");
      expect(result.stdout).toContain('Commit this code');
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

  describe('legacy cleanup', () => {
    it('removes legacy tbd scripts from .claude/scripts/', async () => {
      initGitRepo();

      // Create legacy script structure
      const scriptsDir = join(tempDir, '.claude', 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(join(scriptsDir, 'setup-tbd.sh'), '#!/bin/bash\necho "legacy"');
      await writeFile(join(scriptsDir, 'ensure-tbd-cli.sh'), '#!/bin/bash\necho "legacy"');
      await writeFile(join(scriptsDir, 'other-script.sh'), '#!/bin/bash\necho "keep"');

      // Initialize first (needed for setup to work)
      runTbd(['init', '--prefix=test']);

      // Run setup which should clean up legacy scripts
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Legacy scripts should be removed
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).rejects.toThrow();
      await expect(access(join(scriptsDir, 'ensure-tbd-cli.sh'))).rejects.toThrow();

      // Non-tbd scripts should remain
      await expect(access(join(scriptsDir, 'other-script.sh'))).resolves.not.toThrow();
    });

    it('removes legacy hook entries from project settings.json', async () => {
      const { readFile } = await import('node:fs/promises');
      initGitRepo();

      // Create legacy project settings with old hook entries
      const settingsDir = join(tempDir, '.claude');
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command: 'bash .claude/scripts/ensure-tbd-cli.sh',
                    },
                  ],
                },
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command: 'bash .claude/scripts/ensure-gh-cli.sh',
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      // Initialize first
      runTbd(['init', '--prefix=test']);

      // Run setup which should clean up legacy hooks
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Check settings.json was cleaned up
      const settingsContent = await readFile(join(settingsDir, 'settings.json'), 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Legacy tbd hooks should be removed but gh-cli hook should remain
      const sessionStartHooks = settings.hooks?.SessionStart ?? [];
      const hasLegacyTbdHook = sessionStartHooks.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-tbd')),
      );
      expect(hasLegacyTbdHook).toBe(false);

      // gh-cli hook should still be there
      const hasGhCliHook = sessionStartHooks.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
      );
      expect(hasGhCliHook).toBe(true);
    });

    it('cleans up legacy scripts during fresh setup', async () => {
      initGitRepo();

      // Create legacy script
      const scriptsDir = join(tempDir, '.claude', 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(join(scriptsDir, 'setup-tbd.sh'), '#!/bin/bash\necho "legacy"');

      // Verify script exists before setup
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).resolves.not.toThrow();

      // Run fresh setup (not already initialized) to trigger cleanup
      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).toBe(0);

      // Verify script was removed during setup
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).rejects.toThrow();
    });
  });
});
