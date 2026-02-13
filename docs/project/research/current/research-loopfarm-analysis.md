# Research: LoopFarm — Architecture Analysis and Comparison with tbd

**Date:** 2026-02-13

**Author:** Agent-assisted research

**Status:** Complete

**Source:** https://github.com/femtomc/loopfarm (cloned to attic/loopfarm)

## Overview

LoopFarm is a Python-based "agent loop orchestrator" that combines a hierarchical
planner, agentic execution loops, an issue tracker (DAG), and a forum for agent
conversation into a single CLI tool. It treats AI agents as disposable worker units
rather than persistent chat sessions — inspired by a Factorio-style mental model where
agents do one focused job and get torn down.

This research analyzes LoopFarm's complete architecture, contrasts it with tbd's
approach, and identifies learnings that could strengthen tbd.

## Questions to Answer

1. How does LoopFarm's architecture work end-to-end, from prompt to completion?
2. What novel patterns does LoopFarm employ for agentic orchestration?
3. How does LoopFarm's issue DAG compare to tbd's bead tracking?
4. What features or patterns could be adopted to make tbd more powerful?
5. What are LoopFarm's weaknesses that tbd should avoid?

## Scope

- Full source analysis of the loopfarm Python codebase (~50 source files)
- Architectural comparison with tbd's TypeScript codebase
- Focus on orchestration patterns, state management, and programmable surfaces
- Excludes performance benchmarking or running loopfarm in production

---

## Part 1: Complete Architectural Overview of LoopFarm

### 1.1 Project Structure and Technology

LoopFarm is a Python 3.11+ project using hatchling for packaging with a single runtime
dependency: `rich` (for terminal rendering). It is installed as a CLI tool via
`uv tool install`. The codebase is organized as:

```
src/loopfarm/
├── cli.py              # Top-level CLI entrypoint
├── issue.py            # Issue tracker facade + CLI commands
├── forum.py            # Forum (message bus) facade + CLI commands
├── runner.py           # Single-pass loop session runner
├── execution_spec.py   # Execution specification schema
├── sessions.py         # Session history viewer
├── prompting.py        # Prompt assembly and context injection
├── templates.py        # Markdown template rendering with includes
├── format_stream.py    # Stream output formatters (Claude/Codex/Kimi/Gemini)
├── tissue.py           # Lightweight in-progress issue query
├── ui.py               # Rich terminal UI utilities
├── util.py             # General utilities (subprocess, time, IDs)
├── init_cmd.py         # Scaffold command (loopfarm init)
├── roles_cmd.py        # Role discovery + team assembly
├── docs_cmd.py         # Built-in documentation browser
├── backends/           # AI backend abstraction layer
│   ├── base.py         # StreamBackend abstract base
│   ├── claude.py       # Claude Code CLI backend
│   ├── codex.py        # OpenAI Codex CLI backend
│   ├── gemini.py       # Google Gemini CLI backend
│   ├── kimi.py         # Kimi CLI backend
│   ├── registry.py     # Backend name registry
│   ├── stream_helpers.py  # Subprocess streaming utilities
│   └── types.py        # Backend protocol definition
├── runtime/            # Orchestration engine
│   ├── events.py       # Core event types
│   ├── control.py      # Pause/resume/stop control plane
│   ├── orchestrator.py # Main phase loop orchestrator
│   ├── phase_executor.py      # Single phase execution
│   ├── prompt_resolver.py     # Prompt template resolution
│   ├── forward_report.py      # Git-based forward reports
│   ├── roles.py               # Role document catalog
│   ├── issue_dag_events.py    # DAG event schema
│   ├── issue_dag_execution.py # DAG node execution adapter
│   ├── issue_dag_orchestrator.py  # DAG selection + routing
│   └── issue_dag_runner.py    # Top-level DAG loop runner
├── stores/             # Persistence layer
│   ├── state.py        # State directory resolution + time
│   ├── issue.py        # SQLite issue store (~1760 lines)
│   ├── forum.py        # SQLite forum/message store
│   └── session.py      # Event-sourced session store (on forum)
├── docs/               # Built-in documentation (4 markdown files)
└── prompts/            # Prompt templates (research + implementation)
```

