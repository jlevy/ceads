/**
 * Tests for `tbd list --specs` flag that groups beads by linked spec.
 *
 * Covers:
 * - Grouping beads by spec_path with section headers
 * - "No spec" group for beads without spec_path
 * - Compatibility with --pretty (tree view within groups)
 * - Compatibility with --all and other filters
 * - Parent-child relationships within spec groups
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { writeFile } from 'atomically';

describe('tbd list --specs', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-specs-flag-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);

    // Create spec files
    await mkdir(join(tempDir, 'docs', 'specs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'specs', 'plan-feature-alpha.md'), '# Alpha');
    await writeFile(join(tempDir, 'docs', 'specs', 'plan-feature-beta.md'), '# Beta');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd: tempDir,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  function createIssue(title: string, opts: string[] = []): string {
    const result = runTbd(['create', title, '--json', ...opts]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { id: string };
    return data.id;
  }

  it('groups beads by spec with headers', () => {
    createIssue('Alpha task 1', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('Alpha task 2', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('Beta task 1', ['--spec', 'docs/specs/plan-feature-beta.md']);
    createIssue('No spec task');

    const result = runTbd(['list', '--specs']);
    expect(result.status).toBe(0);

    const output = result.stdout;
    // Should have spec group headers
    expect(output).toContain('plan-feature-alpha');
    expect(output).toContain('plan-feature-beta');
    expect(output).toContain('(No spec)');

    // Alpha tasks grouped together
    expect(output).toContain('Alpha task 1');
    expect(output).toContain('Alpha task 2');
    expect(output).toContain('Beta task 1');
    expect(output).toContain('No spec task');

    // "No spec" should appear after the spec groups
    const alphaPos = output.indexOf('plan-feature-alpha');
    const betaPos = output.indexOf('plan-feature-beta');
    const noSpecPos = output.indexOf('(No spec)');
    expect(noSpecPos).toBeGreaterThan(alphaPos);
    expect(noSpecPos).toBeGreaterThan(betaPos);
  });

  it('works with --pretty flag showing tree view within groups', () => {
    const parentId = createIssue('Alpha parent', [
      '--type',
      'epic',
      '--spec',
      'docs/specs/plan-feature-alpha.md',
    ]);
    createIssue('Alpha child', ['--parent', parentId]);

    createIssue('Standalone no spec');

    const result = runTbd(['list', '--specs', '--pretty']);
    expect(result.status).toBe(0);

    const output = result.stdout;
    // Should have spec header
    expect(output).toContain('plan-feature-alpha');
    // Should have tree characters for parent-child
    expect(output).toContain('Alpha parent');
    expect(output).toContain('Alpha child');
    // Tree connector characters should be present
    expect(output).toMatch(/[└├]── /);
    // No spec group
    expect(output).toContain('(No spec)');
    expect(output).toContain('Standalone no spec');
  });

  it('works with --all to include closed issues', () => {
    const id = createIssue('Closed alpha', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    runTbd(['update', id, '--status', 'closed']);
    createIssue('Open beta', ['--spec', 'docs/specs/plan-feature-beta.md']);

    // Without --all, closed issue should not appear
    const resultNoAll = runTbd(['list', '--specs']);
    expect(resultNoAll.stdout).not.toContain('Closed alpha');
    expect(resultNoAll.stdout).toContain('Open beta');

    // With --all, closed issue should appear
    const resultAll = runTbd(['list', '--specs', '--all']);
    expect(resultAll.stdout).toContain('Closed alpha');
    expect(resultAll.stdout).toContain('Open beta');
  });

  it('works with --status filter', () => {
    createIssue('Open alpha', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    const blockedId = createIssue('Blocked alpha', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    runTbd(['update', blockedId, '--status', 'blocked']);

    const result = runTbd(['list', '--specs', '--status', 'blocked']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Blocked alpha');
    expect(result.stdout).not.toContain('Open alpha');
  });

  it('shows only "No spec" group when no issues have specs', () => {
    createIssue('Task 1');
    createIssue('Task 2');

    const result = runTbd(['list', '--specs']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('(No spec)');
    expect(result.stdout).toContain('Task 1');
    expect(result.stdout).toContain('Task 2');
  });

  it('shows no "No spec" group when all issues have specs', () => {
    createIssue('Alpha 1', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('Beta 1', ['--spec', 'docs/specs/plan-feature-beta.md']);

    const result = runTbd(['list', '--specs']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('(No spec)');
    expect(result.stdout).toContain('plan-feature-alpha');
    expect(result.stdout).toContain('plan-feature-beta');
  });

  it('shows counts per spec group', () => {
    createIssue('Alpha 1', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('Alpha 2', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('No spec 1');

    const result = runTbd(['list', '--specs']);
    expect(result.status).toBe(0);
    // Alpha group should show count of 2
    expect(result.stdout).toContain('(2)');
    // No spec group should show count of 1
    expect(result.stdout).toContain('(1)');
  });

  it('without --specs flag, output is unchanged', () => {
    createIssue('Alpha 1', ['--spec', 'docs/specs/plan-feature-alpha.md']);
    createIssue('No spec 1');

    const result = runTbd(['list']);
    expect(result.status).toBe(0);
    // Should not have spec group headers
    expect(result.stdout).not.toContain('plan-feature-alpha');
    expect(result.stdout).not.toContain('(No spec)');
    // Should still show issues
    expect(result.stdout).toContain('Alpha 1');
    expect(result.stdout).toContain('No spec 1');
  });
});
