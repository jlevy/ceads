# Running Claude Code Across Environments

*Research document on multi-agent orchestration for AI coding agents* *Last updated:
January 2026*

## Introduction: The Multi-Agent Orchestration Problem

Claude Code is currently used in fairly siloed ways—via IDE plugins (like Cursor’s
integration), Anthropic’s Claude Code Cloud web UI, or the desktop app.
These provide powerful single-agent coding assistance, but orchestrating **multiple
Claude Code instances** concurrently in different environments remains challenging.

There is growing interest in frameworks that let many coding agents collaborate on tasks
(for example, coordinating agents from a Slack channel, or across multiple terminals)
with persistent state and minimal manual overhead.
This is essentially a **multi-agent orchestration** problem that breaks down into
several components:

1. **Shared Memory / Task Tracking** — How agents know what work exists and who’s doing
   what
2. **Inter-Agent Communication** — How agents coordinate and hand off work in real-time
3. **Event-Driven Triggers** — How to wake up or spawn agents based on external events
4. **Cross-Machine Coordination** — How agents on different machines or cloud instances
   collaborate
5. **Execution Environments** — Where agents run safely and scalably

This document surveys the current landscape of tools and approaches addressing each of
these challenges.

* * *

## Part 1: Shared Memory and Task Tracking

Before coordinating multiple agents, it’s critical to have a **shared persistent memory
or task tracker** so agents can see the overall work state.

### Beads: Git-Backed Memory for Coding Agents

**Beads**, created by Steve Yegge in late 2025, is a foundational tool in this space.
It is essentially a **lightweight issue-tracking database for coding agents**, with each
“bead” representing a unit of work (issue/task) containing a description, status,
assignee, etc.

Under the hood, Beads stores issues as a JSON Lines file and syncs them via Git,
augmented by a local SQLite cache and a background daemon for real-time updates.
This design gives agents a form of long-term memory: they can query what tasks exist,
which are in progress or done, and even preserve history of work in Git.

**Why is Beads important for multi-agent setups?** If you run 5 Claude Code instances in
parallel, you need them to not step on each other’s toes.
Beads addresses this by **tracking task status centrally** and even allowing atomic task
claims (with the daemon) so two agents don’t accidentally grab the same issue.
Users and agents file tasks into Beads, and each Claude instance can query “ready”
tasks, mark tasks as in-progress or closed, etc., all via CLI commands (`bd create`,
`bd claim`, `bd close`, etc.).

**Beads limitations:** Its architecture—using a local SQLite database and continuous
daemon—can be brittle or **incompatible with sandboxed and cloud environments**:

- Many cloud environments disallow background processes
- SQLite file locking breaks on network filesystems (NFS/SMB)
- The background sync can conflict with manual Git operations
- **Beads doesn’t run well inside Claude Code Cloud/desktop sandbox**

This motivated alternatives that retain Beads’ benefits with simpler, more
environment-agnostic designs.

**January 2026 Update:** Beads has seen rapid development alongside Gas Town:
- Steve Yegge merged **17 PRs in one day** on Beads alone
- The **GUPP Principle** ("Git Up and Push Protocol") addresses context window
  management: “If there is work on your hook, YOU MUST RUN IT”
- Beads expects to be in the **LLM training corpus** soon, improving how naturally
  agents use it

### TBD: A Git-Native Beads Successor

**TBD (To Be Done)** is a drop-in replacement for Beads that emphasizes *durability,
simplicity, and cross-environment compatibility*. Key design differences:

| Aspect | Beads | TBD |
| --- | --- | --- |
| Storage | SQLite + JSONL | Individual Markdown files |
| Background process | Required daemon | None |
| Sync mechanism | Continuous daemon | On-demand CLI |
| Network filesystem | Problematic | Works fine |
| Cloud sandbox | Doesn't work | Works anywhere |
| Merge conflicts | Common in JSONL | Rare (one file per issue) |

**TBD’s design philosophy:**
- Each issue is a separate Markdown file with YAML front-matter
- All issue files live on a dedicated Git **sync branch**, keeping main clean
- No SQLite locks or daemon needed—just Git and filesystem
- Can "npm install -g tbd **anywhere**: local dev, CI, cloud IDEs, network filesystems"

**Trade-offs:** TBD uses **“advisory” claims** rather than atomic locks.
If two agents claim the same task simultaneously, a merge conflict may occur—TBD detects
this and preserves both versions in an “attic” (last-write-wins with conflict
resolution).
This makes TBD **ideal for async or loosely coupled multi-agent workflows**,
but for tight real-time hand-offs, something like Agent Mail is still needed on top.