### 1.2 The Two-Level Architecture

LoopFarm has two distinct execution levels that compose together:

**Level 1: The Session Loop (runner.py + runtime/orchestrator.py)**

A single "session" runs a configured sequence of *phases* in a loop until a termination
phase signals `COMPLETE`. This is the inner execution engine. A session:

1. Receives a `LoopfarmConfig` specifying: which phases to run, how many times to
   repeat each, which phase is the termination gate, and which backend CLI to use
2. Cycles through the phases: for each phase, it builds a prompt from a Markdown
   template, invokes an external AI CLI tool (Claude Code, Codex, Gemini, or Kimi)
   as a subprocess, captures the output, extracts a summary, and posts it to the forum
3. After the termination phase runs, checks the forum for a `COMPLETE` decision
4. If not complete, loops back to the beginning of the phase sequence
5. Between loops, builds "forward reports" capturing git state changes (commits, diffs,
   working tree status) and injects them into subsequent phase prompts

The phases are defined in Markdown files under `.loopfarm/roles/` or
`.loopfarm/prompts/`. Two built-in "programs" are provided:

- **Implementation program**: planning → forward → documentation → architecture →
  backward (termination gate)
- **Research program**: planning → research → curation → backward (termination gate)

Each phase prompt is a Markdown template with placeholders (`{{PROMPT}}`, `{{SESSION}}`,
`{{PROJECT}}`) and injection points for dynamic context (`{{DYNAMIC_CONTEXT}}`,
`{{FORWARD_REPORT}}`, `{{PHASE_BRIEFING}}`). The backward/termination phase is the only
one that can signal `COMPLETE` by posting a JSON decision to the forum.

**Level 2: The Issue DAG Orchestrator (runtime/issue_dag_*.py)**

The higher-level system that decomposes a goal into a DAG of issues and drives them
to completion. This is the outer orchestration layer:

