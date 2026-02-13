# Research: Claude Code Sub-Agents — Architecture, Models, and Orchestration Patterns

**Date:** 2026-02-13 (last updated 2026-02-13)

**Author:** Research brief (AI-assisted)

**Status:** In Progress

**Related:**

- [Running Claude Code Across Environments](research-running-claude-code.md)
- [Agent Coordination Kernel](research-agent-coordination-kernel.md)

* * *

## Overview

This document investigates how Claude Code’s sub-agent system works: what models
sub-agents use, how to control them, how context flows between parent and sub-agents,
and how the system behaves across different environments (local CLI, VS Code, cloud).
It also explores advanced orchestration patterns including loops, nested invocations
("Ralph Wiggum loops"), and custom compaction cycles.

## Key Takeaways

**These are the most actionable findings.
Read these first.**

### Forcing Opus on All Sub-Agents (Including Cloud)

By default, Claude Code delegates codebase exploration and help queries to **Haiku** (a
faster but less capable model)
([sub-agents docs](https://code.claude.com/docs/en/sub-agents#built-in-subagents)). To
force Opus everywhere, you need **two settings** — one for the main agent, one for
sub-agents ([model-config docs](https://code.claude.com/docs/en/model-config),
[settings docs — `env` field](https://code.claude.com/docs/en/settings#available-settings)):

```json
// .claude/settings.json — commit this to your repo
{
  "model": "opus",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}
```

This works in **all environments** — local CLI, VS Code, desktop, and Cloud.

**In Claude Code Cloud specifically**, there are two reliable methods:

1. **Project settings.json** (shown above) — best for teams, committed to git,
   automatically picked up when the Cloud VM clones your repo
   ([settings docs](https://code.claude.com/docs/en/settings#settings-scope)).
2. **Cloud environment dialog** — on claude.ai, edit your environment and add env vars
   in `.env` format
   ([cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web)):
   ```
   CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
   ANTHROPIC_MODEL=opus
   ```

**What does NOT work:**
- `export` in Bash — each Bash runs in a fresh shell; the variable is invisible to
  Claude Code’s agentic loop that spawns sub-agents.
- `~/.claude/settings.json` — not available in Cloud (it’s not in your repo).
- `CLAUDE_ENV_FILE` — may only affect subsequent Bash commands, not sub-agent spawning
  (read at startup). *(Caveat: this claim is inferred from architecture, not explicitly
  documented.)*

**To verify:** Run `/agents` in session to see all sub-agents and their configured
models. Or ask: “What model are your sub-agents configured to use?”
The [sub-agents docs](https://code.claude.com/docs/en/sub-agents#use-the-agents-command)
confirm `/agents` shows all available sub-agents with their configuration.

### Self-Managed Compaction Is Better Than Auto-Compaction

Auto-compaction (at ~95% context) progressively loses critical context with each
summarization pass. A better pattern: **the agent writes a structured handoff, then a
fresh instance picks it up with a clean context window.**

Three ways to implement this, from simplest to most powerful:

1. **tbd agent-handoff shortcut** — run `tbd shortcut agent-handoff` to generate a
   structured handoff prompt.
   Copy it into a new session.
2. **Outer loop (`claude -p`)** — the agent spawns a fresh Claude Code instance via Bash
   with a handoff document as the prompt.
   Each iteration gets a clean context window.
   (See Section 10.)
3. **Ralph Loop shell script** — a shell script runs `claude -p` in a loop,
   reading/writing state files between iterations.
   Fully autonomous. (See Section 10.)

**Key insight:** Memory persists not in the model’s context but in the **filesystem** —
git commits, handoff files, tbd issues.
Each fresh instance reads current state, does one unit of work, writes updated state.

## Questions to Answer

1. How do Claude Code sub-agents work and what models do they use?
2. How do you ensure Opus runs on both the outer agent and all sub-agents?
3. How does context transfer work between parent and sub-agents?
4. Are there differences across environments (CLI, VS Code, desktop, cloud)?
5. What are emerging best practices for sub-agent usage?
6. Can sub-agents be orchestrated in loops or complex patterns?
7. How does Claude-code-invoking-Claude-code compare to native sub-agents?
8. Can we implement custom compaction/handoff cycles?
9. How can a custom sub-agent delegation framework be built?
10. How can an agent manage its own compaction — self-restart with a handoff?

## Scope

- **Included:** Claude Code’s built-in sub-agent system (Task tool), custom sub-agents,
  agent teams, headless mode (`claude -p`), Agent SDK, model configuration across
  environments
- **Excluded:** Third-party orchestrators (Gas Town, Claude Squad, etc.)
  covered in the companion research doc; MCP server architecture; Anthropic API-level
  multi-agent patterns outside Claude Code

* * *

## Findings

### 1. Sub-Agent Architecture and Built-in Types

Claude Code’s sub-agent system works through the **Task tool**, which spawns specialized
AI assistants that handle specific types of tasks.
Each sub-agent runs in its **own context window** with a custom system prompt, specific
tool access, and independent permissions.
When Claude encounters a task matching a sub-agent’s description, it delegates to that
sub-agent, which works independently and returns results.

**Critical architectural constraint:** Sub-agents **cannot spawn other sub-agents**.
This prevents infinite nesting.
If a workflow requires nested delegation, the main conversation must chain sub-agents
sequentially.

#### Built-in Sub-Agent Types

Source:
[Sub-agents docs — Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)

| Sub-Agent | Default Model | Tools Available | Purpose |
| --- | --- | --- | --- |
| **Explore** | **Haiku** | Read-only (no Write/Edit) | File discovery, code search, codebase exploration |
| **Plan** | Inherits | Read-only (no Write/Edit) | Codebase research for plan mode |
| **General-purpose** | Inherits | All tools | Complex research, multi-step operations |
| **Bash** | Inherits | Bash | Running terminal commands in separate context |
| **statusline-setup** | **Sonnet** | Read, Edit | Configuring status line |
| **Claude Code Guide** | **Haiku** | Glob, Grep, Read, WebFetch, WebSearch | Answering questions about Claude Code features |

**Key insight: Yes, sub-agents do use less capable models by default.** The Explore
sub-agent (one of the most commonly invoked) defaults to **Haiku**, not Opus.
The Claude Code Guide sub-agent also uses Haiku.
This means that when Claude Code delegates codebase exploration or self-help queries,
it’s running on a faster but less capable model.
The Plan and General-purpose sub-agents **inherit** the parent model (e.g., Opus if
that’s what you’re running).

**Verified against official docs (Feb 2026):** The default models listed above match the
[sub-agents documentation](https://code.claude.com/docs/en/sub-agents#built-in-subagents)
exactly. Explore: “Haiku (fast, low-latency)”; Plan: “Inherits from main conversation”;
General-purpose: “Inherits from main conversation”; Bash: “Inherits”; statusline-setup:
“Sonnet”; Claude Code Guide: “Haiku”.

### 2. Model Selection and Control

#### How Sub-Agent Models Are Determined

The model for each sub-agent is determined by a priority chain:

1. **`CLAUDE_CODE_SUBAGENT_MODEL`** environment variable — overrides model for **all**
   sub-agents globally
   ([model-config docs](https://code.claude.com/docs/en/model-config#environment-variables))
2. **Per-invocation `model` parameter on the Task tool** — when the parent agent spawns
   a sub-agent, it can pass `model: "opus"` (or `"sonnet"`, `"haiku"`) directly on the
   Task tool call. This is the most direct way the parent agent controls a specific
   sub-agent invocation’s model, independent of the sub-agent’s definition.
   The Task tool schema accepts `{"enum": ["sonnet", "opus", "haiku"]}`.
3. **Per-sub-agent `model` field** — set in the sub-agent’s frontmatter configuration
   (for custom sub-agents) or hardcoded (for built-in sub-agents)
   ([sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model))
4. **`inherit`** — if model is omitted or set to `inherit`, uses the main conversation’s
   model ([sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model):
   "If not specified, defaults to `inherit`")

**Note on priority:** The docs confirm that `CLAUDE_CODE_SUBAGENT_MODEL` is “the model
to use for subagents” and that per-agent `model` field defaults to `inherit` if omitted.
The exact override precedence between `CLAUDE_CODE_SUBAGENT_MODEL`, the Task tool’s
per-invocation `model` parameter, and an explicit per-agent `model` field (e.g.,
`model: sonnet` in a custom sub-agent) is not explicitly documented.
The priority chain above is inferred from specificity: env var as global override,
per-invocation as call-site override, per-agent as definition-time default.

Available model values for the `model` field: `sonnet`, `opus`, `haiku` (aliases), or
`inherit` (use parent model).
See
[sub-agents docs — Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model).

#### How to Force Opus on All Sub-Agents

**Method 1: Environment variable (recommended for blanket override)**

Set `CLAUDE_CODE_SUBAGENT_MODEL` to the full model name
([model-config docs](https://code.claude.com/docs/en/model-config#environment-variables)):

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
claude
```

Or use the `env` field in settings.json, which applies environment variables to every
session ([settings docs](https://code.claude.com/docs/en/settings#available-settings)):

```json
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6"
  }
}
```

This forces every sub-agent — including Explore and Claude Code Guide — to use Opus
instead of Haiku.

**Method 2: Custom sub-agents with explicit model**

Create custom sub-agents in `~/.claude/agents/` or `.claude/agents/` with `model: opus`
([sub-agents docs — Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)):

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
([sub-agents docs — CLI-defined subagents](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope))

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
([sub-agents docs — Disable specific subagents](https://code.claude.com/docs/en/sub-agents#disable-specific-subagents))

You can prevent Claude from using the Haiku-based Explore sub-agent:

```json
{
  "permissions": {
    "deny": ["Task(Explore)"]
  }
}
```

Or via CLI: `claude --disallowedTools "Task(Explore)"`

This forces Claude to use the General-purpose sub-agent (which inherits your model)
instead.

#### Model Alias Resolution

Source:
[Model configuration — Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)

The model aliases always point to the latest versions:

| Alias | Current Model (Feb 2026) |
| --- | --- |
| `opus` | Opus 4.6 |
| `sonnet` | Sonnet 4.5 |
| `haiku` | Haiku (latest) |

To pin to a specific version, use the full model name (e.g., `claude-opus-4-6`).
Override the aliases via environment variables
([model-config docs — Environment variables](https://code.claude.com/docs/en/model-config#environment-variables)):

| Environment Variable | Overrides Alias |
| --- | --- |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` |

#### Cost Considerations

Using Opus for all sub-agents significantly increases token costs.
Anthropic’s multi-agent research system uses Opus as lead with Sonnet sub-agents
specifically to balance capability and cost
([source](https://www.anthropic.com/engineering/multi-agent-research-system)). The
`opusplan` alias provides a hybrid: Opus for planning, Sonnet for execution
([model-config docs](https://code.claude.com/docs/en/model-config#opusplan-model-setting)).

**Token usage scales with sub-agents:** Each sub-agent has its own context window.
Running many sub-agents that each return detailed results can consume significant
context in the parent.
Agent teams use even more tokens, with each teammate being a separate Claude instance.

### 3. Context Transfer Between Parent and Sub-Agents

Source:
[Sub-agents docs — Configure subagents](https://code.claude.com/docs/en/sub-agents#configure-subagents),
[Sub-agents docs — Run subagents in foreground or background](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background)

#### What Sub-Agents Receive

Sub-agents receive:
- Their **system prompt** (from the markdown body of the sub-agent definition) — per
  docs: “The body becomes the system prompt that guides the subagent’s behavior”
- Basic **environment details** (working directory, etc.)
- The **prompt** passed by the parent agent via the Task tool
- If custom sub-agent: preloaded **skills** content (via `skills` field)
- If persistent memory enabled: contents of their **memory directory**

Sub-agents do **NOT** receive:
- The full Claude Code system prompt — per docs: “Subagents receive only this system
  prompt (plus basic environment details like working directory), not the full Claude
  Code system prompt”
- The parent conversation’s message history (with one exception — see below)
- MCP tools when running in background mode — per docs: “MCP tools are not available in
  background subagents”

#### “Access to Current Context”

Some sub-agent types are documented as having “access to current context.”
Based on the official documentation, this means certain sub-agent types can see the
**full conversation history** before the tool call.
The documentation states:

> “Agents with ‘access to current context’ can see the full conversation history before
> the tool call. When using these agents, you can write concise prompts that reference
> earlier context (e.g., ‘investigate the error discussed above’) instead of repeating
> information. The agent will receive all prior messages and understand the context.”

This appears to apply to the General-purpose, Plan, and Explore sub-agent types (based
on the system prompt descriptions of the Task tool).
However, the sub-agent still runs in its **own context window** — it sees the parent’s
history as input context but builds its own separate conversation.

#### Customizing Context Transfer

**Via the `prompt` parameter:** The primary mechanism.
The parent agent writes a detailed prompt describing the task, and this becomes the
sub-agent’s initial instruction.
The quality of this prompt determines how well the sub-agent understands what to do.

**Via skills preloading:** The `skills` field in sub-agent configuration injects full
skill content into the sub-agent’s context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

**Via persistent memory:** The `memory` field gives sub-agents a persistent directory
that survives across conversations:

```yaml
---
name: code-reviewer
description: Reviews code quality
memory: user  # or: project, local
---
```

Scopes: `user` (~/.claude/agent-memory/), `project` (.claude/agent-memory/), `local`
(.claude/agent-memory-local/).

**Via the `resume` parameter:** Resuming a sub-agent continues with its **full previous
context preserved**, including all previous tool calls, results, and reasoning.
This is the most powerful way to maintain continuity.

#### Limitations of Context Transfer

1. Sub-agents don’t inherit skills from the parent — must list them explicitly
2. Sub-agents don’t inherit the full Claude Code system prompt
3. Background sub-agents auto-deny permission prompts not pre-approved
4. MCP tools unavailable in background sub-agents
5. When sub-agents complete, their results return to the main conversation — running
   many verbose sub-agents can consume significant context
6. Sub-agent transcripts are independent of the main conversation’s compaction

### 4. Environments: CLI, VS Code, Desktop, Cloud

#### Key Finding: Model Configuration Is Environment-Agnostic

There are **no IDE-specific model settings**. Model configuration is based on scope
(user, project, local) and environment variables, not on which IDE or runtime
environment you’re using.
The same settings.json and environment variables work across:

- **Local CLI** (`claude` in terminal)
- **VS Code extension** (Claude Code as VS Code plugin)
- **Desktop app** (standalone Claude Code app)
- **Claude Code Cloud** (web-based sessions)

The sub-agent mechanism is the same across all environments.
The Task tool works identically whether you’re in VS Code, the desktop app, or the CLI.

#### Settings Precedence (Same Everywhere)

Source:
[Settings docs — Settings scope](https://code.claude.com/docs/en/settings#settings-scope)

1. **Managed** (enterprise, cannot override)
2. **Command line arguments** (temporary session overrides)
3. **Local** (`.claude/settings.local.json` — per-project personal)
4. **Project** (`.claude/settings.json` — team-shared)
5. **User** (`~/.claude/settings.json` — personal global)

#### How to Set Model in Each Environment

Source:
[Model configuration — Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)

| Environment | How to Set Model |
| --- | --- |
| CLI | `claude --model opus` or `ANTHROPIC_MODEL=opus` or settings.json |
| VS Code | settings.json (project or user level) or environment variables |
| Desktop app | settings.json or `/model opus` during session |
| Cloud | `/model opus` during session or settings.json |
| Any (session) | `/model opus` to switch mid-session |

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

Or set `CLAUDE_CODE_SUBAGENT_MODEL` as an actual environment variable before launching
Claude Code.

#### Cloud-Specific Considerations

Claude Code Cloud runs in isolated, Anthropic-managed VMs that clone your GitHub
repository. Sub-agents work normally within a cloud session.
However there are important differences in how configuration reaches the environment.

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

On claude.ai, when adding or editing an environment, there’s a dialog where you can
specify environment variables in `.env` format:

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

Note: `CLAUDE_ENV_FILE` makes variables available to subsequent Bash commands but may
not affect Claude Code’s internal sub-agent spawning if the variable is only read at
startup. The `env` field in settings.json is more reliable.

**Important: `export` in Bash does NOT work for sub-agent model control.** Each Bash
command runs in a fresh shell, and environment variables set within Bash are not visible
to Claude Code’s agentic loop that spawns sub-agents.

**How to verify which model sub-agents are using:**

1. `/status` — shows current main model and account info
2. `/agents` — shows all sub-agents with their model configurations
3. `/model` — shows current model; use arrow keys to see effort slider
4. Sub-agent transcripts at `~/.claude/projects/{project}/{sessionId}/subagents/`
5. Ask Claude directly: “What model are your sub-agents configured to use?”

**Does `/model` affect sub-agents?** Partially *(inferred from architecture, not
explicitly documented)*:
- Sub-agents with `model: inherit` (or no model field) **will** follow `/model`
- Sub-agents with an explicit model (e.g., `model: sonnet`) **will not**
- Built-in Explore uses Haiku regardless of `/model`
- `CLAUDE_CODE_SUBAGENT_MODEL` overrides everything

**Other considerations:**
- No native instance-to-instance communication between cloud sessions
- No official orchestration API for cloud instances
- Teleport (`/tp`) brings cloud sessions to local terminal but doesn’t connect sessions
  to each other
- Background sub-agents may have additional sandbox restrictions

#### Default Model by Account Type

Source:
[Model configuration — `default` model setting](https://code.claude.com/docs/en/model-config#default-model-setting)

| Account Type | Default Model |
| --- | --- |
| Max and Teams | Opus 4.6 |
| Pro | Opus 4.6 |
| Enterprise | Opus 4.6 available but not default |

Claude Code may automatically **fall back to Sonnet** if you hit a usage threshold with
Opus. This could affect sub-agents that inherit the parent model.

### 5. Emerging Best Practices for Sub-Agents

#### When to Use Sub-Agents vs Main Conversation

**Use the main conversation when:**
- The task needs frequent back-and-forth or iterative refinement
- Multiple phases share significant context (planning → implementation → testing)
- You’re making a quick, targeted change
- Latency matters (sub-agents start fresh and need time to gather context)

**Use sub-agents when:**
- The task produces verbose output you don’t need in your main context
- You want to enforce specific tool restrictions or permissions
- The work is self-contained and can return a summary
- You want to isolate high-volume operations (test runs, log analysis)

#### Effective Sub-Agent Patterns

1. **Isolate high-volume operations:** Running tests, fetching docs, or processing logs
   in sub-agents keeps verbose output out of the main context.

2. **Run parallel research:** Spawn multiple sub-agents for independent investigations.
   Each explores its area, then Claude synthesizes findings.

3. **Chain sub-agents:** For multi-step workflows, use sub-agents in sequence.
   Each completes its task and returns results, which Claude passes to the next.

4. **Specialize with focused prompts:** Each sub-agent should excel at one specific
   task. Write detailed descriptions so Claude knows when to delegate.

5. **Limit tool access:** Grant only necessary permissions for security and focus.
   A reviewer doesn’t need Write/Edit access.

6. **Use resume for continuity:** When a sub-agent needs to continue previous work, use
   the `resume` parameter instead of starting fresh.

7. **Preload skills:** Use the `skills` field to inject domain knowledge without the
   sub-agent having to discover and load it during execution.

8. **Persistent memory:** Enable `memory` for sub-agents that benefit from learning
   across sessions (e.g., a code reviewer that remembers project patterns).

#### Anthropic’s Own Multi-Agent Patterns

Anthropic published their internal multi-agent research system architecture:
- **Orchestrator-worker pattern**: Claude Opus 4 as lead, Claude Sonnet 4 sub-agents
- **90.2% improvement** over single-agent Opus 4 on internal evaluations
- **Token scaling**: Agents use 4x more tokens than chat; multi-agent uses 15x more

#### Cost-Optimization Strategies

- Use `opusplan` alias (Opus for planning, Sonnet for execution)
- Keep Haiku for Explore sub-agents unless quality is insufficient
- Use `max_turns` to limit sub-agent execution
- Run sub-agents in background only when you don’t need immediate results
- Consider whether agent teams (higher token cost) are justified vs simple sub-agents

### 6. Sub-Agent Orchestration Patterns

#### Loops and Iteration

**Native sub-agents cannot run in loops by themselves.** The Task tool spawns a
sub-agent, it runs, and it returns a result.
There is no built-in loop construct.
However, the **main agent** can implement loops:

```
Pattern: Main agent drives the loop
1. Main agent spawns sub-agent A with task
2. Sub-agent A returns results
3. Main agent evaluates results
4. If not satisfactory, spawns sub-agent A again (or resumes it)
5. Repeat until done
```

The `resume` parameter is key here — resuming a sub-agent continues with full previous
context, so the sub-agent doesn’t lose track of what it was doing.

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
- **Write output to a file** — when `run_in_background: true` is set, the Task tool
  result includes an `output_file` path.
  The parent agent retrieves results by reading this file with the Read tool or `tail`
  in Bash. This is the **only** way to get results from a background sub-agent — unlike
  foreground sub-agents, results are not returned inline.
- Inherit pre-approved permissions (auto-deny anything not pre-approved)
- Cannot use MCP tools
- Cannot ask clarifying questions (those tool calls fail but the sub-agent continues)
- Can be resumed in the foreground if they fail due to missing permissions

#### `max_turns` for Bounded Execution

The `max_turns` parameter is a **first-class parameter on the Task tool** itself (not
just a CLI flag).
When the parent agent spawns a sub-agent via the Task tool, it can pass
`max_turns: N` to limit the number of agentic turns (API round-trips) the sub-agent can
take. The Task tool schema defines it as
`{"exclusiveMinimum": 0, "maximum": 9007199254740991}`.

This is useful for:
- Preventing runaway sub-agents that consume too many tokens
- Creating “time-boxed” exploration tasks
- Implementing work-then-report patterns
- Budgeting sub-agent work in orchestration loops (e.g., 20-30 turns per iteration)

#### Agent Teams (Experimental) — For Complex Coordination

When sub-agents are insufficient because workers need to **communicate with each
other**, agent teams provide:
- Shared task lists with self-coordination
- Direct inter-agent messaging (not just report-to-parent)
- Teammates are full, independent Claude Code sessions
- Team lead coordinates, assigns tasks, synthesizes results
- Currently experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)

**Sub-agents vs Agent Teams:**

| Aspect | Sub-agents | Agent Teams |
| --- | --- | --- |
| Context | Own window, results return to caller | Own window, fully independent |
| Communication | Report back to main agent only | Teammates message each other directly |
| Coordination | Main agent manages all work | Shared task list with self-coordination |
| Best for | Focused tasks where only result matters | Complex work requiring discussion |
| Token cost | Lower (results summarized) | Higher (each teammate = separate instance) |
| Nesting | Cannot spawn sub-sub-agents | Cannot spawn sub-teams |

### 7. Claude-Code-Invoking-Claude-Code ("Ralph Wiggum" Loops)

#### The Pattern

The “Ralph Wiggum loop” (or outer-loop pattern) involves Claude Code invoking another
Claude Code instance as a subprocess via the Bash tool, using the `-p`
(print/non-interactive) flag:

```bash
# Basic pattern: Claude Code invokes Claude Code
claude -p "Analyze auth.py and fix security issues" \
  --allowedTools "Read,Edit,Bash" \
  --output-format json
```

This is fundamentally different from native sub-agents:

| Aspect | Native Sub-Agent (Task tool) | Claude-via-Bash (`claude -p`) |
| --- | --- | --- |
| Context isolation | Shares some parent context | Complete isolation (fresh process) |
| Model control | Via `model` field or env var | Full CLI flag control (`--model opus`) |
| System prompt | Sub-agent definition only | Full customization (`--system-prompt`) |
| Tool access | Configured in sub-agent definition | `--allowedTools`, `--disallowedTools` |
| Session persistence | Transcript in sub-agent directory | Optional (`--session-id`, `--continue`) |
| Output format | Returns to parent via Task tool | stdout (text, json, stream-json) |
| Compaction | Built-in auto-compaction | Built-in auto-compaction |
| Cost | Shares API connection | Separate API calls |
| Nesting | Cannot spawn sub-sub-agents | Can nest arbitrarily deep |
| Permission | Inherits from parent + sub-agent config | Fully independent permission mode |
| MCP servers | Inherits from parent (with limits) | Must configure independently |
| Background execution | `run_in_background` parameter | Shell backgrounding (`&`, etc.) |

#### Advantages of Claude-via-Bash Over Native Sub-Agents

1. **Arbitrary nesting:** Unlike native sub-agents which cannot spawn sub-sub-agents,
   `claude -p` invocations can nest as deep as needed.

2. **Full CLI control:** Every CLI flag is available — `--model`, `--system-prompt`,
   `--append-system-prompt`, `--allowedTools`, `--max-turns`, `--max-budget-usd`,
   `--json-schema`, etc.

3. **Complete isolation:** Each invocation is a fresh process with its own context
   window, no risk of context pollution.

4. **Session continuity:** Use `--session-id` and `--continue`/`--resume` to maintain
   state across invocations, enabling explicit compaction boundaries.

5. **Structured output:** `--output-format json` with `--json-schema` provides validated
   structured output, useful for machine-readable handoffs.

6. **Budget limits:** `--max-budget-usd` prevents runaway costs per invocation.

#### Disadvantages of Claude-via-Bash

1. **Higher latency:** Each invocation starts a fresh process (loading configuration,
   connecting to API, etc.)

2. **No shared context:** Must explicitly pass all context via prompts, files, or piping
   — no automatic context inheritance.

3. **Higher token cost:** No prompt caching benefit between separate invocations (though
   each invocation benefits from its own caching).

4. **Process management complexity:** Must handle process lifecycle, error recovery, and
   output parsing.

5. **No automatic resume:** If the outer agent’s context compacts, it may lose track of
   inner invocations unless handoff state is persisted to files.

#### Implementing a Custom Compaction/Handoff Cycle

This is the most interesting application of the outer-loop pattern.
The idea:

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
3. **Evaluate:** Read the inner agent’s output and handoff document
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

The **Agent SDK** (Python and TypeScript packages) provides even more programmatic
control:

```python
# PSEUDOCODE — illustrates the concept, not actual API.
# Real SDK: `pip install claude-code-sdk`, import is `claude_code_sdk`.
# See https://platform.claude.com/docs/en/agent-sdk/overview for actual usage.

from claude_code_sdk import claude_code  # actual import path

result = claude_code(
    prompt="Refactor the auth module",
    model="opus",
    options={
        "system_prompt": "You are a refactoring specialist...",
        "allowed_tools": ["Read", "Edit", "Bash"],
        "max_turns": 20,
    }
)
```

### 8. Comparison: Native Sub-Agents vs Agent Teams vs Outer Loop

| Dimension | Native Sub-Agents | Agent Teams (Experimental) | Outer Loop (claude -p) |
| --- | --- | --- | --- |
| Setup complexity | Low (built-in) | Medium (experimental flag) | High (custom orchestration) |
| Model control | Limited (env var/config) | Per-teammate | Full CLI control |
| Context isolation | Partial | Full | Full |
| Inter-agent comms | None (report to parent) | Direct messaging | Via files/handoff docs |
| Nesting depth | 1 level only | 1 level only | Unlimited |
| Parallelism | Background mode | Native (tmux/in-process) | Shell backgrounding |
| Custom compaction | No | No | Yes (explicit handoffs) |
| Session persistence | Sub-agent transcripts | Teammate transcripts | Full session persistence |
| Token efficiency | Good (shared caching) | Low (separate instances) | Low (separate processes) |
| Maturity | Stable | Experimental | DIY (all stable primitives) |
| Permission control | Inherited + overrides | Inherited | Fully independent |

### 9. Creating Custom Sub-Agent Delegation Frameworks

#### Yes, Custom Sub-Agents Are a First-Class Extension Point

Claude Code’s sub-agent system is designed to be extended.
You can create your own sub-agents that participate in the same delegation framework as
the built-in ones. Claude uses each sub-agent’s `description` field to decide when to
delegate, so a well-described custom sub-agent will be automatically invoked for
matching tasks.

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

You can build a custom pipeline by creating several specialized sub-agents and having
the main agent (or a coordinator sub-agent) chain them:

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

When running Claude as a named agent via `claude --agent coordinator`, you can restrict
which sub-agents it can spawn:

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

The `Task(researcher, implementer, reviewer)` syntax is an allowlist — only those three
sub-agents can be spawned.
This restriction only applies to agents running as the main thread with
`claude --agent`.

#### Limitations of Custom Delegation

1. **No custom delegation logic:** You cannot write code that runs inside Claude Code’s
   delegation decision.
   The delegation is based on Claude’s interpretation of `description` fields — it’s
   LLM-driven, not rule-based.

2. **No sub-agent-to-sub-agent communication:** Sub-agents can only report back to the
   parent. For inter-agent communication, use agent teams.

3. **No sub-sub-agents:** Sub-agents cannot spawn their own sub-agents.
   Pipelines must be orchestrated from the main conversation.

4. **Hook-based control is limited to shell commands:** Hooks run shell commands and use
   exit codes to allow/block.
   They can’t modify the sub-agent’s prompt or tools dynamically.

5. **No programmatic delegation override:** You can’t write a function that decides
   which sub-agent to use based on custom logic.
   You can only influence the decision via descriptions and deny lists.

#### Workaround: Full Custom Delegation via Outer Loop

For fully custom delegation logic, use the `claude -p` outer loop pattern (Section 7).
The outer Claude Code instance can implement arbitrary delegation logic:

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

This gives you fully custom delegation at the cost of managing the orchestration
yourself.

### 10. Self-Managed Compaction and Agent Self-Restart

This section addresses a fundamental problem: **auto-compaction degrades quality
progressively**, and there is no built-in way for an agent to “kill itself and
rejuvenate” with a clean context window.
We explore every available mechanism for an agent to manage its own context lifecycle.

#### The Problem with Auto-Compaction

Built-in auto-compaction triggers at ~95% context capacity.
It uses an LLM call to summarize the conversation, then continues with the summary.
Known problems:

1. **Progressive context loss.** Each compaction summarizes the summary, causing
   exponential detail loss.
   By the 2nd or 3rd compaction, critical decisions, failed approaches, and nuanced
   understanding are typically gone.
2. **Late trigger.** At 95% capacity, model performance is already degraded.
   Practitioners recommend treating 70% as the practical ceiling.
3. **Not task-aware.** Compaction fires purely on token count, not at semantic
   boundaries (e.g., between phases of work).
4. **Infinite compaction loops.** A known bug where Claude Code gets stuck cycling
   between compaction and work.
5. **Buffer overhead.** Claude Code reserves ~33K-45K tokens as buffer, so usable
   context is less than the raw 200K.

**Configuration:**

```json
// Trigger compaction earlier (at 70% instead of ~95%)
{
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "70"
  }
}
```

The `/compact` command also accepts custom focus instructions:
```
/compact focus on the authentication refactoring decisions and failed approaches
```

#### Approach 1: tbd Agent Handoff (Simplest)

The `tbd shortcut agent-handoff` shortcut generates a structured handoff prompt
optimized for the next agent.
It captures:

- Task and spec context
- Current branch, PR, CI status
- tbd issue IDs and statuses
- Failed approaches and key decisions
- Non-obvious setup requirements

**Workflow:**

```
1. Agent detects it's getting long/complex
2. Agent runs: tbd shortcut agent-handoff
3. Output is a structured prompt
4. User pastes it into a new Claude Code session
5. New session starts fresh with full context
```

**Critical pre-handoff step:** Always run `tbd sync` before generating the handoff to
ensure issue state is pushed to the remote.

**Advantage over auto-compaction:** The handoff is curated — it captures *what matters*,
not a generic summary.
Failed approaches (the most valuable information) are explicitly preserved.

#### Approach 2: Outer Loop with `claude -p` (Semi-Autonomous)

The agent spawns a fresh Claude Code instance via the Bash tool.
The current session waits for the subprocess to complete, then continues.

```bash
# Agent writes handoff, then spawns a fresh instance
claude -p "$(cat .handoff/current.md)" \
  --model opus \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
  --max-turns 30 \
  --max-budget-usd 5.00
```

**Key flags for self-restart:**

| Flag | Purpose |
| --- | --- |
| `-p "prompt"` | Non-interactive mode |
| `--output-format json` | Get session_id, metadata back |
| `--max-turns N` | Prevent runaway (budget the phase) |
| `--max-budget-usd N` | Hard spending cap |
| `--append-system-prompt "..."` | Inject handoff instructions |
| `--system-prompt-file ./prompt.txt` | Full custom system prompt |
| `--session-id UUID` | Control session identity |
| `--no-session-persistence` | Don't save (for throwaway work) |

**What happens to the current session?** It blocks on the Bash call until the subprocess
finishes, then continues.
The subprocess is fully independent — its own context window, model, permissions.
The old session does NOT terminate itself.

**Can the agent truly “self-restart”?** Not quite — the old session persists and waits.
But the *effective* behavior is the same: work transfers to a fresh context.
To get true self-termination, use the outer loop shell script (Approach 4).

#### Approach 3: Session Chaining with `--continue` and `--resume`

```bash
# Continue most recent session (appends to existing context)
claude -c -p "Now fix the remaining test failures"

# Resume a specific session by ID
claude -r "abc123-def456" -p "Continue from where you left off"

# Fork: new session ID, inherits history up to fork point
claude --resume "abc123" --fork-session
```

**Important distinction:**
- `--continue`/`--resume` **reloads the full conversation history**. This is NOT
  compaction — it carries the full context and can hit `prompt_too_long` errors if the
  session was already near limits.
- **Forking** is useful for trying alternative approaches without losing the original
  session.

**When to use this vs handoff:**
- Use `--continue` when context is still manageable and you want continuity.
- Use a handoff (fresh `-p`) when context is bloated and you want a clean restart with
  curated state.

#### Approach 4: Ralph Loop Shell Script (Fully Autonomous)

The “Ralph Loop” pattern: a shell script runs `claude -p` in a loop, with each iteration
getting a fresh context window.
State persists in the filesystem, not in the model’s memory.

```bash
#!/bin/bash
# ralph-loop.sh — Autonomous compaction via iteration

TASK_FILE=".handoff/task.md"
STATE_FILE=".handoff/state.md"
MAX_ITERATIONS=20

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i ==="

  PROMPT="You are iteration $i of $MAX_ITERATIONS.
Read $STATE_FILE for current progress.
Read $TASK_FILE for the overall task.
Do ONE meaningful unit of work, then update $STATE_FILE.
If the task is complete, write DONE as the first line of $STATE_FILE."

  claude -p "$PROMPT" \
    --model opus \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    --max-turns 30 \
    --max-budget-usd 3.00

  # Check if done
  if head -1 "$STATE_FILE" 2>/dev/null | grep -q "DONE"; then
    echo "Task completed in $i iterations"
    break
  fi

  # Commit progress between iterations
  git add -A && git commit -m "ralph loop: iteration $i" --no-verify 2>/dev/null
done
```

**Key design principles:**

1. **State lives in files, not context.** The state file is the “memory” that survives
   across iterations. Each iteration reads it, works, updates it.
2. **One unit of work per iteration.** Don’t try to do everything in one pass.
   Let the loop handle continuity.
3. **Git commits between iterations.** Each iteration’s work is preserved in git,
   providing a safety net and audit trail.
4. **Budget limits per iteration.** Prevents any single iteration from running away.

**Overnight batch processing:** A team at a YC hackathon used this pattern to produce
1,100+ commits across six repos overnight for ~$800 ($10.50/hour/agent).

#### Approach 5: Hooks-Based Compaction Management

Use Claude Code hooks to automate parts of the compaction lifecycle.

**Backup context before auto-compaction:**

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/backup-transcript.sh"
      }]
    }]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/backup-transcript.sh
INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path')
BACKUP_DIR="$CLAUDE_PROJECT_DIR/.handoff/backups"
mkdir -p "$BACKUP_DIR"
cp "$TRANSCRIPT" "$BACKUP_DIR/transcript_$(date +%Y%m%d_%H%M%S).jsonl"
exit 0
```

**Inject handoff context after compaction (unreliable — see caveat):**

**Caveat:** The `SessionStart` hook with `compact` matcher has a
[known bug (Issue #15174)](https://github.com/anthropics/claude-code/issues/15174) — the
hook executes but stdout may not be injected into context after compaction completes.
This means the pattern below may silently fail.
Test in your environment before relying on it, and prefer the `PreCompact` backup
approach above as the more reliable hook-based strategy.

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "compact",
      "hooks": [{
        "type": "command",
        "command": "cat .handoff/current.md 2>/dev/null || echo 'No handoff context'"
      }]
    }]
  }
}
```

**Force handoff before session ends:**

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "Before stopping: update .handoff/current.md with current state, run tbd sync, and commit the handoff file."
      }]
    }]
  }
}
```

#### Approach 6: Git-Based Handoff (Cross-Device, Cross-Agent)

The agent writes handoff state to a git-tracked file, commits, pushes.
Any subsequent session (local, cloud, different machine) picks it up by pulling.

```bash
# Current agent writes handoff and pushes
cat > .handoff/current.md << 'HANDOFF'
# Handoff: OAuth2 Implementation
## Phase: 3/5 — Email Notification Service
### Completed: database models, API endpoints, token validation
### In Progress: email template rendering
### Failed Approaches:
- Session cookies: cross-origin issues with mobile app
- SendGrid API v2: deprecated, had to migrate to v3
### Key Decisions:
- JWT over opaque tokens (client-side validation needed)
### Next Steps:
1. Complete email templates in src/notifications/templates/
2. Wire up frontend form to POST /api/auth/register
HANDOFF
git add .handoff/current.md && git commit -m "handoff state" && git push
```

```bash
# New session (anywhere) picks it up
git pull
claude -p "Read .handoff/current.md and continue the task."
```

**Advantages:** Durable (survives VM teardowns), auditable (git log), works across the
Cloud/local boundary.

**Disadvantage:** Commit noise.
Use a `.handoff/` directory and consider squashing handoff commits later.

#### Approach 7: tbd Handoff Integration (Recommended for This Project)

Combining tbd’s issue tracking with structured handoffs provides the most robust pattern
for our project:

```
1. Agent works on tbd issue(s)
2. Agent detects it's approaching context limits
   (or human decides it's time to hand off)
3. Agent runs: tbd shortcut agent-handoff
4. Agent runs: tbd sync
5. Agent commits any WIP + handoff file
6. Agent pushes
7. New session starts:
   - Reads .handoff/current.md
   - Runs tbd prime (restores full tbd context)
   - Runs tbd ready (sees what issues to work on)
   - Continues implementation
```

This is strictly better than auto-compaction because:
- The handoff is **curated** (not a generic LLM summary)
- Failed approaches are explicitly captured
- tbd issues provide structural continuity across sessions
- Git provides a safety net and audit trail
- Works across Cloud/local boundary

#### Cloud-Specific Considerations

**Can a Cloud session restart itself?** Not directly — a Cloud session cannot spawn a
new Cloud session. However:

- The agent can write a handoff file, commit, and push.
  A new Cloud session (started by the user) will see it.
- From local: `claude --remote "Read .handoff/current.md and continue"` spawns a new
  Cloud session.
- Teleport (`/tp`) pulls a Cloud session to local, where you have full shell control for
  outer loops.

**For autonomous self-restart in Cloud:** The most practical pattern is to use hooks
(Stop hook forces handoff) + git-based state + human starts a new Cloud session.
True autonomous restart requires local CLI or a shell script runner.

#### Token Budget Awareness

Can an agent detect when it’s approaching context limits?

1. **System-level warnings** are injected into context when token usage is high.
   The format varies but includes remaining token count.
2. **`/context` command** shows current context usage breakdown in interactive mode.
3. **`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`** can be set to 70% to trigger compaction
   earlier, before quality degrades.
4. **Subagents get their own context** — offloading work to sub-agents naturally reduces
   main context pressure.

**There is no programmatic API for an agent to query its own token usage.** The agent
can’t invoke `/compact` programmatically either.
The closest workaround: set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70`, configure a
`PreCompact` hook to back up state, and a `SessionStart(compact)` hook to inject the
handoff after compaction.

#### Approach 8: Bead-Managed Loop (Structured Iteration via Issue Tracking)

The most structured variant of the Ralph Loop: use **tbd beads** to track each iteration
as a separate issue, with parent-child relationships providing a clear audit trail and
structured context for the next agent.

**Core idea:** A parent bead represents the overall task.
Each iteration spawns a child bead that captures what happened in that step.
The next iteration reads the chain of completed child beads to understand full history —
without relying on context window memory at all.

**Why this is powerful:**

1. **Each bead is a structured summary.** Not a generic LLM compaction — a deliberate,
   curated record of what was attempted, what worked, what failed.
2. **The chain is the memory.** After 50 restarts, you have 50 beads.
   The next agent reads the recent ones (not all 50) to understand current state and
   trajectory.
3. **Beads survive everything.** Context compaction, session crashes, VM teardowns,
   Cloud/local boundary crossings.
   They’re git-native.
4. **Natural stopping points.** Each bead close is a clean checkpoint.
   If something goes wrong, you can see exactly which iteration introduced the problem.
5. **Dependency tracking.** Child beads can depend on each other sequentially, so
   `tbd ready` naturally surfaces the next step.

**Implementation pattern (shell orchestrator):**

```bash
#!/bin/bash
# bead-loop.sh — Ralph Loop with bead-per-iteration tracking

PARENT_BEAD="$1"  # e.g., "ar-k8m2" — the overall task bead
MAX_ITERATIONS=50
TASK_FILE=".handoff/task.md"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i ==="

  # Create a child bead for this iteration
  CHILD_ID=$(tbd create "Iteration $i of: $(tbd show $PARENT_BEAD --json | jq -r '.title')" \
    --type task --priority P2 --json | jq -r '.id')
  tbd dep add "$CHILD_ID" "$PARENT_BEAD"
  tbd update "$CHILD_ID" --status in_progress

  PROMPT="You are iteration $i of up to $MAX_ITERATIONS.

TASK: Read $TASK_FILE for the overall objective.

PREVIOUS ITERATIONS: Run 'tbd show $PARENT_BEAD' to see the parent task,
then check its child beads for history of previous iterations.

YOUR JOB:
1. Read the most recent closed child beads to understand what's been done
2. Do ONE meaningful unit of work toward the objective
3. When done, update bead $CHILD_ID with a clear summary:
   tbd close $CHILD_ID --reason 'Did X. Result: Y. Next: Z.'
4. If the OVERALL task is complete, also close $PARENT_BEAD
5. Run tbd sync"

  claude -p "$PROMPT" \
    --model opus \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    --max-turns 30 \
    --max-budget-usd 3.00

  tbd sync

  # Check if parent bead was closed (task complete)
  STATUS=$(tbd show "$PARENT_BEAD" --json | jq -r '.status')
  if [ "$STATUS" = "closed" ]; then
    echo "Task completed in $i iterations"
    break
  fi

  # Commit progress between iterations
  git add -A && git commit -m "bead loop: iteration $i ($CHILD_ID)" --no-verify 2>/dev/null
  git push 2>/dev/null
done
```

**Implementation pattern (tbd-native / future):**

The tbd harness itself could manage the loop, removing the need for a shell script:

```bash
# Hypothetical tbd command (not yet implemented)
tbd loop $PARENT_BEAD \
  --max-iterations 50 \
  --model opus \
  --budget-per-iteration 3.00 \
  --prompt-file .handoff/task.md
```

This would:
1. Create child beads automatically for each iteration
2. Build the prompt from parent bead + recent child bead history
3. Spawn `claude -p` with the constructed prompt
4. Close the child bead with the agent’s summary
5. Check if the parent bead was closed (done) or continue
6. Run `tbd sync` and `git push` between iterations

**What the bead chain looks like after 5 iterations:**

```
ar-k8m2  [open]     "Refactor auth module to use JWT"
  ├── ar-m3n1  [closed]  "Iteration 1: Analyzed current auth code, identified 3 modules"
  ├── ar-p4q2  [closed]  "Iteration 2: Created JWT token service, wrote tests"
  ├── ar-r5s3  [closed]  "Iteration 3: Migrated login endpoint, tests passing"
  ├── ar-t6u4  [closed]  "Iteration 4: Migrated registration endpoint, found edge case"
  └── ar-v7w5  [in_progress]  "Iteration 5: Fix edge case in token refresh"
```

Each closed bead’s `--reason` contains a structured summary: what was done, what the
result was, what should happen next.
This is far richer than auto-compaction’s generic summary.

**Advantages over plain Ralph Loop:**

| Aspect | Plain Ralph Loop | Bead-Managed Loop |
| --- | --- | --- |
| State format | Free-form text file | Structured beads with metadata |
| History | Single state file (overwritten) | Full chain of closed beads |
| Audit trail | Git commits only | Beads + git commits |
| Searchable | `grep` through state file | `tbd search`, `tbd show` |
| Resumable | Read state file | `tbd ready` surfaces next step |
| Cross-agent | Must share file path | `tbd sync` shares everywhere |
| Rollback | `git revert` | Close/reopen beads, `git revert` |
| Visibility | Log file | `tbd list` shows all iterations |

**When to use this vs plain Ralph Loop:**
- Use plain Ralph Loop for quick, low-ceremony autonomous work.
- Use bead-managed loop when you want full traceability, when multiple people/agents
  might inspect progress, or when iterations are complex enough that a one-line state
  file isn’t sufficient.

#### Decision Matrix: Which Approach to Use

| Approach | Complexity | Context Quality | Autonomy | Cloud? | Best For |
| --- | --- | --- | --- | --- | --- |
| `/compact` (built-in) | None | Low-Medium | Automatic | Yes | Quick extension of a session |
| `tbd agent-handoff` | Low | High | Manual | Yes | Structured team/project handoffs |
| `claude -p` from session | Medium | High | Semi-auto | Local only | Agent-initiated fresh start |
| `--continue`/`--resume` | Low | Full (risky) | Manual | Yes | Quick session pickup |
| Ralph Loop script | High | High | Fully auto | Local only | Long autonomous multi-phase work |
| Bead-managed loop | High | Highest | Fully auto | Yes* | Traceable multi-phase with full audit trail |
| Hooks (Pre/Post compact) | Medium | Medium-High | Automatic | Yes | Augmenting auto-compaction |
| Git-based handoff | Medium | High | Semi-auto | Yes | Cross-device, cross-agent work |
| tbd handoff + git | Medium | Highest | Semi-auto | Yes | This project specifically |

\* Bead-managed loop: the shell orchestrator runs locally, but beads sync via git so
progress is visible everywhere.
A tbd-native orchestrator could run in any environment.

* * *

## Recommendations

### For Most Workflows: Use Native Sub-Agents with Model Overrides

1. Set `CLAUDE_CODE_SUBAGENT_MODEL` to ensure sub-agents use Opus when quality matters
2. Create custom sub-agents in `.claude/agents/` for project-specific specializations
3. Use the `resume` parameter for continuity across sub-agent invocations
4. Preload skills for domain knowledge injection

### For Complex Multi-Phase Projects: Consider the Outer Loop

When you need:
- Custom compaction cycles (better than auto-compaction)
- Arbitrary nesting depth
- Per-phase model selection
- Explicit handoff documents
- Budget limits per phase

The `claude -p` outer loop pattern provides maximum control at the cost of higher
complexity and latency.

### For Collaborative Multi-Agent Work: Use Agent Teams

When workers need to communicate with each other (not just report to parent), agent
teams provide native coordination.
But they’re experimental and have higher token costs.

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

* * *

## Next Steps

- [ ] Test `CLAUDE_CODE_SUBAGENT_MODEL` override in practice and verify behavior
- [x] Add `CLAUDE_CODE_SUBAGENT_MODEL` to this project’s `.claude/settings.json` (done:
  added `"env": { "CLAUDE_CODE_SUBAGENT_MODEL": "claude-opus-4-6" }`)
- [ ] Prototype the Ralph Loop script for this project (using tbd handoff)
- [ ] Test `PreCompact` and `SessionStart(compact)` hooks for context backup
- [ ] Evaluate token cost impact of forcing Opus on all sub-agents
- [ ] Create project-specific custom sub-agents for common tasks
- [ ] Configure Stop hook to force handoff before session ends
- [ ] Experiment with agent teams for collaborative debugging workflows

* * *

## References

### Official Claude Code Documentation

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Complete
  sub-agent configuration reference

- [Model configuration](https://code.claude.com/docs/en/model-config) — Model aliases,
  environment variables, and settings

- [CLI reference](https://code.claude.com/docs/en/cli-reference) — All CLI flags
  including `--model`, `--agents`, `--system-prompt`

- [Settings](https://code.claude.com/docs/en/settings) — Configuration scope hierarchy
  and environment variables

- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
  — Agent teams reference (experimental)

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) — Agent
  SDK and `claude -p` usage

- [Common workflows](https://code.claude.com/docs/en/common-workflows) — Workflow
  patterns including parallel sessions with git worktrees

- [Hooks](https://code.claude.com/docs/en/hooks) — Lifecycle hooks including
  SubagentStart/SubagentStop events

- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) —
  Cloud environment configuration including environment variables

- [Manage Claude’s memory](https://code.claude.com/docs/en/memory) — Context management,
  compaction, and `/compact` command

- [Slash commands](https://code.claude.com/docs/en/slash-commands) — `/compact`,
  `/context`, `/model`, `/agents`, `/status` commands

### Compaction and Handoff Patterns

- [The Ralph Loop](https://awesomeclaude.ai/ralph-wiggum) — Foundational outer-loop
  pattern for autonomous multi-iteration work
- [Smart Handoff for Claude Code](https://blog.skinnyandbald.com/never-lose-your-flow-smart-handoff-for-claude-code/)
  — Custom compact message + WORKING.md pattern
- [Continuous-Claude-v3](https://github.com/parcadei/Continuous-Claude-v3) —
  Ledger-based persistence with handoffs and TLDR analysis
- [claude-handoff plugin](https://github.com/willseltzer/claude-handoff) — Emphasizes
  documenting failed approaches in handoffs
- [claude-code-handoff](https://github.com/nlashinsky/claude-code-handoff) — JSON-based
  machine-readable handoff format
- [Self-checkpoint feature request (Issue #21776)](https://github.com/anthropics/claude-code/issues/21776)
  — Proposed but closed as duplicate
- [SessionStart hook bug with compact matcher (Issue #15174)](https://github.com/anthropics/claude-code/issues/15174)
  — Hook executes but stdout not injected after compaction
- [Context backups: beat auto-compaction](https://claudefa.st/blog/tools/hooks/context-recovery-hook)
  — PreCompact hook for transcript backup

### Anthropic Research

- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
  — Anthropic’s internal orchestrator-worker pattern (Opus lead + Sonnet workers)

### Agent SDK

- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Python
  and TypeScript SDK for programmatic Claude Code usage
- [Streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) —
  Real-time streaming with callbacks
- [Structured outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
  — JSON schema validation for agent output

### Related Internal Research

- [Running Claude Code Across Environments](research-running-claude-code.md) —
  Multi-agent orchestration landscape survey
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) — UNIX-like
  primitives for agent coordination
