/**
 * Tests for tbd prime command output.
 * Verifies the prime command shows full orientation by default.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

describe('prime command', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-prime-test-'));
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
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo and tbd in temp directory.
   */
  function initGitAndTbd(): void {
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);
  }

  describe('initialized repo', () => {
    beforeEach(() => {
      initGitAndTbd();
    });

    it('tbd prime shows full orientation by default', () => {
      const result = runTbd(['prime']);

      expect(result.status).toBe(0);
      // Should include dynamic installation status
      expect(result.stdout).toContain('INSTALLATION');
      expect(result.stdout).toContain('tbd installed');
      // Should include dynamic project status
      expect(result.stdout).toContain('PROJECT STATUS');
      // Should include static skill content (workflow rules)
      expect(result.stdout).toContain('Session Closing Protocol');
      expect(result.stdout).toContain('Bead Tracking Rules');
    });

    it('tbd prime --brief shows abbreviated orientation', () => {
      const result = runTbd(['prime', '--brief']);

      expect(result.status).toBe(0);
      // Should include installation status
      expect(result.stdout).toContain('INSTALLATION');
      // Should include quick reference
      expect(result.stdout).toContain('Quick Reference');
      // Should include session closing checklist
      expect(result.stdout).toContain('SESSION CLOSING');
      // Should NOT include full skill content
      expect(result.stdout).not.toContain('Essential Commands');
      // Should point to full orientation
      expect(result.stdout).toContain('tbd prime');
    });

    it('tbd (no args) shows help with agent guidance', () => {
      const noArgsResult = runTbd([]);

      // Default command (no args) should show help with prominent agent guidance
      expect(noArgsResult.stdout).toContain('IMPORTANT:');
      expect(noArgsResult.stdout).toContain('tbd prime');
      expect(noArgsResult.stdout).toContain('Getting Started:');
    });
  });

  describe('not initialized repo', () => {
    beforeEach(() => {
      // Only init git, not tbd
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });
    });

    it('tbd prime shows setup instructions and value proposition', () => {
      const result = runTbd(['prime']);

      expect(result.status).toBe(0);
      // Should show not initialized
      expect(result.stdout).toContain('NOT INITIALIZED');
      // Should explain what tbd is
      expect(result.stdout).toContain('WHAT tbd IS');
      // Should show setup command
      expect(result.stdout).toContain('tbd setup');
      expect(result.stdout).toContain('--prefix');
    });
  });
});
