/**
 * Tests for markdown utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  stripFrontmatter,
  insertAfterFrontmatter,
} from '../src/utils/markdown-utils.js';

describe('parseFrontmatter', () => {
  it('parses basic frontmatter', () => {
    const content = `---
title: Test
status: open
---

Body content here.`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toBe('title: Test\nstatus: open');
  });

  it('returns null for content without frontmatter', () => {
    const content = 'Just regular content without frontmatter.';
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('returns null for content starting with non-delimiter', () => {
    const content = `title: Test
---
Body`;
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('returns null for unclosed frontmatter', () => {
    const content = `---
title: Test
status: open

Body without closing delimiter.`;
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\ntitle: Test\r\nstatus: open\r\n---\r\n\r\nBody content.';

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toBe('title: Test\nstatus: open');
  });

  it('handles mixed LF and CRLF line endings', () => {
    const content = '---\r\ntitle: Mixed\nstatus: open\r\n---\n\nBody.';

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toBe('title: Mixed\nstatus: open');
  });

  it('handles frontmatter with trailing whitespace on delimiter', () => {
    const content = '---  \ntitle: Test\n---  \n\nBody.';

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toBe('title: Test');
  });

  it('handles empty frontmatter', () => {
    const content = `---
---

Body content.`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toBe('');
  });

  it('handles frontmatter with complex YAML', () => {
    const content = `---
title: Complex Issue
labels:
  - frontend
  - urgent
metadata:
  created: 2025-01-01
---

Description.`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toContain('title: Complex Issue');
    expect(frontmatter).toContain('labels:');
    expect(frontmatter).toContain('- frontend');
  });
});

describe('stripFrontmatter', () => {
  it('strips frontmatter and returns body', () => {
    const content = `---
title: Test
---

Body content here.`;

    const body = stripFrontmatter(content);
    expect(body).toBe('Body content here.');
  });

  it('returns original content if no frontmatter', () => {
    const content = 'Just regular content.';
    expect(stripFrontmatter(content)).toBe('Just regular content.');
  });

  it('returns original content if unclosed frontmatter', () => {
    const content = `---
title: Test
Body without closing.`;
    expect(stripFrontmatter(content)).toBe(content);
  });

  it('handles content with only frontmatter', () => {
    const content = `---
title: Test
---`;

    const body = stripFrontmatter(content);
    expect(body).toBe('');
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\ntitle: Test\r\n---\r\n\r\nBody content.';

    const body = stripFrontmatter(content);
    expect(body.trim()).toBe('Body content.');
  });

  it('trims leading newlines from body', () => {
    const content = `---
title: Test
---



Body with leading newlines.`;

    const body = stripFrontmatter(content);
    expect(body).toBe('Body with leading newlines.');
  });
});

describe('insertAfterFrontmatter', () => {
  it('inserts content after frontmatter', () => {
    const content = `---
title: Test
---

Body content.`;
    const toInsert = '<!-- MARKER -->';

    const result = insertAfterFrontmatter(content, toInsert);
    expect(result).toContain('---\ntitle: Test\n---');
    expect(result).toContain('<!-- MARKER -->');
    expect(result).toContain('Body content.');
    // Marker should come after frontmatter but before body
    expect(result.indexOf('---\ntitle')).toBeLessThan(result.indexOf('<!-- MARKER -->'));
    expect(result.indexOf('<!-- MARKER -->')).toBeLessThan(result.indexOf('Body content.'));
  });

  it('prepends content if no frontmatter', () => {
    const content = 'Just regular content without frontmatter.';
    const toInsert = '<!-- MARKER -->';

    const result = insertAfterFrontmatter(content, toInsert);
    expect(result).toBe('<!-- MARKER -->Just regular content without frontmatter.');
  });

  it('handles empty body with frontmatter', () => {
    const content = `---
title: Test
---`;
    const toInsert = '<!-- MARKER -->';

    const result = insertAfterFrontmatter(content, toInsert);
    expect(result).toContain('---\ntitle: Test\n---');
    expect(result).toContain('<!-- MARKER -->');
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\ntitle: Test\r\n---\r\n\r\nBody content.';
    const toInsert = '<!-- MARKER -->';

    const result = insertAfterFrontmatter(content, toInsert);
    expect(result).toContain('<!-- MARKER -->');
    expect(result).toContain('Body content.');
  });

  it('preserves frontmatter structure', () => {
    const content = `---
name: skill
description: A skill description
allowed-tools: Bash, Read
---

# Content`;
    const toInsert = '<!-- DO NOT EDIT -->';

    const result = insertAfterFrontmatter(content, toInsert);
    // Frontmatter should be intact
    expect(result).toMatch(/^---\nname: skill/);
    expect(result).toContain('description: A skill description');
    expect(result).toContain('allowed-tools: Bash, Read');
    expect(result).toContain('---\n');
    // Marker should be between frontmatter and content
    expect(result).toContain('<!-- DO NOT EDIT -->');
    expect(result).toContain('# Content');
  });
});
