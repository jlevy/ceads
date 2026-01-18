/**
 * Tests for config operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig, writeConfig, initConfig, CONFIG_FILE_PATH } from '../src/file/config.js';
import type { Config } from '../src/lib/types.js';

describe('config operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initConfig', () => {
    it('creates config file with defaults', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const configPath = join(tempDir, CONFIG_FILE_PATH);
      const content = await readFile(configPath, 'utf-8');

      expect(content).toContain('tbd_version: 3.0.0');
      expect(content).toContain('branch: tbd-sync');
      expect(content).toContain('id_prefix: test');
    });

    it('creates .tbd directory', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const { stat } = await import('node:fs/promises');
      const tbdDir = await stat(join(tempDir, '.tbd'));
      expect(tbdDir.isDirectory()).toBe(true);
    });
  });

  describe('readConfig', () => {
    it('reads existing config', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const config = await readConfig(tempDir);

      expect(config.tbd_version).toBe('3.0.0');
      expect(config.sync.branch).toBe('tbd-sync');
      expect(config.sync.remote).toBe('origin');
      expect(config.display.id_prefix).toBe('test');
    });

    it('throws when config does not exist', async () => {
      await expect(readConfig(tempDir)).rejects.toThrow();
    });
  });

  describe('writeConfig', () => {
    it('writes config to file', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const config: Config = {
        tbd_version: '3.1.0',
        sync: { branch: 'custom-branch', remote: 'upstream' },
        display: { id_prefix: 'td' },
        settings: { auto_sync: true, index_enabled: false },
      };

      await writeConfig(tempDir, config);
      const read = await readConfig(tempDir);

      expect(read.tbd_version).toBe('3.1.0');
      expect(read.sync.branch).toBe('custom-branch');
      expect(read.sync.remote).toBe('upstream');
      expect(read.display.id_prefix).toBe('td');
      expect(read.settings.auto_sync).toBe(true);
      expect(read.settings.index_enabled).toBe(false);
    });
  });
});
