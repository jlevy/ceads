/**
 * Tests for spec_path inheritance from parent beads.
 *
 * Covers:
 * - Child inherits spec_path from parent on create (when --spec not provided)
 * - Explicit --spec on child overrides parent inheritance
 * - Propagation to children when parent spec_path changes
 * - Inheritance on re-parenting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { writeFile } from 'atomically';

describe('spec_path inheritance', () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-spec-inherit-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);

    // Create spec files for testing
    await mkdir(join(tempDir, 'docs', 'specs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'specs', 'feature-a.md'), '# Feature A');
    await writeFile(join(tempDir, 'docs', 'specs', 'feature-b.md'), '# Feature B');
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

  function getSpecPath(id: string): string | null {
    const result = runTbd(['show', id, '--json']);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout) as { spec_path?: string };
    return data.spec_path ?? null;
  }

  describe('child inherits spec_path from parent on create', () => {
    it('inherits parent spec_path when child has no --spec', () => {
      const parentId = createIssue('Parent epic', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-a.md',
      ]);
      const childId = createIssue('Child task', ['--parent', parentId]);

      expect(getSpecPath(childId)).toBe('docs/specs/feature-a.md');
    });

    it('does not inherit when child provides explicit --spec', () => {
      const parentId = createIssue('Parent epic', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-a.md',
      ]);
      const childId = createIssue('Child task', [
        '--parent',
        parentId,
        '--spec',
        'docs/specs/feature-b.md',
      ]);

      expect(getSpecPath(childId)).toBe('docs/specs/feature-b.md');
    });

    it('does not inherit when parent has no spec_path', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const childId = createIssue('Child task', ['--parent', parentId]);

      expect(getSpecPath(childId)).toBeNull();
    });
  });

  describe('propagation when parent spec_path changes', () => {
    it('propagates new spec_path to children without explicit spec', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const child1Id = createIssue('Child 1', ['--parent', parentId]);
      const child2Id = createIssue('Child 2', ['--parent', parentId]);

      // Now set spec on parent
      const result = runTbd(['update', parentId, '--spec', 'docs/specs/feature-a.md']);
      expect(result.status).toBe(0);

      expect(getSpecPath(child1Id)).toBe('docs/specs/feature-a.md');
      expect(getSpecPath(child2Id)).toBe('docs/specs/feature-a.md');
    });

    it('does not overwrite child with explicit different spec_path', () => {
      const parentId = createIssue('Parent epic', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-a.md',
      ]);
      const child1Id = createIssue('Child 1', ['--parent', parentId]);
      const child2Id = createIssue('Child task explicit', [
        '--parent',
        parentId,
        '--spec',
        'docs/specs/feature-b.md',
      ]);

      // Change parent spec
      const result = runTbd(['update', parentId, '--spec', 'docs/specs/feature-b.md']);
      expect(result.status).toBe(0);

      // child1 inherited from parent, so it should get the new spec
      expect(getSpecPath(child1Id)).toBe('docs/specs/feature-b.md');
      // child2 had explicit feature-b.md (same as new), so it stays
      expect(getSpecPath(child2Id)).toBe('docs/specs/feature-b.md');
    });

    it('propagates only to children that had old inherited value or null', () => {
      const parentId = createIssue('Parent epic', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-a.md',
      ]);
      // child1 inherits feature-a from parent
      const child1Id = createIssue('Child inherits', ['--parent', parentId]);
      // child2 has explicit feature-b
      const child2Id = createIssue('Child explicit', [
        '--parent',
        parentId,
        '--spec',
        'docs/specs/feature-b.md',
      ]);

      // Change parent to feature-b
      const result = runTbd(['update', parentId, '--spec', 'docs/specs/feature-b.md']);
      expect(result.status).toBe(0);

      // child1 had old value (feature-a) which matches old parent → should update
      expect(getSpecPath(child1Id)).toBe('docs/specs/feature-b.md');
      // child2 had explicit feature-b (different from old parent feature-a) → should NOT update
      expect(getSpecPath(child2Id)).toBe('docs/specs/feature-b.md');
    });
  });

  describe('inheritance on re-parenting', () => {
    it('inherits new parent spec_path when child has no spec', () => {
      createIssue('Parent 1', ['--type', 'epic', '--spec', 'docs/specs/feature-a.md']);
      const parent2Id = createIssue('Parent 2', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-b.md',
      ]);
      const childId = createIssue('Child no spec', []);

      // Re-parent to parent2
      const result = runTbd(['update', childId, '--parent', parent2Id]);
      expect(result.status).toBe(0);

      expect(getSpecPath(childId)).toBe('docs/specs/feature-b.md');
    });

    it('does not overwrite child spec on re-parent when child has explicit spec', () => {
      createIssue('Parent 1', ['--type', 'epic', '--spec', 'docs/specs/feature-a.md']);
      const parent2Id = createIssue('Parent 2', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-b.md',
      ]);
      const childId = createIssue('Child with spec', ['--spec', 'docs/specs/feature-a.md']);

      // Re-parent to parent2 (child already has explicit spec)
      const result = runTbd(['update', childId, '--parent', parent2Id]);
      expect(result.status).toBe(0);

      // Child keeps its explicit spec
      expect(getSpecPath(childId)).toBe('docs/specs/feature-a.md');
    });
  });
});
