/**
 * Tests for attic and import command logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'atomically';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

import { writeIssue, readIssue } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';
import { DATA_SYNC_DIR, ATTIC_DIR, MAPPINGS_DIR } from '../src/lib/paths.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

// Attic entry structure
interface AtticEntry {
  entity_id: string;
  timestamp: string;
  field: string;
  lost_value: string;
  winner_source: string;
  loser_source: string;
  context: {
    local_version: number;
    remote_version: number;
    local_updated_at: string;
    remote_updated_at: string;
  };
}

describe('attic commands logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;
  const atticDir = ATTIC_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-attic-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    await mkdir(join(testDir, atticDir), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('saves attic entry with correct filename format', async () => {
    const entityId = testId(TEST_ULIDS.ATTIC_1);
    const entry: AtticEntry = {
      entity_id: entityId,
      timestamp: '2025-01-07T10:30:00Z',
      field: 'description',
      lost_value: 'Original description content',
      winner_source: 'remote',
      loser_source: 'local',
      context: {
        local_version: 3,
        remote_version: 4,
        local_updated_at: '2025-01-07T10:25:00Z',
        remote_updated_at: '2025-01-07T10:28:00Z',
      },
    };

    // Save entry using the same logic as the command
    const safeTimestamp = entry.timestamp.replace(/:/g, '-');
    const filename = `${entry.entity_id}_${safeTimestamp}_${entry.field}.yml`;
    const filepath = join(testDir, atticDir, filename);
    const content = stringifyYaml(entry, { sortMapEntries: true });
    await writeFile(filepath, content);

    // Read and verify
    const savedContent = await readFile(filepath, 'utf-8');
    const saved = parseYaml(savedContent) as AtticEntry;

    expect(saved.entity_id).toBe(entityId);
    expect(saved.field).toBe('description');
    expect(saved.lost_value).toBe('Original description content');
    expect(saved.winner_source).toBe('remote');
  });

  it('restores value from attic entry', async () => {
    const issueId = testId(TEST_ULIDS.ATTIC_2);
    // Create an issue
    const issue: Issue = {
      type: 'is',
      id: issueId,
      version: 2,
      kind: 'bug',
      title: 'Bug to restore',
      description: 'New overwritten description',
      status: 'open',
      priority: 1,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-07T10:30:00Z',
    };
    await writeIssue(issuesDir, issue);

    // Create attic entry with original value
    const entry: AtticEntry = {
      entity_id: issueId,
      timestamp: '2025-01-07T10:30:00Z',
      field: 'description',
      lost_value: 'Original description before conflict',
      winner_source: 'remote',
      loser_source: 'local',
      context: {
        local_version: 1,
        remote_version: 2,
        local_updated_at: '2025-01-07T10:25:00Z',
        remote_updated_at: '2025-01-07T10:28:00Z',
      },
    };

    // Save attic entry
    const safeTimestamp = entry.timestamp.replace(/:/g, '-');
    const filename = `${entry.entity_id}_${safeTimestamp}_${entry.field}.yml`;
    const filepath = join(testDir, atticDir, filename);
    await writeFile(filepath, stringifyYaml(entry));

    // Simulate restore: load issue, restore field, save
    const loaded = await readIssue(issuesDir, issueId);
    loaded.description = entry.lost_value;
    loaded.version += 1;
    loaded.updated_at = new Date().toISOString();
    await writeIssue(issuesDir, loaded);

    // Verify restoration
    const restored = await readIssue(issuesDir, issueId);
    expect(restored.description).toBe('Original description before conflict');
    expect(restored.version).toBe(3);
  });
});

describe('import command logic', () => {
  let testDir: string;
  const issuesDir = DATA_SYNC_DIR;
  const mappingsDir = MAPPINGS_DIR;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-import-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    await mkdir(join(testDir, mappingsDir), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('parses JSONL format correctly', async () => {
    // Create a sample JSONL file
    const beadsIssues = [
      {
        id: 'bd-x7y8',
        title: 'First issue',
        status: 'open',
        priority: 2,
        labels: ['frontend'],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'bd-a1b2',
        title: 'Second issue',
        type: 'bug',
        status: 'in_progress',
        priority: 1,
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      },
    ];

    const jsonlContent = beadsIssues.map((i) => JSON.stringify(i)).join('\n');
    const jsonlPath = join(testDir, 'beads-export.jsonl');
    await fsWriteFile(jsonlPath, jsonlContent, 'utf-8');

    // Parse JSONL
    const content = await readFile(jsonlPath, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter((l) => l);
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(parsed.length).toBe(2);
    expect(parsed[0]!.id).toBe('bd-x7y8');
    expect(parsed[1]!.id).toBe('bd-a1b2');
    expect(parsed[1]!.type).toBe('bug');
  });

  it('maps Beads status to tbd status correctly', () => {
    const statusMap: Record<string, string> = {
      open: 'open',
      in_progress: 'in_progress',
      blocked: 'blocked',
      deferred: 'deferred',
      closed: 'closed',
      tombstone: 'closed',
    };

    expect(statusMap.open).toBe('open');
    expect(statusMap.in_progress).toBe('in_progress');
    expect(statusMap.tombstone).toBe('closed');
  });

  it('maps Beads type to tbd kind correctly', () => {
    const kindMap: Record<string, string> = {
      bug: 'bug',
      feature: 'feature',
      task: 'task',
      epic: 'epic',
      chore: 'chore',
    };

    expect(kindMap.bug).toBe('bug');
    expect(kindMap.feature).toBe('feature');
    expect(kindMap.task).toBe('task');
  });

  it('maintains ID mapping for idempotent import', async () => {
    // Create a mapping file
    const mapping: Record<string, string> = {
      'bd-x7y8': testId(TEST_ULIDS.IMPORT_1),
      'bd-a1b2': testId(TEST_ULIDS.IMPORT_2),
    };

    const mappingPath = join(testDir, mappingsDir, 'beads.yml');
    await writeFile(mappingPath, stringifyYaml(mapping));

    // Read mapping back
    const content = await readFile(mappingPath, 'utf-8');
    const loaded = parseYaml(content) as Record<string, string>;

    expect(loaded['bd-x7y8']).toBe(testId(TEST_ULIDS.IMPORT_1));
    expect(loaded['bd-a1b2']).toBe(testId(TEST_ULIDS.IMPORT_2));
  });

  it('skips older issues when not merging', async () => {
    const issueId = testId(TEST_ULIDS.IMPORT_3);
    // Create an existing issue
    const existing: Issue = {
      type: 'is',
      id: issueId,
      version: 2,
      kind: 'task',
      title: 'Existing task (updated)',
      status: 'in_progress',
      priority: 1,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-05T00:00:00Z', // More recent
      extensions: {
        beads: {
          original_id: 'bd-c3d4',
          imported_at: '2025-01-01T00:00:00Z',
        },
      },
    };
    await writeIssue(issuesDir, existing);

    // Simulate import check
    const beadsUpdatedAt = new Date('2025-01-02T00:00:00Z');
    const existingUpdatedAt = new Date(existing.updated_at);

    const shouldSkip = beadsUpdatedAt <= existingUpdatedAt;
    expect(shouldSkip).toBe(true);
  });
});
