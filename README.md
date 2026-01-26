# tbd

**Git-native issue tracking for AI agents and humans.**

**tbd** (which stands for “To Be Done” or “TypeScript beads,” depending on your
preference). It is a command-line issue tracker (like `bd`) plus a set of workflows for
improving code quality and doing spec-driven agentic development.

It’s ideal for AI coding agents as well as humans: simple commands, pretty console and
JSON output. It installs via `npm` and works in almost any agent or sandboxed cloud
environment.

## Quick Start

Just tell your agent:

> “npm install -g tbd-git@latest and run tbd for instructions”

That’s it. Running `tbd` with no arguments gives you everything you need:
- **Not installed?** It tells you how to install and set up.
- **Not initialized?** It explains what tbd is and how to initialize.
- **Already set up?** It shows project status, available work, and workflow guidance.

This command bootstraps you through each step, providing context-aware instructions for
whatever comes next.

## Why?

Firstly, tbd was inspired by [Beads](https://github.com/steveyegge/beads) by Steve
Yegge. I love the power of Beads and am grateful for it!
Unfortunately, after using it heavily for about a month, I found architectural issues
and glitches that were too much of a distraction to ignore.
Things like Claude Code Cloud’s network filesystems unable to use SQLite, fighting with
the daemon modifying files in the active working tree, merge conflicts, and a confusing
4-way sync algorithm.

tbd uses a simpler architecture with (I hope) fewer edge cases and bugs.
If you want to try it, you can import issues from Beads, preserving issue IDs.
Internally, everything is Markdown files so you can debug or migrate in the future if
you wish.

But secondly, with tbd it’s now possible to add many more additional workflows:

- Writing planning specs
- Writing implementation plans that map into beads
- Improving code quality via numerous quality rules I’ve curated over the past few
  months (TypeScript, Python, and a few other areas like Convex)
- Reviewing and committing code and filing PRs
- Writing validation plans to help you review

## What tbd Provides

tbd gives you four capabilities that work together.
Everything is **self-documenting** through the CLI—just run `tbd` commands to discover
guidelines, workflows, and best practices.
No need to look elsewhere.

### 1. Issue Tracking

Track tasks, bugs, and features as lightweight “beads” stored in git.
Run `tbd create`, `tbd ready`, `tbd close` to manage work.

### 2. Coding Guidelines

A library of best practices for TypeScript, Python, testing, and more.
Run `tbd guidelines <name>` to pull them in when relevant.

### 3. Spec-Driven Workflows

Write planning specs for features, then break them into trackable issues and implement
systematically. Run `tbd shortcut new-plan-spec` to get started.

### 4. Convenience Shortcuts

Pre-built processes for common tasks like committing code, creating PRs, and reviewing
code. Run `tbd shortcut <name>` to get step-by-step instructions.

### Why These Work Together

The real power of tbd emerges when these four capabilities combine:

1. **Write a planning spec** → breaks down into trackable issues
2. **Issues guide implementation** → guidelines ensure quality at each step
3. **Shortcuts standardize processes** → consistent commits, reviews, and PRs
4. **Everything stays in git** → full history, no external dependencies

This creates disciplined, high-quality agent-based development with built-in scaffolding
for specs, issue tracking, code review, and testing—all from a single CLI.

### Quick Reference

| Need | Command | Notes |
| --- | --- | --- |
| "I found a bug" | `tbd create "..." --type=bug` | Creates issue |
| "Let's plan this feature" | `tbd shortcut new-plan-spec` | Outputs planning instructions |
| "What should I work on?" | `tbd ready` | Lists ready issues |
| "Build a TypeScript CLI" | `tbd guidelines typescript-cli-tool-rules` | Outputs best practices |
| "Review the code" | `tbd shortcut review-code-typescript` | Outputs review checklist |
| "Ready to commit" | `tbd shortcut commit-code` | Outputs commit process |

## Features

- **Git-native:** Issues live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean—no issue churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per issue, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** `tbd` is largely compatible with `bd` at the CLI level.
  But has no JSONL merge conflicts in git.
  No daemon modifying your current working tree.
  No agents confused by error messages about which of several “modes” you’re running in.
  No SQLite file locking issues on network filesystems (like what is used by Claude Code
  Cloud).
- **Shortcuts:** Over a dozen reusable instruction documents for common workflows, like
  - `new-plan-spec` — Create a feature planning spec
  - `new-research-brief` — Create a research document
  - `precommit-process` — Pre-commit review and testing
  - `commit-code` — Run checks and commit
  - `create-or-update-pr-with-validation-plan` — Create PR with test plan
- **Guidelines:** [Over 15 rules and best practices (~30 pages)](packages/tbd/docs/guidelines/)
  for TypeScript, Python, testing, TDD, backward compatibility, and more.
- **Templates:** Document templates for planning specs, research briefs, architecture
  docs.

> [!NOTE]
> See the [design doc](docs/tbd-design.md) (`tbd design`) or
> [reference docs](docs/tbd-docs.md) (`tbd docs`) for more details.

> [!NOTE]
> I use *Beads* (capitalized) to refer to the original `bd` tool.
> In the docs and prompts I sometimes use lowercase “beads” as a generic way to refer to
> issues stored in `tbd` or `bd`.

## Installation

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
npm install -g tbd-git@latest
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

This configures a SessionStart hook that runs `tbd prime` at session start, injecting
workflow context so the agent knows how to use tbd effectively.

The agent can also run `tbd` at any time to get full orientation and see project status.

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

**Available Guidelines:**

| Guideline | Description |
| --- | --- |
| `typescript-rules` | TypeScript coding rules |
| `typescript-cli-tool-rules` | CLI tools with Commander.js |
| `typescript-monorepo-patterns` | TypeScript monorepo architecture |
| `python-rules` | Python coding rules |
| `python-cli-patterns` | Python CLI architecture |
| `convex-rules` | Convex database patterns |
| `general-coding-rules` | Constants, magic numbers, practices |
| `general-testing-rules` | General testing principles |
| `general-tdd-guidelines` | TDD methodology |
| `general-comment-rules` | Comment best practices |
| `general-style-rules` | Auto-formatting and output formatting |
| `general-eng-assistant-rules` | AI assistant objectivity and communication |
| `commit-conventions` | Conventional commits format |
| `golden-testing-guidelines` | Golden/snapshot testing |
| `backward-compatibility-rules` | API and schema compatibility |

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
- [CLI Reference](docs/tbd-docs.md) — Complete command documentation
- [Design Doc](docs/tbd-design.md) — Technical architecture

## Team Workflows

tbd is designed for teams where one person sets up the project and others join later.

**First contributor (project setup):**
```bash
npm install -g tbd-git@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining contributors:**
```bash
git clone <repo>                    # .tbd/ directory comes with repo
npm install -g tbd-git@latest       # If not already installed
tbd setup --auto                    # No --prefix needed! Reads existing config
```

The second contributor just runs `tbd setup --auto` — no need to know the project prefix
or any other configuration details.

**Updating tbd:** After upgrading tbd (`npm install -g tbd-git@latest`), run
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
See the [design doc](docs/tbd-design.md) for details.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