1. Takes a root issue (created from the user's prompt) and validates the DAG
2. Finds the next "ready" leaf — an open issue with no active blockers or children
3. Routes the leaf to one of two paths:
   - **Orchestrator planning**: If the issue has no `execution_spec`, it runs through
     the `.loopfarm/orchestrator.md` prompt. The orchestrator agent decides whether
     the issue is atomic or needs decomposition. If decomposition is needed, the
     agent creates child issues, sets up dependencies, and closes the parent with
     `outcome=expanded`. The key insight: `expanded` is *terminal but not final* —
     it signals that the node has been replaced by its children.
   - **Spec execution**: If the issue has an `execution_spec` (a JSON object specifying
     role, CLI, model, loop steps, and prompt path), it runs a full session loop
     using that spec. The agent executes the atomic task, then closes the issue with
     `outcome=success` or `outcome=failure`.
4. After execution, validates postconditions (the issue must be in terminal status)
5. Checks if the root issue is now "final" (closed with `success`/`failure` and no
   active descendants)
6. If not final, loops back to step 2

The DAG runner (`IssueDagRunner`) combines these two levels: for each step, the
orchestrator selects and routes a leaf, then the execution adapter (`IssueDagNodeExecutionAdapter`)
runs a full session for that leaf. This creates a recursive structure where the
orchestrator can decompose work arbitrarily deep.

### 1.3 State Substrate: Issues + Forum

LoopFarm uses two SQLite databases as its canonical state:

**Issue Store (`.loopfarm/issues.sqlite3`)**

A full issue tracker with:
- **Issues**: id, title, body, status (open/in_progress/paused/closed/duplicate),
  outcome (success/failure/expanded/skipped), priority (1-5), execution_spec, tags,
  timestamps
- **Dependencies**: Directed edges between issues with three relation types:
  - `parent` — hierarchy (decomposition tree)
  - `blocks` — ordering/gating (must complete before)
  - `related` — informational (no execution semantics)
- **Comments**: Per-issue comment threads
- **Tags**: Freeform tags with semantic conventions:
  - `node:agent` — marks an issue as executable by the orchestrator
  - `team:<name>` — assigns team label
  - `role:<name>` — assigns role for execution

Key DAG operations:
- `ready()`: Returns leaf issues that are open, have no active blockers, no active
  children, and match tag filters. This is the "ready frontier."
- `resumable()`: Same but for in_progress issues (for resume mode)
- `claim_ready_leaf()`: Atomic `open → in_progress` transition (race-safe)
- `validate_dag()`: Comprehensive structural validation (cycle detection, orphan
  checks, outcome consistency)
- `validate_orchestration_subtree()`: Lightweight termination check (is root final?
  any active descendants?)
- `resolve_team()`: Walks ancestor chain via parent edges to find nearest `team:*` tag

**Forum Store (`.loopfarm/forum.sqlite3`)**

An append-only topic/message bus used for:
- Session metadata: `loopfarm:session:<id>`, `loopfarm:status:<id>`,
  `loopfarm:briefing:<id>`, `loopfarm:control:<id>`, `loopfarm:context:<id>`
- Forward reports: `loopfarm:forward:<id>`
- Issue-level notes: `issue:<id>`
- Run-level execution events: `loopfarm:feature:issue-dag-orchestration`
- Research findings: `research:<project>:<topic>`

The forum serves as both the provenance log (all events are append-only) and the
shared memory bus (agents read from and post to topics). The session store
(`SessionStore`) is implemented as an event-sourced view on top of the forum — all
session state is persisted as forum messages with schema versioning
(e.g., `loopfarm.session.meta.v1`).

### 1.4 Backend Abstraction

LoopFarm supports four AI backend CLIs through a pluggable `Backend` protocol:

| Backend | CLI Tool | Streaming Format | Default Model |
|---------|----------|-----------------|---------------|
| Claude  | `claude` | stream-json | (from config) |
| Codex   | `codex exec` | JSONL | gpt-5.2 |
| Gemini  | `gemini` | text | (from config) |
| Kimi    | `kimi` | stream-json | (from config) |

Each backend:
1. Constructs a CLI command with appropriate flags (model, reasoning level, output
   format, working directory)
2. Spawns the CLI as a subprocess
3. Streams output through a format-specific `StreamFormatter` that parses the
   backend's protocol and renders it to the terminal using Rich
4. Captures output to a log file
5. Extracts a phase summary from the output (either via the last message or by
   calling Claude Haiku for summarization)

The key architectural decision: LoopFarm does not call AI APIs directly. It invokes
*CLI tools* as subprocesses. This means it can orchestrate any AI agent that has a
CLI interface — Claude Code, Codex, Gemini CLI, Kimi — without importing their SDKs.

### 1.5 Prompt System

Prompts are Markdown files with a lightweight template system:

- **Variable substitution**: `{{PROMPT}}`, `{{SESSION}}`, `{{PROJECT}}`
- **Include directives**: `{{> relative/path.md}}` with cycle detection
- **YAML frontmatter**: Configuration metadata (cli, model, reasoning, loop_steps)
- **Context injection points**: `{{DYNAMIC_CONTEXT}}`, `{{SESSION_CONTEXT}}`,
  `{{USER_CONTEXT}}`, `{{PHASE_BRIEFING}}`, `{{FORWARD_REPORT}}`
- **Frontmatter stripping**: YAML frontmatter is removed before the prompt is sent

The prompt assembly pipeline:
1. Resolve the template file for the current phase
2. Render includes recursively
3. Strip frontmatter
4. Substitute variables
5. Inject phase briefings (summaries from prior phases in this iteration)
6. Inject forward reports (git state changes from prior implementation phases)
7. Inject session/operator context (if set via control plane)
8. Append backend-specific suffix

### 1.6 Control Plane

The control plane allows external actors to interact with running sessions:

- **Pause/Resume**: Suspends the loop at the next control checkpoint
- **Stop**: Gracefully terminates the session
- **Context Set/Clear**: Injects operator steering guidance into the next phase prompt

Control state is persisted via the forum (`loopfarm:control:<session_id>` topic) and
checked at the beginning of each phase execution. While paused, the executor polls
at a configurable interval (default 5 seconds).

### 1.7 Forward Reports

Forward reports are a mechanism for carrying context between loop iterations. After
an implementation phase (the "forward pass"), the system captures:

- Git commit log between pre- and post-phase HEAD
- `git diff --stat` and `--name-status`
- Working tree dirty state
- Staged vs unstaged changes
- A text summary of what was accomplished

This report is posted to the forum and injected into subsequent phase prompts (e.g.,
the architecture review and backward/termination phases). This solves the critical
problem of context loss across phases: the review agent knows exactly what changed
without needing to re-read the entire codebase.

### 1.8 Execution Specs

An `execution_spec` is a JSON object attached to an issue that fully specifies how
to execute it:

```json
{
  "version": 1,
  "role": "worker",
  "prompt_path": ".loopfarm/roles/worker.md",
  "team": "backend",
  "loop_steps": [{"phase": "role", "repeat": 1}],
  "termination_phase": "role",
  "default_cli": "codex",
  "default_model": "gpt-5.2",
  "default_reasoning": "xhigh",
  "phase_cli": {},
  "phase_models": {},
  "phase_prompts": {}
}
```

This is LoopFarm's "programmability" mechanism. By attaching different execution specs
to issues, you can:
- Use different AI models for different tasks
- Define multi-phase execution sequences per issue
- Override CLI tools per phase (e.g., use Claude for planning, Codex for implementation)
- Specify different prompt templates per phase

### 1.9 Role System

Roles are defined as Markdown files in `.loopfarm/roles/`. Each role file:
- Has a name derived from its filename (e.g., `worker.md` → role `worker`)
- Contains a prompt template that the agent follows
- Can have YAML frontmatter specifying execution defaults:
  - `cli`: Which backend to use (claude, codex, gemini, kimi)
  - `model`: Which AI model
  - `reasoning`: Reasoning effort level
  - `loop_steps`: Phase sequence (e.g., `"role"`, `"role*3"` for 3 repetitions)
  - `termination_phase`: Which phase gates completion
  - `team`: Default team assignment

The `RoleCatalog` discovers all role files and provides lookup/validation. When the
orchestrator routes a leaf to a role, it reads the role's frontmatter to configure
the session.

### 1.10 Initialization and Scaffolding

`loopfarm init` creates two files:

1. **`.loopfarm/orchestrator.md`** — The orchestrator prompt. This is the "brain" that
   decides whether to decompose an issue or execute it directly. It instructs the AI to:
   - Inspect the issue using `loopfarm issue show`
   - Check if it's atomic or compound
   - If compound: create child issues with `loopfarm issue new`, wire dependencies
     with `loopfarm issue dep add`, optionally assign execution specs, then close the
     parent with `loopfarm issue status <id> closed --outcome expanded`
   - If atomic: create an execution_spec and close with `expanded`

2. **`.loopfarm/roles/worker.md`** — The default worker role prompt. Instructs the AI to:
   - Read the issue details
   - Implement the task end-to-end
   - Run tests and commit
   - Close with `loopfarm issue status <id> closed --outcome success`

### 1.11 Event System

LoopFarm has a structured event system with five event kinds for the issue DAG:

| Event | Purpose |
|-------|---------|
| `node.plan` | Records orchestrator planning decisions |
| `node.memory` | Captures observations, references, evidence |
| `node.expand` | Records decomposition (parent → children) |
| `node.execute` | Claims a node for execution (with mode: claim/resume) |
| `node.result` | Records execution outcome |

Events are validated against a schema and posted to the forum for provenance. They
enable post-hoc analysis of how the orchestrator decomposed work and what each agent
decided.

### 1.12 Session Management

Sessions are tracked in the forum with full lifecycle metadata:

- Session ID: `loopfarm-XXXXXXXX` (8-char hex)
- Status: running → complete | interrupted | stopped
- Phase tracking: current phase and iteration
- Briefings: per-phase summaries posted after each phase execution
- Decision history: termination decisions from the backward phase

The `loopfarm sessions` / `loopfarm history` commands provide session inspection.

---

## Part 2: How Agentic Loops Work in LoopFarm

### 2.1 The Outer Loop: Issue DAG Orchestration

When you run `loopfarm "Build OAuth flow with retries"`, the flow is:

1. **Root issue creation**: Creates an issue with the prompt as the body, tagged
   `node:agent`
2. **DAG validation**: Validates the (initially trivial) DAG
3. **Selection**: The root issue is the only ready leaf, so it's selected
4. **Routing**: No execution_spec exists, so it's routed to orchestrator planning
5. **Orchestrator session**: A session runs with the orchestrator prompt. The AI
   agent reads the issue, decides it's compound, creates child issues (e.g.,
   "Implement OAuth token exchange", "Add retry middleware", "Write integration
   tests"), wires parent/blocks dependencies, and closes the root with
   `outcome=expanded`
6. **Post-step validation**: Root is `expanded` (terminal but not final). Children
   are open. The DAG runner continues.
7. **Next selection**: The first unblocked child is selected (say "Implement OAuth
   token exchange")
8. **Routing decision**: If the orchestrator assigned an execution_spec, it goes
   to spec execution. If not, it goes back to orchestrator planning for further
   decomposition.
9. **Spec execution**: A session runs with the role prompt. The AI implements the
   feature, tests it, commits, and closes the issue with `outcome=success`.
10. **Continue**: The runner selects the next ready leaf and repeats until the root
    can be closed with `outcome=success` (all children completed successfully).

### 2.2 The Inner Loop: Phase-Based Sessions

Within each session (step 5 or step 9 above), the phase loop runs:

For an **orchestrator planning** session:
- Phase sequence: typically just `role` (one phase)
- The orchestrator agent has one pass to inspect and decompose
- Termination is forced by pre-posting a `COMPLETE` decision

For a **spec execution** session:
- Phase sequence: depends on the role's frontmatter (e.g., `"role*3"` for 3 passes,
  or a multi-phase sequence like `planning, forward, backward`)
- Each phase runs an AI agent with a different prompt template
- The backward phase checks if the work is done and can signal `COMPLETE`
- Forward reports carry context from implementation to review phases

### 2.3 The Recursion: Arbitrary Decomposition Depth

The power of the DAG orchestrator is that decomposition is recursive:

1. Root issue → orchestrator decomposes into 3 children
2. Child A → orchestrator decomposes into 2 sub-children
3. Sub-child A1 → has execution_spec → spec execution → `success`
4. Sub-child A2 → has execution_spec → spec execution → `success`
5. Child A → all children complete → parent can be resolved
6. Child B → has execution_spec → spec execution → `success`
7. Child C → orchestrator decomposes further → ...
8. Eventually all descendants complete → root → `success`

The termination invariant is clear: the root is final only when its status is
closed/duplicate, its outcome is success/failure (not expanded), and no active
descendants remain.

---

## Part 3: Detailed Comparison with tbd

### 3.1 Philosophical Differences

| Aspect | tbd | LoopFarm |
|--------|-----|----------|
| **Primary role** | Issue tracker + knowledge injection for existing AI agents | Self-contained agent orchestrator that IS the agentic loop |
| **Agent relationship** | Works alongside Claude Code, augmenting it | Wraps Claude Code (and other CLIs) as disposable workers |
| **Execution model** | Agent uses tbd as a tool; human/agent drives workflow | LoopFarm drives the workflow; agents are subordinate |
| **State substrate** | Git-native markdown files on a sync branch | SQLite databases in `.loopfarm/` directory |
| **DAG semantics** | Dependencies between beads (flat blocking) | Full hierarchical DAG with parent/blocks/related edges |
| **Decomposition** | Human or agent creates sub-tasks manually | Automated recursive decomposition via orchestrator agent |
| **Multi-agent** | Single agent uses tbd commands | Spawns multiple agent sessions as subprocesses |
| **Context management** | Knowledge injection (guidelines, shortcuts) | Forward reports + phase briefings + forum memory |

### 3.2 Feature Comparison

| Feature | tbd | LoopFarm |
|---------|-----|----------|
| **Issue tracking** | Full (create, update, close, deps, labels, search) | Full (create, update, close, deps, tags, comments, search) |
| **Dependencies** | Blocking dependencies between beads | Three types: parent (hierarchy), blocks (ordering), related (info) |
| **Hierarchical decomposition** | Manual (create sub-beads) | Automated (orchestrator agent decomposes) |
| **DAG validation** | Basic (blocked detection) | Comprehensive (cycles, orphans, outcome consistency, subtree termination) |
| **Execution specs** | Not present | Per-issue execution configuration (model, CLI, phases, prompts) |
| **Multi-backend** | N/A (works with any agent) | Claude, Codex, Gemini, Kimi (CLI subprocess invocation) |
| **Phase loops** | Not present (agent-directed) | Configurable phase sequences with repeat counts |
| **Forward reports** | Not present | Git-based context carry between phases |
| **Forum/shared memory** | Not present | SQLite forum with topics, searchable, provenance events |
| **Session management** | Not present (agent manages own session) | Full session lifecycle (start, pause, resume, stop) |
| **Control plane** | Not present | Pause/resume/stop/inject-context during execution |
| **Role system** | Not present (guidelines serve a related purpose) | Markdown-based role definitions with frontmatter config |
| **Template system** | Shortcuts/guidelines/templates (markdown) | Markdown templates with include, variables, injection points |
| **Knowledge injection** | 17+ guidelines, shortcuts, templates | Role prompts, orchestrator prompt (user-edited only) |
| **Spec-driven workflow** | Plan specs → break into beads → implement | Prompt → orchestrator decomposes → spec execution |
| **Git integration** | Native (markdown on sync branch) | Forward reports only (state in SQLite, not git) |
| **Remote sync** | Git-based sync branch | Not present (local SQLite only) |
| **Search** | Full-text search across beads | LIKE-based search on issues and forum |
| **Priority** | P0-P4 | 1-5 (numeric) |
| **Types** | task, bug, feature, epic | None (tags only) |
| **Labels** | Freeform labels | Tags (freeform, with semantic conventions: node:, team:, role:) |
| **Stale detection** | Yes (tbd stale) | Not present |
| **Statistics** | Yes (tbd stats) | Not present |
| **Rich terminal UI** | Colorized CLI output | Rich library (tables, panels, markdown rendering) |
| **Programmability** | Shortcuts, guidelines (reusable instruction templates) | Execution specs, role frontmatter, orchestrator prompt |

### 3.3 Architectural Comparison

**State Management:**

tbd uses a git-native approach: issues are markdown files with YAML frontmatter,
stored on a dedicated `tbd-sync` branch in a hidden worktree. This is elegant for
git-based workflows — issues travel with the repo, can be branched, and sync
naturally via git push/pull.

LoopFarm uses SQLite databases (`.loopfarm/issues.sqlite3`, `.loopfarm/forum.sqlite3`).
This is simpler to implement and provides fast queries, but lacks the distributed sync
properties of git. LoopFarm has no remote sync mechanism.

**Dependency Model:**

tbd has flat blocking dependencies between beads. LoopFarm has a richer model with
three edge types: `parent` (hierarchy), `blocks` (ordering), and `related`
(informational). The `parent` edge enables tree-structured decomposition, which is
central to LoopFarm's orchestration model. This hierarchical structure is what enables
the recursive `select → execute → validate` loop.

**Orchestration:**

tbd is a "passive" tool — the agent (Claude Code) uses tbd commands as part of its
workflow, but tbd doesn't drive the agent. The workflow is: spec → beads → implement
(with the agent doing each step and tbd providing structure).

LoopFarm is an "active" orchestrator — it drives the agents. The workflow is:
prompt → root issue → DAG decomposition → leaf selection → agent session →
validation → repeat. LoopFarm spawns agent CLIs as subprocesses and coordinates their
work through the issue DAG.

**Knowledge System:**

tbd has a rich knowledge injection system: 17+ guidelines covering TypeScript, Python,
TDD, testing patterns, monorepo architecture, etc. Plus reusable shortcuts for common
workflows (code review, PR creation, cleanup, handoffs). This is a breadth-first
approach to agent capability.

LoopFarm's knowledge system is depth-first: two user-edited files (orchestrator prompt
+ role prompts) and a template system for prompt composition. The knowledge is embedded
in the prompts themselves rather than injected on demand.

