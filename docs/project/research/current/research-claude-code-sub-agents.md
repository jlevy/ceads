# Research: Claude Code Sub-Agents — Architecture, Models, and Orchestration Patterns

**Date:** 2026-02-13 (last updated 2026-02-13)

**Author:** Research brief (AI-assisted)

**Status:** In Progress

**Related:**

- [Running Claude Code Across Environments](research-running-claude-code.md)
- [Agent Coordination Kernel](research-agent-coordination-kernel.md)

---

## Overview

This document investigates how Claude Code's sub-agent system works: what models
sub-agents use, how to control them, how context flows between parent and
sub-agents, and how the system behaves across different environments (local CLI,
VS Code, cloud). It also explores advanced orchestration patterns including
loops, nested invocations ("Ralph Wiggum loops"), and custom compaction cycles.

## Questions to Answer

1. How do Claude Code sub-agents work and what models do they use?
2. How do you ensure Opus runs on both the outer agent and all sub-agents?
3. How does context transfer work between parent and sub-agents?
4. Are there differences across environments (CLI, VS Code, desktop, cloud)?
5. What are emerging best practices for sub-agent usage?
6. Can sub-agents be orchestrated in loops or complex patterns?
7. How does Claude-code-invoking-Claude-code compare to native sub-agents?
8. Can we implement custom compaction/handoff cycles?

## Scope

- **Included:** Claude Code's built-in sub-agent system (Task tool), custom
  sub-agents, agent teams, headless mode (`claude -p`), Agent SDK, model
  configuration across environments
- **Excluded:** Third-party orchestrators (Gas Town, Claude Squad, etc.) covered
  in the companion research doc; MCP server architecture; Anthropic API-level
  multi-agent patterns outside Claude Code

---

## Findings

### 1. Sub-Agent Architecture and Built-in Types

Claude Code's sub-agent system works through the **Task tool**, which spawns
specialized AI assistants that handle specific types of tasks. Each sub-agent
runs in its **own context window** with a custom system prompt, specific tool
access, and independent permissions. When Claude encounters a task matching a
sub-agent's description, it delegates to that sub-agent, which works
independently and returns results.

**Critical architectural constraint:** Sub-agents **cannot spawn other
sub-agents**. This prevents infinite nesting. If a workflow requires nested
delegation, the main conversation must chain sub-agents sequentially.

#### Built-in Sub-Agent Types

| Sub-Agent         | Default Model | Tools Available                      | Purpose                                       |
| ----------------- | ------------- | ------------------------------------ | --------------------------------------------- |
| **Explore**       | **Haiku**     | Read-only (no Write/Edit)            | File discovery, code search, codebase exploration |
| **Plan**          | Inherits      | Read-only (no Write/Edit)            | Codebase research for plan mode               |
| **General-purpose** | Inherits    | All tools                            | Complex research, multi-step operations       |
| **Bash**          | Inherits      | Bash                                 | Running terminal commands in separate context |
| **statusline-setup** | **Sonnet** | Read, Edit                           | Configuring status line                       |
| **Claude Code Guide** | **Haiku** | Glob, Grep, Read, WebFetch, WebSearch | Answering questions about Claude Code features |

**Key insight: Yes, sub-agents do use less capable models by default.** The
Explore sub-agent (one of the most commonly invoked) defaults to **Haiku**, not
Opus. The Claude Code Guide sub-agent also uses Haiku. This means that when
Claude Code delegates codebase exploration or self-help queries, it's running on
a faster but less capable model. The Plan and General-purpose sub-agents
**inherit** the parent model (e.g., Opus if that's what you're running).

### 2. Model Selection and Control

#### How Sub-Agent Models Are Determined

The model for each sub-agent is determined by a priority chain:

1. **`CLAUDE_CODE_SUBAGENT_MODEL`** environment variable — overrides model for
   **all** sub-agents globally
2. **Per-sub-agent `model` field** — set in the sub-agent's frontmatter
   configuration (for custom sub-agents) or hardcoded (for built-in sub-agents)
3. **`inherit`** — if model is omitted or set to `inherit`, uses the main
   conversation's model

Available model aliases for the `model` field: `sonnet`, `opus`, `haiku`, or
`inherit`.

#### How to Force Opus on All Sub-Agents

**Method 1: Environment variable (recommended for blanket override)**

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
claude
```

Or in settings.json:

```json
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}
```

This forces every sub-agent — including Explore and Claude Code Guide — to use
Opus instead of Haiku.

**Method 2: Custom sub-agents with explicit model**

Create custom sub-agents in `~/.claude/agents/` or `.claude/agents/` with
`model: opus`:

```yaml
---
name: my-explorer
description: Explore codebase using Opus
tools: Read, Grep, Glob
model: opus
---

