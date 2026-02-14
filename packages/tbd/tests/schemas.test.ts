/**
 * Tests for Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  IssueSchema,
  IssueId,
  ShortId,
  ExternalIssueIdInput,
  ConfigSchema,
  DocsSourceSchema,
  DocsCacheSchema,
} from '../src/lib/schemas.js';

// Sample valid ULID for testing (26 lowercase alphanumeric chars)
const VALID_ULID = '01hx5zzkbkactav9wevgemmvrz';
const VALID_ULID_2 = '01hx5zzkbkbctav9wevgemmvrs';
const VALID_ULID_3 = '01hx5zzkbkcdtav9wevgemmvrt';

describe('IssueId', () => {
  it('accepts valid ULID-based issue IDs', () => {
    expect(IssueId.safeParse(`is-${VALID_ULID}`).success).toBe(true);
    expect(IssueId.safeParse('is-00000000000000000000000000').success).toBe(true);
    expect(IssueId.safeParse('is-zzzzzzzzzzzzzzzzzzzzzzzzzz').success).toBe(true);
  });

  it('rejects invalid issue IDs', () => {
    expect(IssueId.safeParse('is-a1b2').success).toBe(false); // too short
    expect(IssueId.safeParse('is-a1b2c3').success).toBe(false); // old 6-char format
    expect(IssueId.safeParse(`bd-${VALID_ULID}`).success).toBe(false); // wrong prefix
    expect(IssueId.safeParse(`is-${VALID_ULID.toUpperCase()}`).success).toBe(false); // uppercase
    expect(IssueId.safeParse('is-01hx5zzkbkactav9wevgemmvrz!').success).toBe(false); // invalid char
  });
});

describe('ShortId', () => {
  it('accepts valid short IDs', () => {
    expect(ShortId.safeParse('a7k2').success).toBe(true);
    expect(ShortId.safeParse('b3m9x').success).toBe(true);
    expect(ShortId.safeParse('0000').success).toBe(true);
    expect(ShortId.safeParse('zzzz').success).toBe(true);
  });

  it('rejects invalid short IDs', () => {
    expect(ShortId.safeParse('').success).toBe(false); // empty
    expect(ShortId.safeParse('ABC1').success).toBe(false); // uppercase
    expect(ShortId.safeParse('a b').success).toBe(false); // contains space
  });

  it('accepts short IDs of various lengths for import preservation', () => {
    // New IDs are 4 chars, but imports can preserve longer IDs like "100" from "tbd-100"
    expect(ShortId.safeParse('1').success).toBe(true);
    expect(ShortId.safeParse('100').success).toBe(true);
    expect(ShortId.safeParse('abc').success).toBe(true);
    expect(ShortId.safeParse('abcdef').success).toBe(true);
  });

  it('accepts short IDs with special characters from imports', () => {
    // Imports may have dots (legacy hierarchical), dashes, or underscores
    expect(ShortId.safeParse('208.1').success).toBe(true); // legacy dotted
    expect(ShortId.safeParse('stat-open').success).toBe(true); // dash
    expect(ShortId.safeParse('stat-in_progress').success).toBe(true); // dash and underscore
    expect(ShortId.safeParse('a-b').success).toBe(true); // simple dash
    expect(ShortId.safeParse('a_b').success).toBe(true); // simple underscore
  });
});

describe('ExternalIssueIdInput', () => {
  it('accepts valid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('bd-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('proj-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2x').success).toBe(true); // 5 chars
  });

  it('accepts preserved import IDs of various lengths', () => {
    // Import preserves IDs like "100" from "tbd-100"
    expect(ExternalIssueIdInput.safeParse('bd-100').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('bd-abc').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('bd-abcdef').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('100').success).toBe(true);
  });

  it('rejects invalid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('').success).toBe(false); // empty
    expect(ExternalIssueIdInput.safeParse('bd-').success).toBe(false); // prefix only
    expect(ExternalIssueIdInput.safeParse('BD-a7k2').success).toBe(false); // uppercase prefix
  });
});

describe('IssueSchema', () => {
  it('parses a minimal valid issue', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test issue',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('task'); // default
      expect(result.data.status).toBe('open'); // default
      expect(result.data.priority).toBe(2); // default
      expect(result.data.labels).toEqual([]); // default
    }
  });

  it('parses a complete issue', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 5,
      title: 'Fix authentication bug',
      description: 'Users are logged out after 5 minutes.',
      notes: 'Found issue in session.ts',
      kind: 'bug',
      status: 'in_progress',
      priority: 1,
      assignee: 'alice',
      labels: ['backend', 'security'],
      dependencies: [{ type: 'blocks', target: `is-${VALID_ULID_2}` }],
      parent_id: `is-${VALID_ULID_3}`,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      created_by: 'bob',
      due_date: '2025-02-01T00:00:00Z',
      extensions: { github: { issue_number: 123 } },
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Fix authentication bug');
      expect(result.data.labels).toEqual(['backend', 'security']);
      expect(result.data.extensions?.github).toEqual({ issue_number: 123 });
    }
  });

  it('rejects invalid status', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test',
      status: 'invalid_status',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test',
      priority: 5, // invalid: max is 4
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(false);
  });

  describe('spec_path field', () => {
    it('accepts valid spec_path strings', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: 'docs/project/specs/active/plan-2026-01-26-feature.md',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
      }
    });

    it('accepts missing spec_path (undefined)', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBeUndefined();
      }
    });

    it('accepts null spec_path', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBeNull();
      }
    });

    it('accepts short spec_path like filename only', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: 'feature.md',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBe('feature.md');
      }
    });
  });
});

describe('ConfigSchema', () => {
  it('parses minimal config with defaults', () => {
    // Note: display.id_prefix is now required (no default)
    const config = {
      tbd_version: '3.0.0',
      display: { id_prefix: 'proj' },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sync.branch).toBe('tbd-sync');
      expect(result.data.sync.remote).toBe('origin');
      expect(result.data.display.id_prefix).toBe('proj');
      expect(result.data.settings.auto_sync).toBe(false);
    }
  });

  it('rejects config without required id_prefix', () => {
    const config = {
      tbd_version: '3.0.0',
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  describe('docs_cache', () => {
    it('parses config with docs_cache.files', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          files: {
            'tbd/shortcuts/code-review-and-commit.md':
              'internal:tbd/shortcuts/code-review-and-commit.md',
            'custom/my-doc.md': 'https://example.com/my-doc.md',
          },
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.files).toEqual({
          'tbd/shortcuts/code-review-and-commit.md':
            'internal:tbd/shortcuts/code-review-and-commit.md',
          'custom/my-doc.md': 'https://example.com/my-doc.md',
        });
      }
    });

    it('parses config with docs_cache.lookup_path', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          lookup_path: [
            '.tbd/docs/shortcuts/custom',
            '.tbd/docs/sys/shortcuts',
            '.tbd/docs/tbd/shortcuts',
          ],
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.lookup_path).toEqual([
          '.tbd/docs/shortcuts/custom',
          '.tbd/docs/sys/shortcuts',
          '.tbd/docs/tbd/shortcuts',
        ]);
      }
    });

    it('parses config with full docs_cache structure', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          files: {
            'tbd/shortcuts/code-review-and-commit.md':
              'internal:tbd/shortcuts/code-review-and-commit.md',
          },
          lookup_path: ['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'],
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.files).toBeDefined();
        expect(result.data.docs_cache?.lookup_path).toBeDefined();
      }
    });

    it('lookup_path is optional and undefined when not specified (f04)', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {},
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.lookup_path).toBeUndefined();
      }
    });
  });
});

describe('DocsSourceSchema', () => {
  describe('valid internal sources', () => {
    it('accepts minimal internal source', () => {
      const source = {
        type: 'internal',
        prefix: 'sys',
        paths: ['shortcuts/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('accepts internal source with hidden flag', () => {
      const source = {
        type: 'internal',
        prefix: 'sys',
        hidden: true,
        paths: ['shortcuts/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hidden).toBe(true);
      }
    });

    it('accepts internal source with multiple paths', () => {
      const source = {
        type: 'internal',
        prefix: 'tbd',
        paths: ['shortcuts/', 'guidelines/', 'templates/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paths).toHaveLength(3);
      }
    });
  });

  describe('valid repo sources', () => {
    it('accepts minimal repo source', () => {
      const source = {
        type: 'repo',
        prefix: 'spec',
        url: 'github.com/jlevy/speculate',
        paths: ['shortcuts/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('accepts repo source with ref', () => {
      const source = {
        type: 'repo',
        prefix: 'spec',
        url: 'github.com/jlevy/speculate',
        ref: 'main',
        paths: ['shortcuts/', 'guidelines/', 'templates/', 'references/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ref).toBe('main');
        expect(result.data.paths).toHaveLength(4);
      }
    });

    it('accepts repo source with SSH URL', () => {
      const source = {
        type: 'repo',
        prefix: 'myorg',
        url: 'git@github.com:myorg/coding-standards.git',
        paths: ['guidelines/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('accepts repo source with HTTPS URL', () => {
      const source = {
        type: 'repo',
        prefix: 'myorg',
        url: 'https://github.com/myorg/coding-standards',
        paths: ['guidelines/'],
      };
      const result = DocsSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('prefix validation', () => {
    it('accepts lowercase alphanumeric prefixes', () => {
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'a', paths: ['x/'] }).success,
      ).toBe(true);
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'sys', paths: ['x/'] }).success,
      ).toBe(true);
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'my-org', paths: ['x/'] }).success,
      ).toBe(true);
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'abc123', paths: ['x/'] }).success,
      ).toBe(true);
    });

    it('rejects empty prefix', () => {
      const result = DocsSourceSchema.safeParse({ type: 'internal', prefix: '', paths: ['x/'] });
      expect(result.success).toBe(false);
    });

    it('rejects prefix longer than 16 chars', () => {
      const result = DocsSourceSchema.safeParse({
        type: 'internal',
        prefix: 'a'.repeat(17),
        paths: ['x/'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects uppercase prefix', () => {
      const result = DocsSourceSchema.safeParse({ type: 'internal', prefix: 'SYS', paths: ['x/'] });
      expect(result.success).toBe(false);
    });

    it('rejects prefix with invalid characters', () => {
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'my_org', paths: ['x/'] }).success,
      ).toBe(false);
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'my.org', paths: ['x/'] }).success,
      ).toBe(false);
      expect(
        DocsSourceSchema.safeParse({ type: 'internal', prefix: 'my org', paths: ['x/'] }).success,
      ).toBe(false);
    });
  });

  describe('required fields', () => {
    it('rejects missing type', () => {
      const result = DocsSourceSchema.safeParse({ prefix: 'sys', paths: ['x/'] });
      expect(result.success).toBe(false);
    });

    it('rejects missing prefix', () => {
      const result = DocsSourceSchema.safeParse({ type: 'internal', paths: ['x/'] });
      expect(result.success).toBe(false);
    });

    it('rejects missing paths', () => {
      const result = DocsSourceSchema.safeParse({ type: 'internal', prefix: 'sys' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = DocsSourceSchema.safeParse({ type: 'local', prefix: 'sys', paths: ['x/'] });
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields default correctly', () => {
    it('hidden defaults to undefined when not specified', () => {
      const result = DocsSourceSchema.safeParse({
        type: 'internal',
        prefix: 'sys',
        paths: ['shortcuts/'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hidden).toBeUndefined();
      }
    });

    it('url and ref default to undefined for internal', () => {
      const result = DocsSourceSchema.safeParse({
        type: 'internal',
        prefix: 'sys',
        paths: ['shortcuts/'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBeUndefined();
        expect(result.data.ref).toBeUndefined();
      }
    });
  });
});

describe('DocsCacheSchema with sources', () => {
  it('accepts docs_cache with sources array', () => {
    const result = DocsCacheSchema.safeParse({
      sources: [
        { type: 'internal', prefix: 'sys', hidden: true, paths: ['shortcuts/'] },
        { type: 'repo', prefix: 'spec', url: 'github.com/jlevy/speculate', paths: ['shortcuts/'] },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources).toHaveLength(2);
    }
  });

  it('accepts docs_cache with both sources and files', () => {
    const result = DocsCacheSchema.safeParse({
      sources: [{ type: 'internal', prefix: 'tbd', paths: ['shortcuts/'] }],
      files: {
        'guidelines/custom.md': 'https://example.com/custom.md',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources).toHaveLength(1);
      expect(result.data.files).toBeDefined();
    }
  });

  it('accepts docs_cache without sources (backward compat)', () => {
    const result = DocsCacheSchema.safeParse({
      files: {
        'tbd/shortcuts/code-review.md': 'internal:tbd/shortcuts/code-review.md',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources).toBeUndefined();
    }
  });
});
