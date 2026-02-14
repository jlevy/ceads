---
title: New Shortcut
description: Create a new shortcut (reusable instruction template) for tbd
category: meta
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Create a new shortcut for `tbd shortcut <name>`.

## Locations

- **Official** (bundled with tbd): `packages/tbd/docs/tbd/shortcuts/<name>.md`
- **Project-level** (custom): `.tbd/docs/tbd/shortcuts/<name>.md`

## Format

```markdown
---
title: [Title]
description: [One line for --list output]
category: [category]
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
[Concise instructions. Focus on what's specific to this task.
Skip obvious steps the agent would figure out.
Reference other shortcuts/guidelines/templates as needed.]
```

## Categories

Use one of these standard categories in the frontmatter:

| Category | Use For |
| --- | --- |
| `planning` | Spec creation, implementation planning, validation plans |
| `documentation` | Research briefs, architecture docs, doc revisions |
| `review` | Code review, PR review |
| `git` | Commits, PRs, merging, pre-commit workflows |
| `cleanup` | Code cleanup, dead code removal, test cleanup |
| `session` | Session management, handoffs, setup, recovery |
| `meta` | Creating new shortcuts/guidelines |
| `research` | Research tasks, third-party code checkout |

## Naming

Use kebab-case: `new-<thing>`, `<verb>-<noun>`, `<thing>-<variant>`

Examples: `code-review-and-commit`, `new-plan-spec`, `review-code-typescript`

## Key Principles

- **Be concise**: Skip boilerplate the agent already knows
- **Be specific**: Include non-obvious details, file paths, patterns to follow
- **Reference, don’t duplicate**: Point to `tbd shortcut/guidelines/template` commands
- **Trust the agent**: They’ll adapt to context

## Testing

```bash
tbd shortcut <name>      # Verify output
tbd shortcut --list      # Verify listing
```

For official shortcuts: `pnpm build` in packages/tbd/

## Documentation Updates (Official Shortcuts)

For official shortcuts added to `packages/tbd/docs/tbd/shortcuts/`:

1. **Update root README.md** — Add to the “Available shortcuts” table (grouped by
   category: Planning, Documentation, Review, Git, Cleanup, Session, Meta)
2. **Sync docs cache** — Run `tbd setup --auto` to update `.tbd/docs/`
3. **Rebuild** — `pnpm build` in packages/tbd/ (also copies README to package)

## Shortcuts vs Guidelines

- **Shortcuts**: Workflows to follow (process)
- **Guidelines**: Rules to reference (knowledge)

See `tbd shortcut new-guideline` for creating guidelines.
