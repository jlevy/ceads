/**
 * File system utility functions.
 */

import { access } from 'node:fs/promises';

/**
 * Check if a path exists on the filesystem.
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
