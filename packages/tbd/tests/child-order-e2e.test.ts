/**
 * End-to-end tests for child ordering with hints.
 *
 * Tests the complete workflow of creating children with --parent,
 * automatic population of child_order_hints, and order preservation
 * through create, list, delete, and manual reorder operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

describe('child ordering end-to-end', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-child-order-e2e-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);
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

  function getOrderHints(id: string): string[] | null {
    const result = runTbd(['show', id, '--json']);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { child_order_hints?: string[] };
    return data.child_order_hints ?? null;
  }

  describe('automatic population of child_order_hints', () => {
    it('appends child ID to parent hints on create with --parent', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      createIssue('Child 1', ['--parent', parentId]);
      createIssue('Child 2', ['--parent', parentId]);
      createIssue('Child 3', ['--parent', parentId]);

      // Parent should have order hints in creation order
      const hints = getOrderHints(parentId);
      expect(hints).toHaveLength(3);

      // The hints should contain the internal IDs (is-...) of the children
      // in the order they were created
      expect(hints).not.toBeNull();
      // Since we can't predict internal IDs, just verify count and that they're consistent
    });

    it('appends child ID to parent hints on update with --parent', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const orphanId = createIssue('Orphan task', []);

      // Orphan has no parent, parent should have no hints yet
      let hints = getOrderHints(parentId);
      expect(hints).toBeNull();

      // Now set parent
      const updateResult = runTbd(['update', orphanId, '--parent', parentId]);
      expect(updateResult.status).toBe(0);

      // Parent should now have the child in its hints
      hints = getOrderHints(parentId);
      expect(hints).toHaveLength(1);
    });

    it('does not duplicate if child already in hints', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const childId = createIssue('Child', ['--parent', parentId]);

      // Re-set the same parent
      const updateResult = runTbd(['update', childId, '--parent', parentId]);
      expect(updateResult.status).toBe(0);

      // Should still have only one entry
      const hints = getOrderHints(parentId);
      expect(hints).toHaveLength(1);
    });
  });

  describe('--child-order flag', () => {
    it('manually sets child_order_hints', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const child1Id = createIssue('Child A', ['--parent', parentId]);
      const child2Id = createIssue('Child B', ['--parent', parentId]);
      const child3Id = createIssue('Child C', ['--parent', parentId]);

      // Initially order is A, B, C
      let hints = getOrderHints(parentId);
      expect(hints).toHaveLength(3);

      // Reorder to C, A, B
      const reorderResult = runTbd([
        'update',
        parentId,
        '--child-order',
        `${child3Id},${child1Id},${child2Id}`,
      ]);
      expect(reorderResult.status).toBe(0);

      hints = getOrderHints(parentId);
      expect(hints).toHaveLength(3);
    });

    it('clears hints with empty string', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      createIssue('Child', ['--parent', parentId]);

      // Verify hints exist
      let hints = getOrderHints(parentId);
      expect(hints).toHaveLength(1);

      // Clear with empty string
      const clearResult = runTbd(['update', parentId, '--child-order', '']);
      expect(clearResult.status).toBe(0);

      hints = getOrderHints(parentId);
      expect(hints).toBeNull();
    });

    it('errors on invalid ID', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);

      const result = runTbd(['update', parentId, '--child-order', 'invalid-id']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Invalid ID');
    });
  });

  describe('--show-order flag', () => {
    it('displays child_order_hints', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      createIssue('Child 1', ['--parent', parentId]);
      createIssue('Child 2', ['--parent', parentId]);

      const result = runTbd(['show', parentId, '--show-order']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('child_order_hints:');
      expect(result.stdout).toContain('test-'); // Should show display IDs
    });

    it('shows (none) when no hints', () => {
      const issueId = createIssue('No children', []);

      const result = runTbd(['show', issueId, '--show-order']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('child_order_hints:');
      expect(result.stdout).toContain('(none)');
    });
  });

  describe('order preservation through operations', () => {
    it('preserves order through close and list', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      createIssue('Child A', ['--parent', parentId]);
      const child2Id = createIssue('Child B', ['--parent', parentId]);
      createIssue('Child C', ['--parent', parentId]);
      createIssue('Child D', ['--parent', parentId]);

      // Close one child
      const closeResult = runTbd(['close', child2Id]);
      expect(closeResult.status).toBe(0);

      // List should still show remaining children in order (use --pretty for tree view)
      const listResult = runTbd(['list', '--status', 'open', '--pretty']);
      expect(listResult.status).toBe(0);

      // Verify order: A should come before C, C before D
      const output = listResult.stdout;
      const aIndex = output.indexOf('Child A');
      const cIndex = output.indexOf('Child C');
      const dIndex = output.indexOf('Child D');

      expect(aIndex).toBeLessThan(cIndex);
      expect(cIndex).toBeLessThan(dIndex);
    });

    it('maintains manual order after setting with --child-order', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const child1Id = createIssue('First', ['--parent', parentId]);
      const child2Id = createIssue('Second', ['--parent', parentId]);
      const child3Id = createIssue('Third', ['--parent', parentId]);

      // Reorder to: Third, First, Second
      const reorderResult = runTbd([
        'update',
        parentId,
        '--child-order',
        `${child3Id},${child1Id},${child2Id}`,
      ]);
      expect(reorderResult.status).toBe(0);

      // List with --pretty to get tree view
      const listResult = runTbd(['list', '--pretty']);
      expect(listResult.status).toBe(0);

      const output = listResult.stdout;
      const thirdIndex = output.indexOf('Third');
      const firstIndex = output.indexOf('First');
      const secondIndex = output.indexOf('Second');

      // Third should come before First, First before Second
      expect(thirdIndex).toBeLessThan(firstIndex);
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });
});
