/**
 * Tests for prefix validation and beads prefix extraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('prefix-detection', () => {
  // We'll import dynamically to mock dependencies
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-prefix-test-'));
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('normalizePrefix', () => {
    it('lowercases the prefix', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('MyApp')).toBe('myapp');
    });

    it('removes invalid characters', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('my-app')).toBe('myapp');
      expect(normalizePrefix('my_app')).toBe('myapp');
      expect(normalizePrefix('my.app')).toBe('myapp');
    });

    it('truncates long prefixes', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      const longPrefix = 'verylongprojectname';
      const normalized = normalizePrefix(longPrefix);
      expect(normalized.length).toBeLessThanOrEqual(10);
    });

    it('handles empty string', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('')).toBe('');
    });
  });

  describe('isValidPrefix', () => {
    it('accepts valid prefixes', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('proj')).toBe(true);
      expect(isValidPrefix('tbd')).toBe(true);
      expect(isValidPrefix('myapp')).toBe(true);
      expect(isValidPrefix('a')).toBe(true);
    });

    it('rejects invalid prefixes', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('')).toBe(false);
      expect(isValidPrefix('my-app')).toBe(false); // has hyphen
      expect(isValidPrefix('my_app')).toBe(false); // has underscore
      expect(isValidPrefix('123')).toBe(false); // starts with number
      expect(isValidPrefix('MY APP')).toBe(false); // has space
    });

    it('rejects prefixes that are too long', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('verylongprojectname')).toBe(false);
    });
  });

  describe('getBeadsPrefix', () => {
    it('returns null when no beads config exists', async () => {
      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBeNull();
    });

    it('extracts prefix from beads config', async () => {
      // Create .beads/config.yaml with a prefix
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: myproj\n');

      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBe('myproj');
    });

    it('returns null for invalid beads config', async () => {
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'invalid yaml: [');

      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBeNull();
    });
  });
});