---

## Part 4: Learnings and Opportunities for tbd

### 4.1 Patterns Worth Adopting

#### A. Hierarchical Issue Decomposition

**What LoopFarm does:** The `parent` edge type creates a tree structure where issues
can be decomposed into sub-issues. Combined with the `outcome=expanded` status (which
is terminal but not final), this enables clean recursive decomposition where a parent
issue is marked as "done because it was replaced by children."

**What tbd could do:** Add a `parent` relation type to dependencies. Currently tbd has
flat blocking deps only. A hierarchical structure would enable:
- Tracking epic → task decomposition natively
- Auto-closing parents when all children complete
- DAG-scoped views (show me everything under this epic)
- The `expanded` outcome pattern for tracking decomposed work

**Priority:** Medium-high. This would significantly improve tbd's ability to track
complex multi-step features.

#### B. Ready Frontier / Topological Work Selection

**What LoopFarm does:** The `ready()` query returns leaf issues that are open, have no
active blockers, and no active children. This is the "ready frontier" — the set of
tasks that can be worked on right now, respecting all dependency constraints.

**What tbd could do:** tbd already has `tbd ready` which shows issues without blockers.
The enhancement would be to incorporate parent-child hierarchy: only show leaf issues
(issues with no open children) in the ready set. This would prevent agents from picking
up parent/epic issues when there are concrete sub-tasks to work on.

