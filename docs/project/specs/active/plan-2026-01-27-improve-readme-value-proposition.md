# Feature: Improve README Value Proposition

**Date:** 2026-01-27 **Author:** Claude **Status:** Draft

## Overview

Rewrite the tbd README so a cold reader (HackerNews, Twitter/X) immediately grasps the
full value: tbd is not just an issue tracker—it's an issue tracker **plus** a curated
knowledge base of engineering best practices that, together, let AI agents (and humans)
plan, implement, and ship high-quality code at a level that no other tool currently
combines.

## Goals

- A first-time reader understands tbd's unique value within 30 seconds of scrolling
- The deep, curated guidelines (TypeScript, Python, Convex, monorepo patterns, testing,
  TDD, etc.) are surfaced prominently with direct links—not buried in a table at the
  bottom
- The connection between guidelines + issue tracking + spec-driven workflow = higher
  engineering quality is made explicit
- Tone is confident and concrete, not hand-wavy; show don't tell
- Keep the README scannable: short paragraphs, clear headers, bullet points

## Non-Goals

- Rewriting the guidelines themselves
- Changing CLI commands or features
- Adding new shortcuts or templates
- Changing the design doc or reference docs

## Background

### Problem

The current README accurately describes tbd's features but undersells the value. Key
issues from a fresh-reader perspective:

1. **Buried lede**: The opening line says "helps humans and agents ship code with greater
   speed, quality, and discipline" which is generic. It doesn't differentiate tbd from
   any other project management tool.

2. **Guidelines are invisible**: The README lists 15+ deep guideline documents in a table
   near the bottom, but doesn't link to any of them or explain why they matter. A reader
   has no idea these contain ~30 pages of battle-tested coding rules.

3. **The "why" section is too personal/narrative**: The "Beads: The Great and the
   Not-So-Great Parts" section tells a personal story that's interesting for existing
   users but loses cold readers. The comparison to Beads is important context but
   shouldn't be the primary motivation section.

4. **No direct links to guideline content**: The guideline table lists names but doesn't
   link to the actual files on GitHub. A curious reader can't click through to see
   `typescript-rules`, `python-rules`, `convex-rules`, etc.

5. **Missing "aha moment"**: The README doesn't make it obvious that tbd gives your AI
   agent instant access to expert-level knowledge about TypeScript monorepos, Convex
   patterns, Python best practices, TDD, golden testing, backward compatibility, etc.—all
   via a single `npm install`.

6. **Informal tone in places**: Phrases like "It's basically like tbd is an issue tracker
   and a meta-skill" are conversational but don't land for a skeptical HN audience.

## Design

### Approach

Restructure the README with these changes:

#### 1. Sharpen the opening (lines 1–15)

Replace the current opening with a more concrete, differentiating pitch:
- tbd = git-native issue tracker + curated engineering knowledge base + spec-driven
  workflows
- One `npm install` gives your AI agent structured task management AND expert coding
  guidelines
- Designed for AI agents but equally useful for humans

#### 2. Add a "What's Inside" section highlighting the knowledge base

Right after Quick Start, add a section that showcases the depth of bundled knowledge:
- Direct GitHub links to key guidelines: `typescript-rules`, `typescript-monorepo-patterns`,
  `python-rules`, `convex-rules`, `general-tdd-guidelines`, `golden-testing-guidelines`,
  `backward-compatibility-rules`
- Brief description of what each covers and why it matters
- Make it clear this is ~30 pages of curated, battle-tested engineering knowledge

#### 3. Restructure "Why?" into a clearer value proposition

- Lead with the problem: AI agents write mediocre code without structure and knowledge
- tbd solves this by combining three things: task tracking (beads), planning (specs),
  and knowledge (guidelines)
- Move the Beads comparison to a smaller subsection or a separate doc

#### 4. Add direct links to guideline files

In the guidelines table, make each guideline name a clickable link to the source file in
`packages/tbd/docs/guidelines/`.

#### 5. Clean up informal language

Remove or rewrite:
- "It's basically like tbd is an issue tracker and a meta-skill"
- "And the tbd skill maps your intents down to shortcuts your agent can use and follow"
- Other casual asides that dilute the message

### Components

Only the README.md file needs changes. No code changes.

## Implementation Plan

### Phase 1: README restructure

- [ ] Rewrite opening section (lines 1–11) with sharper value proposition
- [ ] Add prominent "Knowledge Base" or "Built-in Engineering Knowledge" section after
  Quick Start, with direct GitHub links to key guidelines
- [ ] Restructure "What tbd Provides" to lead with the combined value (tracking +
  planning + knowledge = quality)
- [ ] Add direct links to guideline source files in the guidelines table
- [ ] Clean up "Why?" section: lead with value, move Beads comparison to a subsection
- [ ] Remove or rewrite informal/vague language throughout
- [ ] Review flow end-to-end as a cold reader

### Phase 2: Cross-linked docs (stretch)

- [ ] Check that docs linked from README (design doc, CLI reference) are also clear for
  new readers
- [ ] Consider adding a "See these guidelines in action" example or link

## Testing Strategy

- Read the revised README as a fresh HN reader: can you understand the value in 30
  seconds?
- Verify all links work (guideline files exist at the linked paths)
- Ensure no existing information is lost—only restructured

## Open Questions

- Should the Beads comparison be moved entirely to a separate doc, or kept as a smaller
  subsection?
- Is there a good screenshot or terminal output that could be included for visual
  appeal?
- Should we add a "Before/After" example showing what an agent session looks like with
  vs. without tbd?

## References

- Current README: README.md
- Guidelines source: packages/tbd/docs/guidelines/
- Shortcuts source: packages/tbd/docs/shortcuts/
- Templates source: packages/tbd/docs/templates/