You are a codebase exploration specialist...
```

**Method 3: CLI-defined sub-agents**

```bash
claude --agents '{
  "opus-explorer": {
    "description": "Explore codebase with Opus model",
    "prompt": "You are a codebase explorer...",
    "tools": ["Read", "Grep", "Glob"],
    "model": "opus"
  }
}'
```

**Method 4: Disable specific built-in sub-agents**

You can prevent Claude from using the Haiku-based Explore sub-agent:

```json
{
  "permissions": {
    "deny": ["Task(Explore)"]
  }
}
```

Or via CLI: `claude --disallowedTools "Task(Explore)"`

This forces Claude to use the General-purpose sub-agent (which inherits your
model) instead.

#### Model Alias Resolution

The model aliases always point to the latest versions:

| Alias    | Current Model (Feb 2026) |
| -------- | ----------------------- |
| `opus`   | Opus 4.6                |
| `sonnet` | Sonnet 4.5              |
| `haiku`  | Haiku (latest)          |

To pin to a specific version, use the full model name (e.g.,
`claude-opus-4-6`). Override the aliases via environment variables:

| Environment Variable             | Overrides Alias |
| -------------------------------- | --------------- |
| `ANTHROPIC_DEFAULT_OPUS_MODEL`   | `opus`          |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet`        |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL`  | `haiku`         |

#### Cost Considerations

Using Opus for all sub-agents significantly increases token costs. Anthropic's
multi-agent research system uses Opus as lead with Sonnet sub-agents
specifically to balance capability and cost. The `opusplan` alias provides a
hybrid: Opus for planning, Sonnet for execution.

**Token usage scales with sub-agents:** Each sub-agent has its own context
window. Running many sub-agents that each return detailed results can consume
significant context in the parent. Agent teams use even more tokens, with each
teammate being a separate Claude instance.

### 3. Context Transfer Between Parent and Sub-Agents

#### What Sub-Agents Receive

Sub-agents receive:
- Their **system prompt** (from the markdown body of the sub-agent definition)
- Basic **environment details** (working directory, etc.)
- The **prompt** passed by the parent agent via the Task tool
- If custom sub-agent: preloaded **skills** content (via `skills` field)
- If persistent memory enabled: contents of their **memory directory**

Sub-agents do **NOT** receive:
- The full Claude Code system prompt
- The parent conversation's message history (with one exception — see below)
- MCP tools when running in background mode

#### "Access to Current Context"

Some sub-agent types are documented as having "access to current context."
Based on the official documentation, this means certain sub-agent types can
see the **full conversation history** before the tool call. The documentation
states:

> "Agents with 'access to current context' can see the full conversation
> history before the tool call. When using these agents, you can write concise
> prompts that reference earlier context (e.g., 'investigate the error
> discussed above') instead of repeating information. The agent will receive
> all prior messages and understand the context."

This appears to apply to the General-purpose, Plan, and Explore sub-agent
types (based on the system prompt descriptions of the Task tool). However, the
sub-agent still runs in its **own context window** — it sees the parent's
history as input context but builds its own separate conversation.

#### Customizing Context Transfer

**Via the `prompt` parameter:** The primary mechanism. The parent agent writes
a detailed prompt describing the task, and this becomes the sub-agent's initial
instruction. The quality of this prompt determines how well the sub-agent
understands what to do.

**Via skills preloading:** The `skills` field in sub-agent configuration injects
full skill content into the sub-agent's context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

**Via persistent memory:** The `memory` field gives sub-agents a persistent
directory that survives across conversations:

```yaml
---
name: code-reviewer
description: Reviews code quality
memory: user  # or: project, local
---
```

Scopes: `user` (~/.claude/agent-memory/), `project` (.claude/agent-memory/),
`local` (.claude/agent-memory-local/).

**Via the `resume` parameter:** Resuming a sub-agent continues with its **full
previous context preserved**, including all previous tool calls, results, and
reasoning. This is the most powerful way to maintain continuity.

#### Limitations of Context Transfer

1. Sub-agents don't inherit skills from the parent — must list them explicitly
2. Sub-agents don't inherit the full Claude Code system prompt
3. Background sub-agents auto-deny permission prompts not pre-approved
4. MCP tools unavailable in background sub-agents
5. When sub-agents complete, their results return to the main conversation —
   running many verbose sub-agents can consume significant context
6. Sub-agent transcripts are independent of the main conversation's compaction

### 4. Environments: CLI, VS Code, Desktop, Cloud

#### Key Finding: Model Configuration Is Environment-Agnostic

There are **no IDE-specific model settings**. Model configuration is based on
scope (user, project, local) and environment variables, not on which IDE or
runtime environment you're using. The same settings.json and environment
variables work across:

- **Local CLI** (`claude` in terminal)
- **VS Code extension** (Claude Code as VS Code plugin)
- **Desktop app** (standalone Claude Code app)
- **Claude Code Cloud** (web-based sessions)

The sub-agent mechanism is the same across all environments. The Task tool
works identically whether you're in VS Code, the desktop app, or the CLI.

#### Settings Precedence (Same Everywhere)

1. **Managed** (enterprise, cannot override)
2. **Command line arguments** (temporary session overrides)
3. **Local** (`.claude/settings.local.json` — per-project personal)
4. **Project** (`.claude/settings.json` — team-shared)
5. **User** (`~/.claude/settings.json` — personal global)

#### How to Set Model in Each Environment

| Environment   | How to Set Model                                                       |
| ------------- | ---------------------------------------------------------------------- |
| CLI           | `claude --model opus` or `ANTHROPIC_MODEL=opus` or settings.json       |
| VS Code       | settings.json (project or user level) or environment variables         |
| Desktop app   | settings.json or `/model opus` during session                          |
| Cloud         | `/model opus` during session or settings.json                          |
| Any (session) | `/model opus` to switch mid-session                                    |

#### How to Set Sub-Agent Model in Each Environment

Same approach everywhere:

```json
// settings.json (any scope)
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}
```

Or set `CLAUDE_CODE_SUBAGENT_MODEL` as an actual environment variable before
launching Claude Code.

#### Cloud-Specific Considerations

Claude Code Cloud runs in isolated, Anthropic-managed VMs that clone your
GitHub repository. Sub-agents work normally within a cloud session. However
there are important differences in how configuration reaches the environment.

**What IS available in Cloud sessions:**
- `.claude/settings.json` (project-level, committed to Git) — **YES**
- `.claude/agents/` (project-level sub-agent definitions) — **YES**
- Cloud environment dialog settings (env vars in `.env` format) — **YES**
- Server-managed settings (Enterprise/Teams) — **YES**
- `/model` command during session — **YES**

**What is NOT available in Cloud sessions:**
- `~/.claude/settings.json` (user-level) — **NO** (not in the repo)
- `.claude/settings.local.json` (gitignored) — **NO**
- Shell `export` commands — **NO** (each Bash runs in a fresh shell)

**Three methods to set `CLAUDE_CODE_SUBAGENT_MODEL` in Cloud:**

**Method 1: Cloud environment dialog (recommended for Cloud)**

On claude.ai, when adding or editing an environment, there's a dialog where
you can specify environment variables in `.env` format:

```
CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
ANTHROPIC_MODEL=opus
```

**Method 2: Project settings.json `env` field (recommended for teams)**

Commit this to your repository so it takes effect for all Cloud sessions:

```json
// .claude/settings.json (committed to git)
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}
```

**Method 3: SessionStart hook writing to CLAUDE_ENV_FILE**

For dynamic setup, a SessionStart hook can write env vars:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'export CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6' >> \"$CLAUDE_ENV_FILE\""
      }]
    }]
  }
}
```