**Priority:** Medium. tbd's current `ready` command is functional but could be more
DAG-aware.

#### C. Forward Reports (Cross-Phase Context)

**What LoopFarm does:** After an implementation phase, captures a comprehensive git
report (commits, diffs, working tree status, summary) and injects it into the next
phase's prompt. This solves the "what just happened?" problem for review phases.

**What tbd could do:** tbd's shortcut system could include a "forward report" shortcut
or built-in feature that:
1. Captures git state (similar to what `tbd shortcut code-review-and-commit` does)
2. Formats it as structured context
3. Makes it available to subsequent workflow steps

This is partially addressed by tbd's code review shortcuts, but a dedicated
cross-session context carrying mechanism would be more systematic.

**Priority:** Medium. Useful for multi-step workflows, but tbd's current approach of
agent-directed review is effective.

#### D. Forum / Shared Memory Bus

**What LoopFarm does:** An append-only message bus where agents post structured data
(execution events, research findings, session metadata, phase summaries). This creates
a persistent, searchable memory that survives across sessions and agents.

**What tbd could do:** The concept of a structured log/forum for agent communication
is compelling. Currently, tbd's beads serve as the primary coordination mechanism.
A lightweight forum or log system could enable:
- Cross-session context (agent B can read what agent A discovered)
- Structured provenance (what decisions were made and why)
- Research/investigation findings that don't fit into issues

