/**
 * Tests for tbd setup hooks installation.
 *
 * These tests verify that `tbd setup --auto` correctly installs:
 * 1. .claude/scripts/tbd-session.sh (the install + prime script)
 * 2. Hooks in project .claude/settings.json (SessionStart, PreCompact, PostToolUse)
 * 3. .claude/ directory is created automatically if it doesn't exist
 *
 * All hooks are always project-local — no global ~/.claude/ installation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access, realpath, stat } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

// Shell script hooks are Unix-only; skip entire suite on Windows
const describeUnix = platform() === 'win32' ? describe.skip : describe;

describeUnix('setup hooks (project-local)', () => {
  let tempDir: string;
  let fakeHome: string;
  let originalHome: string | undefined;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    // Create temp directories for both project and fake HOME
    const rawTempDir = await mkdtemp(join(tmpdir(), 'tbd-hooks-test-'));
    tempDir = await realpath(rawTempDir);

    // Create a fake HOME directory to isolate from real user settings
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
    it('creates .claude/scripts/tbd-session.sh in project', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify the script was created in the project
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });

    it('makes tbd-session.sh executable', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const stats = await stat(scriptPath);

      // Check executable bit (0o755 = rwxr-xr-x)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it('tbd-session.sh contains tbd install logic', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const content = await readFile(scriptPath, 'utf-8');

      // Verify key parts of the script
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('ensure_tbd');
      expect(content).toContain('npm install');
      expect(content).toContain('tbd prime');
    });
  });

  describe('project .claude/settings.json hooks', () => {
    it('adds SessionStart hook with project-relative path', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify project settings has SessionStart hook
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.SessionStart).toBeInstanceOf(Array);

      // Should have tbd-session.sh in SessionStart with project-relative path
      const sessionHook = settings.hooks.SessionStart.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(sessionHook).toBeDefined();
      expect(sessionHook.hooks[0].command).toBe('bash .claude/scripts/tbd-session.sh');
      expect(sessionHook.hooks[0].command).not.toContain('$HOME');
    });

    it('adds PreCompact hook with project-relative path', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks.PreCompact).toBeDefined();
      expect(settings.hooks.PreCompact).toBeInstanceOf(Array);

      // Should have tbd-session.sh --brief with project-relative path
      const preCompactHook = settings.hooks.PreCompact.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(preCompactHook).toBeDefined();
      expect(preCompactHook.hooks[0].command).toBe('bash .claude/scripts/tbd-session.sh --brief');
      expect(preCompactHook.hooks[0].command).not.toContain('$HOME');
    });

    it('merges with existing project hooks without overwriting', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Pre-populate project settings with existing hooks
      await mkdir(join(projectDir, '.claude'), { recursive: true });
      const settingsPath = join(projectDir, '.claude', 'settings.json');
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
                  hooks: [{ type: 'command', command: 'echo "stop hook"' }],
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
      expect(settings.hooks.Stop[0].hooks[0].command).toContain('stop hook');

      // Existing permissions should still be there
      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.allow).toContain('Skill');

      // Existing non-tbd SessionStart hook should still be there
      const existingHook = settings.hooks.SessionStart.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('existing hook')),
      );
      expect(existingHook).toBeDefined();

      // New tbd hooks should be added
      const hasNewSessionHook = settings.hooks.SessionStart.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasNewSessionHook).toBe(true);
    });

    it('does not install hooks to global ~/.claude/settings.json', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      // Global settings should NOT have tbd hooks
      const globalSettingsPath = join(fakeHome, '.claude', 'settings.json');
      try {
        const content = await readFile(globalSettingsPath, 'utf-8');
        const settings = JSON.parse(content);
        // If the file exists, it should not have tbd session hooks
        const hasTbdHook = settings.hooks?.SessionStart?.some(
          (entry: { hooks?: { command?: string }[] }) =>
            entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
        );
        expect(hasTbdHook).toBeFalsy();
      } catch {
        // File doesn't exist — that's fine, no global hooks installed
      }
    });
  });

  describe('.claude/ directory auto-creation', () => {
    it('creates .claude/ directory if it does not exist', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Do NOT pre-create .claude/ — setup should create it
      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // .claude/ directory should have been created
      await expect(access(join(projectDir, '.claude'))).resolves.not.toThrow();

      // Hooks should be in project .claude/settings.json
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      const hasSessionHook = settings.hooks?.SessionStart?.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);

      // Script should also be in project
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });
  });

  describe('subdirectory handling (git root resolution)', () => {
    it('creates .claude/ at git root when run from a subdirectory', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Create a subdirectory to run setup from
      const subDir = join(projectDir, 'src', 'deep');
      await mkdir(subDir, { recursive: true });

      const result = runTbd(['setup', '--auto', '--prefix=test'], subDir);

      expect(result.status).toBe(0);

      // .claude/ should be at the git root, NOT in the subdirectory
      const rootSettingsPath = join(projectDir, '.claude', 'settings.json');
      await expect(access(rootSettingsPath)).resolves.not.toThrow();

      const content = await readFile(rootSettingsPath, 'utf-8');
      const settings = JSON.parse(content);
      const hasSessionHook = settings.hooks?.SessionStart?.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);

      // Script should be at git root too
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();

      // .claude/ should NOT exist in the subdirectory
      try {
        await access(join(subDir, '.claude'));
        // If we get here, .claude/ exists in subdirectory — that's a bug
        expect.fail('.claude/ should not exist in subdirectory');
      } catch {
        // Expected: .claude/ does not exist in subdirectory
      }
    });

    it('creates .tbd/ at git root when run from a subdirectory', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const subDir = join(projectDir, 'packages', 'lib');
      await mkdir(subDir, { recursive: true });

      const result = runTbd(['setup', '--auto', '--prefix=test'], subDir);

      expect(result.status).toBe(0);

      // .tbd/ should be at the git root
      await expect(access(join(projectDir, '.tbd'))).resolves.not.toThrow();

      // .tbd/ should NOT be in the subdirectory
      try {
        await access(join(subDir, '.tbd'));
        expect.fail('.tbd/ should not exist in subdirectory');
      } catch {
        // Expected
      }
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

      const settingsPath = join(projectDir, '.claude', 'settings.json');
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
