/**
 * Tests for doc-types.ts - doc type registry.
 */

import { describe, it, expect } from 'vitest';
import {
  DOC_TYPES,
  inferDocType,
  getDocTypeDirectory,
  getAllDocTypeNames,
  getAllDocTypeDirectories,
} from '../src/lib/doc-types.js';
import { getDefaultDocPaths, TBD_DOCS_DIR } from '../src/lib/paths.js';
import { join } from 'node:path';

describe('doc-types', () => {
  describe('DOC_TYPES registry', () => {
    it('has all four doc types', () => {
      expect(DOC_TYPES.shortcut).toBeDefined();
      expect(DOC_TYPES.guideline).toBeDefined();
      expect(DOC_TYPES.template).toBeDefined();
      expect(DOC_TYPES.reference).toBeDefined();
    });

    it('each type has directory and plural fields', () => {
      for (const [name, type] of Object.entries(DOC_TYPES)) {
        expect(type.directory).toBeDefined();
        expect(type.directory.length).toBeGreaterThan(0);
        expect(type.plural).toBeDefined();
        expect(type.plural.length).toBeGreaterThan(0);
        expect(type.singular).toBe(name);
      }
    });

    it('shortcut type maps to shortcuts/ directory', () => {
      expect(DOC_TYPES.shortcut.directory).toBe('shortcuts');
      expect(DOC_TYPES.shortcut.plural).toBe('shortcuts');
    });

    it('guideline type maps to guidelines/ directory', () => {
      expect(DOC_TYPES.guideline.directory).toBe('guidelines');
      expect(DOC_TYPES.guideline.plural).toBe('guidelines');
    });

    it('template type maps to templates/ directory', () => {
      expect(DOC_TYPES.template.directory).toBe('templates');
      expect(DOC_TYPES.template.plural).toBe('templates');
    });

    it('reference type maps to references/ directory', () => {
      expect(DOC_TYPES.reference.directory).toBe('references');
      expect(DOC_TYPES.reference.plural).toBe('references');
    });
  });

  describe('inferDocType', () => {
    it('infers shortcut from prefix-based path', () => {
      expect(inferDocType('sys/shortcuts/skill.md')).toBe('shortcut');
      expect(inferDocType('tbd/shortcuts/code-review.md')).toBe('shortcut');
    });

    it('infers guideline from prefix-based path', () => {
      expect(inferDocType('spec/guidelines/typescript-rules.md')).toBe('guideline');
    });

    it('infers template from prefix-based path', () => {
      expect(inferDocType('tbd/templates/plan-spec.md')).toBe('template');
    });

    it('infers reference from prefix-based path', () => {
      expect(inferDocType('spec/references/api-ref.md')).toBe('reference');
    });

    it('infers from flat paths', () => {
      expect(inferDocType('shortcuts/code-review.md')).toBe('shortcut');
      expect(inferDocType('guidelines/typescript-rules.md')).toBe('guideline');
      expect(inferDocType('templates/plan-spec.md')).toBe('template');
      expect(inferDocType('references/api-ref.md')).toBe('reference');
    });

    it('infers from old-style nested paths', () => {
      expect(inferDocType('.tbd/docs/tbd/shortcuts/code-review.md')).toBe('shortcut');
      expect(inferDocType('.tbd/docs/sys/shortcuts/skill.md')).toBe('shortcut');
    });

    it('returns undefined for unrecognized paths', () => {
      expect(inferDocType('unknown/foo.md')).toBeUndefined();
      expect(inferDocType('foo.md')).toBeUndefined();
    });
  });

  describe('getDocTypeDirectory', () => {
    it('returns directory name for each type', () => {
      expect(getDocTypeDirectory('shortcut')).toBe('shortcuts');
      expect(getDocTypeDirectory('guideline')).toBe('guidelines');
      expect(getDocTypeDirectory('template')).toBe('templates');
      expect(getDocTypeDirectory('reference')).toBe('references');
    });
  });

  describe('getAllDocTypeNames', () => {
    it('returns all type names', () => {
      const names = getAllDocTypeNames();
      expect(names).toContain('shortcut');
      expect(names).toContain('guideline');
      expect(names).toContain('template');
      expect(names).toContain('reference');
      expect(names).toHaveLength(4);
    });
  });

  describe('getAllDocTypeDirectories', () => {
    it('returns all directory names', () => {
      const dirs = getAllDocTypeDirectories();
      expect(dirs).toContain('shortcuts');
      expect(dirs).toContain('guidelines');
      expect(dirs).toContain('templates');
      expect(dirs).toContain('references');
      expect(dirs).toHaveLength(4);
    });
  });

  describe('getDefaultDocPaths', () => {
    it('returns sys + tbd prefixed paths for shortcuts', () => {
      const paths = getDefaultDocPaths('shortcut');
      expect(paths).toEqual([
        join(TBD_DOCS_DIR, 'sys', 'shortcuts'),
        join(TBD_DOCS_DIR, 'tbd', 'shortcuts'),
      ]);
    });

    it('returns tbd-prefixed path for guidelines', () => {
      const paths = getDefaultDocPaths('guideline');
      expect(paths).toEqual([join(TBD_DOCS_DIR, 'tbd', 'guidelines')]);
    });

    it('returns tbd-prefixed path for templates', () => {
      const paths = getDefaultDocPaths('template');
      expect(paths).toEqual([join(TBD_DOCS_DIR, 'tbd', 'templates')]);
    });

    it('returns tbd-prefixed path for references', () => {
      const paths = getDefaultDocPaths('reference');
      expect(paths).toEqual([join(TBD_DOCS_DIR, 'tbd', 'references')]);
    });

    it('uses directory names from DOC_TYPES registry', () => {
      // Verify the function derives paths from the registry, not hardcoded
      for (const typeName of getAllDocTypeNames()) {
        const paths = getDefaultDocPaths(typeName);
        const dir = DOC_TYPES[typeName].directory;
        // Every path should contain the doc type's directory
        for (const p of paths) {
          expect(p).toContain(dir);
        }
      }
    });
  });
});
