/**
 * Markdown utilities for processing markdown content.
 */

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the frontmatter content (without delimiters) or null if no valid frontmatter.
 * Handles both LF and CRLF line endings.
 */
export function parseFrontmatter(content: string): string | null {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return null;
  }

  // Find the closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      // Return frontmatter content (trimming any \r from CRLF)
      return lines
        .slice(1, i)
        .map((line) => line.replace(/\r$/, ''))
        .join('\n');
    }
  }

  // No closing --- found
  return null;
}

/**
 * Strip YAML frontmatter from markdown content.
 * Frontmatter is delimited by --- at start and end.
 */
export function stripFrontmatter(content: string): string {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return content;
  }

  // Find the closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      // Return content after frontmatter, trimming leading newlines
      return lines
        .slice(i + 1)
        .join('\n')
        .replace(/^\n+/, '');
    }
  }

  // No closing --- found, return original
  return content;
}
