/**
 * Tests for reference command behavior.
 *
 * References are documentation files (API references, etc.) that follow
 * the same DocCommandHandler pattern as guidelines and templates.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocCache } from '../src/file/doc-cache.js';
import { getDefaultDocPaths } from '../src/lib/paths.js';

describe('reference command behavior', () => {
  let testDir: string;
  let referencesDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `reference-test-${Date.now()}`);
    referencesDir = join(testDir, '.tbd', 'docs', 'tbd', 'references');
    await mkdir(referencesDir, { recursive: true });

    await writeFile(
      join(referencesDir, 'api-reference.md'),
      `---
title: API Reference
description: REST API documentation
---
# API Reference

Endpoints and methods.`,
    );
    await writeFile(
      join(referencesDir, 'data-model.md'),
      `---
title: Data Model
description: Database schema reference
---
# Data Model

Tables and relationships.`,
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('loads references from default doc paths', async () => {
    const paths = getDefaultDocPaths('reference');
    const cache = new DocCache(paths, testDir);
    await cache.load({ quiet: true });
    const docs = cache.list();
    expect(docs.length).toBe(2);
    const names = docs.map((d) => d.name).sort();
    expect(names).toEqual(['api-reference', 'data-model']);
  });

  it('finds reference by exact name', async () => {
    const paths = getDefaultDocPaths('reference');
    const cache = new DocCache(paths, testDir);
    await cache.load({ quiet: true });
    const match = cache.get('api-reference');
    expect(match).not.toBeNull();
    expect(match!.doc.name).toBe('api-reference');
    expect(match!.doc.content).toContain('Endpoints and methods');
  });

  it('fuzzy searches references', async () => {
    const paths = getDefaultDocPaths('reference');
    const cache = new DocCache(paths, testDir);
    await cache.load({ quiet: true });
    const results = cache.search('database');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.doc.name).toBe('data-model');
  });

  it('returns JSON-serializable doc list', async () => {
    const paths = getDefaultDocPaths('reference');
    const cache = new DocCache(paths, testDir);
    await cache.load({ quiet: true });
    const docs = cache.list();
    for (const doc of docs) {
      expect(doc.name).toBeDefined();
      expect(doc.path).toBeDefined();
      expect(doc.frontmatter?.title).toBeDefined();
      expect(doc.frontmatter?.description).toBeDefined();
    }
  });
});
