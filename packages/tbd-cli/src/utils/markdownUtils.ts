/**
 * Markdown utilities for processing markdown content.
 */

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
