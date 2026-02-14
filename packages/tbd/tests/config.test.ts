/**
 * Tests for config operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readConfig,
  writeConfig,
  initConfig,
  readLocalState,
  updateLocalState,
  hasSeenWelcome,
  markWelcomeSeen,
} from '../src/file/config.js';
import { CONFIG_FILE } from '../src/lib/paths.js';
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

      const configPath = join(tempDir, CONFIG_FILE);
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
        tbd_format: 'f02',
        tbd_version: '3.1.0',
        sync: { branch: 'custom-branch', remote: 'upstream' },
        display: { id_prefix: 'td' },
        settings: { auto_sync: true, doc_auto_sync_hours: 24, use_gh_cli: true },
        docs_cache: { lookup_path: ['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'] },
      };

      await writeConfig(tempDir, config);
      const read = await readConfig(tempDir);

      expect(read.tbd_version).toBe('3.1.0');
      expect(read.sync.branch).toBe('custom-branch');
      expect(read.sync.remote).toBe('upstream');
      expect(read.display.id_prefix).toBe('td');
      expect(read.settings.auto_sync).toBe(true);
    });
  });

  describe('local state with welcome_seen', () => {
    it('returns empty state when no state file exists', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBeUndefined();
    });

    it('stores and reads welcome_seen', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { welcome_seen: true });

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
    });

    it('preserves other state fields when updating welcome_seen', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { last_sync_at: '2026-01-01T00:00:00Z' });
      await updateLocalState(tempDir, { welcome_seen: true });

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
      expect(state.last_sync_at).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('welcome tracking utilities', () => {
    it('hasSeenWelcome returns false when no state exists', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      expect(await hasSeenWelcome(tempDir)).toBe(false);
    });

    it('markWelcomeSeen sets welcome_seen to true', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await markWelcomeSeen(tempDir);
      expect(await hasSeenWelcome(tempDir)).toBe(true);
    });

    it('markWelcomeSeen preserves existing state', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { last_sync_at: '2026-01-01T00:00:00Z' });
      await markWelcomeSeen(tempDir);

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
      expect(state.last_sync_at).toBe('2026-01-01T00:00:00Z');
    });
  });
});
