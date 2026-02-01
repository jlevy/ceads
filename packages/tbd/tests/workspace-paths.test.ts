/**
 * Tests for workspace path utilities.
 *
 * Workspaces are named directories under .tbd/workspaces/ that store
 * issue data for sync failure recovery, backups, and bulk editing.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  WORKSPACES_DIR,
  WORKSPACES_DIR_NAME,
  getWorkspaceDir,
  getWorkspaceIssuesDir,
  getWorkspaceMappingsDir,
  getWorkspaceAtticDir,
  isValidWorkspaceName,
} from '../src/lib/paths.js';

describe('workspace path constants', () => {
  it('defines WORKSPACES_DIR_NAME as workspaces', () => {
    expect(WORKSPACES_DIR_NAME).toBe('workspaces');
  });

  it('defines WORKSPACES_DIR as .tbd/workspaces', () => {
    // Use join() to get platform-specific path separator
    expect(WORKSPACES_DIR).toBe(join('.tbd', 'workspaces'));
  });
});

describe('getWorkspaceDir', () => {
  it('returns path to workspace directory', () => {
    const path = getWorkspaceDir('my-feature');
    expect(path).toBe(join('.tbd', 'workspaces', 'my-feature'));
  });

  it('returns path for outbox workspace', () => {
    const path = getWorkspaceDir('outbox');
    expect(path).toBe(join('.tbd', 'workspaces', 'outbox'));
  });

  it('handles workspace names with hyphens', () => {
    const path = getWorkspaceDir('pre-refactor-2026-01');
    expect(path).toBe(join('.tbd', 'workspaces', 'pre-refactor-2026-01'));
  });
});

describe('getWorkspaceIssuesDir', () => {
  it('returns path to workspace issues directory', () => {
    const path = getWorkspaceIssuesDir('my-feature');
    expect(path).toBe(join('.tbd', 'workspaces', 'my-feature', 'issues'));
  });
});

describe('getWorkspaceMappingsDir', () => {
  it('returns path to workspace mappings directory', () => {
    const path = getWorkspaceMappingsDir('my-feature');
    expect(path).toBe(join('.tbd', 'workspaces', 'my-feature', 'mappings'));
  });
});

describe('getWorkspaceAtticDir', () => {
  it('returns path to workspace attic directory', () => {
    const path = getWorkspaceAtticDir('my-feature');
    expect(path).toBe(join('.tbd', 'workspaces', 'my-feature', 'attic'));
  });
});

describe('isValidWorkspaceName', () => {
  it('accepts lowercase alphanumeric names', () => {
    expect(isValidWorkspaceName('myfeature')).toBe(true);
    expect(isValidWorkspaceName('feature123')).toBe(true);
  });

  it('accepts names with hyphens', () => {
    expect(isValidWorkspaceName('my-feature')).toBe(true);
    expect(isValidWorkspaceName('pre-refactor-2026-01')).toBe(true);
  });

  it('accepts names with underscores', () => {
    expect(isValidWorkspaceName('my_feature')).toBe(true);
  });

  it('accepts the special outbox name', () => {
    expect(isValidWorkspaceName('outbox')).toBe(true);
  });

  it('rejects empty names', () => {
    expect(isValidWorkspaceName('')).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(isValidWorkspaceName('my feature')).toBe(false);
  });

  it('rejects names with path separators', () => {
    expect(isValidWorkspaceName('my/feature')).toBe(false);
    expect(isValidWorkspaceName('my\\feature')).toBe(false);
  });

  it('rejects names starting with dot', () => {
    expect(isValidWorkspaceName('.hidden')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(isValidWorkspaceName('my@feature')).toBe(false);
    expect(isValidWorkspaceName('my#feature')).toBe(false);
  });
});
