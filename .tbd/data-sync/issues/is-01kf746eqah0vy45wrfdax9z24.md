---
close_reason: Moved prime instructions to docs/tbd-prime.md. Updated copy-docs.mjs and prime.ts to load from file. Content shared between tbd prime and skill file.
closed_at: 2026-01-18T01:53:25.765Z
created_at: 2026-01-17T23:21:11.137Z
dependencies:
  - target: is-01kf7c0akmxrs9e3ngvv2zz9ys
    type: blocks
  - target: is-01kf7c6ngnzk3da33fec0j1n55
    type: blocks
id: is-01kf746eqah0vy45wrfdax9z24
kind: task
labels: []
priority: 2
status: closed
title: Move prime instructions to top-level tbd-prime.md doc
type: is
updated_at: 2026-01-18T01:53:25.766Z
version: 5
---
Currently the prime instructions are hardcoded as a string constant (PRIME_OUTPUT) in packages/tbd-cli/src/cli/commands/prime.ts.

## Proposed Changes

1. **Create docs/tbd-prime.md** - Move the prime instructions to a top-level markdown file like other docs in the project

2. **Update prime.ts to read from file** - Instead of embedding the content, read from the markdown file at runtime (or bundle it at build time)

3. **Add color support for interactive terminals** - Detect if running in an interactive terminal and add color/formatting for better readability, while keeping plain text output for agents (non-TTY)

## Benefits
- Easier to edit instructions without modifying TypeScript code
- Consistent with other documentation files in the project
- Better developer experience with colored output in terminals
- Agents still get plain text that works well for their context

## Implementation Notes
- Could use chalk or similar for color support
- Check process.stdout.isTTY to determine if color should be used
- Consider bundling the md file at build time vs reading at runtime
