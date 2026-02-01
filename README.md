# tbd

**Task tracking, spec-driven planning, and knowledge injection for AI coding agents.**

**tbd** (short for “To Be Done,” or “TypeScript beads” if you prefer) combines four
things that are each powerful on their own but work even better together:

1. **Task tracking (beads):** Agent-friendly, CLI-native issue tracking for bugs,
   features, epics, and dependencies that persist across sessions in git.
   This alone is a step change in what agents can do.
   [Beads](https://github.com/steveyegge/beads) are fantastic and *unreasonably
   effective* at scaling an agent’s capacity from ~5-10 ad-hoc tasks to hundreds of
   structured beads.
2. **Spec-driven planning:** Templates and workflows for writing specs, breaking them
   into beads, and implementing systematically.
   With a good spec and beads, you can leave an agent running overnight and come back to
   solid code.
3. **Knowledge injection:** Instant availability of in-depth engineering guidelines and
   rules docs. These are essentially “self-injected context” for an agent to get smarter
   when it needs it.
4. **Shortcuts:** Reusable instructions for common tasks like code review, PR creation,
   and writing planning specs, architecture docs, and research briefs.

`tbd` comes pre-installed with in-depth guidelines docs on many topics, including
TypeScript and Python best practices and common agent pitfalls, red-green TDD, golden
testing, Convex, monorepo project setup, error handling practices, and backward
compatibility rules.
(But you can use your own guidelines if you prefer.)

I use `tbd` most frequently in Claude Code since it’s most powerful as a skill, but it
will work in Cursor, Codex, or any agent environment that can use the `tbd` CLI.

## Quick Start

> [!TIP]
> 
> If running on your own machine, install the `tbd` CLI yourself:
> 
> **`npm install -g get-tbd@latest`**
> 
> Then tell your agent:
> 
> ***“run tbd for instructions to set up this project”***
> 
> If running on a fresh cloud instance (like Claude Code Cloud), tell the agent:
> 
> ***“install tbd (npm install -g get-tbd@latest) and run tbd for instructions to set up
> this project”***

That’s it. Running `tbd` with no arguments “primes” the agent with how to use `tbd` and
how to help you. It will then bootstraps a SKILL.md into your project by running
`tbd setup --auto` (which will add a `.tbd` directory and add itself to your `.claude`
skills and hooks). And then it will use shortcuts to welcome you and get you started.

You can then always ask questions like: “what can I do with tbd?”

## How Should You Use `tbd`?

### Drop-In `bd` Replacement

You can use `tbd` as a drop-in replacement for the original Beads (`bd`). It’s largely
compatible at the CLI level for core issue tracking functionality.

Despite the general power of the beads, there are quite a few
[practical frustrations](#how-does-tbd-compare-to-beads) with the original Beads
implementation—notably the daemon modifying files, merge conflicts, sync confusions
across branches and database, and SQLite not working on network drives, such as Claude
Code Cloud. After using `bd` for over a month, this became my greatest pain point.
I now use `tbd` for all my agent coding and its sync architecture works pretty well.

### Spec-Driven Coding and Review

What excites me now is that `tbd` is more than just task management.

These workflows arose from several months of
[heavy spec-driven agentic coding](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md).
With better use of specs, what you build is far clearer and more maintainable.
In fact, I think of iterating on a spec as the hard part now.
Writing the code is often almost automatic, if a spec is good enough!

Basically 100% of the code I now write is agent-written, planned and tracked through
specs and beads and streamlined with shortcuts.

To help with this, `tbd` provides a way to **inject engineering rules and best
practices** and **streamline reproducible workflows with shortcuts**.

By combining task management, knowledge injection, and shortcuts, I find my agents ship
code with speed, quality, and discipline.

### Shortcuts for Common Tasks (Easy with Voice!)

Once you start doing things like the above workflows, it gets repetitive.
And I like to now use voice to give prompts.
So having “shortcut” docs that list common tasks is really helpful.

I can now ship entire large features just with voice prompts like “use the shortcut to
create a new plan spec that …” and “now use the shortcut to file a PR with a validation
plan.”

### What `tbd` Doesn’t Do (Yet)

`tbd` focuses on the *durable layer* of agent development: issue tracking, planning, and
knowledge that persist in git across sessions.
It does not (yet) try to solve real-time multi-agent coordination features of Beads or
[Gas Town](https://github.com/steveyegge/gastown) or
[Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) or unstructured agent
loops like
[Ralph Wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum).
These seem great for rapid prototyping, but so far, code where quality or scale matters,
I’ve not fully embraced unstructured automation (e.g. 20+ concurrent agents or Ralph
loops).
I find having more process and discipline around specs (and around 6–8 concurrent
agents handling different aspects that I manage) is slower, because it forces you to
design, but it gives higher quality results.

> [!NOTE]
> 
> We use *Beads* (capitalized) to refer to Steve Yegge’s original
> [`bd` tool](https://github.com/steveyegge/beads).
> Lowercase “beads” refers generically to the issues stored in `tbd` or `bd`.

## How to Use `tbd`

You talk to your agent in natural language.
The agent translates your requests into `tbd` commands.

The `tbd` CLI blends task tracking and context injection.
Some `tbd` commands do things, like create or update beads, and some help the agent get
status or context or knowledge and know what to do next:

| What you say | What happens | What runs |
| --- | --- | --- |
| "Let's plan a new feature that …" | Agent creates a spec from a template | [`tbd shortcut new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) |
| "Break this spec into beads" | Agent creates implementation beads from the spec | [`tbd shortcut plan-implementation-with-beads`](packages/tbd/docs/shortcuts/standard/plan-implementation-with-beads.md) |
| "Implement these beads" | Agent works through beads systematically | [`tbd shortcut implement-beads`](packages/tbd/docs/shortcuts/standard/implement-beads.md) |
| "Create a bead for the bug where …" | Agent creates and tracks a bead | `tbd create "..." --type=bug` |
| "Let's work on current beads" | Agent finds ready beads and starts working | `tbd ready` |
| "Review this code" | Agent performs comprehensive code review with all guidelines | [`tbd shortcut review-code`](packages/tbd/docs/shortcuts/standard/review-code.md) |
| "Review this PR" | Agent reviews a GitHub pull request and can comment/fix | [`tbd shortcut review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) |
| "Use the shortcut to commit" | Agent runs full pre-commit checks, code review, and commits | [`tbd shortcut code-review-and-commit`](packages/tbd/docs/shortcuts/standard/code-review-and-commit.md) |
| "Create a PR" | Agent creates or updates the pull request | [`tbd shortcut create-or-update-pr-simple`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md) |
| "Let's create a research brief on …" | Agent creates a research document using a template | [`tbd shortcut new-research-brief`](packages/tbd/docs/shortcuts/standard/new-research-brief.md) |
| "How could we test this better?" | Agent loads TDD and testing guidelines | [`tbd guidelines general-tdd-guidelines`](packages/tbd/docs/guidelines/general-tdd-guidelines.md) |
| "How can we make this a well-designed TypeScript CLI?" | Agent loads TypeScript CLI guidelines | [`tbd guidelines typescript-cli-tool-rules`](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) |
| "Can you review if this TypeScript package setup follows best practices" | Agent loads monorepo patterns | [`tbd guidelines typescript-monorepo-patterns`](packages/tbd/docs/guidelines/typescript-monorepo-patterns.md) |
| "How can we do a better job of testing?" | Agent loads golden testing guidelines | [`tbd guidelines golden-testing-guidelines`](packages/tbd/docs/guidelines/golden-testing-guidelines.md) |

Under the hood, your agent runs these `tbd` commands automatically.
You just talk naturally.

## Features

> [!NOTE]
> For full technical details, see the [reference docs](packages/tbd/docs/tbd-docs.md)
> (run `tbd docs`) or the full [design doc](packages/tbd/docs/tbd-design.md)
> (`tbd design`).

- **Git-native:** Beads live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean—no bead churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per bead, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** Largely compatible with `bd` at the CLI level, but with a
  simpler architecture: no JSONL merge conflicts, no daemon modifying your working tree,
  no SQLite file locking on network filesystems (see
  [FAQ: How does `tbd` compare to Beads?](#how-does-tbd-compare-to-beads)).
- **Shortcuts:** Over a dozen reusable workflow documents—plan specs, code reviews,
  commit processes, PR creation, research briefs, and more.
- **Guidelines:** [17+ guideline docs](packages/tbd/docs/guidelines/) of coding rules
  and best practices (see
  [Built-in Engineering Knowledge](#built-in-engineering-knowledge)).
- **Templates:** Document templates for planning specs, research briefs, architecture
  docs.

## Why is This a Good Idea?

Engineers are still adjusting to how fast things are changing.
But the reality is that most of the time now, if you’re doing it right, *agents should
write 100% of your code*.

But anyone who’s coded a lot with agents knows they can be very bad or very good,
depending on the situation.
Without structure and knowledge, the results are often slop or have critical flaws or
they don’t scale to large projects.
They forget conventions between sessions, skip testing, and don’t follow your team’s
patterns.

The usual tactics like pasting rules into prompts is fragile and tiring.
And even adding all these rules to CLAUDE.md or AGENTS.md doesn’t scale.

Beads (git-native CLI-based issue tracking) is one element of the solution.
It solves the task management problem brilliantly.
If you’re not using beads already, you should be!

But task tracking alone doesn’t help with *planning* or *quality*. You still need a way
to think through what you’re building before you start, and a way to make sure the agent
follows good engineering practices while it works.

`tbd` combines all three: beads for task management, spec-driven workflows for planning,
and curated engineering guidelines for quality.
Together, they let you hand an agent a well-defined spec with clear beads and expert
knowledge, and get back careful, well-structured code—even overnight, even across
sessions.

My current favorite workflows and guidelines are included by default, but you’re not
locked in. Add your own via `--add` or configure what’s available in `.tbd/config.yml`.

And yes, all the code *and* all the specs of `tbd` are agent written—see
[the FAQ](#was-tbd-built-with-tbd).

## Built-in Engineering Knowledge

When you run `tbd setup`, your agent gets instant access to
[17+ guideline documents](packages/tbd/docs/guidelines/) covering real-world engineering
practices. These aren’t generic tips; they’re mostly my own detailed and sometimes
opinionated rules with concrete examples, built from months of heavy agentic coding.

> [!TIP]
> 
> An example: I *strongly* believe there are much better ways to do testing
> proliferating hundreds of unit and integration tests.
> So (with help from some Opus 4.5 and GPT-5 Pro) I wrote a multi-page brief about
> “[golden testing](packages/tbd/docs/guidelines/golden-testing-guidelines.md)”
> techniques, which allow the LLM to do end-to-end testing of CLI or web app flows in a
> clean, token-friendly way.
> Now simply telling your agent “check the guidelines on golden testing” can make a huge
> difference, encouraging far more maintainable, deeper tests.

| Guideline | What it covers |
| --- | --- |
| [general-tdd-guidelines](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | Red-Green-Refactor methodology, small slices, test-first discipline |
| [golden-testing-guidelines](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | Snapshot/golden testing for complex systems: session schemas, YAML captures, mock modes |
| [general-testing-rules](packages/tbd/docs/guidelines/general-testing-rules.md) | Minimal tests for maximum coverage, avoiding redundant test cases |
| [typescript-code-coverage](packages/tbd/docs/guidelines/typescript-code-coverage.md) | Code coverage best practices with Vitest and v8 provider |
| [typescript-rules](packages/tbd/docs/guidelines/typescript-rules.md) | Strict type safety, no `any`, type guards, null safety, async patterns |
| [typescript-monorepo-patterns](packages/tbd/docs/guidelines/typescript-monorepo-patterns.md) | pnpm workspaces, package setup, tsdown, Changesets, publint, dual ESM/CJS |
| [typescript-cli-tool-rules](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | Commander.js patterns, picocolors, terminal formatting |
| [python-rules](packages/tbd/docs/guidelines/python-rules.md) | Type hints, docstrings, exception handling, resource management |
| [python-cli-patterns](packages/tbd/docs/guidelines/python-cli-patterns.md) | Modern Python CLI stack: uv, Typer, Rich, Ruff, BasedPyright |
| [backward-compatibility-rules](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | Compatibility across code, APIs, file formats, and database schemas |
| [convex-rules](packages/tbd/docs/guidelines/convex-rules.md) | Convex function syntax, schema design, queries, mutations |
| [convex-limits-best-practices](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Convex platform limits, workarounds, performance tuning |

Plus guidelines on [coding rules](packages/tbd/docs/guidelines/general-coding-rules.md),
[comment quality](packages/tbd/docs/guidelines/general-comment-rules.md),
[commit conventions](packages/tbd/docs/guidelines/commit-conventions.md), and
[style](packages/tbd/docs/guidelines/general-style-rules.md).

You can also add your own team’s guidelines from any URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
```

## Installation and Setup

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
npm install -g get-tbd@latest
```

### Setup

```bash
# Fresh project (--prefix is REQUIRED—it appears in every bead ID, e.g. myapp-a1b2)
tbd setup --auto --prefix=myapp

# Joining an existing tbd project (no prefix needed—reads existing config)
tbd setup --auto

# Migrate from Beads (uses your existing beads prefix)
tbd setup --from-beads
```

> **Tip:** Run `tbd setup --auto` anytime to refresh skill files, hooks, and configs
> with the latest shortcuts, guidelines, and templates.

### Team Setup

`tbd` is designed for teams where one person sets up the project and others join later.

**First contributor:**
```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=myproject
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining contributors:**
```bash
git clone <repo>
npm install -g get-tbd@latest
tbd setup --auto                    # No --prefix needed—reads existing config
```

### Claude Code Integration

`tbd setup --auto` configures SessionStart hooks that run at the beginning of each
Claude Code session:

- **`tbd prime`**—injects workflow context so the agent knows how to use `tbd`
- **`ensure-gh-cli.sh`**—installs the GitHub CLI (`gh`) if not already available

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

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in `tbd`.

## Commands

### Beads

```bash
tbd ready                      # Beads ready to work on (open, unblocked, unassigned)
tbd list                       # List open beads
tbd list --all                 # Include closed
tbd list --specs               # Group beads by spec
tbd show proj-a7k2             # View bead details
tbd create "Title" --type=bug  # Create bead (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close bead
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync                       # Sync with remote (auto-commits and pushes)
```

### Dependencies and Labels

```bash
tbd dep add proj-b3m9 proj-a7k2        # b3m9 depends on a7k2
tbd blocked                            # Show blocked beads
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                         # All labels in use
tbd search "authentication"            # Search beads
```

### Shortcuts, Guidelines, and Templates

`tbd` bundles three types of documentation your agent can invoke on demand:

```bash
# Shortcuts—workflow instructions
tbd shortcut --list              # List all shortcuts
tbd shortcut new-plan-spec       # Get the plan spec workflow

# Guidelines—coding rules and best practices
tbd guidelines --list            # List all guidelines
tbd guidelines typescript-rules  # Get TypeScript rules

# Templates—document scaffolds
tbd template --list              # List all templates
tbd template plan-spec           # Get a plan spec template

# Add your own from any URL
tbd guidelines --add=<url> --name=<name>
tbd shortcut --add=<url> --name=<name>
tbd template --add=<url> --name=<name>
```

**Available shortcuts:**

| Category | Shortcut | Purpose |
| --- | --- | --- |
| **Planning** | `new-plan-spec` | Create a feature planning spec |
|  | `plan-implementation-with-beads` | Break a spec into implementation beads |
|  | `implement-beads` | Implement beads from a spec |
|  | `new-validation-plan` | Create a test/validation plan |
|  | `update-specs-status` | Review active specs and sync with tbd issues |
| **Documentation** | `new-research-brief` | Create a research document |
|  | `new-architecture-doc` | Create an architecture document |
|  | `revise-architecture-doc` | Update an architecture doc to match current code |
|  | `revise-all-architecture-docs` | Revise all current architecture documents |
| **Review** | `review-code` | Comprehensive code review (uncommitted, branch, or PR) |
|  | `review-github-pr` | Review a GitHub PR with commenting and CI checks |
|  | `review-code-typescript` | TypeScript-focused code review |
|  | `review-code-python` | Python-focused code review |
| **Git** | `precommit-process` | Pre-commit review and testing |
|  | `code-review-and-commit` | Commit with pre-commit checks |
|  | `create-or-update-pr-simple` | Basic PR creation |
|  | `create-or-update-pr-with-validation-plan` | PR with a validation plan |
|  | `merge-upstream` | Merge origin/main with conflict resolution |
| **Cleanup** | `code-cleanup-all` | Full code cleanup (duplicates, dead code, quality) |
|  | `code-cleanup-tests` | Remove trivial/low-value tests |
|  | `code-cleanup-docstrings` | Add docstrings to major functions |
| **Session** | `agent-handoff` | Generate handoff prompt for another agent |
|  | `welcome-user` | Welcome message after tbd installation |
|  | `setup-github-cli` | Ensure GitHub CLI is installed and working |
|  | `sync-failure-recovery` | Handle tbd sync failures |
| **Meta** | `new-guideline` | Create a new coding guideline for tbd |
|  | `new-shortcut` | Create a new shortcut for tbd |

**Available guidelines:** See
[Built-in Engineering Knowledge](#built-in-engineering-knowledge) for the full list of
17+ guidelines covering TypeScript, Python, testing, TDD, and more.

**Available templates:**

| Template | Description |
| --- | --- |
| `plan-spec` | Feature planning specification |
| `research-brief` | Research document |
| `architecture` | Architecture document |

### Spec-Driven Development

For non-trivial features, `tbd` supports a full spec-driven workflow:

1. **Plan**: Create a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: Convert spec into implementation beads
   (`tbd shortcut plan-implementation-with-beads`)
3. **Implement**: Work through beads systematically (`tbd shortcut implement-beads`)
4. **Validate**: Create validation plan, run tests (`tbd shortcut new-validation-plan`)
5. **Ship**: Commit, create PR (`tbd shortcut create-or-update-pr-with-validation-plan`)

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Bead statistics
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
- [CLI Reference](packages/tbd/docs/tbd-docs.md)—Complete command documentation
- [Design Doc](packages/tbd/docs/tbd-design.md)—Technical architecture

## How It Works

`tbd` keeps two things separate from your code:

- **Beads** live on a dedicated `tbd-sync` branch.
  One Markdown file per bead means parallel creation never conflicts.
  `tbd sync` pushes changes—no manual git operations needed.
- **Documents** (shortcuts, guidelines, templates) are cached locally in `.tbd/docs/`
  during `tbd setup --auto`. Your agent reads them on demand via `tbd shortcut`,
  `tbd guidelines`, and `tbd template`. Re-run `tbd setup --auto` anytime to refresh
  with the latest bundled docs, or add your own via `--add`.
- **Everything is self-documented via the CLI.** Running `tbd` with no arguments gives
  full orientation. `tbd setup --auto` writes a skill file (SKILL.md/AGENTS.md) that
  teaches the agent all available commands, shortcuts, and guidelines.
  This means agents can inject context—specs, engineering guidelines, workflow
  instructions—at any point in a session, not just at startup.

See the [design doc](packages/tbd/docs/tbd-design.md) for details.

## FAQ

### How does `tbd` compare to Beads?

`tbd` was inspired by [Beads](https://github.com/steveyegge/beads) by Steve Yegge, and
I’m grateful for the idea—it genuinely changed how I work with agents.
If you’re not familiar with Beads, the core insight is that git-native issue tracking
raises an agent’s capacity for structured work from ~5-10 to-do items to hundreds of
beads.

`tbd` builds on that foundation with a simpler architecture: plain Markdown files
instead of JSONL, no daemon, no SQLite, no 4-way sync.
This avoids the edge cases I ran into with network filesystems (Claude Code Cloud),
merge conflicts, and multi-agent workflows.

If you already use Beads, `tbd setup --from-beads` migrates you to `tbd`. This imports
and sets up your `.tbd` directory and preserves the IDs of all issues.

**Scope:** `tbd` focuses on the *durable layer*—issue tracking, specs, and knowledge
that persist across sessions and live in git.
It does *not* aim to solve real-time multi-agent coordination, which is a separate
problem requiring sub-second messaging and atomic claims.
Tools like [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) and
[Gas Town](https://github.com/steveyegge/gastown) address that space and are
complementary to `tbd`—you could layer real-time coordination on top of `tbd`'s durable
tracking. See the [design doc](packages/tbd/docs/tbd-design.md) for a detailed
comparison.

### Why spec-driven development?

After months of heavy agentic coding, I’ve found that the single biggest lever for
quality is planning before you code.
A
[carefully written spec](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md)
lets you think through what you’re building, catch design problems early, and break the
work into well-defined beads.
The agent then implements each bead with clear context about the bigger picture.

This matters because with a good spec broken into beads, you can leave an agent running
overnight and come back to code that’s well-structured and coherent—not a pile of
disconnected changes.
`tbd` bakes in shortcuts for the full cycle: writing specs, breaking them into beads,
implementing, validating, and shipping.

### Was `tbd` built with `tbd`?

Of course! I bootstrapped with the original `bd`. It imported from `bd` and began
self-hosting its own tasks, then took over its own specs and reminds itself of its own
coding guidelines. Here’s what that looks like in practice:

**Specs:** `tbd` has dozens of active and completed plan specs, such as:
- `plan-2026-01-15-tbd-v1-implementation.md`—The original v1 design
- `plan-2026-01-20-streamlined-init-setup-design.md`—Redesigning the setup flow
- `plan-2026-01-26-configurable-doc-cache-sync.md`—Making the doc system configurable
- `plan-2026-01-28-cli-add-docs-by-url.md`—Adding `--add` for external docs

**Beads:** Features are broken into beads and worked through systematically.
For example, the current list of open beads for this project looks like

```
$ tbd list --pretty 
tbd-0nuf      P2  ○ open  [feature] Add remote vs local issue counts to tbd stats
tbd-1r0w      P2  ○ open  [epic] Spec: CLI Output Formatting Consistency
...
tbd-pt3v      P2  ○ open  [epic] Spec: CLI Output Design System
tbd-tv5i      P2  ○ open  [feature] Format option (json/yaml/table/csv)
tbd-w4un      P2  ○ open  [task] Create claude-installation.md with installation section for Claude only
tbd-x3zq      P2  ○ open  [task] Add integration tests for shortcut command
tbd-x8va      P2  ○ open  [epic] Agent documentation consolidation and cleanup
tbd-xqn2      P2  ○ open  [feature] Issue templates
tbd-yom2      P2  ○ open  [feature] Improve sync commit messages with ticket IDs and summaries
├── tbd-f0nb      P2  ○ open  [task] Generate commit body with long-format issue summaries (title, description, close_reason)
├── tbd-qi6q      P2  ○ open  [task] Add tests for sync commit message generation
├── tbd-r6s8      P2  ○ open  [task] Track modified issues at commit time and pass to commit message generator
└── tbd-xdwv      P2  ○ open  [task] Generate commit subject line with up to 8 short IDs (truncate if >10)
tbd-z26l      P2  ○ open  [task] Document configuration options in tbd-design.md
tbd-6org      P3  ○ open  [task] Add ESLint rule to enforce atomically for file writes

39 issue(s)
$ 
```

### Can I add my own guidelines?

Yes. `tbd` comes with 17+ bundled guidelines, but you can add your own team’s docs from
any URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
tbd shortcut --add=<url> --name=my-team-workflow
tbd template --add=<url> --name=my-team-template
```

You can also configure which docs are available in `.tbd/config.yml`. I put my favorite
guidelines and shortcuts in by default, but you’re not locked into using them.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
