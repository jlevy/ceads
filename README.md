# tbd

**Task management, spec-driven planning, and instant knowledge injection for AI coding
agents.**

**tbd** (short for “To Be Done,” or “TypeScript beads” if you prefer) combines three
things that are each powerful on their own but unreasonably effective together:

1. **Task tracking (beads)** — git-native issues, bugs, epics, and dependencies that
   persist across sessions.
   This alone is a step change in what agents can do.
   Git-native issue tracking is
   [unreasonably effective](https://github.com/steveyegge/beads) at scaling an agent’s
   capacity from ~5-10 ad-hoc tasks to hundreds of structured issues.
2. **Spec-driven planning** — workflows for writing specs, breaking them into issues,
   and implementing systematically.
   With a good spec and beads, you can leave an agent running overnight and come back to
   solid code.
3. **Instant knowledge injection** — 17+ detailed guideline docs covering TypeScript,
   Python, Convex, monorepo architecture, TDD, golden testing, backward compatibility,
   and more — injected into the agent’s context on demand.

Works in Claude Code, Cursor, Codex, or any agent environment with a shell.

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

## How to Use tbd

You talk to your agent in natural language.
The agent translates your requests into tbd commands behind the scenes — you don’t need
to memorize anything.

| What you say | What happens |
| --- | --- |
| "There's a bug where ..." | Agent creates and tracks a bug |
| "Let's work on current issues" | Agent finds ready issues and starts working |
| "Let's plan a new feature" | Agent creates a spec from a template |
| "Break this spec into issues" | Agent creates implementation issues from the spec |
| "Implement these issues" | Agent works through issues systematically |
| "Build a TypeScript CLI" | Agent loads TypeScript CLI guidelines |
| "Improve the monorepo setup" | Agent loads monorepo patterns |
| "Add better e2e testing" | Agent loads golden testing guidelines |
| "Review these changes" | Agent loads language-specific review guidelines |
| "Commit this" | Agent runs pre-commit checks and commits |
| "Create a PR" | Agent creates or updates the pull request |
| "Research this topic" | Agent creates a research document |

Under the hood, your agent is running `tbd create`, `tbd ready`, `tbd shortcut`,
`tbd guidelines`, and other commands.
But you just talk naturally.

## Why?

AI agents can generate a lot of code, but without structure and knowledge, the results
are hit-or-miss. Agents forget conventions between sessions, skip testing, and don’t
follow your team’s patterns.
The usual fix — pasting rules into prompts or CLAUDE.md files — is fragile and doesn’t
scale across projects.

Beads (git-native issue tracking) solve the task management problem brilliantly.
But task tracking alone doesn’t help with *planning* or *quality*. You still need a way
to think through what you’re building before you start, and a way to make sure the agent
follows good engineering practices while it works.

tbd combines all three: beads for task management, spec-driven workflows for planning,
and curated engineering guidelines for quality.
Together, they let you hand an agent a well-defined spec with clear issues and expert
knowledge, and get back careful, well-structured code — even overnight, even across
sessions.

All workflows and guidelines are included by default, but you’re not locked in.
Add your own via `--add` or configure what’s available in `.tbd/config.yml`.

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

You can also add your own team’s guidelines from any URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
```

## Features

- **Git-native:** Issues live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean — no issue churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per issue, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** Largely compatible with `bd` at the CLI level, but with a
  simpler architecture: no JSONL merge conflicts, no daemon modifying your working tree,
  no SQLite file locking on network filesystems (see
  [FAQ: How does tbd compare to Beads?](#how-does-tbd-compare-to-beads)).
- **Shortcuts:** Over a dozen reusable workflow documents — plan specs, code reviews,
  commit processes, PR creation, research briefs, and more.
- **Guidelines:** [17+ guideline docs](packages/tbd/docs/guidelines/) of coding rules
  and best practices (see
  [Built-in Engineering Knowledge](#built-in-engineering-knowledge)).
- **Templates:** Document templates for planning specs, research briefs, architecture
  docs.

> [!NOTE]
> See the [design doc](packages/tbd/docs/tbd-design.md) (`tbd design`) or
> [reference docs](packages/tbd/docs/tbd-docs.md) (`tbd docs`) for more details.

## Installation and Setup

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
npm install -g get-tbd@latest
```

### Setup

```bash
# Fresh project (--prefix is REQUIRED — it appears in every issue ID, e.g. myapp-a1b2)
tbd setup --auto --prefix=myapp

# Joining an existing tbd project (no prefix needed — reads existing config)
tbd setup --auto

# Migrate from Beads (uses your existing beads prefix)
tbd setup --from-beads
```

> **Tip:** Run `tbd setup --auto` anytime to refresh skill files, hooks, and configs
> with the latest shortcuts, guidelines, and templates.

### Team Setup

tbd is designed for teams where one person sets up the project and others join later.

**First contributor:**
```bash
npm install -g tbd-git@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining contributors:**
```bash
git clone <repo>
npm install -g tbd-git@latest
tbd setup --auto                    # No --prefix needed — reads existing config
```

### Claude Code Integration

`tbd setup --auto` configures SessionStart hooks that run at the beginning of each
Claude Code session:

- **`tbd prime`** — injects workflow context so the agent knows how to use tbd
- **`ensure-gh-cli.sh`** — installs the GitHub CLI (`gh`) if not already available

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

### Migrating from Beads

```bash
tbd setup --from-beads       # Auto-detects and migrates
tbd stats                    # Verify
tbd list --all
tbd setup beads --disable    # Optionally disable beads after migration
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in tbd.

## Commands

### Issues

```bash
tbd ready                      # Issues ready to work on (open, unblocked, unassigned)
tbd list                       # List open issues
tbd list --all                 # Include closed
tbd list --specs               # Group issues by spec
tbd show proj-a7k2             # View issue details
tbd create "Title" --type=bug  # Create issue (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close issue
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync                       # Sync with remote (auto-commits and pushes)
```

### Dependencies and Labels

```bash
tbd dep add proj-b3m9 proj-a7k2        # b3m9 depends on a7k2
tbd blocked                            # Show blocked issues
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                         # All labels in use
tbd search "authentication"            # Search issues
```

### Shortcuts, Guidelines, and Templates

tbd bundles three types of documentation your agent can invoke on demand:

```bash
# Shortcuts — workflow instructions
tbd shortcut --list              # List all shortcuts
tbd shortcut new-plan-spec       # Get the plan spec workflow

# Guidelines — coding rules and best practices
tbd guidelines --list            # List all guidelines
tbd guidelines typescript-rules  # Get TypeScript rules

# Templates — document scaffolds
tbd template --list              # List all templates
tbd template plan-spec           # Get a plan spec template

# Add your own from any URL
tbd guidelines --add=<url> --name=<name>
tbd shortcut --add=<url> --name=<name>
tbd template --add=<url> --name=<name>
```

**Available shortcuts:**

| Shortcut | Purpose |
| --- | --- |
| `new-plan-spec` | Create a feature planning spec |
| `new-research-brief` | Create a research document |
| `new-architecture-doc` | Create an architecture document |
| `new-validation-plan` | Create a test/validation plan |
| `new-implementation-beads-from-spec` | Break a spec into implementation issues |
| `implement-beads` | Implement issues from a spec |
| `precommit-process` | Pre-commit review and testing |
| `commit-code` | Commit with pre-commit checks |
| `review-code-typescript` | Code review for TypeScript |
| `review-code-python` | Code review for Python |
| `create-or-update-pr-simple` | Basic PR creation |
| `create-or-update-pr-with-validation-plan` | PR with a validation plan |

**Available guidelines** (see
[Built-in Engineering Knowledge](#built-in-engineering-knowledge) for details):

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

**Available templates:**

| Template | Description |
| --- | --- |
| `plan-spec` | Feature planning specification |
| `research-brief` | Research document |
| `architecture` | Architecture document |

### Spec-Driven Development

For non-trivial features, tbd supports a full spec-driven workflow:

1. **Plan**: Create a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: Convert spec into implementation issues
   (`tbd shortcut new-implementation-beads-from-spec`)
3. **Implement**: Work through issues systematically (`tbd shortcut implement-beads`)
4. **Validate**: Create validation plan, run tests (`tbd shortcut new-validation-plan`)
5. **Ship**: Commit, create PR (`tbd shortcut create-or-update-pr-with-validation-plan`)

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Issue statistics
tbd doctor                   # Check for problems
tbd doctor --fix             # Auto-fix issues
```

### Agent-Friendly Flags

Every command supports these flags for automation:

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--non-interactive` | Fail if input required |
| `--yes` | Auto-confirm prompts |
| `--dry-run` | Preview changes |
| `--quiet` | Minimal output |

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

tbd keeps two things separate from your code:

- **Issues** live on a dedicated `tbd-sync` branch.
  One Markdown file per issue means parallel creation never conflicts.
  `tbd sync` pushes changes — no manual git operations needed.
- **Documents** (shortcuts, guidelines, templates) are cached locally in `.tbd/docs/`
  during `tbd setup --auto`. Your agent reads them on demand via `tbd shortcut`,
  `tbd guidelines`, and `tbd template`. Re-run `tbd setup --auto` anytime to refresh
  with the latest bundled docs, or add your own via `--add`.
- **Everything is self-documented via the CLI.** Running `tbd` with no arguments gives
  full orientation. `tbd setup --auto` writes a skill file (SKILL.md/AGENTS.md) that
  teaches the agent all available commands, shortcuts, and guidelines.
  This means agents can inject context — specs, engineering guidelines, workflow
  instructions — at any point in a session, not just at startup.

See the [design doc](packages/tbd/docs/tbd-design.md) for details.

## FAQ

### Why spec-driven development?

After months of heavy agentic coding, I’ve found that the single biggest lever for
quality is planning before you code.
A
[carefully written spec](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md)
lets you think through what you’re building, catch design issues early, and break the
work into well-defined issues.
The agent then implements each issue with clear context about the bigger picture.

This matters because with a good spec broken into beads, you can leave an agent running
overnight and come back to code that’s well-structured and coherent — not a pile of
disconnected changes.
tbd bakes in shortcuts for the full cycle: writing specs, breaking them into
implementation issues, implementing, validating, and shipping.

### Was tbd built with tbd?

Yes! tbd has been developed using its own issue tracking, specs, and guidelines from
early on. Here’s what that looks like in practice:

**Specs** — tbd has 10+ active and completed plan specs, including:
- `plan-2026-01-15-tbd-v1-implementation.md` — The original v1 design
- `plan-2026-01-20-streamlined-init-setup-design.md` — Redesigning the setup flow
- `plan-2026-01-26-configurable-doc-cache-sync.md` — Making the doc system configurable
- `plan-2026-01-28-cli-add-docs-by-url.md` — Adding `--add` for external docs

**Beads** — Features are broken into issues, worked through systematically, and closed
with reasons. For example, improving this README was tracked as an epic with 7 child
tasks:

```
tbd-cjwa  P1  ✓ closed  [epic] Improve README value proposition for cold readers
tbd-q72d  P1  ✓ closed  [task] Sharpen README opening
tbd-lugb  P1  ✓ closed  [task] Add 'Built-in Engineering Knowledge' section with direct links
tbd-ezyn  P1  ✓ closed  [task] Highlight extensibility: --add flag for custom knowledge injection
tbd-7san  P2  ✓ closed  [task] Restructure 'Why?' section into clear value proposition
tbd-ntp3  P2  ✓ closed  [task] Add direct clickable links to all guideline source files
tbd-4tt2  P2  ✓ closed  [task] Clean up informal language throughout README
```

### How does tbd compare to Beads?

tbd was inspired by [Beads](https://github.com/steveyegge/beads) by Steve Yegge, and I’m
grateful for the idea — it genuinely changed how I work with agents.
If you’re not familiar with Beads, the core insight is that git-native issue tracking
raises an agent’s capacity for structured work from ~5-10 to-do items to hundreds of
issues.

tbd builds on that foundation with a simpler architecture: plain Markdown files instead
of JSONL, no daemon, no SQLite, no 4-way sync.
This avoids the edge cases I ran into with network filesystems (Claude Code Cloud),
merge conflicts, and multi-agent workflows.

tbd also adds spec-driven planning and curated engineering guidelines — things Beads
doesn’t attempt. If you already use Beads, `tbd setup --from-beads` migrates your issues
with IDs preserved.

### Can I add my own guidelines?

Yes.
tbd comes with 17+ bundled guidelines, but you can add your own team’s docs from any
URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
tbd shortcut --add=<url> --name=my-team-workflow
tbd template --add=<url> --name=my-team-template
```

You can also configure which docs are available in `.tbd/config.yml`. You’re not locked
into the bundled set.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
