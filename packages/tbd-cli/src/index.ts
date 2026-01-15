/**
 * tbd-cli: Git-native issue tracking for AI agents and humans
 *
 * This is the library entry point. All exports here should be node-free
 * to support browser/edge runtime usage. CLI-specific code is in ./cli/.
 */

// Version injected at build time
declare const __TBD_VERSION__: string;

/**
 * Package version, derived from git at build time.
 * Format: X.Y.Z for releases, X.Y.Z-dev.N.hash for dev builds.
 */
export const VERSION: string =
  typeof __TBD_VERSION__ !== 'undefined' ? __TBD_VERSION__ : 'development';

// Re-export schemas for library consumers
export * from './lib/schemas.js';
export * from './lib/types.js';

// Re-export core operations (these should be node-free)
export { parseIssue, serializeIssue } from './file/parser.js';
