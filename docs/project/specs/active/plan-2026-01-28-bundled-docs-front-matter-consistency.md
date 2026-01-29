# Feature: Bundled Docs Front Matter Consistency

**Date:** 2026-01-28 **Author:** Joshua Levy **Status:** Draft

## Overview

Audit and standardize front matter across all bundled documentation files (guidelines,
shortcuts, templates) to ensure consistency and add author credits.

## Goals

- Consistent front matter format across all bundled docs
- Add author/credits field to recognize contributors
- Clear documentation of front matter requirements for new docs

## Non-Goals

- Changing the content of the docs themselves
- Restructuring the doc organization
- Adding complex metadata (versioning, dates, tags)

## Background

The tbd CLI bundles documentation files that agents can query: guidelines, shortcuts,
and templates. These docs use YAML front matter for metadata that powers `--list`
commands and searchability.
However, the front matter usage is inconsistent across different doc types.

## Current State Analysis

### Files WITH Standard Front Matter (`title` + `description`)

| Category | Count | Status |
| --- | --- | --- |
| Guidelines | 18 | All have front matter |
| Standard Shortcuts | 14 | All have front matter |
| Templates | 3 | All have front matter |
| System Shortcuts | 1 of 3 | Only shortcut-explanation.md |

**Total with front matter:** 36 of 43 bundled docs

### Files WITHOUT Standard Front Matter

**System Shortcuts (2 files):**
- `shortcuts/system/skill-brief.md` - No front matter
- `shortcuts/system/skill.md` - No front matter

**Core Docs (4 files):**
- `tbd-closing.md` - No front matter
- `tbd-design.md` - No front matter (but has inline metadata)
- `tbd-docs.md` - No front matter
- `tbd-prime.md` - No front matter

**Special Format (1 file):**
- `install/claude-header.md` - Different format (MCP skill header with `name`,
  `description`, `allowed-tools`)

### Current Front Matter Fields

```yaml
---
title: Human-readable title
description: One-line description for --list output
---
```

### Missing Fields

- **author** - No docs currently have author attribution in front matter
- **credits** - No mechanism for acknowledging contributors

## Design

### Proposed Standard Front Matter

For guidelines, shortcuts, and templates:

```yaml
---
title: Human-readable title
description: One-line description for --list output
author: Primary author name(s)
credits: Additional contributors or AI assistance acknowledgment (optional)
---
```

### Field Definitions

| Field | Required | Purpose |
| --- | --- | --- |
| `title` | Yes | Display name in lists and headers |
| `description` | Yes | Brief description for `--list` output |
| `author` | Yes | Primary author(s) - individual names or "tbd team" |
| `credits` | No | Additional contributors, AI acknowledgment |

### Author Attribution Guidelines

- **Original human author**: Use name (e.g., “Joshua Levy”)
- **Team/collaborative**: Use “tbd team” or list contributors
- **AI-assisted**: Include acknowledgment (e.g., “Joshua Levy with Claude”)
- **Unknown/general**: Use “tbd contributors”

### Files to Update

**Add standard front matter (6 files):**
1. `shortcuts/system/skill-brief.md`
2. `shortcuts/system/skill.md`
3. `tbd-closing.md`
4. `tbd-design.md`
5. `tbd-docs.md`
6. `tbd-prime.md`

**Add author field to existing front matter (36 files):**
- All 18 guidelines
- All 14 standard shortcuts
- All 3 templates
- `shortcuts/system/shortcut-explanation.md`

**Leave as-is (1 file):**
- `install/claude-header.md` - Uses MCP skill header format (different purpose)

### Decisions Made

1. **Default author value**: `Joshua Levy (github.com/jlevy) with LLM assistance`

2. **Exception for Convex rules**: `Convex team` for convex-rules.md only

3. **Core docs and system shortcuts**: Leave as-is (no front matter changes)

## Implementation Plan

### Phase 1: Add Author Field to Guidelines, Shortcuts, Templates

- [ ] Update 17 guidelines with author:
  `Joshua Levy (github.com/jlevy) with LLM assistance`
- [ ] Update convex-rules.md with author: `Convex team`
- [ ] Update all 14 standard shortcuts with author field
- [ ] Update all 3 templates with author field

### Phase 2: Documentation

- [ ] Update `new-guideline` shortcut to include author field in template

## Testing Strategy

- Verify `tbd guidelines --list` still works correctly
- Verify `tbd shortcut --list` still works correctly
- Verify `tbd template --list` still works correctly
- Spot check that front matter is valid YAML

## References

- Existing front matter in [guidelines/](../../packages/tbd/docs/guidelines/)
- YAML front matter spec: https://jekyllrb.com/docs/front-matter/
