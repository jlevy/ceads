# tbd

**Instant high-quality context injection for AI coding agents.**

**tbd** is a git-native issue tracker that bundles a curated knowledge base of
engineering best practices — TypeScript, Python, Convex, monorepos, TDD, and more — so
your AI agent writes code the way a senior engineer would, from the first line.

One `npm install` gives any AI coding agent three things at once:
1. **Structured issue tracking** — git-native tasks, bugs, epics, and dependencies that
   persist across sessions
2. **A deep engineering knowledge base** — 17+ guideline docs covering TypeScript rules,
   Python conventions, Convex patterns, monorepo architecture, TDD, golden testing,
   backward compatibility, and more
3. **Spec-driven workflows** — shortcuts for planning features, breaking specs into
   issues, reviewing code, committing, and filing PRs

It works in Claude Code, Cursor, Codex, or any agent environment with a shell.
Simple commands, readable console and JSON output.

## Quick Start

> [!TIP]
> 
> *Just tell your agent:*
> 
> ***“npm install -g get-tbd@latest and run tbd for instructions”***

That’s it. Running `tbd` with no arguments gives you everything you need:
- Not installed? It tells you how to install and set up.
- Not initialized? It explains what tbd is and how to initialize.
- Already set up? It shows project status, available work, and workflow guidance.

This command bootstraps you through each step, providing context-aware instructions for
whatever comes next.

## Built-in Engineering Knowledge

When you run `tbd setup`, your agent gets instant access to
[17+ guideline documents](packages/tbd/docs/guidelines/) covering real-world engineering
practices. These aren’t generic tips — they’re detailed, opinionated rules with concrete
examples, built from months of heavy agentic coding.

**Highlights:**

