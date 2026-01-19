/**
 * Tests for subdirectory support in tbd.
 *
 * Bug: tbd commands fail when run from subdirectories within a tbd repository.
 * The CLI should find the tbd root by walking up the directory tree.
 *
 * @see cli-subdirectory.tryscript.md for golden tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initConfig, isInitialized } from '../src/file/config.js';

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

    /**
     * BUG: This test demonstrates the current broken behavior.
     * isInitialized returns false for subdirectories because it only
     * checks the immediate directory, not parent directories.
     *
     * Expected: true (should find .tbd/ in parent)
     * Actual: false (only checks current directory)
     */
    it('BUG: returns false for first-level subdirectory (should return true)', async () => {
      const srcDir = join(tbdRootDir, 'src');
      const result = await isInitialized(srcDir);

      // This documents the current BROKEN behavior
      expect(result).toBe(false);

      // TODO: After fix, this should be:
      // expect(result).toBe(true);
    });

    it('BUG: returns false for deeply nested subdirectory (should return true)', async () => {
      const deepDir = join(tbdRootDir, 'src', 'components', 'ui');
      const result = await isInitialized(deepDir);

      // This documents the current BROKEN behavior
      expect(result).toBe(false);

      // TODO: After fix, this should be:
      // expect(result).toBe(true);
    });

    it('BUG: returns false for docs subdirectory (should return true)', async () => {
      const docsDir = join(tbdRootDir, 'docs');
      const result = await isInitialized(docsDir);

      // This documents the current BROKEN behavior
      expect(result).toBe(false);

      // TODO: After fix, this should be:
      // expect(result).toBe(true);
    });
  });

  /**
   * Future tests for findTbdRoot function (to be implemented).
   *
   * The fix should add a function like:
   *   export async function findTbdRoot(startDir: string): Promise<string | null>
   *
   * Which walks up the directory tree looking for .tbd/
   */
  describe.skip('findTbdRoot (to be implemented)', () => {
    it('should return root when called from root', async () => {
      // const root = await findTbdRoot(tbdRootDir);
      // expect(root).toBe(tbdRootDir);
    });

    it('should return root when called from subdirectory', async () => {
      // const root = await findTbdRoot(join(tbdRootDir, 'src'));
      // expect(root).toBe(tbdRootDir);
    });

    it('should return root when called from deeply nested directory', async () => {
      // const root = await findTbdRoot(join(tbdRootDir, 'src', 'components', 'ui'));
      // expect(root).toBe(tbdRootDir);
    });

    it('should return null when not in a tbd repo', async () => {
      // const root = await findTbdRoot(tempDir);
      // expect(root).toBeNull();
    });

    it('should return null at filesystem root', async () => {
      // const root = await findTbdRoot('/');
      // expect(root).toBeNull();
    });
  });
});
