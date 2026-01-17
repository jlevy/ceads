# Agent Coordination Kernel

I’m going to answer this the way I’d approach it if I were trying to invent a
“coordination kernel” that could survive multiple model ecosystems, multiple UI
surfaces, multiple execution substrates, and still feel UNIX-y instead of like a
monolith.

The big idea: **separate durable truth from live coordination** and make *both* look
like simple, composable streams and files.

* * *

## What you’re really building

You’re not building “a better Beads.”
You’re building the missing OS primitives for “programs (agents) that collaborate,”
where:

* **Agents are processes** (Claude Code, Codex, etc.).
* **Tasks / issues are durable state** (should live in Git/GitHub with good merge
  behavior).
* **Coordination is ephemeral state** (leases, presence, inboxes, wakeups).
* **Execution is a substrate** (local shell, tmux panes, containers, Sprites,
  Codespaces, Claude Code Cloud, etc.).
* **UIs are just I/O devices** (Slack, Cursor/VSCode, web dashboards, terminal).

If you get the primitives right, *Gas Town / Agent Mail / TBD / Sprites* become
interchangeable “userlands,” not architectural commitments.

* * *

## The UNIX-like strategy

UNIX won by having a tiny number of primitives that compose:

* A **uniform representation** (bytes / files).
* A **uniform composition mechanism** (pipes).
* **Small tools** that do one thing well.

For agent orchestration, the equivalents can be:

1. **Durable objects as files** (Git-friendly, human-readable, inspectable).
2. **Live events as streams** (line-delimited JSON).
3. **Idempotent controllers** that subscribe → decide → publish.
4. **Adapters** that map external systems (Slack, GitHub, Sprites, IDEs) into the same
   event stream.

This gives you: *simple tools are simple, complex tools are possible.*

* * *

## The primitives I’d standardize

If you standardize only a handful of concepts, everything else becomes a thin layer.

### 1) Entity Store (durable truth)

**What it is:** A Git-native, merge-friendly store of “things that matter later.”

**Entities you want (minimum viable set):**

* `work_item` (issue/task)
* `artifact` (a diff, commit, PR URL, build log, trace, transcript)
* `agent` (long-lived identity + metadata, not “presence”)
* `message` (optional, but useful even durably: comments, handoffs, decisions)

**Interface (UNIX-ish):**

* `store get <id>` → prints canonical JSON/YAML/MD
* `store put <entity>` → writes file(s) atomically
* `store query …` → prints JSON lines
* `store watch` → prints change events as JSON lines

**Why it matters:** This is your “Git is the database” layer (TBD is already close).
It should work everywhere without sqlite/daemons.

**Design rule:** durable store should support **eventual consistency** and **conflict
preservation** (attic), not “perfect locks.”

* * *

### 2) Event Journal (append-only log)

**What it is:** The universal coordination substrate.
Everything that happens can be expressed as an event.

**Why it’s the real keystone:** You can implement *every other feature* as a projection
(a “view”) over an event log.
And you can bridge event logs across transports.

**UNIX representation:** **JSON Lines**.

Example event envelope (the boring part you standardize):

```json
{
  "event_id": "01J...ULID",
  "ts": "2026-01-17T00:58:12Z",
  "project": "repo@origin",
  "type": "work.claimed",
  "actor": { "agent_id": "agent:claude-07", "session_id": "sess:..." },
  "refs": { "work_id": "is-01hx...", "thread_id": "th-..." },
  "body": { "...": "..." }
}
```

**Critical fields to standardize:**

* `event_id` (ULID so it sorts by time)
* `type` (namespace like `work.*`, `lease.*`, `msg.*`, `run.*`)
* `actor.agent_id` and `actor.session_id`
* `refs.work_id` / `refs.thread_id`
* `idempotency_key` (optional but *hugely* useful)

**Rule:** Journals are **append-only**, never edited.
That eliminates a ton of distributed-systems pain.

* * *

### 3) Materializer (view builder)

**What it is:** A pure function: `events -> current state`.

It produces:

* “Current issue list”
* “Who has claimed what”
* “What’s blocked”
* “Unread inbox”
* “Active agents”

In UNIX terms: it’s `awk`/`sed` for your event stream.

**Interface:**

* `materialize work` → prints a stable snapshot (JSON/MD)
* `materialize inbox --agent agent:foo`
* `materialize status`

**Why it matters:** It lets you store durable truth as:

* either files (TBD style), **or**
* append-only journals,
* or both (journals for merge-safety + periodic materialized snapshots for humans)

This is the mechanism that keeps you from building monoliths: state is derived, not
“maintained by a server.”

* * *

### 4) Lease (ephemeral exclusivity)

**What it is:** A time-bound claim on a resource.

This is the simplest “real-time coordination primitive” that is actually worth
standardizing.

