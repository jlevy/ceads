---
title: New Guideline
description: Create a new coding guideline document for tbd
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Shortcut: New Guideline

Create a new guideline for `tbd guidelines <name>`.

## Locations

- **Official** (bundled with tbd): `packages/tbd/docs/guidelines/<name>.md`
- **Project-level** (custom): `.tbd/docs/guidelines/<name>.md`

## Format

````markdown
---
title: [Title]
description: [One line for --list output]
---
# [Title]

[Brief intro: what this covers, when to use it.]

## [Topic]

- **Rule name**: Explanation with rationale.

  ```typescript
  // Example if applicable
````

## Related Guidelines

- See `tbd guidelines [related]` for [topic]
````

## Key Principles

- **Actionable rules**: Specific, not vague principles
- **Code examples**: Show, don't just tell
- **Cross-references**: Link related guidelines for context injection
- **No relative links**: Use full URLs for external refs (they break when installed elsewhere)

## Naming

| Pattern | Example |
| --- | --- |
| `{lang}-rules` | `typescript-rules` |
| `{lang}-{topic}-rules` | `typescript-cli-tool-rules` |
| `{domain}-rules` | `convex-rules` |
| `general-{topic}-rules` | `general-testing-rules` |

## Testing

```bash
tbd guidelines <name>      # Verify output
tbd guidelines --list      # Verify listing
````

For official guidelines: `pnpm build` in packages/tbd/
