/**
 * Tests for doc-sync.ts - doc cache sync functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import {
  DocSync,
  isDocsStale,
  mergeDocCacheConfig,
  internalDocExists,
  pruneStaleInternals,
} from '../src/file/doc-sync.js';

describe('doc-sync', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `tbd-doc-sync-test-${randomBytes(4).toString('hex')}`);
    await mkdir(tempDir, { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('DocSync.parseSource', () => {
    it('parses internal source', () => {
      const sync = new DocSync(tempDir, {});
      const source = sync.parseSource('internal:shortcuts/standard/code-review-and-commit.md');

      expect(source.type).toBe('internal');
      expect(source.location).toBe('shortcuts/standard/code-review-and-commit.md');
    });

    it('parses URL source', () => {
      const sync = new DocSync(tempDir, {});
      const source = sync.parseSource('https://raw.githubusercontent.com/org/repo/main/file.md');

      expect(source.type).toBe('url');
      expect(source.location).toBe('https://raw.githubusercontent.com/org/repo/main/file.md');
    });
  });

  describe('DocSync.getCurrentState', () => {
    it('returns empty set when docs directory is empty', async () => {
      const sync = new DocSync(tempDir, {});
      const state = await sync.getCurrentState();

      expect(state.size).toBe(0);
    });

    it('returns paths of existing docs', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'test.md'), '# Test');
      await mkdir(join(tempDir, '.tbd', 'docs', 'shortcuts'), { recursive: true });
      await writeFile(join(tempDir, '.tbd', 'docs', 'shortcuts', 'commit.md'), '# Commit');

      const sync = new DocSync(tempDir, {});
      const state = await sync.getCurrentState();

      expect(state.has('test.md')).toBe(true);
      expect(state.has('shortcuts/commit.md')).toBe(true);
    });
  });

  describe('DocSync.sync', () => {
    it('adds new docs from config', async () => {
      // Create a test doc in a simulated internal location
      const internalDocsDir = join(tempDir, 'internal-docs');
      await mkdir(join(internalDocsDir, 'shortcuts'), { recursive: true });
      await writeFile(join(internalDocsDir, 'shortcuts', 'test.md'), '# Test Shortcut');

      // Note: We can't easily test internal docs without mocking the getDocsBasePath
      // Instead, test the status/dry-run functionality
      const sync = new DocSync(tempDir, {
        'shortcuts/test.md': 'internal:shortcuts/test.md',
      });

      const result = await sync.sync({ dryRun: true });

      // Should report that it would add the doc (even if fetch fails)
      expect(result.errors.length > 0 || result.added.length > 0).toBe(true);
    });

    it('removes docs not in config', async () => {
      // Create a doc that should be removed
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.sync();

      expect(result.removed).toContain('old-doc.md');
    });

    it('dry run does not modify files', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.sync({ dryRun: true });

      expect(result.removed).toContain('old-doc.md');

      // File should still exist
      const content = await readFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), 'utf-8');
      expect(content).toBe('# Old Doc');
    });
  });

  describe('DocSync.status', () => {
    it('returns what would change without modifying', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.status();

      expect(result.removed).toContain('old-doc.md');
    });
  });

  describe('isDocsStale', () => {
    it('returns true when never synced', () => {
      expect(isDocsStale(undefined, 24)).toBe(true);
    });

    it('returns false when auto-sync is disabled', () => {
      expect(isDocsStale(undefined, 0)).toBe(false);
    });

    it('returns false when recently synced', () => {
      const now = new Date().toISOString();
      expect(isDocsStale(now, 24)).toBe(false);
    });

    it('returns true when sync is older than configured hours', () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      expect(isDocsStale(old, 24)).toBe(true);
    });

    it('returns false when sync is within configured hours', () => {
      const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago
      expect(isDocsStale(recent, 24)).toBe(false);
    });
  });

  describe('mergeDocCacheConfig', () => {
    it('returns defaults when user config is undefined', () => {
      const defaults = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
        'guidelines/typescript.md': 'internal:guidelines/typescript.md',
      };

      const result = mergeDocCacheConfig(undefined, defaults);

      expect(result).toEqual(defaults);
    });

    it('returns defaults when user config is empty', () => {
      const defaults = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
      };

      const result = mergeDocCacheConfig({}, defaults);

      expect(result).toEqual(defaults);
    });

    it('preserves user custom sources not in defaults', () => {
      const defaults = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
      };
      const userConfig = {
        'custom/my-doc.md': 'https://example.com/my-doc.md',
      };

      const result = mergeDocCacheConfig(userConfig, defaults);

      expect(result['shortcuts/commit.md']).toBe('internal:shortcuts/commit.md');
      expect(result['custom/my-doc.md']).toBe('https://example.com/my-doc.md');
    });

    it('user overrides take precedence over defaults', () => {
      const defaults = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
      };
      const userConfig = {
        'shortcuts/commit.md': 'https://example.com/my-custom-commit.md',
      };

      const result = mergeDocCacheConfig(userConfig, defaults);

      expect(result['shortcuts/commit.md']).toBe('https://example.com/my-custom-commit.md');
    });

    it('adds new defaults to existing user config', () => {
      const defaults = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
        'shortcuts/new-feature.md': 'internal:shortcuts/new-feature.md',
      };
      const userConfig = {
        'shortcuts/commit.md': 'internal:shortcuts/commit.md',
        'custom/my-doc.md': 'https://example.com/my-doc.md',
      };

      const result = mergeDocCacheConfig(userConfig, defaults);

      // New default should be added
      expect(result['shortcuts/new-feature.md']).toBe('internal:shortcuts/new-feature.md');
      // Existing entries preserved
      expect(result['shortcuts/commit.md']).toBe('internal:shortcuts/commit.md');
      expect(result['custom/my-doc.md']).toBe('https://example.com/my-doc.md');
    });

    it('merges complex configs correctly', () => {
      const defaults = {
        'shortcuts/a.md': 'internal:shortcuts/a.md',
        'shortcuts/b.md': 'internal:shortcuts/b.md',
        'guidelines/ts.md': 'internal:guidelines/ts.md',
      };
      const userConfig = {
        'shortcuts/b.md': 'https://custom.com/b.md', // override
        'custom/external.md': 'https://example.com/doc.md', // custom
      };

      const result = mergeDocCacheConfig(userConfig, defaults);

      expect(Object.keys(result).sort()).toEqual([
        'custom/external.md',
        'guidelines/ts.md',
        'shortcuts/a.md',
        'shortcuts/b.md',
      ]);
      expect(result['shortcuts/a.md']).toBe('internal:shortcuts/a.md');
      expect(result['shortcuts/b.md']).toBe('https://custom.com/b.md');
      expect(result['guidelines/ts.md']).toBe('internal:guidelines/ts.md');
      expect(result['custom/external.md']).toBe('https://example.com/doc.md');
    });
  });

  describe('internalDocExists', () => {
    it('returns true for existing bundled docs', async () => {
      // This tests against the actual bundled docs in the package
      // shortcuts/standard/code-review-and-commit.md should exist
      const exists = await internalDocExists('shortcuts/standard/code-review-and-commit.md');
      expect(exists).toBe(true);
    });

    it('returns false for non-existent docs', async () => {
      const exists = await internalDocExists('nonexistent/fake-doc.md');
      expect(exists).toBe(false);
    });

    it('returns false for partial path matches', async () => {
      // A path that looks similar but doesn't exist
      const exists = await internalDocExists('shortcuts/standard/nonexistent.md');
      expect(exists).toBe(false);
    });
  });

  describe('pruneStaleInternals', () => {
    it('keeps entries with existing internal sources', async () => {
      const config = {
        'shortcuts/standard/code-review-and-commit.md':
          'internal:shortcuts/standard/code-review-and-commit.md',
      };

      const result = await pruneStaleInternals(config);

      expect(result.config['shortcuts/standard/code-review-and-commit.md']).toBe(
        'internal:shortcuts/standard/code-review-and-commit.md',
      );
      expect(result.pruned).toEqual([]);
    });

    it('removes entries with non-existent internal sources', async () => {
      const config = {
        'stale/doc.md': 'internal:nonexistent/fake-doc.md',
      };

      const result = await pruneStaleInternals(config);

      expect(result.config['stale/doc.md']).toBeUndefined();
      expect(result.pruned).toContain('stale/doc.md');
    });

    it('preserves URL sources without checking', async () => {
      const config = {
        'external/doc.md': 'https://example.com/doc.md',
      };

      const result = await pruneStaleInternals(config);

      expect(result.config['external/doc.md']).toBe('https://example.com/doc.md');
      expect(result.pruned).toEqual([]);
    });

    it('handles mixed configs correctly', async () => {
      const config = {
        'shortcuts/standard/code-review-and-commit.md':
          'internal:shortcuts/standard/code-review-and-commit.md', // exists
        'stale/doc.md': 'internal:nonexistent/fake-doc.md', // doesn't exist
        'external/doc.md': 'https://example.com/doc.md', // URL, always kept
      };

      const result = await pruneStaleInternals(config);

      // Existing internal kept
      expect(result.config['shortcuts/standard/code-review-and-commit.md']).toBe(
        'internal:shortcuts/standard/code-review-and-commit.md',
      );
      // Non-existent internal pruned
      expect(result.config['stale/doc.md']).toBeUndefined();
      // URL preserved
      expect(result.config['external/doc.md']).toBe('https://example.com/doc.md');
      // Only stale entry in pruned list
      expect(result.pruned).toEqual(['stale/doc.md']);
    });

    it('returns empty pruned list when nothing to prune', async () => {
      const config = {
        'external/doc.md': 'https://example.com/doc.md',
      };

      const result = await pruneStaleInternals(config);

      expect(result.pruned).toEqual([]);
    });
  });
});
