/**
 * Tests for subdirectory support in tbd.
 *
 * Verifies that tbd correctly finds the repository root when running from subdirectories,
 * similar to how git finds .git/ directories by walking up the directory tree.
 *
 * @see cli-subdirectory.tryscript.md for golden tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initConfig,
  isInitialized,
  findTbdRoot,
  writeLocalState,
  readLocalState,
} from '../src/file/config.js';

describe('subdirectory support', () => {
  let tempDir: string;
  let tbdRootDir: string;

  beforeEach(async () => {
    // Create a temp directory structure:
    // tempDir/
    //   repo/           <- tbd root (has .tbd/)
    //     src/
    //       components/
    //         ui/
    //     docs/
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-subdir-test-'));
    tbdRootDir = join(tempDir, 'repo');

    // Create directory structure
    await mkdir(tbdRootDir, { recursive: true });
    await mkdir(join(tbdRootDir, 'src', 'components', 'ui'), { recursive: true });
    await mkdir(join(tbdRootDir, 'docs'), { recursive: true });

    // Initialize tbd at root
    await initConfig(tbdRootDir, '3.0.0', 'test');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('isInitialized', () => {
    it('returns true for tbd root directory', async () => {
      const result = await isInitialized(tbdRootDir);
      expect(result).toBe(true);
    });

    it('returns false for parent of tbd root', async () => {
      // tempDir is parent of repo, should not be initialized
      const result = await isInitialized(tempDir);
      expect(result).toBe(false);
    });

    it('returns true for first-level subdirectory', async () => {
      const srcDir = join(tbdRootDir, 'src');
      const result = await isInitialized(srcDir);
      expect(result).toBe(true);
    });

    it('returns true for deeply nested subdirectory', async () => {
      const deepDir = join(tbdRootDir, 'src', 'components', 'ui');
      const result = await isInitialized(deepDir);
      expect(result).toBe(true);
    });

    it('returns true for docs subdirectory', async () => {
      const docsDir = join(tbdRootDir, 'docs');
      const result = await isInitialized(docsDir);
      expect(result).toBe(true);
    });
  });

  describe('findTbdRoot', () => {
    it('returns root when called from root', async () => {
      const root = await findTbdRoot(tbdRootDir);
      expect(root).toBe(tbdRootDir);
    });

    it('returns root when called from first-level subdirectory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'src'));
      expect(root).toBe(tbdRootDir);
    });

    it('returns root when called from deeply nested directory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'src', 'components', 'ui'));
      expect(root).toBe(tbdRootDir);
    });

    it('returns null when not in a tbd repo', async () => {
      const root = await findTbdRoot(tempDir);
      expect(root).toBeNull();
    });

    it('returns null at filesystem root', async () => {
      const root = await findTbdRoot('/');
      expect(root).toBeNull();
    });

    it('returns root when called from docs subdirectory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'docs'));
      expect(root).toBe(tbdRootDir);
    });
  });

  describe('spurious .tbd/ directory handling', () => {
    it('ignores .tbd/ directory in subdirectory that has no config.yml', async () => {
      // Simulate a bug that creates .tbd/ in a subdirectory with only state.yml
      const webDir = join(tbdRootDir, 'web');
      await mkdir(webDir, { recursive: true });
      await mkdir(join(webDir, '.tbd'), { recursive: true });
      await writeFile(join(webDir, '.tbd', 'state.yml'), 'welcome_seen: true\n');

      // findTbdRoot should skip the spurious web/.tbd/ and find the real root
      const root = await findTbdRoot(webDir);
      expect(root).toBe(tbdRootDir);
    });

    it('ignores empty .tbd/ directory in subdirectory', async () => {
      // Create an empty .tbd/ directory in a subdirectory
      const srcDir = join(tbdRootDir, 'src');
      await mkdir(join(srcDir, '.tbd'), { recursive: true });

      // Should still find the real root, not src/
      const root = await findTbdRoot(srcDir);
      expect(root).toBe(tbdRootDir);
    });

    it('isInitialized returns true even with spurious .tbd/ in subdirectory', async () => {
      // Create spurious .tbd/ in subdirectory
      const webDir = join(tbdRootDir, 'web');
      await mkdir(webDir, { recursive: true });
      await mkdir(join(webDir, '.tbd'), { recursive: true });

      // isInitialized should still find the real root
      const result = await isInitialized(webDir);
      expect(result).toBe(true);
    });

    it('ignores .tbd/ directory with only random files (no config.yml)', async () => {
      const subDir = join(tbdRootDir, 'packages', 'app');
      await mkdir(subDir, { recursive: true });
      await mkdir(join(subDir, '.tbd'), { recursive: true });
      await writeFile(join(subDir, '.tbd', 'random.txt'), 'not a config\n');

      const root = await findTbdRoot(subDir);
      expect(root).toBe(tbdRootDir);
    });

    it('returns null when only spurious .tbd/ exists (no real root above)', async () => {
      // Directory outside any tbd repo with a spurious .tbd/ directory
      const orphanDir = join(tempDir, 'orphan');
      await mkdir(orphanDir, { recursive: true });
      await mkdir(join(orphanDir, '.tbd'), { recursive: true });
      await writeFile(join(orphanDir, '.tbd', 'state.yml'), 'welcome_seen: true\n');

      const root = await findTbdRoot(orphanDir);
      expect(root).toBeNull();
    });
  });

  describe('writeLocalState safety', () => {
    it('writes state to existing .tbd/ directory at root', async () => {
      await writeLocalState(tbdRootDir, { welcome_seen: true });
      const state = await readLocalState(tbdRootDir);
      expect(state.welcome_seen).toBe(true);
    });

    it('does not create .tbd/ in subdirectory when called with wrong path', async () => {
      const webDir = join(tbdRootDir, 'web');
      await mkdir(webDir, { recursive: true });

      // writeLocalState should fail if .tbd/ doesn't exist (not create it)
      await expect(writeLocalState(webDir, { welcome_seen: true })).rejects.toThrow();
    });
  });
});