Note: `CLAUDE_ENV_FILE` makes variables available to subsequent Bash commands
but may not affect Claude Code's internal sub-agent spawning if the variable
is only read at startup. The `env` field in settings.json is more reliable.

**Important: `export` in Bash does NOT work for sub-agent model control.**
Each Bash command runs in a fresh shell, and environment variables set within
Bash are not visible to Claude Code's agentic loop that spawns sub-agents.

**How to verify which model sub-agents are using:**

1. `/status` — shows current main model and account info
2. `/agents` — shows all sub-agents with their model configurations
3. `/model` — shows current model; use arrow keys to see effort slider
4. Sub-agent transcripts at `~/.claude/projects/{project}/{sessionId}/subagents/`
5. Ask Claude directly: "What model are your sub-agents configured to use?"

**Does `/model` affect sub-agents?** Partially:
- Sub-agents with `model: inherit` (or no model field) **will** follow `/model`
- Sub-agents with an explicit model (e.g., `model: sonnet`) **will not**
- Built-in Explore uses Haiku regardless of `/model`
- `CLAUDE_CODE_SUBAGENT_MODEL` overrides everything

**Other considerations:**
- No native instance-to-instance communication between cloud sessions
- No official orchestration API for cloud instances
- Teleport (`/tp`) brings cloud sessions to local terminal but doesn't
  connect sessions to each other
- Background sub-agents may have additional sandbox restrictions

#### Default Model by Account Type

| Account Type      | Default Model |
| ----------------- | ------------- |
| Max and Teams     | Opus 4.6      |
| Pro               | Opus 4.6      |
| Enterprise        | Opus 4.6 available but not default |

Claude Code may automatically **fall back to Sonnet** if you hit a usage
threshold with Opus. This could affect sub-agents that inherit the parent model.

### 5. Emerging Best Practices for Sub-Agents

#### When to Use Sub-Agents vs Main Conversation