### Other Git-Native Issue Trackers

The trend toward git-native issue tracking for agents includes:

- **git-bug** — Distributed bug tracker embedded in Git (Go, ~1.7k stars)
- **SCIIT** — Issues stored as block comments in source code, tracked via Git hooks
- **git-issue** — Decentralized issue management by Diomidis Spinellis
- **Ticket** — Simple Bash-based ticket tool

All embrace simplicity, no always-on services, and Git for distribution.

* * *

## Part 2: Multi-Agent Orchestration Frameworks

### Gas Town: Full Multi-Agent Orchestrator (Built on Beads)

While Beads is a passive issue tracker, **Gas Town** is Steve Yegge’s ambitious attempt
to build a full **multi-agent orchestrator** on top of Beads.
Released January 1, 2026, it’s described as a *“multi-agent orchestration system for
Claude Code with persistent work tracking”*.

**Architecture concepts (Mad Max themed):**
- **Mayor** — Coordinator agent with full context of all ongoing work
- **Polecats** — Ephemeral worker agents that spawn, complete a task, and disappear
- **Rigs** — Projects under development, each linked to a Git repo
- **Convoys** — Bundles of tasks assigned to an agent as a batch
- **Mailboxes** — Inter-agent message passing (inspired by Agent Mail)

Gas Town lets a developer launch and manage **20-30 Claude Code agents in parallel**,
dividing work among them and preserving context across agent restarts.

Gas Town adds several orchestration features: **“Convoys”** bundle multiple tasks to
assign to an agent as a batch, and built-in **mailboxes/handoffs** allow agents to send
messages or “email” each other tasks and results asynchronously.
Gas Town also defines **persistent agent identities** via special “Role beads” and
“Agent beads”—giving each agent a stable address and profile in the task database.

