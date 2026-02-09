/**
 * Tests for `tbd source` command - manage doc sources.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';

import { readConfig } from '../src/file/config.js';
import { addSource, listSources, removeSource } from '../src/cli/commands/source.js';

describe('source command logic', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `tbd-source-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(tempDir, '.tbd'), { recursive: true });

    // Minimal f04 config
    const config = {
      tbd_format: 'f04',
      tbd_version: '0.1.17',
      sync: { branch: 'tbd-sync', remote: 'origin' },
      display: { id_prefix: 'test' },
      settings: { auto_sync: false },
      docs_cache: {
        sources: [
          { type: 'internal', prefix: 'sys', paths: ['shortcuts'], hidden: true },
          { type: 'internal', prefix: 'tbd', paths: ['shortcuts', 'guidelines', 'templates'] },
        ],
        files: {},
        lookup_path: [],
      },
    };
    await mkdir(join(tempDir, '.tbd'), { recursive: true });
    const { writeFile: atomicWrite } = await import('atomically');
    await atomicWrite(join(tempDir, '.tbd', 'config.yml'), stringifyYaml(config));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('addSource', () => {
    it('adds a repo source to config', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/guidelines',
        prefix: 'myorg',
      });

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      const added = sources.find((s) => s.prefix === 'myorg');
      expect(added).toBeDefined();
      expect(added!.type).toBe('repo');
      expect(added!.url).toContain('github.com/org/guidelines');
      expect(added!.ref).toBe('main');
    });

    it('uses custom ref when specified', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
        ref: 'v2.0',
      });

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      const added = sources.find((s) => s.prefix === 'ext');
      expect(added!.ref).toBe('v2.0');
    });

    it('uses custom paths when specified', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
        paths: ['guidelines', 'references'],
      });

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      const added = sources.find((s) => s.prefix === 'ext');
      expect(added!.paths).toEqual(['guidelines', 'references']);
    });

    it('defaults paths to all doc types', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
      });

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      const added = sources.find((s) => s.prefix === 'ext');
      expect(added!.paths).toContain('shortcuts');
      expect(added!.paths).toContain('guidelines');
      expect(added!.paths).toContain('templates');
      expect(added!.paths).toContain('references');
    });

    it('rejects duplicate prefix', async () => {
      await expect(
        addSource(tempDir, {
          url: 'github.com/org/repo',
          prefix: 'tbd', // already exists
        }),
      ).rejects.toThrow(/prefix.*already exists/i);
    });

    it('validates prefix format', async () => {
      await expect(
        addSource(tempDir, {
          url: 'github.com/org/repo',
          prefix: 'INVALID',
        }),
      ).rejects.toThrow(/prefix/i);
    });

    it('appends source after existing sources', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
      });

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      // Should be appended at end (after sys and tbd)
      expect(sources.length).toBe(3);
      expect(sources[2]!.prefix).toBe('ext');
    });
  });

  describe('listSources', () => {
    it('returns all configured sources', async () => {
      const sources = await listSources(tempDir);
      expect(sources.length).toBe(2);
      expect(sources[0]!.prefix).toBe('sys');
      expect(sources[1]!.prefix).toBe('tbd');
    });

    it('includes newly added sources', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
      });

      const sources = await listSources(tempDir);
      expect(sources.length).toBe(3);
      expect(sources[2]!.prefix).toBe('ext');
    });
  });

  describe('removeSource', () => {
    it('removes a source by prefix', async () => {
      await addSource(tempDir, {
        url: 'github.com/org/repo',
        prefix: 'ext',
      });

      await removeSource(tempDir, 'ext');

      const config = await readConfig(tempDir);
      const sources = config.docs_cache?.sources ?? [];
      expect(sources.find((s) => s.prefix === 'ext')).toBeUndefined();
      expect(sources.length).toBe(2); // back to sys + tbd
    });

    it('throws when removing non-existent prefix', async () => {
      await expect(removeSource(tempDir, 'nonexistent')).rejects.toThrow(/no source.*nonexistent/i);
    });

    it('prevents removing internal sources', async () => {
      await expect(removeSource(tempDir, 'sys')).rejects.toThrow(/internal/i);
    });
  });
});
