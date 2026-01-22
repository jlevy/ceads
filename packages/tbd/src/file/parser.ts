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

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { Issue } from '../lib/types.js';
import { IssueSchema } from '../lib/schemas.js';

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
 * Handles both LF and CRLF line endings.
 */
export function parseMarkdownWithFrontmatter(content: string): ParsedIssueFile {
  const lines = content.split('\n');

  // Find front matter boundaries (use trim() to handle CRLF)
  if (lines[0]?.trim() !== '---') {
    throw new Error('Invalid format: missing front matter opening delimiter');
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new Error('Invalid format: missing front matter closing delimiter');
  }

  // Parse front matter (strip \r from CRLF line endings)
  const frontmatterYaml = lines
    .slice(1, endIndex)
    .map((line) => line.replace(/\r$/, ''))
    .join('\n');
  const frontmatter = parseYaml(frontmatterYaml) as Record<string, unknown>;

  // Parse body - split into description and notes
  const bodyLines = lines.slice(endIndex + 1);
  const body = bodyLines.join('\n').trim();

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

  // Serialize YAML with specific options for canonical output
  const yaml = stringifyYaml(sortedMetadata, {
    sortMapEntries: true,
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
