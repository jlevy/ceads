/**
 * Tests for tbd-format.ts - format versioning and migration infrastructure.
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENT_FORMAT,
  INITIAL_FORMAT,
  FORMAT_HISTORY,
  detectFormat,
  needsMigration,
  migrateToLatest,
  isCompatibleFormat,
  describeMigration,
  type RawConfig,
} from '../src/lib/tbd-format.js';

describe('tbd-format', () => {
  describe('constants', () => {
    it('has current format', () => {
      expect(CURRENT_FORMAT).toBe('f03');
    });

    it('has initial format', () => {
      expect(INITIAL_FORMAT).toBe('f01');
    });

    it('has format history', () => {
      expect(FORMAT_HISTORY.f01).toBeDefined();
      expect(FORMAT_HISTORY.f02).toBeDefined();
      expect(FORMAT_HISTORY.f03).toBeDefined();
    });
  });

  describe('detectFormat', () => {
    it('returns INITIAL_FORMAT when no tbd_format field', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
      };
      expect(detectFormat(config)).toBe('f01');
    });

    it('returns the tbd_format value when present', () => {
      const config: RawConfig = {
        tbd_format: 'f02',
        tbd_version: '0.2.0',
      };
      expect(detectFormat(config)).toBe('f02');
    });

    it('returns CURRENT_FORMAT for unknown format', () => {
      const config: RawConfig = {
        tbd_format: 'f99',
        tbd_version: '9.0.0',
      };
      expect(detectFormat(config)).toBe(CURRENT_FORMAT);
    });
  });

  describe('needsMigration', () => {
    it('returns true when format is f01', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
      };
      expect(needsMigration(config)).toBe(true);
    });

    it('returns false when format is current', () => {
      const config: RawConfig = {
        tbd_format: CURRENT_FORMAT,
        tbd_version: '0.2.0',
      };
      expect(needsMigration(config)).toBe(false);
    });
  });

  describe('migrateToLatest', () => {
    it('migrates f01 to f03 (through f02)', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
        display: { id_prefix: 'test' },
        sync: { branch: 'tbd-sync', remote: 'origin' },
        settings: { auto_sync: false },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f01');
      expect(result.toFormat).toBe('f03');
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe('f03');
      expect(result.config.settings?.doc_auto_sync_hours).toBe(24);
      expect(result.changes).toContain('Added tbd_format: f02');
      expect(result.changes).toContain('Added settings.doc_auto_sync_hours: 24');
      expect(result.changes).toContain('Updated tbd_format: f03');
    });

    it('migrates f02 to f03', () => {
      const config: RawConfig = {
        tbd_format: 'f02',
        tbd_version: '0.1.5',
        display: { id_prefix: 'test' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
        doc_cache: { 'shortcuts/test.md': 'internal:shortcuts/test.md' },
        docs: { paths: ['.tbd/docs/custom', '.tbd/docs/standard'] },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f02');
      expect(result.toFormat).toBe('f03');
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe('f03');
      // doc_cache moved to docs_cache.files
      expect(result.config.doc_cache).toBeUndefined();
      expect(result.config.docs_cache?.files).toEqual({
        'shortcuts/test.md': 'internal:shortcuts/test.md',
      });
      // docs.paths moved to docs_cache.lookup_path
      expect(result.config.docs).toBeUndefined();
      expect(result.config.docs_cache?.lookup_path).toEqual([
        '.tbd/docs/custom',
        '.tbd/docs/standard',
      ]);
    });

    it('does not modify already current config', () => {
      const config: RawConfig = {
        tbd_format: 'f03',
        tbd_version: '0.1.6',
        display: { id_prefix: 'test' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
        docs_cache: {
          files: { 'shortcuts/test.md': 'internal:shortcuts/test.md' },
          lookup_path: ['.tbd/docs/shortcuts/system'],
        },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f03');
      expect(result.toFormat).toBe('f03');
      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.config.settings?.doc_auto_sync_hours).toBe(12);
    });

    it('preserves existing settings when migrating', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
        display: { id_prefix: 'myapp' },
        sync: { branch: 'custom-sync', remote: 'upstream' },
        settings: { auto_sync: true },
      };

      const result = migrateToLatest(config);

      expect(result.config.display?.id_prefix).toBe('myapp');
      expect(result.config.sync?.branch).toBe('custom-sync');
      expect(result.config.sync?.remote).toBe('upstream');
      expect(result.config.settings?.auto_sync).toBe(true);
    });
  });

  describe('isCompatibleFormat', () => {
    it('returns true for f01', () => {
      expect(isCompatibleFormat('f01')).toBe(true);
    });

    it('returns true for f02', () => {
      expect(isCompatibleFormat('f02')).toBe(true);
    });

    it('returns true for f03', () => {
      expect(isCompatibleFormat('f03')).toBe(true);
    });

    it('returns false for unknown future format', () => {
      expect(isCompatibleFormat('f99')).toBe(false);
    });
  });

  describe('describeMigration', () => {
    it('describes f01 migration (two steps)', () => {
      const descriptions = describeMigration('f01');
      expect(descriptions).toHaveLength(2);
      expect(descriptions[0]).toContain('f01 → f02');
      expect(descriptions[1]).toContain('f02 → f03');
    });

    it('describes f02 migration', () => {
      const descriptions = describeMigration('f02');
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]).toContain('f02 → f03');
    });

    it('returns empty for current format', () => {
      const descriptions = describeMigration('f03');
      expect(descriptions).toHaveLength(0);
    });
  });
});