| Guideline | What it covers |
| --- | --- |
| [typescript-rules](packages/tbd/docs/guidelines/typescript-rules.md) | Strict type safety, no `any`, type guards, null safety, async patterns |
| [typescript-monorepo-patterns](packages/tbd/docs/guidelines/typescript-monorepo-patterns.md) | pnpm workspaces, tsdown, Changesets, publint, lefthook, dual ESM/CJS |
| [typescript-cli-tool-rules](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | Commander.js patterns, picocolors, terminal formatting |
| [python-rules](packages/tbd/docs/guidelines/python-rules.md) | Type hints, docstrings, exception handling, resource management |
| [python-cli-patterns](packages/tbd/docs/guidelines/python-cli-patterns.md) | Modern Python CLI stack: uv, Typer, Rich, Ruff, BasedPyright |
| [convex-rules](packages/tbd/docs/guidelines/convex-rules.md) | Convex function syntax, schema design, queries, mutations |
| [convex-limits-best-practices](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Platform limits, workarounds, performance tuning |
| [general-tdd-guidelines](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | Red-Green-Refactor methodology, small slices, test-first discipline |
| [golden-testing-guidelines](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | Snapshot testing for complex systems: session schemas, YAML captures, mock modes |
| [backward-compatibility-rules](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | Compatibility across code, APIs, file formats, and database schemas |

Plus guidelines on
[code coverage](packages/tbd/docs/guidelines/typescript-code-coverage.md),
[testing principles](packages/tbd/docs/guidelines/general-testing-rules.md),
[coding rules](packages/tbd/docs/guidelines/general-coding-rules.md),
[comment quality](packages/tbd/docs/guidelines/general-comment-rules.md),
[commit conventions](packages/tbd/docs/guidelines/commit-conventions.md), and
[style](packages/tbd/docs/guidelines/general-style-rules.md).

Your agent accesses these with a single command:

```bash
tbd guidelines typescript-rules    # Injects TypeScript rules into agent context
tbd guidelines convex-rules        # Injects Convex patterns into agent context
tbd guidelines --list              # See all available guidelines
```

You can also add your own team’s guidelines from any URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
```

## Quick Reference

You describe what you want in natural language; your agent translates it into tbd
commands:

| User Need or Request | tbd Command Agent Can Run | What Happens |
| --- | --- | --- |
| "There is a bug where ..." | `tbd create "..." --type=bug` | Creates issue |
| "Fix current issues" | `tbd ready` | Lists ready issues |
| *(agent choice)* | `tbd dep add <id> <depends-on>` | Adds dependency |
| *(agent choice)* | `tbd close <id>` | Closes issue |
| *(agent choice)* | `tbd sync` | Syncs issues to remote |
| "Build a TypeScript CLI" | `tbd guidelines typescript-cli-tool-rules` | Agent gets guidelines |
| "Improve eslint setup" | `tbd guidelines typescript-monorepo-patterns` | Agent gets guidelines |
| "Add better e2e testing" | `tbd guidelines golden-testing-guidelines` | Agent gets guidelines |
| "Review these changes" (TypeScript) | `tbd guidelines typescript-rules` | Agent gets guidelines |
| "Review these changes" (Python) | `tbd guidelines python-rules` | Agent gets guidelines |
| "Let's plan a new feature" | `tbd shortcut new-plan-spec` | Agent gets spec template and instructions |
| "Break spec into issues" | `tbd shortcut new-implementation-beads-from-spec` | Agent gets instructions |
| "Implement these issues" | `tbd shortcut implement-beads` | Agent gets instructions |
| "Commit this" | `tbd shortcut commit-code` | Agent gets instructions |
| "Create a PR" | `tbd shortcut create-or-update-pr-simple` | Agent gets instructions |
| "Research this topic" | `tbd shortcut new-research-brief` | Agent gets template and instructions |
| "Document this architecture" | `tbd shortcut new-architecture-doc` | Agent gets template and instructions |

## Why?

AI agents can generate a lot of code, but without structure and knowledge, the quality
is inconsistent. Agents forget conventions between sessions, skip testing, and don’t
follow your team’s patterns.
The usual fix — copying rules into prompts or CLAUDE.md files — is fragile and doesn’t
scale across projects.

tbd solves this by combining three things that work together:

1. **Task tracking** — Issues persist across sessions, so agents pick up where they left
   off. Dependencies, priorities, and epics keep complex work organized.
2. **Planning** — Spec-driven workflows help you think through features before coding.
   With a good spec broken into issues, you can leave an agent running overnight and
   come back to solid code.
   See
   [lessons in spec coding](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md)
   for more on this approach.
3. **Knowledge** — Curated engineering guidelines are injected directly into the agent’s
   context on demand. Your agent doesn’t guess at TypeScript patterns or Convex
   conventions — it follows documented, battle-tested rules.

The result: agents that do careful, planned, high-quality work on hundreds of issues,
not just 5-10 ad-hoc tasks.

All workflows and guidelines are included by default, but you’re not locked in.
You can add your own via `--add` or configure what’s available in `.tbd/config.yml`.

### Background: Beads

tbd was inspired by [Beads](https://github.com/steveyegge/beads) by Steve Yegge, which
demonstrated that git-native issue tracking dramatically improves an agent’s capacity
for structured work.
tbd builds on that idea with a simpler architecture — plain Markdown files instead of
JSONL, no daemon, no SQLite — to avoid the edge cases that arise with network
filesystems (like Claude Code Cloud) and multi-agent workflows.

If you already use Beads, `tbd setup --from-beads` migrates your issues with IDs
preserved.

## Features

- **Git-native:** Issues live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean—no issue churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per issue, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** Largely compatible with `bd` at the CLI level, but with a
  simpler architecture: no JSONL merge conflicts, no daemon modifying your working tree,
  no SQLite file locking on network filesystems.
- **Shortcuts:** Over a dozen reusable instruction documents for common workflows, like
  - `new-plan-spec` — Create a feature planning spec
  - `new-research-brief` — Create a research document
  - `precommit-process` — Pre-commit review and testing
  - `commit-code` — Run checks and commit
  - `create-or-update-pr-with-validation-plan` — Create PR with test plan
- **Guidelines:** [17+ guideline docs](packages/tbd/docs/guidelines/) of coding rules
  and best practices for TypeScript, Python, Convex, testing, TDD, backward
  compatibility, and more (see
  [Built-in Engineering Knowledge](#built-in-engineering-knowledge)).
- **Templates:** Document templates for planning specs, research briefs, architecture
  docs.

> [!NOTE]
> See the [design doc](packages/tbd/docs/tbd-design.md) (`tbd design`) or
> [reference docs](packages/tbd/docs/tbd-docs.md) (`tbd docs`) for more details.

## Installation

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
npm install -g get-tbd@latest
```

### Setup Options

```bash
# Fresh project (--prefix is REQUIRED)
tbd setup --auto --prefix=myapp

# Joining existing tbd project (no prefix needed)
tbd setup --auto

# Refresh configs and skill files (re-run anytime to update)
tbd setup --auto

# Migrate from Beads
tbd setup --from-beads

# Advanced: surgical init only
tbd init --prefix=proj
```

> **Tip:** Run `tbd setup --auto` anytime to refresh skill files, hooks, and configs.
> This updates your local installation with the latest shortcuts, guidelines, and
> templates lists.

### Basic Usage

```bash
# Create issues
tbd create "API returns 500 on malformed input" --type=bug --priority=P1
tbd create "Add rate limiting to /api/upload" --type=feature
tbd list --pretty  # View issues

# Find and claim work
tbd ready                                    # What's available?
tbd update proj-a7k2 --status=in_progress    # Claim it

# Complete and sync
tbd closing  # Get a reminder of the closing protocol (this is also in the skill docs)
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

## Commands

### Core Workflow

```bash
tbd ready                      # Issues ready to work on (open, unblocked, unassigned)
tbd list                       # List open issues
tbd list --all                 # Include closed
tbd show proj-a7k2             # View issue details
tbd create "Title" --type=bug  # Create issue (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close issue
tbd sync                       # Sync with remote (auto-commits and pushes issues)
```

### Dependencies

```bash
tbd dep add proj-b3m9 proj-a7k2  # b3m9 is blocked by a7k2
tbd blocked                      # Show blocked issues
```

### Labels

```bash
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                   # All labels in use
```

### Search

```bash
tbd search "authentication"
tbd search "TODO" --status=open
```

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Issue statistics
tbd doctor                   # Check for problems
tbd doctor --fix             # Auto-fix issues
```

## Spec-Driven Development

For non-trivial features, tbd supports a spec-driven workflow:

1. **Plan**: Create a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: Convert spec into implementation issues
   (`tbd shortcut new-implementation-beads-from-spec`)
3. **Implement**: Work through issues systematically (`tbd shortcut implement-beads`)
4. **Validate**: Create validation plan, run tests (`tbd shortcut new-validation-plan`)
5. **Ship**: Commit, create PR (`tbd shortcut create-or-update-pr-with-validation-plan`)

This methodology helps structure complex work before diving into code, creating clear
documentation of what was built and why.

## For AI Agents

tbd is designed for AI coding agents.
The key philosophy: **agents should use tbd proactively to help users**, not just tell
users about commands.

### Getting Oriented

Just run `tbd` — it provides complete orientation including:
- Installation and project status
- Workflow rules and session protocol
- All available commands with examples
- Directory of shortcuts and guidelines

For abbreviated output in constrained contexts: `tbd prime --brief`

### Agent Workflow Loop

```bash
tbd ready --json                          # Find work
tbd update proj-xxxx --status=in_progress # Claim (advisory)
# ... do the work ...
tbd close proj-xxxx --reason="Done"       # Complete
tbd sync                                  # Push
```

### Agent-Friendly Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--non-interactive` | Fail if input required |
| `--yes` | Auto-confirm prompts |
| `--dry-run` | Preview changes |
| `--quiet` | Minimal output |

### Claude Code Integration

```bash
tbd setup --auto --prefix=myapp   # Fresh project: full setup including Claude hooks
tbd setup --auto                  # Existing project or refresh: configure/update hooks
```

This configures SessionStart hooks that run at the beginning of each agent session:

- **`tbd prime`** — Injects workflow context so the agent knows how to use tbd
- **`ensure-gh-cli.sh`** — Installs the GitHub CLI (`gh`) if not already available,
  enabling PR creation, issue management, and GitHub API access from agent sessions

The agent can also run `tbd` at any time to get full orientation and see project status.

**GitHub authentication:** For `gh` to work, set these environment variables before
starting your agent session:

```
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GH_PROMPT_DISABLED=1
```

Create a [Personal Access Token](https://github.com/settings/tokens?type=beta)
(fine-grained recommended) with **Contents** and **Pull requests** read/write
permissions. For Claude Code Cloud, set these in your project’s environment variables.
For local CLI usage, add them to your shell profile (`~/.zshrc` or `~/.bashrc`). See
[GitHub CLI setup docs](docs/general/agent-setup/github-cli-setup.md) for details.

To disable automatic `gh` installation, pass `--no-gh-cli` during setup or set
`use_gh_cli: false` in `.tbd/config.yml` under `settings:`.

**Updating:** Run `tbd setup --auto` anytime to refresh skill files with the latest
shortcuts, guidelines, and templates.

### Shortcuts, Guidelines, and Templates

tbd includes three types of documentation agents can invoke:

- **Shortcuts** — Reusable instruction documents for common workflows
- **Guidelines** — Coding rules and best practices
- **Templates** — Document templates for specs, research, architecture

```bash
# Shortcuts
tbd shortcut --list              # List all shortcuts
tbd shortcut new-plan-spec       # Run a shortcut by name

# Guidelines
tbd guidelines --list            # List all guidelines
tbd guidelines typescript-rules  # Get TypeScript rules

# Templates
tbd template --list             # List all templates
tbd template plan-spec > docs/project/specs/plan-2025-01-15-feature.md

# Add external docs by URL
tbd guidelines --add=<url> --name=<name>
tbd shortcut --add=<url> --name=<name>
tbd template --add=<url> --name=<name>
```

**Available Shortcuts:**

| Shortcut | Purpose |
| --- | --- |
| `new-plan-spec` | Create feature planning spec |
| `new-research-brief` | Create research document |
| `new-architecture-doc` | Create architecture document |
| `new-validation-plan` | Create test/validation plan |
| `new-implementation-beads-from-spec` | Break spec into issues |
| `implement-beads` | Implement issues from specs |
| `precommit-process` | Pre-commit review and testing |
| `commit-code` | Commit with pre-commit checks |
| `review-code-typescript` | Code review for TypeScript |
| `review-code-python` | Code review for Python |
| `create-or-update-pr-simple` | Basic PR creation |
| `create-or-update-pr-with-validation-plan` | PR with validation plan |

**Available Guidelines** (see
[Built-in Engineering Knowledge](#built-in-engineering-knowledge) above for details):

| Guideline | Description |
| --- | --- |
| [`typescript-rules`](packages/tbd/docs/guidelines/typescript-rules.md) | TypeScript coding rules |
| [`typescript-cli-tool-rules`](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | CLI tools with Commander.js |
| [`typescript-monorepo-patterns`](packages/tbd/docs/guidelines/typescript-monorepo-patterns.md) | TypeScript monorepo architecture |
| [`typescript-code-coverage`](packages/tbd/docs/guidelines/typescript-code-coverage.md) | Code coverage with Vitest and v8 |
| [`python-rules`](packages/tbd/docs/guidelines/python-rules.md) | Python coding rules |
| [`python-cli-patterns`](packages/tbd/docs/guidelines/python-cli-patterns.md) | Python CLI architecture |
| [`convex-rules`](packages/tbd/docs/guidelines/convex-rules.md) | Convex database patterns |
| [`convex-limits-best-practices`](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Convex platform limits and workarounds |
| [`general-coding-rules`](packages/tbd/docs/guidelines/general-coding-rules.md) | Constants, magic numbers, practices |
| [`general-testing-rules`](packages/tbd/docs/guidelines/general-testing-rules.md) | General testing principles |
| [`general-tdd-guidelines`](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | TDD methodology |
| [`general-comment-rules`](packages/tbd/docs/guidelines/general-comment-rules.md) | Comment best practices |
| [`general-style-rules`](packages/tbd/docs/guidelines/general-style-rules.md) | Auto-formatting and output formatting |
| [`general-eng-assistant-rules`](packages/tbd/docs/guidelines/general-eng-assistant-rules.md) | AI assistant objectivity and communication |
| [`commit-conventions`](packages/tbd/docs/guidelines/commit-conventions.md) | Conventional commits format |
| [`golden-testing-guidelines`](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | Golden/snapshot testing |
| [`backward-compatibility-rules`](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | API and schema compatibility |

**Available Templates:**

| Template | Description |
| --- | --- |
| `plan-spec` | Feature planning specification |
| `research-brief` | Research document |
| `architecture` | Architecture document |

## Documentation

```bash
tbd                          # Full orientation and workflow guidance
tbd readme                   # This file
tbd docs                     # Full CLI reference
```

Or read online:
- [CLI Reference](packages/tbd/docs/tbd-docs.md) — Complete command documentation
- [Design Doc](packages/tbd/docs/tbd-design.md) — Technical architecture

## Team Workflows

tbd is designed for teams where one person sets up the project and others join later.

**First contributor (project setup):**
```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining contributors:**
```bash
git clone <repo>                    # .tbd/ directory comes with repo
npm install -g get-tbd@latest       # If not already installed
tbd setup --auto                    # No --prefix needed! Reads existing config
```

The second contributor just runs `tbd setup --auto` — no need to know the project prefix
or any other configuration details.

**Updating tbd:** After upgrading tbd (`npm install -g get-tbd@latest`), run
`tbd setup --auto` to refresh local skill files with the latest shortcuts, guidelines,
and templates.

## Migration from Beads

```bash
# Auto-detects beads and migrates (uses existing beads prefix)
tbd setup --from-beads

# Verify
tbd stats
tbd list --all

# If you wish to disable beads after migration
tbd setup beads --disable
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in tbd.
The prefix from your beads configuration is automatically used.

## How It Works

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code.
One file per issue means parallel creation never conflicts.
Run `tbd sync` to push changes—no manual git operations needed for issues.
See the [design doc](packages/tbd/docs/tbd-design.md) for details.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
