/**
 * Centralized path constants for tbd.
 *
 * Directory structure (per spec):
 *
 * On main/dev branches:
 *   .tbd/
 *     config.yml              - Project configuration (tracked)
 *     state.yml               - Local state (gitignored)
 *     .gitignore              - Ignores docs/, data-sync-worktree/, data-sync/
 *     docs/                   - Installed documentation (gitignored, regenerated on setup)
 *     data-sync-worktree/     - Hidden worktree checkout of tbd-sync branch
 *       .tbd/
 *         data-sync/
 *           issues/
 *           mappings/
 *           attic/
 *           meta.yml
 *
 * On tbd-sync branch:
 *   .tbd/
 *     data-sync/
 *       issues/
 *       mappings/
 *       attic/
 *       meta.yml
 */

import { join } from 'node:path';

/** The tbd configuration directory on main branch */
export const TBD_DIR = '.tbd';

/** The config file path */
export const CONFIG_FILE = join(TBD_DIR, 'config.yml');

/** The local state file (gitignored) */
export const STATE_FILE = join(TBD_DIR, 'state.yml');

/** The worktree directory name */
export const WORKTREE_DIR_NAME = 'data-sync-worktree';

/** The worktree path (gitignored) */
export const WORKTREE_DIR = join(TBD_DIR, WORKTREE_DIR_NAME);

/** The data directory name on the sync branch */
export const DATA_SYNC_DIR_NAME = 'data-sync';

/**
 * The base directory for synced data.
 *
 * NOTE: This is currently pointing directly to .tbd/data-sync/ which is WRONG
 * per the spec. The correct path should be via the worktree:
 *   .tbd/data-sync-worktree/.tbd/data-sync/
 *
 * TODO(tbd-208): Update this to use the worktree path once worktree
 * management is implemented.
 */
export const DATA_SYNC_DIR = join(TBD_DIR, DATA_SYNC_DIR_NAME);

/**
 * The correct path for synced data via worktree (per spec).
 * Use this once worktree management is implemented.
 */
export const DATA_SYNC_DIR_VIA_WORKTREE = join(WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME);

/** Issues directory */
export const ISSUES_DIR = join(DATA_SYNC_DIR, 'issues');

/** Mappings directory */
export const MAPPINGS_DIR = join(DATA_SYNC_DIR, 'mappings');

/** Attic directory for conflict resolution */
export const ATTIC_DIR = join(DATA_SYNC_DIR, 'attic');

/** Meta file for schema version */
export const META_FILE = join(DATA_SYNC_DIR, 'meta.yml');

/** The sync branch name */
export const SYNC_BRANCH = 'tbd-sync';

// =============================================================================
// Workspace Paths (for sync failure recovery, backups, bulk editing)
// =============================================================================

/** The workspaces directory name within .tbd/ */
export const WORKSPACES_DIR_NAME = 'workspaces';

/** Full path to workspaces directory: .tbd/workspaces/ */
export const WORKSPACES_DIR = join(TBD_DIR, WORKSPACES_DIR_NAME);

/**
 * Get the path to a named workspace directory.
 *
 * Workspaces are stored at: .tbd/workspaces/{name}/
 *
 * @param workspaceName - The name of the workspace (e.g., 'outbox', 'my-feature')
 * @returns Path to the workspace directory
 */
export function getWorkspaceDir(workspaceName: string): string {
  return join(WORKSPACES_DIR, workspaceName);
}

/**
 * Get the path to a workspace's issues directory.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's issues directory
 */
export function getWorkspaceIssuesDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'issues');
}

/**
 * Get the path to a workspace's mappings directory.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's mappings directory
 */
export function getWorkspaceMappingsDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'mappings');
}

/**
 * Get the path to a workspace's attic directory.
 *
 * The attic stores conflict backups during workspace save operations.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's attic directory
 */
export function getWorkspaceAtticDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'attic');
}

/**
 * Validate a workspace name.
 *
 * Valid workspace names:
 * - Lowercase alphanumeric characters
 * - Hyphens and underscores allowed
 * - Must not be empty
 * - Must not contain path separators or dots at start
 *
 * @param name - The workspace name to validate
 * @returns true if the name is valid
 */
export function isValidWorkspaceName(name: string): boolean {
  if (!name || name.length === 0) {
    return false;
  }

  // Must not start with dot (hidden files)
  if (name.startsWith('.')) {
    return false;
  }

  // Only allow lowercase alphanumeric, hyphens, and underscores
  // No spaces, path separators, or special characters
  const validPattern = /^[a-z0-9][a-z0-9_-]*$/;
  return validPattern.test(name);
}

// =============================================================================
// Documentation/Shortcuts Paths
// =============================================================================

/** Docs directory name within .tbd/ */
export const DOCS_DIR = 'docs';

/** Shortcuts directory name within docs/ */
export const SHORTCUTS_DIR = 'shortcuts';

