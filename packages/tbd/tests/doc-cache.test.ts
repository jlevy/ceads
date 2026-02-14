/**
 * Tests for DocCache - path-ordered markdown document cache.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DocCache,
  generateShortcutDirectory,
  parseQualifiedName,
  type CachedDoc,
  SCORE_EXACT_MATCH,
  SCORE_PREFIX_MATCH,
  SCORE_CONTAINS_ALL,
  SCORE_PARTIAL_BASE,
  SCORE_MIN_THRESHOLD,
} from '../src/file/doc-cache.js';

describe('DocCache', () => {
  let testDir: string;
  let systemDir: string;
  let standardDir: string;

  beforeEach(async () => {
    // Create temp directories for testing
    testDir = join(tmpdir(), `doc-cache-test-${Date.now()}`);
    systemDir = join(testDir, '.tbd', 'docs', 'sys', 'shortcuts');
    standardDir = join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts');
    await mkdir(systemDir, { recursive: true });
    await mkdir(standardDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directories
    await rm(testDir, { recursive: true, force: true });
  });

  describe('load()', () => {
    it('loads markdown files from directories', async () => {
      await writeFile(join(systemDir, 'skill-baseline.md'), '# Skill\n\nContent here.');
      await writeFile(join(standardDir, 'workflow.md'), '# Workflow\n\nContent here.');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.name)).toContain('skill-baseline');
      expect(docs.map((d) => d.name)).toContain('workflow');
    });

    it('skips non-markdown files', async () => {
      await writeFile(join(systemDir, 'skill-baseline.md'), '# Skill');
      await writeFile(join(systemDir, 'readme.txt'), 'Not markdown');
      await writeFile(join(systemDir, 'config.yml'), 'yaml: true');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      expect(docs).toHaveLength(1);
      expect(docs[0]!.name).toBe('skill-baseline');
    });

    it('handles missing directories gracefully', async () => {
      const cache = new DocCache(
        ['.tbd/docs/shortcuts/nonexistent', '.tbd/docs/sys/shortcuts'],
        testDir,
      );
      await cache.load();

      // Should not throw, just skip missing dir
      expect(cache.isLoaded()).toBe(true);
    });

    it('parses frontmatter metadata', async () => {
      const content = `---
title: New Plan Spec
description: Create a new feature planning specification
tags:
  - planning
  - documentation
---

# Instructions

Content here.`;

      await writeFile(join(standardDir, 'new-plan-spec.md'), content);

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      expect(docs).toHaveLength(1);
      expect(docs[0]!.frontmatter?.title).toBe('New Plan Spec');
      expect(docs[0]!.frontmatter?.description).toBe('Create a new feature planning specification');
      expect(docs[0]!.frontmatter?.tags).toEqual(['planning', 'documentation']);
    });

    it('handles files without frontmatter', async () => {
      await writeFile(join(standardDir, 'simple.md'), '# Simple\n\nNo frontmatter.');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      expect(docs).toHaveLength(1);
      expect(docs[0]!.frontmatter).toBeUndefined();
    });
  });

  describe('get() - exact matching', () => {
    it('finds document by exact name', async () => {
      await writeFile(join(standardDir, 'new-plan-spec.md'), '# Plan Spec');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('new-plan-spec');
      expect(match).not.toBeNull();
      expect(match!.doc.name).toBe('new-plan-spec');
      expect(match!.score).toBe(SCORE_EXACT_MATCH);
    });

    it('finds document with .md extension in query', async () => {
      await writeFile(join(standardDir, 'workflow.md'), '# Workflow');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('workflow.md');
      expect(match).not.toBeNull();
      expect(match!.doc.name).toBe('workflow');
    });

    it('returns null for non-existent document', async () => {
      await writeFile(join(standardDir, 'exists.md'), '# Exists');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('nonexistent');
      expect(match).toBeNull();
    });
  });

  describe('search() - fuzzy matching', () => {
    beforeEach(async () => {
      // Set up test documents
      await writeFile(
        join(standardDir, 'new-plan-spec.md'),
        `---
title: New Plan Spec
description: Create a new feature planning specification
---
# Plan Spec`,
      );

      await writeFile(
        join(standardDir, 'implement-spec.md'),
        `---
title: Implement Spec
description: Implement a specification with beads
---
# Implement`,
      );

      await writeFile(
        join(standardDir, 'coding-spike.md'),
        `---
title: Coding Spike
description: Quick exploration of a technical approach
---
# Spike`,
      );
    });

    it('returns exact matches with highest score', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('new-plan-spec');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.doc.name).toBe('new-plan-spec');
      expect(matches[0]!.score).toBe(SCORE_EXACT_MATCH);
    });

    it('returns prefix matches with high score', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('new-plan');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.doc.name).toBe('new-plan-spec');
      expect(matches[0]!.score).toBe(SCORE_PREFIX_MATCH);
    });

    it('matches documents containing all query words', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('plan spec');
      expect(matches.length).toBeGreaterThan(0);
      // Should match new-plan-spec since it contains both words
      expect(matches[0]!.doc.name).toBe('new-plan-spec');
      expect(matches[0]!.score).toBe(SCORE_CONTAINS_ALL);
    });

    it('matches against title and description', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('feature planning');
      expect(matches.length).toBeGreaterThan(0);
      // Should match based on description containing these words
      expect(matches[0]!.doc.name).toBe('new-plan-spec');
    });

    it('returns empty array for no matches', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('xyznonexistent123');
      expect(matches).toHaveLength(0);
    });

    it('respects limit parameter', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('spec', 1);
      expect(matches).toHaveLength(1);
    });

    it('sorts results by score descending', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('spec');
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i]!.score).toBeLessThanOrEqual(matches[i - 1]!.score);
      }
    });
  });

  describe('search() - edge cases', () => {
    it('handles empty query', async () => {
      await writeFile(join(standardDir, 'test.md'), '# Test');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('');
      expect(matches).toHaveLength(0);
    });

    it('handles whitespace-only query', async () => {
      await writeFile(join(standardDir, 'test.md'), '# Test');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('   ');
      expect(matches).toHaveLength(0);
    });

    it('handles special characters in query', async () => {
      await writeFile(
        join(standardDir, 'test-file.md'),
        `---
title: Test (with parens)
description: A test file [with brackets]
---
# Test`,
      );

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      // Should not throw, may or may not find matches
      const matches = cache.search('test (with parens)');
      expect(Array.isArray(matches)).toBe(true);
    });

    it('is case insensitive', async () => {
      await writeFile(
        join(standardDir, 'MyWorkflow.md'),
        `---
title: My Workflow
---
# Content`,
      );

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const lowerMatches = cache.search('myworkflow');
      const upperMatches = cache.search('MYWORKFLOW');
      const mixedMatches = cache.search('MyWorkflow');

      expect(lowerMatches.length).toBeGreaterThan(0);
      expect(upperMatches.length).toBeGreaterThan(0);
      expect(mixedMatches.length).toBeGreaterThan(0);
      expect(lowerMatches[0]!.doc.name).toBe('MyWorkflow');
    });

    it('handles multi-word queries with extra spaces', async () => {
      await writeFile(
        join(standardDir, 'new-plan-spec.md'),
        `---
title: New Plan Spec
---
# Content`,
      );

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('  new   plan  ');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.doc.name).toBe('new-plan-spec');
    });

    it('partial word matches have lower score than full matches', async () => {
      await writeFile(join(standardDir, 'specification.md'), '# Spec');
      await writeFile(join(standardDir, 'spec.md'), '# Spec');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('spec');
      expect(matches.length).toBe(2);
      // Exact match should come first
      expect(matches[0]!.doc.name).toBe('spec');
      expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score);
    });

    it('handles files with invalid YAML frontmatter gracefully', async () => {
      await writeFile(
        join(standardDir, 'invalid.md'),
        `---
title: [invalid yaml
not: closed: properly
---
# Content`,
      );
      await writeFile(join(standardDir, 'valid.md'), '# Valid file');

      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      // Should load without throwing
      const docs = cache.list();
      expect(docs.length).toBe(2);
    });
  });

  describe('path ordering and shadowing', () => {
    it('earlier paths take precedence', async () => {
      // Create same-named file in both directories
      await writeFile(join(systemDir, 'shared.md'), '# System version');
      await writeFile(join(standardDir, 'shared.md'), '# Standard version');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('shared');
      expect(match).not.toBeNull();
      expect(match!.doc.content).toContain('System version');
      expect(match!.doc.sourceDir).toBe('.tbd/docs/sys/shortcuts');
    });

    it('list() returns only active docs by default', async () => {
      await writeFile(join(systemDir, 'shared.md'), '# System');
      await writeFile(join(standardDir, 'shared.md'), '# Standard');
      await writeFile(join(standardDir, 'unique.md'), '# Unique');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      expect(docs).toHaveLength(2); // shared (from system) + unique
    });

    it('list(true) includes shadowed docs', async () => {
      await writeFile(join(systemDir, 'shared.md'), '# System');
      await writeFile(join(standardDir, 'shared.md'), '# Standard');
      await writeFile(join(standardDir, 'unique.md'), '# Unique');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const allDocs = cache.list(true);
      expect(allDocs).toHaveLength(3); // shared (system) + shared (standard) + unique
    });

    it('isShadowed() correctly identifies shadowed docs', async () => {
      await writeFile(join(systemDir, 'shared.md'), '# System');
      await writeFile(join(standardDir, 'shared.md'), '# Standard');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const allDocs = cache.list(true);
      const systemDoc = allDocs.find((d) => d.sourceDir === '.tbd/docs/sys/shortcuts');
      const standardDoc = allDocs.find((d) => d.sourceDir === '.tbd/docs/tbd/shortcuts');

      expect(cache.isShadowed(systemDoc!)).toBe(false);
      expect(cache.isShadowed(standardDoc!)).toBe(true);
    });
  });

  describe('scoring constants', () => {
    it('has correct score values', () => {
      expect(SCORE_EXACT_MATCH).toBe(1.0);
      expect(SCORE_PREFIX_MATCH).toBe(0.9);
      expect(SCORE_CONTAINS_ALL).toBe(0.8);
      expect(SCORE_PARTIAL_BASE).toBe(0.7);
      expect(SCORE_MIN_THRESHOLD).toBe(0.5);
    });

    it('scores are in descending order', () => {
      expect(SCORE_EXACT_MATCH).toBeGreaterThan(SCORE_PREFIX_MATCH);
      expect(SCORE_PREFIX_MATCH).toBeGreaterThan(SCORE_CONTAINS_ALL);
      expect(SCORE_CONTAINS_ALL).toBeGreaterThan(SCORE_PARTIAL_BASE);
      expect(SCORE_PARTIAL_BASE).toBeGreaterThan(SCORE_MIN_THRESHOLD);
    });
  });
});

describe('generateShortcutDirectory', () => {
  function makeCachedDoc(name: string, description: string, hidden?: boolean): CachedDoc {
    return {
      path: `/test/${name}.md`,
      name,
      frontmatter: { description },
      content: `# ${name}`,
      sourceDir: '/test',
      sizeBytes: 100,
      approxTokens: 30,
      hidden: hidden ?? false,
    };
  }

  it('excludes docs with hidden=true from shortcut table', () => {
    const shortcuts = [
      makeCachedDoc('skill', 'System skill file', true),
      makeCachedDoc('skill-brief', 'Brief skill file', true),
      makeCachedDoc('code-review', 'Review code changes'),
    ];

    const result = generateShortcutDirectory(shortcuts);

    expect(result).toContain('code-review');
    expect(result).not.toContain('| skill |');
    expect(result).not.toContain('| skill-brief |');
  });

  it('excludes docs with hidden=true from guidelines table', () => {
    const shortcuts = [makeCachedDoc('workflow', 'A workflow')];
    const guidelines = [
      makeCachedDoc('internal-guide', 'Internal only', true),
      makeCachedDoc('typescript-rules', 'TypeScript best practices'),
    ];

    const result = generateShortcutDirectory(shortcuts, guidelines);

    expect(result).toContain('typescript-rules');
    expect(result).not.toContain('internal-guide');
  });

  it('includes all docs when none are hidden', () => {
    const shortcuts = [
      makeCachedDoc('review', 'Review code'),
      makeCachedDoc('commit', 'Commit changes'),
    ];

    const result = generateShortcutDirectory(shortcuts);

    expect(result).toContain('review');
    expect(result).toContain('commit');
  });

  it('shows empty message when all shortcuts are hidden', () => {
    const shortcuts = [
      makeCachedDoc('skill', 'Hidden', true),
      makeCachedDoc('skill-brief', 'Hidden', true),
    ];

    const result = generateShortcutDirectory(shortcuts);

    expect(result).toContain('No shortcuts available');
  });
});

describe('parseQualifiedName', () => {
  it('parses unqualified name', () => {
    const result = parseQualifiedName('typescript-rules');
    expect(result).toEqual({ baseName: 'typescript-rules' });
  });

  it('parses qualified name with prefix', () => {
    const result = parseQualifiedName('spec:typescript-rules');
    expect(result).toEqual({ prefix: 'spec', baseName: 'typescript-rules' });
  });

  it('handles names with multiple colons (first colon is separator)', () => {
    const result = parseQualifiedName('spec:some:doc-name');
    expect(result).toEqual({ prefix: 'spec', baseName: 'some:doc-name' });
  });

  it('handles empty prefix (colon at start)', () => {
    const result = parseQualifiedName(':typescript-rules');
    expect(result).toEqual({ baseName: ':typescript-rules' });
  });

  it('strips .md extension', () => {
    const result = parseQualifiedName('typescript-rules.md');
    expect(result).toEqual({ baseName: 'typescript-rules' });
  });

  it('strips .md extension from qualified name', () => {
    const result = parseQualifiedName('spec:typescript-rules.md');
    expect(result).toEqual({ prefix: 'spec', baseName: 'typescript-rules' });
  });
});

describe('DocCache prefix-aware lookup', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `doc-cache-prefix-test-${Date.now()}`);
    // Create prefix-based directories
    await mkdir(join(testDir, '.tbd', 'docs', 'sys', 'shortcuts'), { recursive: true });
    await mkdir(join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts'), { recursive: true });
    await mkdir(join(testDir, '.tbd', 'docs', 'spec', 'shortcuts'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('loads docs with prefix from directory structure', async () => {
    await writeFile(
      join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts', 'commit.md'),
      '---\ntitle: Commit\n---\n# Commit',
    );

    const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
    await cache.load();

    const match = cache.get('commit');
    expect(match).not.toBeNull();
    expect(match!.doc.prefix).toBe('tbd');
  });

  it('resolves qualified name to specific prefix', async () => {
    // Same name in two prefixes
    await writeFile(join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts', 'review.md'), '# TBD Review');
    await writeFile(
      join(testDir, '.tbd', 'docs', 'spec', 'shortcuts', 'review.md'),
      '# Spec Review',
    );

    const cache = new DocCache(['.tbd/docs/tbd/shortcuts', '.tbd/docs/spec/shortcuts'], testDir);
    await cache.load();

    // Qualified lookup should return specific prefix
    const match = cache.get('spec:review');
    expect(match).not.toBeNull();
    expect(match!.doc.content).toContain('Spec Review');
    expect(match!.doc.prefix).toBe('spec');
  });

  it('unqualified name returns first match in path order', async () => {
    await writeFile(join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts', 'review.md'), '# TBD Review');
    await writeFile(
      join(testDir, '.tbd', 'docs', 'spec', 'shortcuts', 'review.md'),
      '# Spec Review',
    );

    const cache = new DocCache(['.tbd/docs/tbd/shortcuts', '.tbd/docs/spec/shortcuts'], testDir);
    await cache.load();

    // Unqualified should return first (tbd)
    const match = cache.get('review');
    expect(match).not.toBeNull();
    expect(match!.doc.content).toContain('TBD Review');
    expect(match!.doc.prefix).toBe('tbd');
  });

  it('list() filters out hidden docs by default', async () => {
    await writeFile(
      join(testDir, '.tbd', 'docs', 'sys', 'shortcuts', 'skill.md'),
      '---\ntitle: Skill\n---\n# Skill',
    );
    await writeFile(
      join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts', 'commit.md'),
      '---\ntitle: Commit\n---\n# Commit',
    );

    const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
    await cache.load();

    // sys docs are not hidden by default (hidden is set at source level, not directory level)
    const docs = cache.list();
    expect(docs.length).toBe(2);
  });
});
