/**
 * Tests for YAML front matter parser.
 */

import { describe, it, expect } from 'vitest';
import { parseIssue, serializeIssue, parseMarkdownWithFrontmatter } from '../src/file/parser.js';

describe('parseMarkdownWithFrontmatter', () => {
  it('parses basic front matter', () => {
    const content = `---
title: Test Issue
status: open
---

This is the description.`;

    const result = parseMarkdownWithFrontmatter(content);
    expect(result.frontmatter.title).toBe('Test Issue');
    expect(result.frontmatter.status).toBe('open');
    expect(result.description).toBe('This is the description.');
    expect(result.notes).toBe('');
  });

  it('parses front matter with notes section', () => {
    const content = `---
title: Test Issue
---

Description here.

## Notes

Working notes here.`;

    const result = parseMarkdownWithFrontmatter(content);
    expect(result.description).toBe('Description here.');
    expect(result.notes).toBe('Working notes here.');
  });

  it('throws on missing front matter delimiter', () => {
    const content = `title: Test
---
Description`;

    expect(() => parseMarkdownWithFrontmatter(content)).toThrow('missing front matter');
  });
});

describe('parseIssue', () => {
  it('parses a complete issue file', () => {
    const content = `---
type: is
id: is-a1b2c3
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: alice
labels:
  - backend
  - security
dependencies: []
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: null
deferred_until: null
extensions: {}
---

Users are being logged out after exactly 5 minutes of inactivity.

## Notes

Found the issue in session.ts line 42. Working on fix.`;

    const issue = parseIssue(content);
    expect(issue.id).toBe('is-a1b2c3');
    expect(issue.title).toBe('Fix authentication timeout');
    expect(issue.status).toBe('in_progress');
    expect(issue.labels).toEqual(['backend', 'security']);
    expect(issue.description).toBe(
      'Users are being logged out after exactly 5 minutes of inactivity.',
    );
    expect(issue.notes).toBe('Found the issue in session.ts line 42. Working on fix.');
  });
});

describe('serializeIssue', () => {
  it('serializes an issue to canonical format', () => {
    const issue = {
      type: 'is' as const,
      id: 'is-a1b2c3',
      version: 1,
      kind: 'task' as const,
      title: 'Test issue',
      status: 'open' as const,
      priority: 2,
      labels: ['frontend'],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      description: 'This is the description.',
      notes: 'Some notes.',
    };

    const content = serializeIssue(issue);

    // Check structure
    expect(content).toContain('---');
    expect(content).toContain('id: is-a1b2c3');
    expect(content).toContain('title: Test issue');
    expect(content).toContain('This is the description.');
    expect(content).toContain('## Notes');
    expect(content).toContain('Some notes.');

    // Ends with single newline
    expect(content.endsWith('\n')).toBe(true);
    expect(content.endsWith('\n\n')).toBe(false);
  });

  it('produces deterministic output (sorted keys)', () => {
    const issue = {
      type: 'is' as const,
      id: 'is-a1b2c3',
      version: 1,
      kind: 'task' as const,
      title: 'Test',
      status: 'open' as const,
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const content1 = serializeIssue(issue);
    const content2 = serializeIssue(issue);

    expect(content1).toBe(content2);
  });
});
