/**
 * Tests for tbd setup global hooks installation.
 *
 * These tests verify that `tbd setup --auto` correctly installs:
 * 1. ~/.claude/scripts/tbd-session.sh (the install + prime script)
 * 2. Global hooks in ~/.claude/settings.json (SessionStart, PreCompact)
 *
 * TDD Phase 0a: These tests should FAIL initially, proving the bug exists.
 * See: docs/project/specs/active/plan-2026-01-27-welcome-message-improvements.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access, realpath, stat } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

// Shell script hooks are Unix-only; skip entire suite on Windows
const describeUnix = platform() === 'win32' ? describe.skip : describe;

describeUnix('setup global hooks', () => {
  let tempDir: string;
  let fakeHome: string;
  let originalHome: string | undefined;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    // Create temp directories for both project and fake HOME
    const rawTempDir = await mkdtemp(join(tmpdir(), 'tbd-hooks-test-'));
    tempDir = await realpath(rawTempDir);

    // Create a fake HOME directory to isolate global settings
    fakeHome = join(tempDir, 'fake-home');
    await mkdir(fakeHome, { recursive: true });

    // Create ~/.claude directory to simulate Claude Code being installed
    await mkdir(join(fakeHome, '.claude'), { recursive: true });

    // Save original HOME and set fake HOME
    originalHome = process.env.HOME;
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run tbd command with mocked HOME.
   */
  function runTbd(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome, // Windows equivalent of HOME
        FORCE_COLOR: '0',
      },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo in a directory.
   */
  function initGitRepo(dir: string): void {
    execSync('git init --initial-branch=main', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
  }

  describe('tbd-session.sh script installation', () => {
    it('creates ~/.claude/scripts/tbd-session.sh', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify the script was created
      const scriptPath = join(fakeHome, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });

    it('makes tbd-session.sh executable', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(fakeHome, '.claude', 'scripts', 'tbd-session.sh');
      const stats = await stat(scriptPath);

      // Check executable bit (0o755 = rwxr-xr-x)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it('tbd-session.sh contains tbd install logic', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(fakeHome, '.claude', 'scripts', 'tbd-session.sh');
      const content = await readFile(scriptPath, 'utf-8');

      // Verify key parts of the script
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('ensure_tbd');
      expect(content).toContain('npm install');
      expect(content).toContain('tbd prime');
    });
  });

  describe('global settings.json hooks', () => {
    it('adds SessionStart hook to ~/.claude/settings.json', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify global settings has SessionStart hook
      const settingsPath = join(fakeHome, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.SessionStart).toBeInstanceOf(Array);

      // Should have tbd-session.sh in SessionStart
      const hasSessionHook = settings.hooks.SessionStart.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);
    });

    it('adds PreCompact hook to ~/.claude/settings.json', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const settingsPath = join(fakeHome, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks.PreCompact).toBeDefined();
      expect(settings.hooks.PreCompact).toBeInstanceOf(Array);

      // Should have tbd-session.sh --brief in PreCompact
      const hasPreCompactHook = settings.hooks.PreCompact.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh --brief')),
      );
      expect(hasPreCompactHook).toBe(true);
    });

    it('merges with existing hooks without overwriting', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Pre-populate global settings with existing hooks
      const settingsPath = join(fakeHome, '.claude', 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: 'echo "existing hook"' }],
                },
              ],
              Stop: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: '~/.claude/stop-hook.sh' }],
                },
              ],
            },
            permissions: { allow: ['Skill'] },
          },
          null,
          2,
        ),
      );

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Existing Stop hook should still be there
      expect(settings.hooks.Stop).toBeDefined();
      expect(settings.hooks.Stop[0].hooks[0].command).toContain('stop-hook.sh');

      // Existing permissions should still be there
      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.allow).toContain('Skill');

      // New tbd hooks should be added
      const hasNewSessionHook = settings.hooks.SessionStart.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasNewSessionHook).toBe(true);
    });
  });

  describe('project-level hooks (when .claude/ exists)', () => {
    it('installs hooks to project .claude/settings.json when .claude/ exists', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Pre-create project .claude/ directory (simulating Claude Code project)
      await mkdir(join(projectDir, '.claude'), { recursive: true });

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      // Verify project-level settings has SessionStart hook with tbd-session.sh
      const projectSettingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Should have tbd-session.sh in SessionStart (project-level)
      const hasSessionHook = settings.hooks?.SessionStart?.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);
    });

    it('installs tbd-session.sh script to project .claude/scripts/', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Pre-create project .claude/ directory
      await mkdir(join(projectDir, '.claude'), { recursive: true });

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      // Verify script was created in project
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });
  });

  describe('idempotency', () => {
    it('running setup twice does not duplicate hooks', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Run setup twice
      runTbd(['setup', '--auto', '--prefix=test'], projectDir);
      runTbd(['setup', '--auto'], projectDir);

      const settingsPath = join(fakeHome, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Count tbd-session.sh hooks in SessionStart
      const tbdHookCount = settings.hooks.SessionStart.filter(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      ).length;

      expect(tbdHookCount).toBe(1);
    });
  });
});
