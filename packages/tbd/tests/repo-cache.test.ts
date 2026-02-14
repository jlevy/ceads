/**
 * Tests for repo-cache.ts - sparse git repo checkout caching.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createTestBareRepo } from './helpers/doc-test-utils.js';
import { RepoCache } from '../src/file/repo-cache.js';

describe('repo-cache', () => {
  let tbdRoot: string;
  let bareRepoPath: string;

  beforeEach(async () => {
    tbdRoot = join(
      tmpdir(),
      `repo-cache-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await mkdir(join(tbdRoot, '.tbd'), { recursive: true });

    // Create a bare repo with docs content
    bareRepoPath = await createTestBareRepo({
      'shortcuts/code-review.md':
        '---\nname: code-review\ndescription: Review code\n---\n# Code Review\n',
      'shortcuts/commit.md': '---\nname: commit\ndescription: Commit code\n---\n# Commit\n',
      'guidelines/typescript-rules.md':
        '---\nname: typescript-rules\ndescription: TS rules\n---\n# TypeScript Rules\n',
      'templates/spec.md': '---\nname: spec\ndescription: Spec template\n---\n# Spec\n',
      'README.md': '# Test Repo\n',
      'src/index.ts': 'console.log("hello");\n',
    });
  });

  afterEach(async () => {
    await rm(tbdRoot, { recursive: true, force: true });
    await rm(bareRepoPath, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('creates RepoCache with cacheDir under .tbd/', () => {
      const cache = new RepoCache(tbdRoot);
      expect(cache.cacheDir).toBe(join(tbdRoot, '.tbd', 'repo-cache'));
    });
  });

  describe('ensureRepo', () => {
    it('clones a repo on first access', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', ['shortcuts/']);
      expect(repoDir).toContain('repo-cache');

      // Verify files were checked out
      const content = await readFile(join(repoDir, 'shortcuts', 'code-review.md'), 'utf-8');
      expect(content).toContain('# Code Review');
    });

    it('returns same dir on second access (cached)', async () => {
      const cache = new RepoCache(tbdRoot);
      const dir1 = await cache.ensureRepo(bareRepoPath, 'main', ['shortcuts/']);
      const dir2 = await cache.ensureRepo(bareRepoPath, 'main', ['shortcuts/']);
      expect(dir1).toBe(dir2);
    });

    it('clones multiple paths', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', [
        'shortcuts/',
        'guidelines/',
        'templates/',
      ]);

      const shortcuts = await readdir(join(repoDir, 'shortcuts'));
      expect(shortcuts).toContain('code-review.md');
      expect(shortcuts).toContain('commit.md');

      const guidelines = await readdir(join(repoDir, 'guidelines'));
      expect(guidelines).toContain('typescript-rules.md');
    });

    it('throws on invalid repo URL', async () => {
      const cache = new RepoCache(tbdRoot);
      await expect(
        cache.ensureRepo('/nonexistent/repo.git', 'main', ['shortcuts/']),
      ).rejects.toThrow();
    });
  });

  describe('scanDocs', () => {
    it('finds all .md files in specified paths', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', ['shortcuts/', 'guidelines/']);

      const docs = await cache.scanDocs(repoDir, ['shortcuts/', 'guidelines/']);
      expect(docs.length).toBe(3); // 2 shortcuts + 1 guideline
      expect(docs.map((d) => d.relativePath).sort()).toEqual([
        'guidelines/typescript-rules.md',
        'shortcuts/code-review.md',
        'shortcuts/commit.md',
      ]);
    });

    it('returns empty array for paths with no .md files', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', ['shortcuts/']);
      const docs = await cache.scanDocs(repoDir, ['nonexistent/']);
      expect(docs).toEqual([]);
    });

    it('does not include non-.md files', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', ['src/']);
      const docs = await cache.scanDocs(repoDir, ['src/']);
      expect(docs).toEqual([]);
    });

    it('includes relativePath and content for each doc', async () => {
      const cache = new RepoCache(tbdRoot);
      const repoDir = await cache.ensureRepo(bareRepoPath, 'main', ['guidelines/']);
      const docs = await cache.scanDocs(repoDir, ['guidelines/']);

      expect(docs).toHaveLength(1);
      expect(docs[0]!.relativePath).toBe('guidelines/typescript-rules.md');
      expect(docs[0]!.content).toContain('# TypeScript Rules');
    });
  });

  describe('getRepoDir', () => {
    it('returns deterministic directory for a repo URL', () => {
      const cache = new RepoCache(tbdRoot);
      const dir1 = cache.getRepoDir('github.com/jlevy/speculate');
      const dir2 = cache.getRepoDir('github.com/jlevy/speculate');
      expect(dir1).toBe(dir2);

      // Different URL should give different dir
      const dir3 = cache.getRepoDir('github.com/jlevy/other');
      expect(dir3).not.toBe(dir1);
    });
  });
});