**Use the main conversation when:**
- The task needs frequent back-and-forth or iterative refinement
- Multiple phases share significant context (planning → implementation → testing)
- You're making a quick, targeted change
- Latency matters (sub-agents start fresh and need time to gather context)

**Use sub-agents when:**
- The task produces verbose output you don't need in your main context
- You want to enforce specific tool restrictions or permissions
- The work is self-contained and can return a summary
- You want to isolate high-volume operations (test runs, log analysis)

#### Effective Sub-Agent Patterns

1. **Isolate high-volume operations:** Running tests, fetching docs, or
   processing logs in sub-agents keeps verbose output out of the main context.

2. **Run parallel research:** Spawn multiple sub-agents for independent
   investigations. Each explores its area, then Claude synthesizes findings.

3. **Chain sub-agents:** For multi-step workflows, use sub-agents in sequence.
   Each completes its task and returns results, which Claude passes to the next.

4. **Specialize with focused prompts:** Each sub-agent should excel at one
   specific task. Write detailed descriptions so Claude knows when to delegate.

5. **Limit tool access:** Grant only necessary permissions for security and
   focus. A reviewer doesn't need Write/Edit access.

6. **Use resume for continuity:** When a sub-agent needs to continue previous
   work, use the `resume` parameter instead of starting fresh.

7. **Preload skills:** Use the `skills` field to inject domain knowledge
   without the sub-agent having to discover and load it during execution.

8. **Persistent memory:** Enable `memory` for sub-agents that benefit from
   learning across sessions (e.g., a code reviewer that remembers project
   patterns).

#### Anthropic's Own Multi-Agent Patterns

Anthropic published their internal multi-agent research system architecture:
- **Orchestrator-worker pattern**: Claude Opus 4 as lead, Claude Sonnet 4
  sub-agents
- **90.2% improvement** over single-agent Opus 4 on internal evaluations
- **Token scaling**: Agents use 4x more tokens than chat; multi-agent uses 15x
  more

#### Cost-Optimization Strategies

- Use `opusplan` alias (Opus for planning, Sonnet for execution)
- Keep Haiku for Explore sub-agents unless quality is insufficient
- Use `max_turns` to limit sub-agent execution
- Run sub-agents in background only when you don't need immediate results
- Consider whether agent teams (higher token cost) are justified vs simple
  sub-agents

### 6. Sub-Agent Orchestration Patterns

#### Loops and Iteration

**Native sub-agents cannot run in loops by themselves.** The Task tool spawns a
sub-agent, it runs, and it returns a result. There is no built-in loop
construct. However, the **main agent** can implement loops:

```
Pattern: Main agent drives the loop
1. Main agent spawns sub-agent A with task
2. Sub-agent A returns results
3. Main agent evaluates results
4. If not satisfactory, spawns sub-agent A again (or resumes it)
5. Repeat until done
```

The `resume` parameter is key here — resuming a sub-agent continues with full
previous context, so the sub-agent doesn't lose track of what it was doing.

#### Background Sub-Agents (Parallelism)

The `run_in_background` parameter allows concurrent execution:

```
Main agent:
  ├── Spawns sub-agent A (background) → runs concurrently
  ├── Spawns sub-agent B (background) → runs concurrently
  ├── Continues own work
  ├── Reads sub-agent A result when ready
  └── Reads sub-agent B result when ready
```

Background sub-agents:
- Run concurrently while the main agent continues
- Write output to a file that can be checked via Read or `tail`
- Inherit pre-approved permissions (auto-deny anything not pre-approved)
- Cannot use MCP tools
- Cannot ask clarifying questions (those tool calls fail but the sub-agent
  continues)
- Can be resumed in the foreground if they fail due to missing permissions

#### `max_turns` for Bounded Execution

The `max_turns` parameter limits the number of agentic turns (API round-trips)
a sub-agent can take. This is useful for:
- Preventing runaway sub-agents that consume too many tokens
- Creating "time-boxed" exploration tasks
- Implementing work-then-report patterns

#### Agent Teams (Experimental) — For Complex Coordination

When sub-agents are insufficient because workers need to **communicate with each
other**, agent teams provide:
- Shared task lists with self-coordination
- Direct inter-agent messaging (not just report-to-parent)
- Teammates are full, independent Claude Code sessions
- Team lead coordinates, assigns tasks, synthesizes results
- Currently experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)

**Sub-agents vs Agent Teams:**

| Aspect          | Sub-agents                              | Agent Teams                                |
| --------------- | --------------------------------------- | ------------------------------------------ |
| Context         | Own window, results return to caller    | Own window, fully independent              |
| Communication   | Report back to main agent only          | Teammates message each other directly      |
| Coordination    | Main agent manages all work             | Shared task list with self-coordination    |
| Best for        | Focused tasks where only result matters | Complex work requiring discussion          |
| Token cost      | Lower (results summarized)              | Higher (each teammate = separate instance) |
| Nesting         | Cannot spawn sub-sub-agents             | Cannot spawn sub-teams                     |