/** System shortcuts directory name (core docs like skill.md) */
export const SYSTEM_DIR = 'system';

/** Standard shortcuts directory name (workflow shortcuts) */
export const STANDARD_DIR = 'standard';

/** Guidelines directory name (coding rules and best practices) */
export const GUIDELINES_DIR = 'guidelines';

/** Templates directory name (document templates) */
export const TEMPLATES_DIR = 'templates';

/** Full path to docs directory: .tbd/docs/ */
export const TBD_DOCS_DIR = join(TBD_DIR, DOCS_DIR);

/** Full path to shortcuts directory: .tbd/docs/shortcuts/ */
export const TBD_SHORTCUTS_DIR = join(TBD_DOCS_DIR, SHORTCUTS_DIR);

/** Full path to system shortcuts: .tbd/docs/shortcuts/system/ */
export const TBD_SHORTCUTS_SYSTEM = join(TBD_SHORTCUTS_DIR, SYSTEM_DIR);

/** Full path to standard shortcuts: .tbd/docs/shortcuts/standard/ */
export const TBD_SHORTCUTS_STANDARD = join(TBD_SHORTCUTS_DIR, STANDARD_DIR);

/** Full path to guidelines: .tbd/docs/guidelines/ (top-level, not under shortcuts) */
export const TBD_GUIDELINES_DIR = join(TBD_DOCS_DIR, GUIDELINES_DIR);

/** Full path to templates: .tbd/docs/templates/ (top-level, not under shortcuts) */
export const TBD_TEMPLATES_DIR = join(TBD_DOCS_DIR, TEMPLATES_DIR);

/** @deprecated Use TBD_GUIDELINES_DIR instead */
export const TBD_SHORTCUTS_GUIDELINES = TBD_GUIDELINES_DIR;

/** @deprecated Use TBD_TEMPLATES_DIR instead */
export const TBD_SHORTCUTS_TEMPLATES = TBD_TEMPLATES_DIR;

/** Built-in docs source paths (relative to package docs/) */
export const BUILTIN_SHORTCUTS_SYSTEM = join(SHORTCUTS_DIR, SYSTEM_DIR);
export const BUILTIN_SHORTCUTS_STANDARD = join(SHORTCUTS_DIR, STANDARD_DIR);

/** Built-in guidelines source path (relative to package docs/) */
export const BUILTIN_GUIDELINES_DIR = GUIDELINES_DIR;

/** Built-in templates source path (relative to package docs/) */
export const BUILTIN_TEMPLATES_DIR = TEMPLATES_DIR;

/** Install directory name (header files for tool-specific installation) */
export const INSTALL_DIR = 'install';

/** Built-in install source path (relative to package docs/) */
export const BUILTIN_INSTALL_DIR = INSTALL_DIR;

/**
 * Default shortcut lookup paths (searched in order, relative to tbd root).
 * Earlier paths take precedence over later paths.
 * Note: Guidelines and templates are now separate top-level directories.
 */
export const DEFAULT_SHORTCUT_PATHS = [
  TBD_SHORTCUTS_SYSTEM, // .tbd/docs/shortcuts/system/
  TBD_SHORTCUTS_STANDARD, // .tbd/docs/shortcuts/standard/
];

/**
 * Default guidelines lookup paths (relative to tbd root).
 */
export const DEFAULT_GUIDELINES_PATHS = [
  TBD_GUIDELINES_DIR, // .tbd/docs/guidelines/
];

/**
 * Default template lookup paths (relative to tbd root).
 */
export const DEFAULT_TEMPLATE_PATHS = [
  TBD_TEMPLATES_DIR, // .tbd/docs/templates/
];

/**
 * Get the full path to an issue file.
 */
export function getIssuePath(issueId: string): string {
  return join(ISSUES_DIR, `${issueId}.md`);
}

/**
 * Get the full path to a mapping file.
 */
export function getMappingPath(name: string): string {
  return join(MAPPINGS_DIR, `${name}.yml`);
}

/**
 * Get the full path to an attic entry.
 */
export function getAtticPath(issueId: string, filename: string): string {
  return join(ATTIC_DIR, 'conflicts', issueId, filename);
}

// =============================================================================
// Dynamic Path Resolution
// =============================================================================

import { access } from 'node:fs/promises';

/**
 * Options for resolveDataSyncDir.
 */
export interface ResolveDataSyncDirOptions {
  /**
   * Allow fallback to direct path when worktree is missing.
   * Set to true for test environments or diagnostic tools.
   * Default: true. When false and worktree is missing, throws WorktreeMissingError.
   */
  allowFallback?: boolean;
}

/**
 * Error thrown when worktree is missing and fallback is not allowed.
 * Defined inline to avoid circular dependency with errors.ts.
 */
export class WorktreeMissingError extends Error {
  constructor(
    message = "Worktree not found at .tbd/data-sync-worktree/. Run 'tbd doctor --fix' to repair.",
  ) {
    super(message);
    this.name = 'WorktreeMissingError';
  }
}

