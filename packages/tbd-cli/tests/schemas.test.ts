/**
 * Tests for Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import { IssueSchema, IssueId, IssueIdInput, ConfigSchema } from '../src/lib/schemas.js';

describe('IssueId', () => {
  it('accepts valid issue IDs', () => {
    expect(IssueId.safeParse('is-a1b2c3').success).toBe(true);
    expect(IssueId.safeParse('is-000000').success).toBe(true);
    expect(IssueId.safeParse('is-ffffff').success).toBe(true);
  });

  it('rejects invalid issue IDs', () => {
    expect(IssueId.safeParse('is-a1b2').success).toBe(false); // too short
    expect(IssueId.safeParse('is-a1b2c3d4').success).toBe(false); // too long
    expect(IssueId.safeParse('bd-a1b2c3').success).toBe(false); // wrong prefix
    expect(IssueId.safeParse('is-ABCDEF').success).toBe(false); // uppercase
  });
});

describe('IssueIdInput', () => {
  it('accepts valid input IDs', () => {
    expect(IssueIdInput.safeParse('is-a1b2c3').success).toBe(true);
    expect(IssueIdInput.safeParse('bd-a1b2c3').success).toBe(true);
    expect(IssueIdInput.safeParse('a1b2c3').success).toBe(true);
    expect(IssueIdInput.safeParse('a1b2').success).toBe(true); // 4 chars allowed for input
  });
});

describe('IssueSchema', () => {
  it('parses a minimal valid issue', () => {
    const issue = {
      type: 'is',
      id: 'is-a1b2c3',
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
      id: 'is-a1b2c3',
      version: 5,
      title: 'Fix authentication bug',
      description: 'Users are logged out after 5 minutes.',
      notes: 'Found issue in session.ts',
      kind: 'bug',
      status: 'in_progress',
      priority: 1,
      assignee: 'alice',
      labels: ['backend', 'security'],
      dependencies: [{ type: 'blocks', target: 'is-f14c3d' }],
      parent_id: 'is-000001',
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
      id: 'is-a1b2c3',
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
      id: 'is-a1b2c3',
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
    const config = {
      tbd_version: '3.0.0',
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sync.branch).toBe('tbd-sync');
      expect(result.data.sync.remote).toBe('origin');
      expect(result.data.display.id_prefix).toBe('bd');
      expect(result.data.settings.auto_sync).toBe(false);
    }
  });
});