**Properties:**

* TTL-based (`acquire`, `renew`, `release`)
* Advisory (clients cooperate) *or* enforced (if you have a trusted backend)
* Applies to: work items, files, directories, test environments, runners

**Event types:**

* `lease.acquire`, `lease.renew`, `lease.release`, `lease.expire`

**Why leases beat locks:** They degrade gracefully.
If an agent crashes, the world heals.

**UNIX analogy:** like `flock`, but distributed and TTL-based.

* * *

### 5) Mailbox (directed message stream)

**What it is:** Agent-to-agent (and human-to-agent) messages as events.

**Key:**

* Messages are *just events* with `to` and `thread_id`.

**Why this matters:** It’s the “Agent Mail” concept, but it becomes
transport-independent:

* Could be Git (slow)
* Could be websocket relay
* Could be Slack
* Could be a managed pub/sub service
* Could be local sockets

**UNIX interface:**

* `msg send --to agent:foo --thread th-123 --work is-abc --body @file.md`
* `msg recv --me agent:me --follow`

* * *

### 6) Runner (execution substrate)

**What it is:** A standard “job execution” interface so agents can ask *something* to
run code/tests/builds anywhere.

Think “cron + ssh + container + sprites” unified behind one contract.

**Event types:**

* `run.requested { cmd, env_spec, repo_ref, inputs }`
* `run.completed { exit_code, artifacts, logs_ref }`

**Why this is huge:** It decouples “agent intelligence” from “where code runs.”

* Claude Code Cloud might not allow arbitrary networking.
* Sprites does.
* Local does.
* CI does.

If your orchestration primitives include `run.*`, you can swap environments without
rewriting the agent layer.

* * *

### 7) Bridge (adapters to the outside world)

**What it is:** A small process that maps external I/O into events and back.

Examples:

* Slack bridge: Slack thread ↔ `msg.*` + `work.*`
* GitHub bridge: Issues/PRs ↔ `work_item` + `artifact`
* IDE bridge: Cursor/VSCode actions ↔ `work.*` events
* Sprites bridge: `run.*` ↔ sprites API calls

**UNIX rule:** bridges should be dumb and stateless; any state lives in journals/stores.

* * *

## The single most important design choice: “Everything is a stream”

If you choose *one* compositional model, choose this:

* Every component **consumes a stream of events**
* It maintains only a small local cache
* It **emits events**
* Its behavior is **idempotent** (safe to replay)
* You can run N copies and not corrupt the world

This is how you avoid monoliths while still enabling complex systems.

It’s also how you get:

* replay/debuggability
* audit trails
* “time travel” in coordination
* easy integration testing (just feed recorded event logs)

* * *

## How this composes into systems (examples)

### A) “Git-only” coordination (no backend, maximum portability)

* Durable store: TBD (issues/files on `tbd-sync`)
* Journal: Git-backed append-only event log (per-agent files)
* Coordination: slow polling + `git fetch`
* Best for: Claude Code Cloud, restricted sandboxes, offline workflows

**Composition:**

* agent loop:

  * `tbd ready --json | choose-one | tbd update --status in_progress`
  * do work
  * `tbd close …`
  * `git push`

**Limitation:** real-time handoff is slow.

* * *

### B) “Git + Relay” coordination (small backend, still simple)

* Durable store: TBD/GitHub
* Live relay: a tiny websocket/NATS/redis-streams service (managed or self-hosted)
* Bridges mirror events to/from Git

**This gives you:**

* instant “someone claimed this”
* presence
* mailbox delivery
* file leases

But if relay dies, you still have durable truth in Git.

* * *

### C) “Slack as UI, relay as coordination, Git as truth”

* Slack threads are just views into `work_id + thread_id`
* Slack messages become `msg.sent` events
* The system posts status back to Slack by subscribing to `work.updated`

This yields your goal: “track issues and correct fixes and manage from Slack.”

* * *

### D) Gas Town-style tmux orchestration becomes “just one client”

If your primitives exist, Gas Town doesn’t need to be the architecture.
It becomes:

* a UI for spawning agent processes
* a local scheduler that assigns tasks
* a dashboard that watches the event stream

Same with Cursor/VSCode integrations.

* * *

## The “least-monolithic” set of binaries I’d ship

If I were building this as a UNIX-y toolkit, I’d ship **5 CLIs** that speak JSONL:

1. `wk` — work item store ops

   * wraps TBD-ish file layout + git sync

2. `ev` — event journal ops

   * `ev emit`, `ev tail`, `ev replay`

3. `lease` — lease ops

   * can run in local-only mode or via relay

4. `msg` — mailbox ops

   * can be durable-only (Git) or live (relay)

5. `run` — runner ops

   * `run request`, `run poll`, `run attach`

Everything else is a bridge:

* `bridge-slack`
* `bridge-github`
* `bridge-sprites`
* `bridge-mcp` (so Claude/Codex can call these as tools)

Each binary is small.
You can compose them with pipes.
You can replace any one of them later.

* * *

## A concrete “kernel contract” you can implement once

If I had to pick the one contract that enables everything, it’s:

### The Agent Bus Contract

A minimal spec with **three capabilities**:

1. **Publish**

* input: JSON event
* output: ack `{event_id}`

2. **Subscribe**

* input: `filter` (types/topics, project, agent, work_id)
* output: JSON events (stream)

3. **Durable snapshot**

* input: `since` cursor or “latest”
* output: events (replay) or materialized state

Then you provide multiple backends:

* `bus://git` (slow, replay via pulls)
* `bus://ws` (fast, relay)
* `bus://nats` / `bus://redis` (fast)
* `bus://stdio` (local composition)

This is the “below models” layer.
Claude Code and Codex don’t care; they just call tools that publish/subscribe.

* * *

## How you keep it robust across environments

A few “principal engineer” rules I’d enforce hard:

### Rule 1: Multi-writer safety via per-writer append-only logs

If multiple agents write to the same file, Git conflicts happen.
If each agent writes to its **own journal**, merges become trivial.

* `.coord/journal/agent-07.jsonl`
* `.coord/journal/agent-12.jsonl`

Then materialize a view.

This is the same trick that makes distributed logs workable without CRDT wizardry.

### Rule 2: Durable is Git; live is optional

Never require the live layer for correctness.
Use it for latency and convenience.

### Rule 3: Don’t mix “tracker state” with “coordination state”

* Tracker: issues, artifacts, decisions → Git
* Coordination: leases, heartbeats, routing → live bus (and optionally mirrored for
  audit)

### Rule 4: Every action is idempotent

If an agent crashes mid-action, a restarted agent can retry safely because:

* writes are append-only events
* materializer resolves duplicates via `idempotency_key`

* * *

## Where this lands relative to TBD / Agent Mail

* **TBD** is a great durable **entity store** (issues).
  Extend it with:

  * `agents/` and `messages/` collections (as your doc suggests)
  * `tbd watch --json` (turn changes into a stream)

* **Agent Mail** is a great **mailbox + lease server**. You can keep its semantics but
  make the interface more general:

  * leases apply to work items, files, environments
  * mailbox messages unify with “issue comments” and Slack threads

* **Gas Town** is a UI + orchestration client.
  It becomes one “controller” that reads from the bus and writes back decisions.

This reduces lock-in: you can swap Gas Town out for a Slack-first controller, or a web
UI, without touching the underlying primitives.

* * *

## If I had to propose one “new primitive” that feels like UNIX

Here’s the one that I think is the deepest “UNIX-like” move:

### `watch` as a first-class interface

Everything should have a `watch` that emits JSONL events:

* `tbd watch`
* `lease watch`
* `msg watch`
* `run watch`

Because once “watch” exists, you can glue *anything* together using pipes:

* `tbd watch | bridge-slack`
* `msg watch --me agent:foo | agent-runner`
* `run watch --status failed | pagerduty-bridge`
* `tbd watch | jq … | xargs …`

A huge amount of orchestration can be achieved with shell scripts + systemd + tmux once
you have watchable streams.

* * *

## A roadmap that stays non-monolithic

If you want to move fast without building a platform:

1. **Ship the durable core (TBD)**

   * issues in Git, conflict-minimized, no daemon

2. **Add “messages” as durable entities**

   * issue comments + handoffs as files

3. **Add `watch` producing JSONL**

   * file watching + git polling
   * becomes the universal composition point

4. **Add a tiny optional relay**

   * websocket fanout + TTL leases
   * stateless; can be hosted/managed later

5. **Add bridges**

   * Slack
   * GitHub Issues/PRs
   * Sprites runner (optional)
   * MCP tool server wrapper (so any agent can call primitives)

At every step, you haven’t committed to a monolith.
You’ve just added a tool.

* * *

## The mental model I’d keep repeating

* **Git is your filesystem.**
* **The event log is your syslog.**
* **Leases are your flock().**
* **Mailboxes are your pipes/signals.**
* **Runners are your exec().**
* **Bridges are your device drivers.**

If you build those primitives with clean interfaces, you’ll be able to orchestrate:

* Claude Code in Cursor
* Claude Code Cloud sandboxes
* Sprites VMs
* Codex agents
* future models

…without rewriting architecture every time a new environment or model shows up.

If you want, I can sketch a concrete event type taxonomy (`work.*`, `msg.*`, `lease.*`,
`run.*`, `agent.*`) and a minimal CLI UX that maps cleanly onto those primitives, while
staying backward-compatible with TBD commands (so “agents can just use `tbd`” and
“orchestrators can use the bus”).