Yegge built Gas Town after reaching the limits of manually juggling 10+ agents ("Stage
7" in his terms), envisioning it as *“like Kubernetes, but for agents.”*

**January 2026 growth:**
- **100+ PRs merged** from nearly 50 contributors
- **44k lines of code** added, growing to **189k lines of Go code** total
- **2,684 commits** since Dec 15th first commit
- Yegge merged **25 PRs in one day** on Gas Town and **17 PRs** on Beads
- Supports multiple backends: Claude Code CLI (default) and OpenAI Codex CLI (optional)

**Real-time coordination and safety:** Gas Town is an **aggressive YOLO setup**—Yegge
warns it’s for experienced “chimp wranglers” at the frontier.
All agents run with high autonomy, so mistakes can happen fast.
Gas Town mitigates risk by persisting everything and using Git as a safety net.
Multiple agents might fix the same bug in different ways, and a human (or mayor) later
“picks the winner.” The philosophy is high throughput over perfection—an **“AI coding
factory”** with you as the manager overseeing a swarm of coding agents.

**Caveats:**
- Inherits Beads’ SQLite dependency—best for local Unix-like environments
- Requires Go 1.23+, Git 2.25+, tmux, and Beads v0.44+
- A GAS token crypto scam emerged (released Jan 13, peaked at 4 cents, fully pumped and
  dumped by Jan 19)—unrelated to the open-source project

### Moltbot (formerly Clawdbot)

A major new entrant with **68,000+ GitHub stars**, created by PSPDFKit founder Peter
Steinberger. Rebranded from “Clawdbot” after an Anthropic trademark challenge.

**Key differentiators:**
- **Headless execution** — Bypasses GUI entirely, executing shell commands at machine
  speed
- **Multi-platform messaging bridge** — Connects WhatsApp, Telegram, Discord, iMessage
  to coding agents
- **Multi-agent routing** — Routes provider accounts to isolated agents with per-agent
  sessions
- **Hierarchical orchestration** — Supervisor agents delegating to specialists
- **Cross-platform orchestration** — Coordinates between Codex, Cursor, Manus, and other
  tools

Unlike most orchestrators assuming same-machine execution, Moltbot’s messaging bridge
enables coordination across different platforms and environments.

### Claude Squad

Terminal app by smtg-ai managing multiple agents (Claude Code, Aider, Codex, OpenCode,
Amp):
- Uses **tmux** for isolated terminal sessions
- Uses **git worktrees** to isolate codebases (each session on its own branch)
- Supports **auto-accept/YOLO mode** for background task completion
- Install: `brew install claude-squad`

### Conductor (Melty Labs)

macOS app for parallel agent orchestration:
- Runs multiple Claude Code/Codex agents simultaneously
- Each agent gets isolated **git worktree** workspace
- Tight integration with **Linear** and **GitHub**
- See who’s working, who’s stuck, and what changed in one UI
- **Free** (no subscription), but **Apple Silicon only**

### Code Conductor (Open Source)

GitHub-native orchestration (github.com/ryanmac/code-conductor):
- Agents claim tasks, implement, and ship autonomously
- **Zero merge conflicts** via isolated worktrees
- GitHub-native—no external dependencies

### Oh My Claude (OMC)

Transforms Claude Code into multi-agent system:
- **32 specialized agents** and **40 skills**
- Zero learning curve
- **Sisyphus variant** — 11 specialized agents (Oracle, Prometheus, etc.)
  working continuously
- 18 lifecycle hooks, LSP and AST tools integration

* * *

## Part 3: Inter-Agent Communication

### MCP Agent Mail

**MCP Agent Mail** by Jeffrey Emanuel focuses specifically on inter-agent communication
and coordination. As Steve Yegge put it: *“Beads gives the agents shared memory, and MCP
Agent Mail gives them messaging… and that’s all they need.”*

**What Agent Mail provides:**
- Local **HTTP server ("MCP server")** for sending messages like email threads
- Each agent gets an **inbox and outbox** stored in a git-tracked archive
- **Agent identities** and lightweight “threads” for conversation context
- **Advisory file locking (reservations)** — agents request leases on files before
  modifying

The file reservation system addresses a key challenge: two agents editing the same file
can interfere or cause merge conflicts.
Agents request reservations via the mail server, and others avoid those files until the
lease expires. This is analogous to the “file check-out” approach of old source control
systems—Jeffrey even jokes it resembles his 1990s Accenture workflow where only one dev
could edit a file at once.
But in practice, he found that AI agents **“just figure it out”** and coordinate without
trouble—the agents negotiate via messages who works on what, often deciding a leader
among themselves.

**Git worktree support:** Agent Mail also supports working with a **Git worktree model**
(multiple working copies of the repo for each agent) as an alternative to single-folder
mode. Jeffrey modified Agent Mail to support worktrees, which avoids needing file locks
entirely—each agent works on its own branch and merges via Git.

**January 2026 updates:**
- **Automated message checking hooks** — Addressed complaint that agents forget to check
  messages; now works for Claude Code, with Codex and Gemini support coming
- **Commercial companion app** — Emanuel built using 7 Codex instances simultaneously,
  400 agent messages for complete implementation
- **Mobile app** — Provision and steer fleets of agents from iOS, broadcast
  instructions, enforce confirmation for dangerous actions

**Emanuel’s recommended stack:**
- Agent Mail MCP + warp-grep MCP + playwright MCP (for frontend)
- CLI tools: Beads, bv (Beads viewer), ubs, cass
- Enables running **10+ agents simultaneously** on complex projects

**The “Agent Village” concept:** Beads + Agent Mail = an environment where many agents
work in parallel, share a memory of tasks, and communicate like a small team.
This concept boosts productivity substantially: Jeffrey claims using 10+ agents with
this setup gave him effectively dozens of hours of work done in parallel for each human
hour, thanks to machine-speed typing and coordination.

Agent Mail also has a **companion mobile app and automation layer** (a commercial
offering) that allows provisioning and steering fleets of agents from an iOS app, with
features like broadcasting instructions to all agents and enforcing confirmation for
dangerous actions. This shows one possible future: an **“Agent HQ”** where a human
overseer can manage many agents remotely.

### Google’s A2A (Agent-to-Agent) Protocol

The **only purpose-built protocol** for cross-machine agent coordination, launched by
Google in April 2025 and now donated to the Linux Foundation.

**Key features:**
- **150+ organizations** supporting (Atlassian, Salesforce, SAP, Box, Cohere, etc.)
- JSON-RPC over HTTP with Server-Sent Events for streaming
- Agents expose **“Agent Cards”** at `/.well-known/agent.json` for discovery
- Version 0.3 released with gRPC support and security card signing

**A2A vs MCP:** | Protocol | Purpose | Scope | |----------|---------|-------| | MCP |
Agent-to-tool communication | How agents access tools and resources | | A2A |
Agent-to-agent communication | How agents collaborate with each other |

A hybrid approach using both protocols is emerging as the recommended pattern.

**Key capability:** “A2A enables cross-network collaboration—supporting the
collaboration of agents operating in different distributed network environments, such as
other clouds or multi-tenant systems.”

### MCP Remote Servers

MCP was designed for local tool connections but **can work remotely**:
- `MCPServerStdio` class for local subprocess servers
- `MCPServerSse` class for HTTP-based remote servers
- Can combine local and remote servers in one agent
- Cross-System Agent Communication MCP Server exists for multi-system coordination

* * *

## Part 4: Event-Driven Triggers and GitHub Automation

A key question for distributed agent workflows: **How do you trigger Claude Code
instances based on external events?**

### GitHub-Triggered Claude Code

**Official: Claude Code GitHub Actions** (github.com/anthropics/claude-code-action)

The official GitHub Action brings AI-powered automation to GitHub workflows:
- **Trigger**: `@claude` mention in any PR or issue comment
- **Workflow events**: `pull_request`, `issue_comment`, `issues`, `push`
- **Setup**: Run `/install-github-app` in Claude Code terminal

```yaml
# Example: Wake up Claude on any @claude mention
name: claude-responder
on:
  issue_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
```

**Claude Hub** (claude-did-this.com) — More autonomous webhook service:
- Complete end-to-end development workflows
- Implements features, reviews code, merges PRs, waits for CI, runs for hours
- Microservice architecture with container isolation and webhook verification
- **60-80% reduction** in manual review time claimed

### The Bot-to-Bot Problem

**Critical insight:** Most GitHub bot frameworks **explicitly prevent** bot-to-bot
communication to avoid infinite loops:

```yaml
# Standard anti-loop pattern
if: ${{ github.event.sender.type != 'Bot' }}
```

This is why scenarios like “Bot A files PR → Bot B reviews → Bot A responds” aren’t
built-in patterns—they’re considered anti-patterns.

**Workarounds for intentional bot-to-bot coordination:**

1. **Human-in-the-loop** — Use specific commands like `@claude-reviewer` vs
   `@claude-implementer` requiring human trigger

2. **State machine via GitHub** — Use PR labels/status checks as coordination mechanism
   rather than comment chains

3. **External orchestrator** — Have a central service manage agent-to-agent
   communication, only triggering GitHub when needed

**Example: Multi-Bot Workflow via GitHub Actions**

```yaml
# Workflow 1: Implementer bot
name: claude-implementer
on:
  issues:
    types: [assigned]
jobs:
  implement:
    if: contains(github.event.issue.labels.*.name, 'needs-implementation')
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: "Implement this feature and file a PR"

# Workflow 2: Reviewer bot (triggered by PR from implementer)
name: claude-reviewer
on:
  pull_request:
    types: [opened]
jobs:
  review:
    if: github.event.pull_request.user.login == 'claude-implementer-bot'
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: "Review this PR and request changes if needed"

# Workflow 3: Implementer responds to review
name: claude-respond-to-review
on:
  pull_request_review:
    types: [submitted]
jobs:
  respond:
    if: github.event.review.user.login == 'claude-reviewer-bot'
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: "Address the review feedback"
```

### Claude Code Hooks System

Claude Code provides hooks for event-driven behavior within sessions:

| Event | When It Fires | Use Case |
| --- | --- | --- |
| `PreToolUse` | Before Claude performs an action | Validation |
| `PostToolUse` | After Claude completes an action | Cleanup, logging |
| `Stop` | When Claude finishes responding | Trigger next steps |
| `SubagentStop` | When a subagent finishes | Coordinate subagent work |
| `SessionStart` | Session begins or resumes | Load context, set up environment |
| `SessionEnd` | Session terminates | Cleanup, sync state |

Hooks can perform async operations like HTTP requests, enabling webhook integration
within Claude Code sessions.

* * *

## Part 5: Cross-Machine Coordination

Most multi-agent frameworks assume **same-machine execution**. True cross-machine
coordination remains a significant gap in the ecosystem.

### Current State Comparison

| Framework | Same Machine | Cross-Machine | Notes |
| --- | --- | --- | --- |
| Gas Town / Beads | Yes | No (Git sync only) | Requires local SQLite, daemon |
| Agent Mail (MCP) | Yes | Partial | HTTP server could be networked |
| Claude Squad | Yes | No | tmux/worktree based |
| Conductor | Yes | No | macOS only |
| Moltbot | Yes | Partial | Messaging bridge approach |
| **A2A Protocol** | Yes | **Yes** | Purpose-built for this |
| **MCP Remote Servers** | N/A | **Yes** | Emerging pattern |

### claude-code-by-agents

The **closest existing tool** for cross-machine Claude Code coordination
(github.com/baryhuang/claude-code-by-agents):

- Desktop app and API for multi-agent orchestration
- Coordinates **local AND remote agents** through @mentions
- Supports routing to: `localhost:8081`, `mac-mini.local:8081`, `cloud-instance:8081`
- @mentions route to specific agents; orchestrator handles coordination
- File-based communication with automatic dependency management

### What Doesn’t Exist (The Gap)

**For Claude Code Cloud specifically:**
- **No native instance-to-instance communication** — sessions are isolated
- **No official orchestration API** for cloud instances
- **Teleport (`/tp`)** only brings sessions to your terminal, doesn’t connect them

**Architecture needed for cross-instance coordination:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestration Layer                       │
│  (GitHub webhook handler / A2A server / custom service)      │
└─────────────────────────────────────────────────────────────┘
        ↓ spawn/trigger         ↓ spawn/trigger
┌───────────────┐         ┌───────────────┐
│ Claude Code   │ ←─────→ │ Claude Code   │
│ Cloud #1      │  (via   │ Cloud #2      │
│               │   Git)  │               │
└───────────────┘         └───────────────┘
```

The coordination would happen through:
1. **GitHub** as the message bus (commits, PRs, issues)
2. **TBD sync branch** as shared state
3. **External orchestrator** to trigger new instances

* * *

## Part 6: Execution Environments

### Sprites.dev (Fly.io)

**Sprites** are stateful sandbox environments with checkpoint & restore—lightweight,
Firecracker-based VMs designed for AI coding agents.
Launched January 2026.

**Philosophy:** “Ephemeral sandboxes are obsolete.
Stop killing your sandboxes every time you use them.”

**Key features:**
- Boot in **1-12 seconds** with **100GB persistent storage**
- Auto-idle when inactive (stops billing, preserves state)
- Last 5 checkpoints mounted at `/.sprite/checkpoints`
- Pre-installed: Claude Code, Codex CLI, Python, Node
- Checkpoints restore in **~300ms**
- **500 Sprites free** with trial credits
- **Open-source local version coming** per Fly.io developer Thomas Ptacek

**Use cases for multi-agent orchestration:**
- Spawn 5 Sprites, each with Claude Code isolated from your main system
- Run Agent Mail server in one Sprite, agents in others communicate over private network
- Checkpoint before risky operations, rollback on failure
- Per-VM network policy (allow/restrict internet access)

**Security context:** Simon Willison predicts “we’re due a Challenger disaster with
respect to coding agent security”—Sprites addresses this with VM isolation.
If an agent goes haywire, it only damages its VM (which you can snapshot or wipe).

### Other Execution Options

- **Docker containers** — Lighter than VMs but less isolated
- **Firecracker microVMs** — What Sprites uses under the hood
- **GitHub Codespaces** — Cloud dev environments (can run TBD, limited multi-agent)
- **Claude Code Cloud** — Anthropic’s managed sandbox (isolated sessions, no cross-talk)

* * *

## Part 7: Claude Code’s Native Multi-Agent Features

### Hidden TeammateTool (Discovered January 24, 2026)

The community discovered that **Claude Code v2.1.19 contains a fully-built multi-agent
orchestration system** hidden behind feature flags.

**TeammateTool** (extracted from the binary) supports 13 core operations:
- `spawnTeam` / `discoverTeams` / `requestJoin`
- `assignTask` / `broadcastMessage` / `voteOnDecision`
- And more coordination primitives

**Tools to access it:**

| Tool | Approach | URL |
| --- | --- | --- |
| CC Mirror | Unlocks hidden feature, zero dependencies | github.com/numman-ali/cc-mirror |
| claude-sneakpeek | Parallel build with flags enabled | github.com/mikekelly/claude-sneakpeek |
| Claude-Flow | Third-party using native TeammateTool | github.com/ruvnet/claude-flow |

**CC Mirror** turns Claude into “The Conductor” that decomposes work into dependency
graphs, spawning background agents to execute in parallel while the lead continues
working.

**Warning:** The feature is experimental with “documented reliability issues”—not
recommended for production yet.
“Swarms mode is feature-flagged for good reasons.”

### The Task Tool (Official)

Claude Code’s official agent orchestration via the Task tool:
- Spawn specialized sub-agents that work independently
- Run in background without blocking workflow
- Return results to main session
- Each subagent type has specific tools available

### Anthropic’s Official Multi-Agent Research

Anthropic published details of their internal architecture:
- **Orchestrator-worker pattern** with Claude Opus 4 as lead and Claude Sonnet 4
  subagents
- **90.2% improvement** over single-agent Opus 4 on internal research evaluations
- Agents use **4× more tokens** than chat; multi-agent uses **15× more**

**Claude Cowork** (launched January 12, 2026):
- Autonomous agent operating as a “digital colleague”
- Manages file systems, orchestrates workflows, executes multi-step tasks
- Anthropic signals “multi-agent orchestration” as the next major milestone

**Important distinction:** Cowork is not exactly multiple agents—it’s **one Claude
executing a chain of tool-using actions**. But it’s a step toward an orchestrator-like
experience for end users.
Anthropic positions Cowork as a glimpse of the future where powerful coding agents are
more autonomous and can handle complex workflows beyond just Q&A chat—described as a
“general agent… well positioned to bring the wildly powerful capabilities of Claude Code
to a wider audience.”
Instead of requiring a power-user to manually orchestrate many Claude instances via tmux
(a la Gas Town), Anthropic might eventually provide a more **user-friendly
orchestrator** where Claude itself manages subtasks.
It wouldn’t be surprising if future versions allow something like “Claude spawns Claude”
internally.

* * *

## Part 8: IDE and Platform Integrations

### Current State

IDE-based AI coding assistants (Cursor, VS Code Copilot, etc.)
are typically **single-agent affairs**. They excel at inline code suggestions and
one-at-a-time commands but **do not inherently support multiple agents concurrently**.

As Yegge’s “Dev Evolution” stages illustrate:
- **Stage 2-3:** Coding agent in IDE, maybe YOLO mode (most developers in 2024-2025)
- **Stage 6:** CLI, multi-agent, YOLO
- **Stage 7+:** Orchestrators like Gas Town

The jump to Stage 6 and beyond requires stepping outside the typical IDE plugin UI and
using CLI-based tools.

**VS Code experiments:** Third-party VSCode extensions experiment with agent
orchestration—for instance, **Continue** is an extension that allows the AI to run
iterative loops on code changes (somewhat like an agent refining code continuously).
There are also community projects where people run multiple VSCode instances each with a
coding agent and coordinate them manually via a shared repo—these are ad-hoc though, and
the real structured solutions are emerging outside the IDE, in the CLI/cloud space.

### OpenAI Codex Integrations

**Codex CLI** is analogous to Claude Code—open source, built in Rust:
- Run as **MCP server mode** for other agents to connect
- **Agents SDK** for orchestrating multiple Codex instances with hand-offs
- Full traces capturing every prompt, tool call, hand-off

**Slack integration:**
- Mention `@Codex` in a Slack channel to kick off coding tasks
- Spins up cloud task in OpenAI’s managed sandbox
- Posts diffs/answers back to thread
- Multiple threads can run different tasks concurrently

**GitHub integration:**
- Opens PRs, comments on issues
- **Linear integration** for issue tracking

### Gemini CLI (January 27, 2026)

Google’s new open-source AI agent under Apache 2.0:
- **Free tier:** 60 requests/min, 1,000/day with personal Google account
- **1M token context window** with Gemini 3 models
- Built-in: Google Search, file operations, shell commands, web fetch
- **MCP-extensible** for custom integrations
- Uses ReAct (reason and act) loop for complex use cases

* * *

## Part 9: Industry Trends and Future Directions

### Market Trends (2026)

**Gartner reports:**
- **1,445% surge** in multi-agent system inquiries Q1 2024 → Q2 2025
- Predicts **40% of enterprise applications** will embed AI agents by end of 2026 (up
  from <5% in 2025)
- Market projection: **$7.8B → $52B by 2030**

**Architectural shift:** From monolithic agents to “puppeteer” orchestrators
coordinating specialist agents—the “microservices revolution” for AI agents.

### Emerging Best Practices

- **3-7 agents** work best for most workflows; above 7, use hierarchical structures with
  team leaders
- Implement **retry logic with exponential backoff** for temporary failures
- Use **circuit breakers** to prevent cascading failures across agents
- Hybrid approach: **MCP for tool connections + A2A for agent coordination**

### Future Directions

**Convergence of Memory and Messaging:**
- Gas Town already uses Beads for both data and messaging
- OpenAI’s MCP aims to handle context sharing and tool usage in one protocol
- Likely emergence of unified “Agent Orchestration Server” handling both persistent
  storage of work items and real-time message passing
- MCP (Model Context Protocol) is openly specified—one could implement their own server
  if desired, and we may see hosted versions (e.g., OpenAI could offer a managed
  coordination server as part of their platform)

**Deeper Dev Ecosystem Integration:**
- Orchestration frameworks hooking into GitHub, Jira, Slack out-of-the-box
- OpenAI Codex shows the way with Slack/GitHub/Linear integration
- Anthropic equivalent expected (Claude Slack bot, GitHub Action)
- Agents will take tasks from your issue tracker directly, update tickets, open pull
  requests, and so on—the multi-agent layer acts as a bridge between human project
  management and agent work execution
- One could imagine raising a GitHub Issue tagged in a certain way and an AI agent
  automatically picks it up to work on

**Improved UIs:**
- Gas Town expects better UIs to come
- Web dashboards showing all agent instances, tasks, progress
- Orchestration as simple as dragging tasks to an “AI” column on Kanban

**Role Specialization:**
- Beyond N identical agents: test-writer, refactorer, doc-researcher
- Different system prompts or even different models per role
- Gas Town already supports multiple model types (Claude and Codex), and Agent Mail’s
  mention of “heterogeneous fleets (Claude Code, Codex, Gemini CLI, etc.)” shows users
  are mixing models
- A flexible orchestration layer should assign tasks to the best-suited agent
- Marketplace of third-party agent “skills” (Yegge’s “Mol Mall” concept)

**Cloud vs Local Balance:**
- OpenAI’s managed Codex tasks vs self-hosted approaches
- GitHub as central store (TBD pushing to repo) + lightweight messaging service
- Frameworks like OpenAI Agents SDK making orchestration mostly configuration
- It might even be possible to use GitHub Issues or Discussions as a makeshift
  coordination backend (agents could post messages there)—though purpose-built solutions
  are likely more efficient and secure
- Some people have already had agents manage multiple branches concurrently for
  different features

* * *

## Practical Recommendations

For teams seeking to coordinate Claude Code instances today, a combination of approaches
can work:

1. **Task Tracking:** Use **TBD** (or Beads if local-only) to persist tasks on GitHub
   with minimal friction

2. **Real-time Coordination:** Use **Agent Mail (MCP)** for task handoff between agents,
   possibly with each agent in a Sprite VM for safety

3. **GitHub-Triggered Workflows:** Use **Claude Code Action** for @mention-triggered
   automation; chain workflows for multi-bot coordination

4. **Cross-Machine:** Currently requires external orchestrator—consider **A2A protocol**
   or **claude-code-by-agents** for remote agent coordination

5. **Execution Environment:** **Sprites** for isolated, persistent VMs; local Docker for
   lighter-weight isolation

6. **Slack Integration:** Consider leveraging Slack integration (OpenAI’s Codex Slack
   bot is a model—you could create a Claude Slack bot analog using the Claude API and
   your coordination layer)

7. **GitHub as Coordination:** If real-time isn’t critical, using GitHub issues or PRs
   as the place where Claude agents look for work can be effective—one agent could post
   a fix as a PR, another (or a human) could review/merge, all tracked in GitHub

The “best” mechanism depends on how much real-time concurrency vs.
simplicity you need.
The bias is towards flexible, CLI-first infrastructure that can run anywhere—local,
cloud, Codespaces, Sprites—since they’re just Git and simple services.

All these tools are quickly evolving.
Pioneers like Yegge’s Gas Town + Beads and Emanuel’s Agent Mail illustrate the
possibilities (and pitfalls) of DIY solutions—they’ve massively increased coding
throughput for early adopters.
Now, with efforts like TBD (making the core tracking more reliable across platforms) and
big players like Anthropic and OpenAI formalizing orchestration capabilities (Cowork,
MCP, etc.), we’re likely to see these capabilities become more accessible.

The future likely holds even more **turnkey orchestration services** (perhaps even a
dedicated “Claude Orchestrator” product from Anthropic eventually, or third-party
platforms built around this idea).
Until then, mixing and matching the open-source solutions discussed here is the state of
the art.

* * *

## References

### Beads and Gas Town (Steve Yegge)

- [Welcome to Gas Town](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
  — January 2026 launch post
- [Gas Town Emergency User Manual](https://steve-yegge.medium.com/gas-town-emergency-user-manual-cf0e4556d74b)
  — Updated guide
- [The Future of Coding Agents](https://steve-yegge.medium.com/the-future-of-coding-agents-e9451a84207c)
  — Vision post
- [Beads Best Practices](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c)
  — Agent Village concept
- [GitHub: steveyegge/gastown](https://github.com/steveyegge/gastown) — Gas Town
  repository
- [GAS Token Crypto Scam - Pivot to AI](https://pivot-to-ai.com/2026/01/22/steve-yegges-gas-town-vibe-coding-goes-crypto-scam/)
  — Coverage of the unrelated GAS token pump-and-dump

### Agent Mail (Jeffrey Emanuel)

- [GitHub: Dicklesworthstone/mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail)
  — Main repository
- [Jeffrey Emanuel on automated hooks](https://x.com/doodlestein/status/2005311608961040826)
  — December 2025 update
- [Jeffrey Emanuel on companion app](https://x.com/doodlestein/status/1985405083488755740)
  — Commercial development

### Moltbot

- [Moltbot Guide - DEV Community](https://dev.to/czmilo/moltbot-the-ultimate-personal-ai-assistant-guide-for-2026-d4e)
- [What is Moltbot? -
  DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-moltbot)
- [Moltbot Documentation](https://docs.molt.bot/)

### Claude Code Multi-Agent Features

- [Claude Code’s Hidden Multi-Agent Orchestration - The Unwind AI](https://www.theunwindai.com/p/claude-code-s-hidden-multi-agent-orchestration-now-open-source)
- [Unlocking Claude Code’s Hidden Swarm Mode - DEV Community](https://dev.to/tinaba96/unlocking-claude-codes-hidden-swarm-mode-how-to-spawn-an-ai-engineering-team-with-one-command-4ng4)
- [Claude Code’s Hidden Multi-Agent System - paddo.dev](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [GitHub: numman-ali/cc-mirror](https://github.com/numman-ali/cc-mirror) — CC Mirror
- [Numman Ali on CC Mirror - X](https://x.com/nummanali/status/2007768692659015877) — CC
  Mirror announcement
- [GitHub: mikekelly/claude-sneakpeek](https://github.com/mikekelly/claude-sneakpeek) —
  Feature flag bypass
- [GitHub: ruvnet/claude-flow](https://github.com/ruvnet/claude-flow) — Claude-Flow
  orchestration

### Anthropic Official

- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Cowork Announcement](https://markets.financialcontent.com/wss/article/tokenring-2026-1-19-anthropic-unveils-claude-cowork-the-first-truly-autonomous-digital-colleague)
- [First impressions of Claude Cowork - Simon Willison](https://simonw.substack.com/p/first-impressions-of-claude-cowork)
  — Detailed analysis of Cowork as a general agent
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [GitHub: anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)

### Orchestration Tools

- [GitHub: smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) — Claude Squad
- [Conductor](https://www.conductor.build/) — Melty Labs macOS app
- [GitHub: ryanmac/code-conductor](https://github.com/ryanmac/code-conductor) —
  GitHub-native
- [Oh My Claude - Medium Review](https://medium.com/@joe.njenga/i-tested-oh-my-claude-code-the-only-agents-swarm-orchestration-you-need-7338ad92c00f)
- [GitHub: baryhuang/claude-code-by-agents](https://github.com/baryhuang/claude-code-by-agents)
  — Cross-machine

### Protocols and Standards

- [A2A Protocol Documentation](https://a2a-protocol.org/latest/)
- [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [Microsoft: A2A Communication on MCP](https://developer.microsoft.com/blog/can-you-build-agent2agent-communication-on-mcp-yes)
- [Integrating Multiple MCP Servers - CodeSignal](https://codesignal.com/learn/courses/advanced-mcp-server-and-agent-integration-in-python/lessons/integrating-and-coordinating-multiple-mcp-servers-with-a-python-agent)
  — Guide to combining local and remote MCP servers

### Execution Environments

- [Sprites.dev](https://sprites.dev/) — Fly.io stateful sandboxes
- [Simon Willison on Sprites](https://simonwillison.net/2026/Jan/9/sprites-dev/)
- [Fly.io Sprites Announcement](https://devclass.com/2026/01/13/fly-io-introduces-sprites-lightweight-persistent-vms-to-isolate-agentic-ai/)

### OpenAI Codex

- [Codex CLI](https://developers.openai.com/codex/cli/)
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk/)
- [Use Codex in Slack](https://developers.openai.com/codex/integrations/slack/)
- [How OpenAI’s Codex for Slack enhances team collaboration - LinkedIn](https://www.linkedin.com/posts/denisedresser_codex-is-now-generally-available-activity-7381464835588460544-p6k7)
  — Discussion of Codex Slack integration

### Google Gemini

- [GitHub: google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI Documentation](https://developers.google.com/gemini-code-assist/docs/gemini-cli)

### TBD (To Be Done)

- TBD Design Specification — Internal design document for the git-native issue tracker

### Industry Analysis

- [7 Agentic AI Trends to Watch in 2026 - MachineLearningMastery](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)
- [8 Best Multi-Agent AI Frameworks for 2026](https://www.multimodal.dev/post/best-multi-agent-ai-frameworks)
- [Claude Hub - Claude Did This](https://claude-did-this.com/)
- [PR-Agent by Qodo](https://github.com/qodo-ai/pr-agent)

### GitHub Integrations

- [Integrating Claude Code with GitHub Actions - Steve Kinney](https://stevekinney.com/courses/ai-development/integrating-with-github-actions)
- [Multiple branches and agents - Reddit](https://www.reddit.com/r/codex/comments/1o09pgj/multiple_branches_and_agents_working_at_the_same/)
