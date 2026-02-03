/**
 * YAML front matter parser and serializer for issue files.
 *
 * Issues are stored as Markdown files with YAML front matter:
 * ---
 * type: is
 * id: is-a1b2c3
 * ...
 * ---
 *
 * Description body here.
 *
 * ## Notes
 *
 * Working notes here.
 *
 * See: tbd-design.md §2.1 Markdown + YAML Front Matter Format
 */

import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

import { normalizeLineEndings } from '../utils/markdown-utils.js';
import { stringifyYaml } from '../utils/yaml-utils.js';
import type { Issue } from '../lib/types.js';
import { IssueSchema } from '../lib/schemas.js';

/**
 * gray-matter options using the 'yaml' package as engine.
 * This preserves date strings instead of converting them to Date objects.
 */
export const matterOptions = {
  engines: {
    yaml: {
      parse: (str: string): object => parseYaml(str) as object,
      stringify: (obj: object): string => stringifyYaml(obj),
    },
  },
};

/**
 * Parsed issue file content.
 */
export interface ParsedIssueFile {
  frontmatter: Record<string, unknown>;
  description: string;
  notes: string;
}

/**
 * Parse a Markdown file with YAML front matter.
 * Uses gray-matter for consistent frontmatter parsing.
 * Handles both LF and CRLF line endings.
 */
export function parseMarkdownWithFrontmatter(content: string): ParsedIssueFile {
  // Normalize CRLF to LF before parsing
  const normalizedContent = normalizeLineEndings(content);

  // Check for valid frontmatter
  if (!matter.test(normalizedContent)) {
    throw new Error('Invalid format: missing front matter opening delimiter');
  }

  const parsed = matter(normalizedContent, matterOptions);

  // gray-matter returns empty object if no closing delimiter found
  // but the raw matter string will be empty if parsing failed
  if (parsed.matter === '' && !normalizedContent.includes('---\n---')) {
    // Check if there's actually a closing delimiter
    const lines = normalizedContent.split('\n');
    let hasClosing = false;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        hasClosing = true;
        break;
      }
    }
    if (!hasClosing) {
      throw new Error('Invalid format: missing front matter closing delimiter');
    }
  }

  const frontmatter = parsed.data as Record<string, unknown>;

  // Parse body - split into description and notes
  const body = parsed.content.trim();

  // Find notes section
  const notesMatch = /\n## Notes\n/i.exec(body);
  let description = body;
  let notes = '';

  if (notesMatch?.index !== undefined) {
    description = body.slice(0, notesMatch.index).trim();
    notes = body.slice(notesMatch.index + notesMatch[0].length).trim();
  }

  return { frontmatter, description, notes };
}

/**
 * Parse an issue from Markdown file content.
 */
export function parseIssue(content: string): Issue {
  const { frontmatter, description, notes } = parseMarkdownWithFrontmatter(content);

  // Merge body content into frontmatter
  const data = {
    ...frontmatter,
    description: description || undefined,
    notes: notes || undefined,
  };

  // Validate and parse with Zod
  return IssueSchema.parse(data);
}

/**
 * Serialize an issue to Markdown file content.
 * Uses canonical serialization for deterministic output.
 */
export function serializeIssue(issue: Issue): string {
  // Extract body fields
  const { description, notes, ...metadata } = issue;

  // Sort keys alphabetically for canonical output
  const sortedMetadata: Record<string, unknown> = {};
  for (const key of Object.keys(metadata).sort()) {
    sortedMetadata[key] = metadata[key as keyof typeof metadata];
  }

  // Serialize YAML with compact output for frontmatter (sortMapEntries is in defaults)
  const yaml = stringifyYaml(sortedMetadata, {
    lineWidth: 0, // No wrapping
    nullStr: 'null',
  });

  // Build the file content
  // Note: No blank line between closing --- and body content
  const parts = ['---', yaml.trim(), '---'];

  if (description) {
    parts.push(description.trim());
  }

  if (notes) {
    parts.push('');
    parts.push('## Notes');
    parts.push('');
    parts.push(notes.trim());
  }

  // Single newline at end
  return parts.join('\n') + '\n';
}