/**
 * Cache for resolved data sync directory.
 * Reset when baseDir changes.
 */
let _resolvedDataSyncDir: string | null = null;
let _resolvedBaseDir: string | null = null;
let _resolvedAllowFallback: boolean | null = null;

/**
 * Resolve the actual data sync directory path.
 *
 * This function detects whether we're running with a git worktree
 * (production) or in a test environment without worktree.
 *
 * Order of preference:
 * 1. Worktree path if worktree exists: .tbd/data-sync-worktree/.tbd/data-sync/
 * 2. Direct path as fallback (only if allowFallback: true)
 *
 * @param baseDir - The base directory of the repository (default: process.cwd())
 * @param options - Options for path resolution
 * @returns Resolved data sync directory path
 * @throws WorktreeMissingError if worktree missing and allowFallback is false
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 */
export async function resolveDataSyncDir(
  baseDir: string = process.cwd(),
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const allowFallback = options?.allowFallback ?? true;

  // Return cached result if baseDir and options haven't changed
  if (
    _resolvedDataSyncDir &&
    _resolvedBaseDir === baseDir &&
    _resolvedAllowFallback === allowFallback
  ) {
    return _resolvedDataSyncDir;
  }

  const worktreePath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);
  const directPath = join(baseDir, DATA_SYNC_DIR);

  // Check if worktree path exists
  try {
    await access(worktreePath);
    _resolvedDataSyncDir = worktreePath;
    _resolvedBaseDir = baseDir;
    _resolvedAllowFallback = allowFallback;
    return worktreePath;
  } catch {
    // Worktree doesn't exist
    if (!allowFallback) {
      throw new WorktreeMissingError();
    }

    // Fallback to direct path (test mode or diagnostic tools)
    // Note: In production, sync.ts checks worktree health before calling this
    // Debug warning to help detect unintended fallback usage
    if (process.env.DEBUG || process.env.TBD_DEBUG) {
      console.warn(
        '[tbd:paths] resolveDataSyncDir: worktree not found, falling back to direct path',
      );
    }
    _resolvedDataSyncDir = directPath;
    _resolvedBaseDir = baseDir;
    _resolvedAllowFallback = allowFallback;
    return directPath;
  }
}

/**
 * Resolve issues directory path.
 */
export async function resolveIssuesDir(
  baseDir: string = process.cwd(),
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'issues');
}

/**
 * Resolve mappings directory path.
 */
export async function resolveMappingsDir(
  baseDir: string = process.cwd(),
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'mappings');
}

/**
 * Resolve attic directory path.
 */
export async function resolveAtticDir(
  baseDir: string = process.cwd(),
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'attic');
}

/**
 * Clear the resolved path cache.
 * Call this when the repository state changes (e.g., after init).
 */
export function clearPathCache(): void {
  _resolvedDataSyncDir = null;
  _resolvedBaseDir = null;
  _resolvedAllowFallback = null;
}

// =============================================================================
// Doc Path Resolution
// =============================================================================

import { isAbsolute } from 'node:path';
import { homedir } from 'node:os';

/**
 * Resolve a doc path for consistent handling across the codebase.
 *
 * Path resolution rules:
 * - Absolute paths (starting with /): used as-is
 * - Home directory paths (starting with ~/): expanded to user home directory
 * - Relative paths: resolved from tbd root (baseDir)
 *
 * @param docPath - The path to resolve
 * @param baseDir - The tbd root directory (parent of .tbd/), defaults to cwd
 * @returns Resolved absolute path
 *
 * @example
 * // Absolute path - returned as-is
 * resolveDocPath('/usr/local/docs/file.md') // => '/usr/local/docs/file.md'
 *
 * // Home path - expanded
 * resolveDocPath('~/docs/file.md') // => '/Users/username/docs/file.md'
 *
 * // Relative path - resolved from baseDir
 * resolveDocPath('docs/file.md', '/project') // => '/project/docs/file.md'
 */
export function resolveDocPath(docPath: string, baseDir: string = process.cwd()): string {
  // Handle home directory expansion
  if (docPath.startsWith('~/')) {
    return join(homedir(), docPath.slice(2));
  }

  // Absolute paths used as-is
  if (isAbsolute(docPath)) {
    return docPath;
  }

  // Relative paths resolved from baseDir (tbd root)
  return join(baseDir, docPath);
}

// =============================================================================
// Token Estimation Settings
// =============================================================================

/**
 * Characters per token ratio for estimating token counts.
 *
 * Based on research of OpenAI (tiktoken) and Claude tokenizers:
 * - Pure English prose: ~4-5 chars/token
 * - Code and symbols: ~3 chars/token
 * - Mixed markdown/code docs: ~3.5 chars/token
 *
 * We use 3.5 as our docs are markdown with code examples.
 * This provides ~15-20% accuracy, sufficient for cost estimation.
 */
export const CHARS_PER_TOKEN = 3.5;