However, tbd already has comments on issues which serve some of this purpose.
The question is whether a separate "forum" abstraction provides enough additional
value.

**Priority:** Low-medium. The bead comment system partially covers this. A full forum
would add complexity.

#### E. Execution Specs / Per-Issue Configuration

**What LoopFarm does:** Each issue can have an `execution_spec` that specifies exactly
how to execute it: which AI model, which CLI tool, what phase sequence, what prompts.
This makes the system programmable at the issue level.

**What tbd could do:** tbd could support attaching "execution hints" to beads — metadata
that tells the agent how to approach the task. This could include:
- Suggested guidelines to load (`tbd guidelines <name>`)
- Suggested shortcuts to follow
- Tool preferences (which agent to use)
- Estimated complexity or approach notes

This would be lighter-weight than LoopFarm's full execution specs but would carry
useful metadata for agent-directed workflows.

**Priority:** Low. tbd's philosophy is that the agent decides how to work, not the
issue tracker.

#### F. DAG Validation

**What LoopFarm does:** Comprehensive DAG validation including cycle detection (using
recursive CTEs and DFS), orphan node detection, outcome consistency checking,
unsupported tag detection, and subtree termination analysis.

**What tbd could do:** tbd could add `tbd doctor` checks for dependency issues:
- Circular dependencies
- Orphaned dependencies (pointing to deleted beads)
- Beads that are blocked but the blocker is already closed
- Inconsistent states (bead marked closed but has open dependencies)

