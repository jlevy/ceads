/**
 * Doc type registry — single source of truth for doc types.
 *
 * All doc types (shortcut, guideline, template, reference) are defined here.
 * Commands, sync, and cache should derive paths and names from this registry
 * rather than hardcoding them.
 */

/** The supported doc type names. */
export type DocTypeName = 'shortcut' | 'guideline' | 'template' | 'reference';

/** Metadata for a doc type. */
export interface DocTypeInfo {
  /** Singular name (matches the DocTypeName key) */
  singular: string;
  /** Plural name (used in commands and display) */
  plural: string;
  /** Directory name on disk (e.g., 'shortcuts') */
  directory: string;
}

/** Registry of all doc types and their metadata. */
export const DOC_TYPES: Record<DocTypeName, DocTypeInfo> = {
  shortcut: {
    singular: 'shortcut',
    plural: 'shortcuts',
    directory: 'shortcuts',
  },
  guideline: {
    singular: 'guideline',
    plural: 'guidelines',
    directory: 'guidelines',
  },
  template: {
    singular: 'template',
    plural: 'templates',
    directory: 'templates',
  },
  reference: {
    singular: 'reference',
    plural: 'references',
    directory: 'references',
  },
};

/** Map from directory name to doc type name for reverse lookup. */
const DIRECTORY_TO_TYPE: Record<string, DocTypeName> = Object.fromEntries(
  Object.entries(DOC_TYPES).map(([name, info]) => [info.directory, name as DocTypeName]),
) as Record<string, DocTypeName>;

/**
 * Infer the doc type from a file path.
 *
 * Recognizes paths in these formats:
 * - `{prefix}/{type-dir}/{name}.md` (new prefix-based)
 * - `{type-dir}/{name}.md` (flat)
 * - `.tbd/docs/{...}/{type-dir}/{...}/{name}.md` (old-style nested)
 */
export function inferDocType(path: string): DocTypeName | undefined {
  const parts = path.replace(/\\/g, '/').split('/');

  // Check each path segment for a known doc type directory
  for (const part of parts) {
    if (part in DIRECTORY_TO_TYPE) {
      return DIRECTORY_TO_TYPE[part];
    }
  }

  return undefined;
}

/** Get the directory name for a doc type. */
export function getDocTypeDirectory(typeName: DocTypeName): string {
  return DOC_TYPES[typeName].directory;
}

/** Get all doc type names. */
export function getAllDocTypeNames(): DocTypeName[] {
  return Object.keys(DOC_TYPES) as DocTypeName[];
}

/** Get all doc type directory names. */
export function getAllDocTypeDirectories(): string[] {
  return Object.values(DOC_TYPES).map((t) => t.directory);
}
