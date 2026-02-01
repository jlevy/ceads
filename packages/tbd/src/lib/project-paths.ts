/**
 * Generic project path utilities for handling user-provided paths.
 *
 * This module provides reusable functions for resolving, validating, and
 * normalizing paths relative to a project root. It is designed to be
 * general-purpose and not tied to any specific use case (e.g., specs).
 *
 * Key features:
 * - Resolves absolute, relative, and subdirectory paths to project-relative paths
 * - Validates that paths stay within project boundaries
 * - Normalizes paths (removes ./, converts backslashes, etc.)
 * - Validates file existence
 */

import { resolve, relative, isAbsolute, normalize, sep } from 'node:path';
import { access, stat } from 'node:fs/promises';

/**
 * Result of resolving a path relative to the project root.
 */
export interface ResolvedProjectPath {
  /** Path relative to project root (always uses forward slashes) */
  relativePath: string;
  /** Absolute path to the file */
  absolutePath: string;
}

/**
 * Error thrown when a path operation fails.
 * The message is user-friendly and can be displayed directly.
 */
export class ProjectPathError extends Error {
  constructor(
    message: string,
    public readonly code: 'OUTSIDE_PROJECT' | 'NOT_FOUND' | 'NOT_A_FILE',
  ) {
    super(message);
    this.name = 'ProjectPathError';
  }
}

/**
 * Converts a ProjectPathError to a user-friendly error message for CLI display.
 * Returns the error message if it's a ProjectPathError, otherwise re-throws.
 */
export function getPathErrorMessage(error: unknown): string {
  if (error instanceof ProjectPathError) {
    return error.message;
  }
  throw error;
}

/**
 * Normalizes a path by:
 * - Removing leading ./
 * - Converting backslashes to forward slashes (Windows compatibility)
 * - Removing redundant slashes
 * - Resolving . and .. components
 *
 * @param inputPath - The path to normalize
 * @returns Normalized path string
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) {
    return '';
  }

  // First, convert all backslashes to forward slashes (Windows compatibility)
  // This must happen BEFORE normalize() since backslashes aren't path separators on Linux
  let normalized = inputPath.replace(/\\/g, '/');

  // Use Node's normalize to handle . and .. components
  // (normalize on Linux won't touch forward slashes)
  normalized = normalize(normalized);

  // Ensure we still have forward slashes after normalize (in case of mixed separators)
  normalized = normalized.split(sep).join('/');

  // Remove leading ./
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Remove trailing slash (unless it's just "/")
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Handle edge case where normalize returns '.'
  if (normalized === '.') {
    return '';
  }

  return normalized;
}

/**
 * Checks if an absolute path is within the project root.
 *
 * @param absolutePath - The absolute path to check
 * @param projectRoot - The project root directory
 * @returns true if the path is within or at the project root
 */
export function isPathWithinProject(absolutePath: string, projectRoot: string): boolean {
  // Normalize both paths for consistent comparison
  const normalizedPath = resolve(absolutePath);
  const normalizedRoot = resolve(projectRoot);

  // The path is within the project if it starts with the project root
  // We need to handle the case where the path IS the project root
  // or is a subdirectory of it
  if (normalizedPath === normalizedRoot) {
    return true;
  }

  // Check if path starts with root + separator
  // This prevents false positives like /project-backup matching /project
  return normalizedPath.startsWith(normalizedRoot + sep);
}

/**
 * Resolves any path (absolute, relative, or from subdirectory) to a project-relative path.
 *
 * Resolution rules:
 * 1. Absolute paths within project → convert to relative
 * 2. Absolute paths outside project → error
 * 3. Relative paths from subdirectory → resolve to project root
 * 4. Already project-relative → pass through with normalization
 * 5. Path escaping project (../../) → error
 *
 * @param inputPath - The path provided by the user (can be absolute or relative)
 * @param projectRoot - The project root directory (parent of .tbd/)
 * @param cwd - Current working directory (where command was run)
 * @returns Resolved paths object with both relative and absolute paths
 * @throws ProjectPathError if path is outside project
 */
export function resolveProjectPath(
  inputPath: string,
  projectRoot: string,
  cwd: string,
): ResolvedProjectPath {
  // Normalize inputs
  const normalizedProjectRoot = resolve(projectRoot);
  const normalizedCwd = resolve(cwd);

  let absolutePath: string;

  if (isAbsolute(inputPath)) {
    // Input is already absolute
    absolutePath = resolve(inputPath);
  } else {
    // Input is relative - resolve from current working directory
    absolutePath = resolve(normalizedCwd, inputPath);
  }

  // Check if path is within project
  if (!isPathWithinProject(absolutePath, normalizedProjectRoot)) {
    throw new ProjectPathError(`Path is outside project root: ${inputPath}`, 'OUTSIDE_PROJECT');
  }

  // Calculate relative path from project root
  const relativePath = relative(normalizedProjectRoot, absolutePath);

  // Normalize the relative path (remove ./, convert separators, etc.)
  const normalizedRelative = normalizePath(relativePath);

  return {
    relativePath: normalizedRelative,
    absolutePath,
  };
}

/**
 * Validates that a file exists at the resolved path.
 *
 * @param resolvedPath - Path already resolved via resolveProjectPath
 * @returns true if file exists
 * @throws ProjectPathError if file does not exist or is not a file
 */
export async function validateFileExists(resolvedPath: ResolvedProjectPath): Promise<boolean> {
  try {
    await access(resolvedPath.absolutePath);
  } catch {
    throw new ProjectPathError(`File not found: ${resolvedPath.relativePath}`, 'NOT_FOUND');
  }

  // Also verify it's a file, not a directory
  try {
    const stats = await stat(resolvedPath.absolutePath);
    if (!stats.isFile()) {
      throw new ProjectPathError(`Path is not a file: ${resolvedPath.relativePath}`, 'NOT_A_FILE');
    }
  } catch (error) {
    if (error instanceof ProjectPathError) {
      throw error;
    }
    throw new ProjectPathError(`File not found: ${resolvedPath.relativePath}`, 'NOT_FOUND');
  }

  return true;
}

/**
 * Convenience function that resolves and validates a path in one call.
 *
 * @param inputPath - The path provided by the user
 * @param projectRoot - The project root directory
 * @param cwd - Current working directory
 * @returns Resolved and validated path
 * @throws ProjectPathError if path is outside project or file doesn't exist
 */
export async function resolveAndValidatePath(
  inputPath: string,
  projectRoot: string,
  cwd: string,
): Promise<ResolvedProjectPath> {
  const resolved = resolveProjectPath(inputPath, projectRoot, cwd);
  await validateFileExists(resolved);
  return resolved;
}