**Priority:** Medium. This would improve data integrity and catch common mistakes.

### 4.2 Patterns to Observe but Not Necessarily Adopt

#### G. Multi-Backend Orchestration

LoopFarm's ability to invoke different AI CLIs (Claude, Codex, Gemini, Kimi) as
subprocesses is architecturally interesting but creates coupling to specific CLI
tool interfaces. tbd's approach of being backend-agnostic (working with any agent)
is arguably more robust.

#### H. Active Agent Orchestration

LoopFarm's model of driving agents as disposable workers is powerful for autonomous
execution but creates complexity (subprocess management, output formatting, error
handling). tbd's passive model (being a tool the agent uses) is simpler and
more composable. The tradeoff is autonomy vs. simplicity.

#### I. Phase Loops with Termination Gates

The concept of cycling through phases (plan → implement → review → decide) until
a termination gate signals completion is elegant for long-running autonomous work.
However, this is more relevant to a "loop orchestrator" than an issue tracker.
tbd's shortcuts already encode workflow sequences; formalizing them as phase loops
would be over-engineering for tbd's use case.

### 4.3 Anti-Patterns to Avoid

#### J. SQLite for Distributed State

LoopFarm's use of SQLite means state cannot be easily shared across machines or
team members. tbd's git-native approach is significantly better for collaboration.
This is a clear strength of tbd.