### 7. Claude-Code-Invoking-Claude-Code ("Ralph Wiggum" Loops)

#### The Pattern

The "Ralph Wiggum loop" (or outer-loop pattern) involves Claude Code invoking
another Claude Code instance as a subprocess via the Bash tool, using the `-p`
(print/non-interactive) flag:

```bash
# Basic pattern: Claude Code invokes Claude Code
claude -p "Analyze auth.py and fix security issues" \
  --allowedTools "Read,Edit,Bash" \
  --output-format json
```

This is fundamentally different from native sub-agents:

| Aspect                | Native Sub-Agent (Task tool)           | Claude-via-Bash (`claude -p`)              |
| --------------------- | -------------------------------------- | ------------------------------------------ |
| Context isolation     | Shares some parent context             | Complete isolation (fresh process)          |
| Model control         | Via `model` field or env var           | Full CLI flag control (`--model opus`)      |
| System prompt         | Sub-agent definition only              | Full customization (`--system-prompt`)      |
| Tool access           | Configured in sub-agent definition     | `--allowedTools`, `--disallowedTools`       |
| Session persistence   | Transcript in sub-agent directory      | Optional (`--session-id`, `--continue`)     |
| Output format         | Returns to parent via Task tool        | stdout (text, json, stream-json)           |
| Compaction            | Built-in auto-compaction               | Built-in auto-compaction                   |
| Cost                  | Shares API connection                  | Separate API calls                         |
| Nesting               | Cannot spawn sub-sub-agents            | Can nest arbitrarily deep                  |
| Permission            | Inherits from parent + sub-agent config| Fully independent permission mode          |
| MCP servers           | Inherits from parent (with limits)     | Must configure independently               |
| Background execution  | `run_in_background` parameter          | Shell backgrounding (`&`, etc.)            |

#### Advantages of Claude-via-Bash Over Native Sub-Agents

1. **Arbitrary nesting:** Unlike native sub-agents which cannot spawn
   sub-sub-agents, `claude -p` invocations can nest as deep as needed.

2. **Full CLI control:** Every CLI flag is available — `--model`, `--system-prompt`,
   `--append-system-prompt`, `--allowedTools`, `--max-turns`, `--max-budget-usd`,
   `--json-schema`, etc.

3. **Complete isolation:** Each invocation is a fresh process with its own
   context window, no risk of context pollution.

4. **Session continuity:** Use `--session-id` and `--continue`/`--resume` to
   maintain state across invocations, enabling explicit compaction boundaries.

5. **Structured output:** `--output-format json` with `--json-schema` provides
   validated structured output, useful for machine-readable handoffs.

6. **Budget limits:** `--max-budget-usd` prevents runaway costs per invocation.

#### Disadvantages of Claude-via-Bash

1. **Higher latency:** Each invocation starts a fresh process (loading
   configuration, connecting to API, etc.)

2. **No shared context:** Must explicitly pass all context via prompts, files,
   or piping — no automatic context inheritance.

3. **Higher token cost:** No prompt caching benefit between separate
   invocations (though each invocation benefits from its own caching).

4. **Process management complexity:** Must handle process lifecycle, error
   recovery, and output parsing.

5. **No automatic resume:** If the outer agent's context compacts, it may lose
   track of inner invocations unless handoff state is persisted to files.

#### Implementing a Custom Compaction/Handoff Cycle

This is the most interesting application of the outer-loop pattern. The idea:

```
Outer Claude Code (orchestrator):
  Loop:
    1. Spawn inner Claude Code with task + context file
    2. Inner Claude Code works until max_turns or budget limit
    3. Inner Claude Code writes handoff document to file
    4. Inner Claude Code exits
    5. Outer agent reads handoff document
    6. Outer agent decides whether to continue or finish
    7. If continue, spawn new inner Claude Code with updated context
```

**Example implementation:**

```bash
# Outer orchestrator could run this loop pattern:

# Step 1: Write initial task context
echo "Task: Refactor auth module. Phase 1: Analysis." > /tmp/task-context.md

# Step 2: First inner invocation
claude -p "$(cat /tmp/task-context.md)" \
  --model opus \
  --allowedTools "Read,Grep,Glob,Bash,Edit,Write" \
  --append-system-prompt "When you finish or hit limits, write a handoff \
    document to /tmp/handoff.md describing: what you did, what remains, \
    key findings, and recommended next steps." \
  --max-turns 20 \
  --output-format json > /tmp/result-1.json

# Step 3: Read handoff and decide whether to continue
# (The outer Claude Code can read /tmp/handoff.md and evaluate)

# Step 4: Second inner invocation with updated context
claude -p "Continue the work described in this handoff: $(cat /tmp/handoff.md)" \
  --model opus \
  --allowedTools "Read,Grep,Glob,Bash,Edit,Write" \
  --append-system-prompt "..." \
  --max-turns 20 \
  --output-format json > /tmp/result-2.json
```

