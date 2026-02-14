/**
 * Add external documentation to the tbd doc cache.
 *
 * Uses the shared github-fetch utility for URL conversion and fetching.
 * Handles doc-specific concerns: content validation, file writing, and
 * atomic config updates.
 */

import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { writeFile } from 'atomically';

import { readConfig, writeConfig } from './config.js';
import { githubBlobToRawUrl, fetchWithGhFallback } from './github-fetch.js';
import { TBD_DOCS_DIR, TBD_PREFIX } from '../lib/paths.js';
import { type DocTypeName, getDocTypeDirectory } from '../lib/doc-types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * The type of document being added.
 * Re-exported from doc-types.ts for backward compatibility.
 */
export type DocType = DocTypeName;

/**
 * Options for adding a document.
 */
export interface AddDocOptions {
  /** URL to fetch the document from */
  url: string;
  /** Name for the document (without .md extension) */
  name: string;
  /** Type of document */
  docType: DocType;
}

/**
 * Result of adding a document.
 */
export interface AddDocResult {
  /** The destination path relative to .tbd/docs/ */
  destPath: string;
  /** The raw URL used to fetch the content */
  rawUrl: string;
  /** Whether gh CLI was used as fallback */
  usedGhCli: boolean;
}

// =============================================================================
// Content Validation
// =============================================================================

/**
 * Validate that fetched content looks like a reasonable markdown document.
 *
 * @throws If content fails sanity checks
 */
export function validateDocContent(content: string, name: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error(`Fetched content for "${name}" is empty`);
  }

  if (content.length < 10) {
    throw new Error(`Fetched content for "${name}" is too short (${content.length} chars)`);
  }

  // Check for HTML error pages
  if (content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<html')) {
    throw new Error(
      `Fetched content for "${name}" appears to be an HTML page, not a markdown document`,
    );
  }

  // Check for binary content (high ratio of non-printable characters)
  const nonPrintable = content.split('').filter((c) => {
    const code = c.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  }).length;
  if (nonPrintable / content.length > 0.1) {
    throw new Error(`Fetched content for "${name}" appears to be binary, not a text document`);
  }
}

// =============================================================================
// Doc Type to Path Mapping
// =============================================================================

/**
 * Get the destination subdirectory for a doc type.
 * Delegates to the doc-types registry.
 */
export function getDocTypeSubdir(docType: DocType): string {
  return getDocTypeDirectory(docType);
}

// =============================================================================
// Main Add Function
// =============================================================================

/**
 * Add an external document to the tbd doc cache.
 *
 * This function:
 * 1. Converts GitHub blob URLs to raw URLs
 * 2. Fetches the content (with gh CLI fallback on 403)
 * 3. Validates the content looks like markdown
 * 4. Writes the file to .tbd/docs/{type}/{name}.md
 * 5. Atomically updates the config to include the new source
 *
 * @throws If fetching, validation, or config update fails
 */
export async function addDoc(tbdRoot: string, options: AddDocOptions): Promise<AddDocResult> {
  const { url, name, docType } = options;

  // Normalize name (strip .md if provided)
  const cleanName = name.endsWith('.md') ? name.slice(0, -3) : name;
  const filename = `${cleanName}.md`;
  const subdir = getDocTypeSubdir(docType);
  // User-added docs go into the tbd/ prefix directory
  const destPath = `${TBD_PREFIX}/${subdir}/${filename}`;
  const rawUrl = githubBlobToRawUrl(url);

  // Fetch content
  const { content, usedGhCli } = await fetchWithGhFallback(url);

  // Validate content
  validateDocContent(content, cleanName);

  // Write file to .tbd/docs/tbd/{subdir}/{name}.md
  const fullPath = join(tbdRoot, TBD_DOCS_DIR, destPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);

  // Atomically update config
  const config = await readConfig(tbdRoot);
  config.docs_cache ??= { files: {} };
  config.docs_cache.files ??= {};
  config.docs_cache.files[destPath] = rawUrl;

  await writeConfig(tbdRoot, config);

  return { destPath, rawUrl, usedGhCli };
}
