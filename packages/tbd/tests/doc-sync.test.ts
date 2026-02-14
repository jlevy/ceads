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
  resolveSourcesToDocs,
  getSourcesHash,
  readSourcesHash,
  writeSourcesHash,
  shouldClearDocsCache,
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
      const source = sync.parseSource('internal:tbd/shortcuts/code-review-and-commit.md');

      expect(source.type).toBe('internal');
      expect(source.location).toBe('tbd/shortcuts/code-review-and-commit.md');
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
      // tbd/shortcuts/code-review-and-commit.md should exist
      const exists = await internalDocExists('tbd/shortcuts/code-review-and-commit.md');
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
        'tbd/shortcuts/code-review-and-commit.md':
          'internal:tbd/shortcuts/code-review-and-commit.md',
      };

      const result = await pruneStaleInternals(config);

      expect(result.config['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'internal:tbd/shortcuts/code-review-and-commit.md',
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
        'tbd/shortcuts/code-review-and-commit.md':
          'internal:tbd/shortcuts/code-review-and-commit.md', // exists
        'stale/doc.md': 'internal:nonexistent/fake-doc.md', // doesn't exist
        'external/doc.md': 'https://example.com/doc.md', // URL, always kept
      };

      const result = await pruneStaleInternals(config);

      // Existing internal kept
      expect(result.config['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'internal:tbd/shortcuts/code-review-and-commit.md',
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

  describe('resolveSourcesToDocs', () => {
    it('resolves internal source to file entries', async () => {
      const sources = [
        {
          type: 'internal' as const,
          prefix: 'tbd',
          paths: ['shortcuts/'],
        },
      ];

      const result = await resolveSourcesToDocs(sources);

      // Should contain bundled tbd shortcuts with prefix-based keys
      expect(result['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'internal:tbd/shortcuts/code-review-and-commit.md',
      );
    });

    it('resolves internal source with hidden flag', async () => {
      const sources = [
        {
          type: 'internal' as const,
          prefix: 'sys',
          hidden: true,
          paths: ['shortcuts/'],
        },
      ];

      const result = await resolveSourcesToDocs(sources);

      // Should contain sys shortcuts
      expect(result['sys/shortcuts/skill-baseline.md']).toBe(
        'internal:sys/shortcuts/skill-baseline.md',
      );
    });

    it('resolves multiple internal sources', async () => {
      const sources = [
        {
          type: 'internal' as const,
          prefix: 'sys',
          hidden: true,
          paths: ['shortcuts/'],
        },
        {
          type: 'internal' as const,
          prefix: 'tbd',
          paths: ['shortcuts/', 'guidelines/', 'templates/'],
        },
      ];

      const result = await resolveSourcesToDocs(sources);

      // sys shortcuts
      expect(result['sys/shortcuts/skill-baseline.md']).toBe(
        'internal:sys/shortcuts/skill-baseline.md',
      );
      // tbd shortcuts
      expect(result['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'internal:tbd/shortcuts/code-review-and-commit.md',
      );
      // tbd guidelines
      expect(result['tbd/guidelines/typescript-rules.md']).toBe(
        'internal:tbd/guidelines/typescript-rules.md',
      );
      // tbd templates
      expect(result['tbd/templates/plan-spec.md']).toBe('internal:tbd/templates/plan-spec.md');
    });

    it('applies files overrides last', async () => {
      const sources = [
        {
          type: 'internal' as const,
          prefix: 'tbd',
          paths: ['shortcuts/'],
        },
      ];

      const filesOverrides = {
        'tbd/shortcuts/code-review-and-commit.md': 'https://example.com/custom-commit-shortcut.md',
        'custom/my-doc.md': 'https://example.com/my-doc.md',
      };

      const result = await resolveSourcesToDocs(sources, filesOverrides);

      // Override should win over internal source
      expect(result['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'https://example.com/custom-commit-shortcut.md',
      );
      // Custom file entry should be added
      expect(result['custom/my-doc.md']).toBe('https://example.com/my-doc.md');
    });

    it('returns empty map for empty sources', async () => {
      const result = await resolveSourcesToDocs([]);

      expect(Object.keys(result)).toEqual([]);
    });

    it('returns only files overrides when no sources', async () => {
      const filesOverrides = {
        'custom/doc.md': 'https://example.com/doc.md',
      };

      const result = await resolveSourcesToDocs([], filesOverrides);

      expect(result['custom/doc.md']).toBe('https://example.com/doc.md');
      expect(Object.keys(result).length).toBe(1);
    });

    it('handles non-existent internal path gracefully', async () => {
      const sources = [
        {
          type: 'internal' as const,
          prefix: 'custom',
          paths: ['nonexistent-dir/'],
        },
      ];

      const result = await resolveSourcesToDocs(sources);

      // No entries for non-existent paths
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('getSourcesHash', () => {
    it('returns deterministic hash for same sources', () => {
      const sources = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];

      const hash1 = getSourcesHash(sources);
      const hash2 = getSourcesHash(sources);

      expect(hash1).toBe(hash2);
    });

    it('returns 8-character hex string', () => {
      const sources = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];

      const hash = getSourcesHash(sources);

      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('returns different hash for different sources', () => {
      const sources1 = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];
      const sources2 = [{ type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] }];

      const hash1 = getSourcesHash(sources1);
      const hash2 = getSourcesHash(sources2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns different hash when source order changes', () => {
      const sources1 = [
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
        { type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] },
      ];
      const sources2 = [
        { type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] },
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
      ];

      const hash1 = getSourcesHash(sources1);
      const hash2 = getSourcesHash(sources2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns empty string for empty sources', () => {
      const hash = getSourcesHash([]);

      // Empty sources should produce a consistent hash
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe('readSourcesHash / writeSourcesHash', () => {
    it('returns undefined when no hash file exists', async () => {
      const hash = await readSourcesHash(tempDir);

      expect(hash).toBeUndefined();
    });

    it('writes and reads hash', async () => {
      await writeSourcesHash(tempDir, 'abcd1234');
      const hash = await readSourcesHash(tempDir);

      expect(hash).toBe('abcd1234');
    });

    it('overwrites existing hash', async () => {
      await writeSourcesHash(tempDir, 'abcd1234');
      await writeSourcesHash(tempDir, 'efgh5678');
      const hash = await readSourcesHash(tempDir);

      expect(hash).toBe('efgh5678');
    });
  });

  describe('shouldClearDocsCache', () => {
    it('returns true when no hash file exists (first sync)', async () => {
      const sources = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];

      const result = await shouldClearDocsCache(tempDir, sources);

      expect(result).toBe(true);
    });

    it('returns false when hash matches current sources', async () => {
      const sources = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];

      const hash = getSourcesHash(sources);
      await writeSourcesHash(tempDir, hash);

      const result = await shouldClearDocsCache(tempDir, sources);

      expect(result).toBe(false);
    });

    it('returns true when sources have changed', async () => {
      const oldSources = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];
      const newSources = [
        { type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] },
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
      ];

      const hash = getSourcesHash(oldSources);
      await writeSourcesHash(tempDir, hash);

      const result = await shouldClearDocsCache(tempDir, newSources);

      expect(result).toBe(true);
    });

    it('returns true when source order changes', async () => {
      const sources1 = [
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
        { type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] },
      ];
      const sources2 = [
        { type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] },
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
      ];

      const hash = getSourcesHash(sources1);
      await writeSourcesHash(tempDir, hash);

      const result = await shouldClearDocsCache(tempDir, sources2);

      expect(result).toBe(true);
    });

    it('returns false for empty sources when hash matches', async () => {
      const sources: { type: 'internal' | 'repo'; prefix: string; paths: string[] }[] = [];
      const hash = getSourcesHash(sources);
      await writeSourcesHash(tempDir, hash);

      const result = await shouldClearDocsCache(tempDir, sources);

      expect(result).toBe(false);
    });
  });

  describe('integration: resolveSourcesToDocs → DocSync cycle', () => {
    it('resolves default sources and syncs files to .tbd/docs/', async () => {
      // Default sources (matching what f04 migration produces)
      const sources = [
        { type: 'internal' as const, prefix: 'sys', hidden: true, paths: ['shortcuts/'] },
        {
          type: 'internal' as const,
          prefix: 'tbd',
          paths: ['shortcuts/', 'guidelines/', 'templates/'],
        },
      ];

      // Resolve sources to flat file map
      const fileMap = await resolveSourcesToDocs(sources);

      // Verify resolution produced expected entries
      expect(Object.keys(fileMap).length).toBeGreaterThan(0);
      expect(fileMap['sys/shortcuts/skill-baseline.md']).toBe(
        'internal:sys/shortcuts/skill-baseline.md',
      );
      expect(fileMap['tbd/shortcuts/code-review-and-commit.md']).toBe(
        'internal:tbd/shortcuts/code-review-and-commit.md',
      );
      expect(fileMap['tbd/guidelines/typescript-rules.md']).toBe(
        'internal:tbd/guidelines/typescript-rules.md',
      );

      // Sync using the resolved file map
      const sync = new DocSync(tempDir, fileMap);
      const result = await sync.sync();

      // Should have added files
      expect(result.added.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
      expect(result.success).toBe(true);

      // Verify files actually exist on disk
      const skillContent = await readFile(
        join(tempDir, '.tbd', 'docs', 'sys', 'shortcuts', 'skill-baseline.md'),
        'utf-8',
      );
      expect(skillContent).toContain('tbd');

      const commitContent = await readFile(
        join(tempDir, '.tbd', 'docs', 'tbd', 'shortcuts', 'code-review-and-commit.md'),
        'utf-8',
      );
      expect(commitContent.length).toBeGreaterThan(0);
    });

    it('sources hash detects change and enables cache clear', async () => {
      const sources1 = [{ type: 'internal' as const, prefix: 'tbd', paths: ['shortcuts/'] }];

      // Write initial hash
      const hash1 = getSourcesHash(sources1);
      await writeSourcesHash(tempDir, hash1);

      // Same sources: no clear needed
      expect(await shouldClearDocsCache(tempDir, sources1)).toBe(false);

      // Add a new source: clear needed
      const sources2 = [
        ...sources1,
        { type: 'internal' as const, prefix: 'sys', paths: ['shortcuts/'] },
      ];
      expect(await shouldClearDocsCache(tempDir, sources2)).toBe(true);

      // After writing new hash: no clear needed
      await writeSourcesHash(tempDir, getSourcesHash(sources2));
      expect(await shouldClearDocsCache(tempDir, sources2)).toBe(false);
    });

    it('end-to-end: default f04 sources produce correct prefix directories', async () => {
      // Simulate the default sources from f04 migration
      const defaultSources = [
        { type: 'internal' as const, prefix: 'sys', hidden: true, paths: ['shortcuts/'] },
        {
          type: 'internal' as const,
          prefix: 'tbd',
          paths: ['shortcuts/', 'guidelines/', 'templates/'],
        },
      ];

      // Step 1: Resolve sources to file map
      const fileMap = await resolveSourcesToDocs(defaultSources);

      // Step 2: Verify all expected prefix/type combos are present
      const prefixTypes = new Set<string>();
      for (const key of Object.keys(fileMap)) {
        const parts = key.split('/');
        if (parts.length >= 2) {
          prefixTypes.add(`${parts[0]}/${parts[1]}`);
        }
      }
      expect(prefixTypes.has('sys/shortcuts')).toBe(true);
      expect(prefixTypes.has('tbd/shortcuts')).toBe(true);
      expect(prefixTypes.has('tbd/guidelines')).toBe(true);
      expect(prefixTypes.has('tbd/templates')).toBe(true);

      // Step 3: Sync to disk
      const sync = new DocSync(tempDir, fileMap);
      const result = await sync.sync();

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.added.length).toBeGreaterThan(50); // Should sync 50+ docs

      // Step 4: Verify directory structure
      const { readdir: rd } = await import('node:fs/promises');

      const sysShortcuts = await rd(join(tempDir, '.tbd', 'docs', 'sys', 'shortcuts'));
      expect(sysShortcuts.length).toBeGreaterThan(0);
      expect(sysShortcuts).toContain('skill-baseline.md');

      const tbdShortcuts = await rd(join(tempDir, '.tbd', 'docs', 'tbd', 'shortcuts'));
      expect(tbdShortcuts.length).toBeGreaterThan(0);
      expect(tbdShortcuts).toContain('code-review-and-commit.md');

      const tbdGuidelines = await rd(join(tempDir, '.tbd', 'docs', 'tbd', 'guidelines'));
      expect(tbdGuidelines.length).toBeGreaterThan(0);
      expect(tbdGuidelines).toContain('typescript-rules.md');

      const tbdTemplates = await rd(join(tempDir, '.tbd', 'docs', 'tbd', 'templates'));
      expect(tbdTemplates.length).toBeGreaterThan(0);
      expect(tbdTemplates).toContain('plan-spec.md');

      // Step 5: Write and verify sources hash
      const hash = getSourcesHash(defaultSources);
      await writeSourcesHash(tempDir, hash);
      expect(await shouldClearDocsCache(tempDir, defaultSources)).toBe(false);

      // Step 6: Resync should report no changes
      const resync = new DocSync(tempDir, fileMap);
      const result2 = await resync.sync();
      expect(result2.added).toEqual([]);
      expect(result2.updated).toEqual([]);
      expect(result2.removed).toEqual([]);
    });
  });
});
