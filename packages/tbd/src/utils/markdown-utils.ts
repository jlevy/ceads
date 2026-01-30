/**
 * Markdown utilities for processing markdown content.
 *
 * Uses gray-matter for consistent frontmatter parsing across the codebase.
 */

import matter from 'gray-matter';

export interface ParsedMarkdown {
  /** Raw frontmatter string (without --- delimiters), or null if no frontmatter */
  frontmatter: string | null;
  /** Body content after frontmatter, with leading newlines trimmed */
  body: string;
}

/**
 * Normalize line endings to LF.
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse markdown content into frontmatter and body.
 * Handles both LF and CRLF line endings.
 *
 * @returns Object with frontmatter (null if none) and body
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const normalized = normalizeLineEndings(content);

  if (!matter.test(normalized)) {
    return { frontmatter: null, body: content };
  }

  try {
    const parsed = matter(normalized);

    // Extract frontmatter from parsed.data by stringifying back to YAML
    // The matter property is unreliable, so we reconstruct from data
    const data = parsed.data;
    let frontmatter: string | null = null;

    if (data && Object.keys(data).length > 0) {
      // Reconstruct frontmatter as YAML lines
      const lines: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${String(item)}`);
          }
        } else if (typeof value === 'object' && value !== null) {
          lines.push(`${key}:`);
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            lines.push(`  ${subKey}: ${String(subValue)}`);
          }
        } else {
          lines.push(`${key}: ${String(value)}`);
        }
      }
      frontmatter = lines.join('\n');
    } else {
      // Empty frontmatter (just --- followed by ---)
      frontmatter = '';
    }

    // Body with leading newlines trimmed
    const body = parsed.content.replace(/^\n+/, '');

    return { frontmatter, body };
  } catch {
    // Invalid/unclosed frontmatter - treat as no frontmatter
    return { frontmatter: null, body: content };
  }
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the frontmatter content (without delimiters) or null if no valid frontmatter.
 * Handles both LF and CRLF line endings.
 */
export function parseFrontmatter(content: string): string | null {
  return parseMarkdown(content).frontmatter;
}

/**
 * Strip YAML frontmatter from markdown content.
 * Returns the body content without frontmatter, with leading newlines trimmed.
 * Handles both LF and CRLF line endings.
 */
export function stripFrontmatter(content: string): string {
  return parseMarkdown(content).body;
}

/**
 * Insert content after YAML frontmatter.
 * If no frontmatter exists, prepends the content.
 * Content is inserted directly after ---. Include leading newlines in toInsert if needed.
 */
export function insertAfterFrontmatter(content: string, toInsert: string): string {
  const { frontmatter, body } = parseMarkdown(content);

  if (frontmatter === null) {
    return toInsert + content;
  }

  const frontmatterBlock = frontmatter ? `---\n${frontmatter}\n---` : '---\n---';
  return `${frontmatterBlock}\n${toInsert}\n\n${body}`;
}
