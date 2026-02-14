/**
 * Characterization tests for shortcut command behavior.
 *
 * These tests capture the exact current behavior before any refactoring,
 * ensuring that the shortcut-to-DocCommandHandler migration preserves
 * all observable behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocCache, generateShortcutDirectory, SCORE_PREFIX_MATCH } from '../src/file/doc-cache.js';
import { SHORTCUT_AGENT_HEADER, GUIDELINES_AGENT_HEADER } from '../src/cli/lib/doc-prompts.js';

describe('shortcut command behavior', () => {
  let testDir: string;
  let systemDir: string;
  let standardDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `shortcut-test-${Date.now()}`);
    systemDir = join(testDir, '.tbd', 'docs', 'sys', 'shortcuts');
    standardDir = join(testDir, '.tbd', 'docs', 'tbd', 'shortcuts');
    await mkdir(systemDir, { recursive: true });
    await mkdir(standardDir, { recursive: true });

    // System shortcuts (hidden in real setup)
    await writeFile(
      join(systemDir, 'skill-baseline.md'),
      `---
title: Skill Baseline
description: Main skill file
---
# Skill Content`,
    );
    await writeFile(
      join(systemDir, 'skill-brief.md'),
      `---
title: Skill Brief
description: Brief skill file
---
# Brief`,
    );
    await writeFile(
      join(systemDir, 'shortcut-explanation.md'),
      `---
title: Shortcut Explanation
description: How shortcuts work
---
# Shortcut Explanation

Shortcuts are reusable instruction templates.`,
    );

    // Standard shortcuts
    await writeFile(
      join(standardDir, 'code-review.md'),
      `---
title: Code Review
description: Review code changes and commit
category: review
tags:
  - review
  - git
---
# Code Review Shortcut

Review all changes carefully.`,
    );
    await writeFile(
      join(standardDir, 'new-plan-spec.md'),
      `---
title: New Plan Spec
description: Create a new feature planning specification
category: planning
---
# New Plan Spec

Instructions for creating a plan.`,
    );
    await writeFile(
      join(standardDir, 'implement-beads.md'),
      `---
title: Implement Beads
description: Implement beads from a spec following TDD
category: planning
---
# Implement Beads

Follow TDD to implement beads.`,
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('exact lookup', () => {
    it('finds shortcut by exact name and returns content', async () => {
      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('code-review');
      expect(match).not.toBeNull();
      expect(match!.doc.name).toBe('code-review');
      expect(match!.doc.content).toContain('Review all changes carefully');
    });

    it('finds system shortcuts by exact name', async () => {
      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('shortcut-explanation');
      expect(match).not.toBeNull();
      expect(match!.doc.content).toContain('Shortcuts are reusable');
    });
  });

  describe('fuzzy search with score thresholds', () => {
    it('prefix match returns score >= SCORE_PREFIX_MATCH', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('code-rev');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.doc.name).toBe('code-review');
      expect(matches[0]!.score).toBeGreaterThanOrEqual(SCORE_PREFIX_MATCH);
    });

    it('word-based match returns lower score than prefix match', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('review code');
      expect(matches.length).toBeGreaterThan(0);
      // Word match has lower score than prefix match
      expect(matches[0]!.score).toBeLessThan(SCORE_PREFIX_MATCH);
    });
  });

  describe('--category filtering', () => {
    it('filters docs by category from frontmatter', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const allDocs = cache.list();
      const planningDocs = allDocs.filter((d) => d.frontmatter?.category === 'planning');
      const reviewDocs = allDocs.filter((d) => d.frontmatter?.category === 'review');

      expect(planningDocs.length).toBe(2); // new-plan-spec, implement-beads
      expect(reviewDocs.length).toBe(1); // code-review
    });
  });

  describe('no-query fallback', () => {
    it('shortcut-explanation.md is accessible for no-query mode', async () => {
      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const explanation = cache.get('shortcut-explanation');
      expect(explanation).not.toBeNull();
      expect(explanation!.doc.content).toContain('Shortcut Explanation');
    });
  });

  describe('agent header', () => {
    it('SHORTCUT_AGENT_HEADER is defined and non-empty', () => {
      expect(SHORTCUT_AGENT_HEADER).toBeDefined();
      expect(SHORTCUT_AGENT_HEADER.length).toBeGreaterThan(0);
      expect(SHORTCUT_AGENT_HEADER).toContain('Agent instructions');
    });

    it('GUIDELINES_AGENT_HEADER is defined and non-empty', () => {
      expect(GUIDELINES_AGENT_HEADER).toBeDefined();
      expect(GUIDELINES_AGENT_HEADER.length).toBeGreaterThan(0);
    });
  });

  describe('path ordering and shadowing', () => {
    it('system dir takes precedence over standard dir for same name', async () => {
      // Add a file with same name to both dirs
      await writeFile(join(standardDir, 'skill-baseline.md'), '# Standard skill');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const match = cache.get('skill-baseline');
      expect(match).not.toBeNull();
      expect(match!.doc.content).toContain('Skill Content'); // System version
      expect(match!.doc.sourceDir).toBe('.tbd/docs/sys/shortcuts');
    });

    it('shadowed entries are identifiable', async () => {
      await writeFile(join(standardDir, 'skill-baseline.md'), '# Standard skill');

      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const allDocs = cache.list(true); // include shadowed
      const standardSkill = allDocs.find(
        (d) => d.name === 'skill-baseline' && d.sourceDir === '.tbd/docs/tbd/shortcuts',
      );
      expect(standardSkill).toBeDefined();
      expect(cache.isShadowed(standardSkill!)).toBe(true);
    });
  });

  describe('JSON output shape', () => {
    it('list output has expected fields', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      for (const doc of docs) {
        // These are the fields the shortcut --list --json uses
        expect(doc).toHaveProperty('name');
        expect(doc).toHaveProperty('path');
        expect(doc).toHaveProperty('sourceDir');
        expect(doc).toHaveProperty('sizeBytes');
        expect(doc).toHaveProperty('approxTokens');
        expect(doc).toHaveProperty('content');
      }
    });

    it('search result has expected fields', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const matches = cache.search('code-review');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty('doc');
      expect(matches[0]).toHaveProperty('score');
      expect(matches[0]!.doc).toHaveProperty('name');
      expect(matches[0]!.doc).toHaveProperty('content');
    });
  });

  describe('generateShortcutDirectory', () => {
    it('generates directory excluding system shortcuts by name', async () => {
      const cache = new DocCache(['.tbd/docs/sys/shortcuts', '.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      const directory = generateShortcutDirectory(docs);

      // Standard shortcuts should be included
      expect(directory).toContain('code-review');
      expect(directory).toContain('new-plan-spec');
      expect(directory).toContain('implement-beads');

      // System shortcuts should be excluded (by hardcoded skip names)
      expect(directory).not.toContain('| skill-baseline |');
      expect(directory).not.toContain('| skill-brief |');
      expect(directory).not.toContain('| skill-minimal |');
      expect(directory).not.toContain('| shortcut-explanation |');
    });

    it('wraps with directory markers', async () => {
      const cache = new DocCache(['.tbd/docs/tbd/shortcuts'], testDir);
      await cache.load();

      const docs = cache.list();
      const directory = generateShortcutDirectory(docs);

      expect(directory).toContain('<!-- BEGIN SHORTCUT DIRECTORY -->');
      expect(directory).toContain('<!-- END SHORTCUT DIRECTORY -->');
    });
  });
});