**A more sophisticated pattern using session continuity:**

```bash
# First invocation creates a session
session_id=$(claude -p "Start refactoring auth module" \
  --output-format json | jq -r '.session_id')

# Continue the same session (preserves full history)
claude -p "Continue the refactoring" --resume "$session_id" \
  --output-format json

# Fork the session (new ID but inherits history)
claude -p "Try an alternative approach" \
  --resume "$session_id" --fork-session \
  --output-format json
```

#### The Full Outer Loop Architecture

For a fully orchestrated outer loop, the outer Claude Code instance would:

1. **Plan:** Use plan mode or a planning sub-agent to break work into phases
2. **Execute phases:** For each phase, invoke `claude -p` with:
   - Phase-specific system prompt
   - Context from previous phases (via files)
   - Budget/turn limits
   - Structured output requirements
3. **Evaluate:** Read the inner agent's output and handoff document
4. **Decide:** Continue, retry, or finish
5. **Persist state:** Write orchestration state to files (not just context)

```
┌─────────────────────────────────────────────┐
│  Outer Claude Code (Orchestrator)           │
│                                             │
│  CLAUDE.md: "You are an orchestrator..."    │
│  Loop:                                      │
│    ├── Read task-state.json                 │
│    ├── Determine next phase                 │
│    ├── Invoke: claude -p "phase N" ...      │
│    │     └── Inner Claude Code              │
│    │          ├── Works on phase            │
│    │          ├── Writes handoff.md         │
│    │          └── Exits                     │
│    ├── Read handoff.md                      │
│    ├── Update task-state.json               │
│    └── If more work: continue loop          │
└─────────────────────────────────────────────┘
```

**Advantages of this architecture:**
- Each inner invocation gets a fresh context window (no compaction needed)
- Handoff documents provide explicit, curated context (better than auto-compaction)
- The outer agent can use different models/prompts for different phases
- Budget and turn limits prevent runaway costs per phase
- State is persisted to files, surviving even if the outer agent compacts

**Disadvantages:**
- More complex to set up and debug
- Higher total token cost (no shared prompt caching)
- Latency from process startup per invocation
- Requires careful handoff document design
- The outer agent itself will eventually hit context limits

#### Can We Do This Today?

**Yes.** All the pieces exist:

1. `claude -p` for non-interactive invocations ✓
2. `--model` for per-invocation model control ✓
3. `--system-prompt` / `--append-system-prompt` for custom prompts ✓
4. `--max-turns` and `--max-budget-usd` for bounded execution ✓
5. `--output-format json` for structured output ✓
6. `--resume` and `--continue` for session continuity ✓
7. `--allowedTools` for per-invocation tool control ✓
8. `--agents` for per-invocation custom sub-agents ✓
9. Bash tool for invoking `claude -p` from within Claude Code ✓

The **Agent SDK** (Python and TypeScript packages) provides even more
programmatic control:

```python
# Python Agent SDK example (conceptual)
from claude_code import ClaudeCode

agent = ClaudeCode(
    model="opus",
    system_prompt="You are a refactoring specialist...",
    allowed_tools=["Read", "Edit", "Bash"],
    max_turns=20
)

result = agent.run("Refactor the auth module")
handoff = result.structured_output  # if using --json-schema
```

### 8. Comparison: Native Sub-Agents vs Agent Teams vs Outer Loop

| Dimension           | Native Sub-Agents        | Agent Teams (Experimental)  | Outer Loop (claude -p)       |
| ------------------- | ------------------------ | --------------------------- | ---------------------------- |
| Setup complexity    | Low (built-in)           | Medium (experimental flag)  | High (custom orchestration)  |
| Model control       | Limited (env var/config) | Per-teammate                | Full CLI control             |
| Context isolation   | Partial                  | Full                        | Full                         |
| Inter-agent comms   | None (report to parent)  | Direct messaging            | Via files/handoff docs       |
| Nesting depth       | 1 level only             | 1 level only                | Unlimited                    |
| Parallelism         | Background mode          | Native (tmux/in-process)    | Shell backgrounding          |
| Custom compaction    | No                       | No                          | Yes (explicit handoffs)      |
| Session persistence | Sub-agent transcripts    | Teammate transcripts        | Full session persistence     |
| Token efficiency    | Good (shared caching)    | Low (separate instances)    | Low (separate processes)     |
| Maturity            | Stable                   | Experimental                | DIY (all stable primitives)  |
| Permission control  | Inherited + overrides    | Inherited                   | Fully independent            |