#### K. Tight CLI Coupling

LoopFarm's backends are tightly coupled to specific CLI tool interfaces (parsing
their JSON streaming formats, knowing their flags). When these tools change,
LoopFarm breaks. tbd avoids this by not wrapping CLI tools.

#### L. No Remote Sync

LoopFarm has no mechanism for syncing state between machines or team members. tbd's
git-based sync is a major differentiator.

---

## Part 5: Recommendations

### High Priority

1. **Add parent/child relationships to dependencies.** This is the single highest-value
   feature from LoopFarm. Enable hierarchical issue decomposition with proper semantics:
   - New relation type: `parent` (in addition to existing `blocks`)
   - Issues with children should not appear in `tbd ready` output
   - `tbd show` should display child issues
   - Consider an `expanded` close reason to track decomposed work

2. **Enhance DAG validation in `tbd doctor`.** Add checks for circular dependencies,
   orphaned dependency references, and inconsistent blocked/closed states.

### Medium Priority

3. **Forward report mechanism.** Create a built-in way to capture and format git state
   changes for cross-session context. This could be a new shortcut or a built-in
   `tbd report` command.

4. **Ready frontier improvements.** Make `tbd ready` DAG-aware: only show leaf issues
   with no open children, not parent/epic issues.

### Low Priority

5. **Per-bead execution hints.** Allow attaching metadata to beads that suggests how
   to approach them (guidelines to load, complexity estimate, approach notes).

6. **Structured activity log.** Consider a lightweight event/log system for tracking
   what agents did across sessions, separate from issue comments.

## Next Steps

- [ ] Evaluate feasibility of parent/child relations in tbd's current data model
- [ ] Prototype DAG validation enhancements for `tbd doctor`
- [ ] Design forward report shortcut or command
- [ ] Consider ready frontier improvements with hierarchical awareness

## References

- Source: https://github.com/femtomc/loopfarm (cloned at `attic/loopfarm`)
- LoopFarm built-in docs: `attic/loopfarm/src/loopfarm/docs/`
- LoopFarm prompt templates: `attic/loopfarm/prompts/`
- tbd design: `docs/project/architecture/` and `packages/tbd/docs/tbd-design.md`
