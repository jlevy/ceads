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
    expect(ShortId.safeParse('a-b').success).toBe(false); // contains hyphen
  });

  it('accepts short IDs of various lengths for import preservation', () => {
    // New IDs are 4 chars, but imports can preserve longer IDs like "100" from "tbd-100"
    expect(ShortId.safeParse('1').success).toBe(true);
    expect(ShortId.safeParse('100').success).toBe(true);
    expect(ShortId.safeParse('abc').success).toBe(true);
    expect(ShortId.safeParse('abcdef').success).toBe(true);
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
});
