/**
 * Tests for markdown utilities.
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stripFrontmatter } from '../src/utils/markdown-utils.js';

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