### 9. Creating Custom Sub-Agent Delegation Frameworks

#### Yes, Custom Sub-Agents Are a First-Class Extension Point

Claude Code's sub-agent system is designed to be extended. You can create
your own sub-agents that participate in the same delegation framework as the
built-in ones. Claude uses each sub-agent's `description` field to decide
when to delegate, so a well-described custom sub-agent will be automatically
invoked for matching tasks.

#### How Delegation Works (and How to Customize It)

The delegation flow is:

1. Claude encounters a task in the conversation
2. Claude evaluates available sub-agents' `description` fields
3. If a sub-agent matches, Claude delegates via the Task tool
4. The sub-agent runs with its own system prompt, tools, and model
5. Results return to the main conversation

You can influence this at every step:

**Control which sub-agents exist** (`.claude/agents/` or `~/.claude/agents/`):
- Create project-specific sub-agents that your team shares
- Create personal sub-agents for your own workflows
- Distribute sub-agents via plugins

**Control which sub-agents can be used** (permissions):
- `deny` specific sub-agents: `"permissions": { "deny": ["Task(Explore)"] }`
- `--disallowedTools "Task(my-agent)"` on the CLI
- Restrict which sub-agents another agent can spawn: `tools: Task(worker, researcher)`

**Control delegation behavior** (hooks):
- `SubagentStart` hook fires when any sub-agent begins — run setup scripts
- `SubagentStop` hook fires when any sub-agent completes — run cleanup
- `PreToolUse` hooks within sub-agents validate operations before execution
- `PostToolUse` hooks within sub-agents run after tool operations

**Example: A custom delegation framework with pre/post hooks**

```yaml
# .claude/agents/guarded-coder.md
---
name: guarded-coder
description: Implement code changes with mandatory pre-commit validation.
  Use proactively when making code changes.
tools: Read, Edit, Write, Bash, Grep, Glob
model: opus
permissionMode: acceptEdits
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint-changed-files.sh"
  Stop:
    - hooks:
        - type: command
          command: "./scripts/run-tests-on-changes.sh"
---

You are a senior developer. When implementing changes:
1. Read and understand the existing code
2. Make minimal, focused changes
3. Ensure all changes pass linting (automatic via hooks)
4. Run tests before reporting completion (automatic via hooks)
```

**Example: Settings-level hooks for sub-agent lifecycle**

```json
// .claude/settings.json
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "guarded-coder",
      "hooks": [{
        "type": "command",
        "command": "./scripts/create-git-stash.sh"
      }]
    }],
    "SubagentStop": [{
      "matcher": "guarded-coder",
      "hooks": [{
        "type": "command",
        "command": "./scripts/validate-and-format.sh"
      }]
    }]
  }
}
```

#### Building a Multi-Agent Pipeline with Custom Sub-Agents

You can build a custom pipeline by creating several specialized sub-agents
and having the main agent (or a coordinator sub-agent) chain them:

```
.claude/agents/
  ├── researcher.md      # Read-only, explores codebase (model: haiku)
  ├── planner.md         # Read-only, creates implementation plan (model: opus)
  ├── implementer.md     # Full tools, writes code (model: opus)
  ├── reviewer.md        # Read-only, reviews changes (model: sonnet)
  └── test-runner.md     # Bash only, runs tests (model: haiku)
```

Then instruct Claude (via CLAUDE.md or prompts):

```markdown
When implementing features, follow this pipeline:
1. Use the researcher sub-agent to understand the codebase
2. Use the planner sub-agent to create an implementation plan
3. Use the implementer sub-agent to write the code
4. Use the reviewer sub-agent to review the changes
5. Use the test-runner sub-agent to validate
```

#### Restricting Sub-Agent Spawning for Coordinator Agents

When running Claude as a named agent via `claude --agent coordinator`, you
can restrict which sub-agents it can spawn:

```yaml
# .claude/agents/coordinator.md
---
name: coordinator
description: Coordinates work across specialized agents
tools: Task(researcher, implementer, reviewer), Read, Bash
---

You are a coordinator. Delegate research to the researcher,
implementation to the implementer, and review to the reviewer.
Never implement code directly.
```

The `Task(researcher, implementer, reviewer)` syntax is an allowlist — only
those three sub-agents can be spawned. This restriction only applies to
agents running as the main thread with `claude --agent`.

#### Limitations of Custom Delegation

1. **No custom delegation logic:** You cannot write code that runs inside
   Claude Code's delegation decision. The delegation is based on Claude's
   interpretation of `description` fields — it's LLM-driven, not rule-based.

2. **No sub-agent-to-sub-agent communication:** Sub-agents can only report
   back to the parent. For inter-agent communication, use agent teams.

