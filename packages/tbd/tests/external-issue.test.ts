/**
 * End-to-end tests for external_issue_url field.
 *
 * Covers:
 * - external_issue_url round-trips through update/show/list
 * - Inheritance from parent on create
 * - Propagation when parent's external_issue_url changes
 * - Update and clear via --from-file
 * - List --external-issue filter
 *
 * Note: These tests do NOT call the GitHub API — they test the
 * schema, CLI flags, and inheritance/propagation logic end-to-end.
 * Since --external-issue on create/update validates via GitHub API,
 * we set the field via update --from-file to bypass validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { writeFile } from 'atomically';

describe('external_issue_url', { timeout: 15000 }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-external-issue-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);

    // Create spec directory for inheritance tests
    await mkdir(join(tempDir, 'docs', 'specs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'specs', 'feature-a.md'), '# Feature A');
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

  function getIssueJson(id: string): Record<string, unknown> {
    const result = runTbd(['show', id, '--json']);
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout) as Record<string, unknown>;
  }

  /**
   * Set external_issue_url on an existing issue via update --from-file.
   * Bypasses GitHub API validation (which --external-issue would trigger).
   */
  async function setExternalUrl(id: string, url: string | null): Promise<void> {
    const filePath = join(tempDir, `update-${Date.now()}.yml`);
    const urlLine = url ? `external_issue_url: "${url}"` : 'external_issue_url:';
    await writeFile(filePath, `---\n${urlLine}\n---\n`);
    const result = runTbd(['update', id, '--from-file', filePath]);
    expect(result.status).toBe(0);
  }

  // =========================================================================
  // Round-trip: set via update --from-file and read via show --json
  // =========================================================================

  describe('round-trip', () => {
    it('stores and retrieves external_issue_url', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const id = createIssue('Issue with external link');

      await setExternalUrl(id, url);

      const data = getIssueJson(id);
      expect(data.external_issue_url).toBe(url);
    });

    it('creates issue without external_issue_url', () => {
      const id = createIssue('Plain issue');
      const data = getIssueJson(id);
      expect(data.external_issue_url).toBeUndefined();
    });
  });

  // =========================================================================
  // Update and clear
  // =========================================================================

  describe('update and clear', () => {
    it('sets external_issue_url on existing issue', async () => {
      const id = createIssue('Plain issue');
      const url = 'https://github.com/owner/repo/issues/99';

      await setExternalUrl(id, url);

      const data = getIssueJson(id);
      expect(data.external_issue_url).toBe(url);
    });

    it('clears external_issue_url when set to null', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const id = createIssue('Issue with link');

      await setExternalUrl(id, url);
      expect(getIssueJson(id).external_issue_url).toBe(url);

      await setExternalUrl(id, null);
      const data = getIssueJson(id);
      // After clearing, should be null or undefined
      expect(data.external_issue_url ?? null).toBeNull();
    });
  });

  // =========================================================================
  // Inheritance from parent
  // =========================================================================

  describe('inheritance from parent', () => {
    it('inherits external_issue_url from parent on create', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      await setExternalUrl(parentId, url);

      const childId = createIssue('Child task', ['--parent', parentId]);

      const childData = getIssueJson(childId);
      expect(childData.external_issue_url).toBe(url);
    });

    it('inherits both spec_path and external_issue_url from parent', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const parentId = createIssue('Parent epic', [
        '--type',
        'epic',
        '--spec',
        'docs/specs/feature-a.md',
      ]);

      // spec_path is set via --spec on create; set external_issue_url via from-file
      await setExternalUrl(parentId, url);

      // But wait: spec was already set and we need child to inherit it.
      // The update via setExternalUrl shouldn't clear spec_path.
      const parentData = getIssueJson(parentId);
      expect(parentData.spec_path).toBe('docs/specs/feature-a.md');
      expect(parentData.external_issue_url).toBe(url);

      const childId = createIssue('Child task', ['--parent', parentId]);

      const childData = getIssueJson(childId);
      expect(childData.spec_path).toBe('docs/specs/feature-a.md');
      expect(childData.external_issue_url).toBe(url);
    });

    it('does not inherit when parent has no external_issue_url', () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const childId = createIssue('Child task', ['--parent', parentId]);

      const childData = getIssueJson(childId);
      expect(childData.external_issue_url).toBeUndefined();
    });
  });

  // =========================================================================
  // Propagation on parent update
  // =========================================================================

  describe('propagation on parent update', () => {
    it('propagates new external_issue_url to children without explicit url', async () => {
      const parentId = createIssue('Parent epic', ['--type', 'epic']);
      const child1Id = createIssue('Child 1', ['--parent', parentId]);
      const child2Id = createIssue('Child 2', ['--parent', parentId]);

      // Now set external_issue_url on parent — should propagate to children
      const url = 'https://github.com/owner/repo/issues/99';
      await setExternalUrl(parentId, url);

      expect(getIssueJson(child1Id).external_issue_url).toBe(url);
      expect(getIssueJson(child2Id).external_issue_url).toBe(url);
    });
  });

  // =========================================================================
  // List --external-issue filter
  // =========================================================================

  describe('list --external-issue filter', () => {
    it('filters to only linked issues', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const id = createIssue('Linked issue');
      await setExternalUrl(id, url);
      createIssue('Unlinked issue');

      const result = runTbd(['list', '--external-issue', '--json']);
      expect(result.status).toBe(0);
      const issues = JSON.parse(result.stdout) as { external_issue_url?: string }[];

      expect(issues).toHaveLength(1);
      expect(issues[0]!.external_issue_url).toBe(url);
    });
  });

  // =========================================================================
  // Show includes external_issue_url in JSON
  // =========================================================================

  describe('show --json includes field', () => {
    it('includes external_issue_url in JSON output', async () => {
      const url = 'https://github.com/owner/repo/issues/42';
      const id = createIssue('Issue with link');
      await setExternalUrl(id, url);

      const data = getIssueJson(id);
      expect(data.external_issue_url).toBe(url);
    });
  });
});
