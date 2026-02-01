# Feature: Improve README Value Proposition

**Date:** 2026-01-27 **Author:** Claude **Status:** In Progress

## Overview

Rewrite the tbd README so a cold reader (HackerNews, Twitter/X) immediately grasps the
full value of tbd.

tbd combines three things that are each powerful on their own but unreasonably effective
together:

1. **Task management via beads** — git-native issue tracking that’s proven unreasonably
   effective at scaling an agent’s capacity from ~5-10 ad-hoc tasks to hundreds of
   structured issues across sessions.
   This alone is a step change.
2. **Spec-driven development** — workflows for planning features, writing specs, and
   breaking them into implementation issues before coding.
   With a good spec and beads, you can leave an agent running overnight and come back to
   solid, well-structured code.
3. **Instant high-quality context injection** — a curated knowledge base of engineering
   best practices (TypeScript, Python, Convex, monorepos, TDD, etc.)
   injected directly into the agent’s context on demand, so it follows battle-tested
   rules instead of guessing.

The README should communicate that tbd is the combination of all three, and that
interacting with it feels natural — you talk to your agent, and tbd provides the
discipline and knowledge behind the scenes.

## Goals

- A first-time reader understands tbd’s unique value within 30 seconds of scrolling
- All three pillars (beads, specs, knowledge) are given equal weight — not organized
  around any single one
- The guidelines are surfaced prominently with direct links — not buried in a table
- Tone follows writing-style-rules.md: clear, concise, casual (not stiff), detailed,
  specific, warm, respectful of reader intelligence
- Include an FAQ section for deeper context (spec-driven development philosophy, “built
  with tbd” examples, Beads comparison)
- Keep the README scannable: short paragraphs, clear headers, bullet points

## Non-Goals

- Rewriting the guidelines themselves
- Changing CLI commands or features
- Adding new shortcuts or templates
- Making the tone artificially formal

## Background

### Problem

The current README accurately describes tbd’s features but undersells the value.
Key issues from a fresh-reader perspective:

1. **Buried lede**: The opening line is generic and doesn’t differentiate tbd.

2. **Guidelines are invisible**: The README lists 15+ deep guideline documents in a
   table near the bottom, but doesn’t link to any of them or explain why they matter.

3. **Missing “aha moment”**: The README doesn’t make it obvious that tbd gives your AI
   agent instant access to expert-level knowledge about TypeScript monorepos, Convex
   patterns, Python best practices, TDD, golden testing, backward compatibility, etc.
   — all via a single `npm install`.

4. **Beads undersold**: Task management via beads is unreasonably effective — it’s a
   genuine step change in how much structured work an agent can do.
   The README should convey this more forcefully.

5. **Spec-driven development not explained**: The value of planning before coding, and
   how specs + beads work together, deserves more than a brief section.
   Much of the original “Why?”
   content about this was valuable and should be preserved, perhaps in an FAQ.

6. **New features not yet highlighted**: `--add` flag, `--specs` flag, and new guideline
   docs strengthen the story but aren’t woven into the narrative.

### What was over-corrected in initial revision

- The opening was too centered on “context injection” at the expense of task management
- Some informal language was removed that was actually fine — the goal is casual
  clarity, not formality
- Valuable discussion about spec-driven development was cut entirely rather than moved

## Design

### Approach

#### 1. Rebalance the opening

The tagline and opening should communicate all three pillars, not just knowledge
injection. The opening should make clear that beads are a proven, unreasonably effective
approach to task management, and that tbd adds spec-driven planning and curated
engineering knowledge on top.

#### 2. Keep the “Built-in Engineering Knowledge” section

This section with direct links to guidelines is genuinely useful.
Keep it.

#### 3. Restore warmth and informality where appropriate

Follow writing-style-rules.md: clear, concise, casual, warm.
Don’t strip out personality just to sound professional.
Remove language that’s vague or hand-wavy, but keep language that’s direct and
conversational.

#### 4. Add FAQ section

Move deeper context to a FAQ at the bottom:
- Why spec-driven development?
  (Restore the cut discussion about how specs + beads work together, with link to
  lessons in spec coding)
- Was tbd built with tbd?
  (Yes — show real beads and specs from this project)
- How does tbd compare to Beads?
  (Keep the Beads comparison here, gracious and warm)
- Can I add my own guidelines?
  (--add flag)

#### 5. Highlight extensibility

The `--add` flag and `.tbd/config.yml` customization should be visible — you’re not
locked into the bundled docs.

### Components

Only the README.md file needs changes.
No code changes.

## Implementation Plan

### Phase 1: README restructure (in progress)

- [x] Add prominent “Built-in Engineering Knowledge” section with direct links
- [x] Add direct links to guideline source files in the guidelines table
- [x] Fix broken links to design doc and CLI reference
- [ ] Rewrite opening to balance all three pillars (beads + specs + knowledge)
- [ ] Restore casual/warm tone where it was over-formalized
- [ ] Add FAQ section (spec-driven dev, built with tbd, Beads comparison, --add)
- [ ] Review flow end-to-end as a cold reader

### Phase 2: Cross-linked docs (stretch)

- [ ] Check that docs linked from README are also clear for new readers
- [ ] Consider adding a “See these guidelines in action” example

## Testing Strategy

- Read the revised README as a fresh HN reader: can you understand the value in 30
  seconds?
- Verify all links work
- Ensure the tone matches writing-style-rules.md: casual, clear, warm, specific

## Open Questions

- Is there a good screenshot or terminal output that could be included for visual
  appeal?

## References

- Current README: README.md
- Writing style rules: docs/project/agent-rules/writing-style-rules.md
- Guidelines source: packages/tbd/docs/guidelines/
- Shortcuts source: packages/tbd/docs/shortcuts/
- Templates source: packages/tbd/docs/templates/