3. **No sub-sub-agents:** Sub-agents cannot spawn their own sub-agents.
   Pipelines must be orchestrated from the main conversation.

4. **Hook-based control is limited to shell commands:** Hooks run shell
   commands and use exit codes to allow/block. They can't modify the
   sub-agent's prompt or tools dynamically.

5. **No programmatic delegation override:** You can't write a function that
   decides which sub-agent to use based on custom logic. You can only
   influence the decision via descriptions and deny lists.

#### Workaround: Full Custom Delegation via Outer Loop

For fully custom delegation logic, use the `claude -p` outer loop pattern
(Section 7). The outer Claude Code instance can implement arbitrary
delegation logic:

```bash
# Outer orchestrator decides which specialist to invoke
claude -p "Analyze this task and determine the right approach" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"approach":{"enum":["research","implement","debug"]},"reasoning":{"type":"string"}}}'

# Based on the structured output, invoke the right specialist
if [ "$approach" = "research" ]; then
  claude -p "Research: $task" --model haiku --system-prompt "You are a researcher..."
elif [ "$approach" = "implement" ]; then
  claude -p "Implement: $task" --model opus --system-prompt "You are a developer..."
fi
```

This gives you fully custom delegation at the cost of managing the
orchestration yourself.

---

## Recommendations

### For Most Workflows: Use Native Sub-Agents with Model Overrides

1. Set `CLAUDE_CODE_SUBAGENT_MODEL` to ensure sub-agents use Opus when quality
   matters
2. Create custom sub-agents in `.claude/agents/` for project-specific
   specializations
3. Use the `resume` parameter for continuity across sub-agent invocations
4. Preload skills for domain knowledge injection

### For Complex Multi-Phase Projects: Consider the Outer Loop

When you need:
- Custom compaction cycles (better than auto-compaction)
- Arbitrary nesting depth
- Per-phase model selection
- Explicit handoff documents
- Budget limits per phase

The `claude -p` outer loop pattern provides maximum control at the cost of
higher complexity and latency.

### For Collaborative Multi-Agent Work: Use Agent Teams

When workers need to communicate with each other (not just report to parent),
agent teams provide native coordination. But they're experimental and have
higher token costs.

### Quick-Reference: Ensuring Opus Everywhere

```bash
# Option 1: Environment variable (simplest)
export ANTHROPIC_MODEL=opus
export CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
claude

# Option 2: Settings file (persistent)
# ~/.claude/settings.json
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}

# Option 3: Disable Haiku-based built-in sub-agents
# Forces Claude to use inheriting sub-agents instead
{
  "permissions": {
    "deny": ["Task(Explore)", "Task(claude-code-guide)"]
  }
}

# Option 4: Per-session CLI flag
claude --model opus
# (sub-agents that "inherit" will use Opus;
#  built-in Haiku sub-agents still use Haiku
#  unless CLAUDE_CODE_SUBAGENT_MODEL is also set)
```

---

## Next Steps

- [ ] Test `CLAUDE_CODE_SUBAGENT_MODEL` override in practice and verify behavior
- [ ] Prototype an outer-loop orchestrator script using `claude -p`
- [ ] Evaluate token cost impact of forcing Opus on all sub-agents
- [ ] Experiment with agent teams for collaborative debugging workflows
- [ ] Create project-specific custom sub-agents for common tasks
- [ ] Design a handoff document format for outer-loop compaction cycles

---

## References

### Official Claude Code Documentation

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) —
  Complete sub-agent configuration reference
- [Model configuration](https://code.claude.com/docs/en/model-config) — Model
  aliases, environment variables, and settings
- [CLI reference](https://code.claude.com/docs/en/cli-reference) — All CLI
  flags including `--model`, `--agents`, `--system-prompt`
- [Settings](https://code.claude.com/docs/en/settings) — Configuration scope
  hierarchy and environment variables
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) —
  Agent teams reference (experimental)
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) —
  Agent SDK and `claude -p` usage
- [Common workflows](https://code.claude.com/docs/en/common-workflows) —
  Workflow patterns including parallel sessions with git worktrees
- [Hooks](https://code.claude.com/docs/en/hooks) — Lifecycle hooks including
  SubagentStart/SubagentStop events
- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) —
  Cloud environment configuration including environment variables

### Anthropic Research

- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) —
  Anthropic's internal orchestrator-worker pattern (Opus lead + Sonnet workers)

### Agent SDK

- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —
  Python and TypeScript SDK for programmatic Claude Code usage
- [Streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) —
  Real-time streaming with callbacks
- [Structured outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs) —
  JSON schema validation for agent output

### Related Internal Research

- [Running Claude Code Across Environments](research-running-claude-code.md) —
  Multi-agent orchestration landscape survey
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) — UNIX-like
  primitives for agent coordination
