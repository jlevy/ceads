# Tbd research & design brief

*(Broad architecture + product design review; with an incremental strategy for “replace
Beads now” + “level up coordination later”)*

## 0. Context and what you’re optimizing for

You’re solving two problems at once:

1. **Immediate replacement for Beads** A CLI-first, agent-friendly tracker that people
   actually *use*, but without the architectural debt (glitches, sync weirdness, daemon
   fights, messy codebase) that makes Beads painful to patch.

2. **A coordination substrate that survives the next 12–24 months of workflow shifts**
   Many agents + many humans, across many environments (local, CI, cloud sandboxes like
   Claude Code Cloud), coordinating on GitHub repos—eventually with more real-time needs
   and more external tools.

Your draft (“Tbd”) is already pointed in the right direction: *git-native, layered,
offline-first, and progressive enhancement.* The key question is how to **keep v1
extremely shippable** while defining the right seams for later “bridge / real-time /
tool broker” layers.

* * *

## 1. Research: current practices, tools, and constraints

### 1.1 Beads: why it’s popular, and why it’s brittle

Beads’ popularity is a strong signal that **git-backed coordination artifacts** work
well for agents and humans—especially when they live “next to the code” and require no
central SaaS.

From Beads’ own documentation, the architecture includes:

- issues stored as **JSONL in a `.beads/` directory**

- a **SQLite local cache**

- and a **background daemon** to coordinate/optimize workflows
  ([GitHub](https://github.com/steveyegge/beads "GitHub - steveyegge/beads: Beads - A memory upgrade for your coding agent"))

Beads has also evolved worktree-/branch-related complexity (and users end up learning
about “special modes” and “special branches” instead of just using git normally).
For example, Beads documents enhanced **git worktree support** with shared database
architecture
([GitHub](https://github.com/steveyegge/beads/blob/main/docs/WORKTREES.md?utm_source=chatgpt.com "beads/docs/WORKTREES.md at main · steveyegge/beads")),
and it has docs around **protected branches / sync branch** modes
([GitHub](https://github.com/steveyegge/beads/blob/main/docs/PROTECTED_BRANCHES.md?utm_source=chatgpt.com "beads/docs/PROTECTED_BRANCHES.md at main")).
This aligns with your lived experience: it’s not just “bugs”; the surface area and
invariants are hard.

**Takeaway:** Beads proved the product shape, but it also demonstrated a classic trap:
once you combine *daemon + local DB + tracked artifacts + git sync tricks*, you get a
system where debugging becomes “distributed systems archaeology.”

* * *

### 1.2 The “git-native issue tracker” ecosystem: patterns worth copying

There’s a surprisingly rich ecosystem of git-native trackers and workflows, and the most
relevant pattern is:

> *Keep the data model simple and inspectable; let git do distribution; avoid hidden
> background magic.*

Two examples that map directly to your goals:

- **ticket (wedow/ticket)** positions itself as a “full replacement for beads” and
  explicitly calls out avoiding “SQLite” and “rogue background daemon,” with a migration
  path (“migrate-beads”). It stores tickets as **Markdown with YAML frontmatter**
  ([GitHub](https://github.com/wedow/ticket?utm_source=chatgpt.com "wedow/ticket: Fast, powerful, git-native ticket ...")).
  This is basically a market validation of your instinct: “rewrite cleanly, keep it
  minimal, avoid daemon-first.”

- **beans (hmans/beans)** is another git-friendly, file-based tracker emphasizing
  local-first usage and simple storage, and has continued iteration on performance and
  workflow ergonomics
  ([GitHub](https://github.com/hmans/beans?utm_source=chatgpt.com "hmans/beans: A CLI-based, flat-file issue tracker for ...")).

And then there are more “git-object-native” approaches (e.g., git-bug) and “sync with
GitHub/GitLab” approaches (e.g., git-issue).
Even without deep-diving each, the lesson is consistent:

**Takeaway:** The winning “git-native” product designs tend to:

- store data as **plain files or git objects**

- remain **CLI-first**

- keep **background services optional**

- and treat GitHub as an optional mirror/bridge, not the truth by default

* * *

### 1.3 Agent coordination “in the wild”: local daemons, tmux swarms, and MCP servers

A lot of current agent coordination is basically “local hacks made reusable”:

- agents sharing a tmux session / a machine / a filesystem

- ad-hoc message passing

- scripts that assume a single host

Your mention of “Agent Mail” fits this pattern.
For example, `mcp_agent_mail` presents itself as an HTTP-only FastMCP server for “email
coordination,” and it’s backed by **Git and SQLite**
([GitHub](https://github.com/Dicklesworthstone/mcp_agent_mail "GitHub -
Dicklesworthstone/mcp_agent_mail: Like gmail for your coding agents.
Lets various different agents communicate and coordinate with each other.")).

At the same time, there’s an emerging *standard interface layer* that changes what
“integration” means:

- **Model Context Protocol (MCP)** is positioned as a standard way for models/agents to
  connect to tools, with a TypeScript-first schema and published spec; the MCP repo
  shows a release tagged “Latest Nov 25, 2025”
  ([Anthropic](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation "Donating the Model Context Protocol and establishing the Agentic AI Foundation \ Anthropic")),
  and Anthropic describes MCP as an open standard for connecting AI assistants to
  data/tools
  ([GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol "GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol")).

- MCP governance also moved under the **Linux Foundation** (per their announcements)
  ([GitHub](https://github.com/modelcontextprotocol "Model Context Protocol · GitHub")).

**Takeaway:** “Bridge layers” should increasingly be thought of as **MCP tool surfaces**
(or libraries behind MCP), rather than bespoke per-agent integrations.

* * *

### 1.4 Reality check: cloud agent environments are isolated and credential-constrained

This matters *a lot* for your “agents in their own environments completely separately”
concern.

Anthropic’s Claude Code on the web describes **isolated sandboxes** where credentials
(like git credentials) are not inside the sandbox, and git interactions are mediated
through a **proxy** that enforces policies (e.g., ensuring pushes go only to the
configured branch)
([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing "Making Claude Code more secure and autonomous with sandboxing \ Anthropic")).

This implies a key constraint:

> You cannot assume a “shared local daemon” or “agents talking to each other on
> localhost” will work across cloud agent products.

**Takeaway:** A git-native coordination plane that only needs “git fetch/push to GitHub”
is unusually compatible with cloud sandboxes—especially if it uses a **single known
branch** that can be allow-listed.

* * *

### 1.5 Practical GitHub integration constraints you must design around

If you build any GitHub bridge, you have to internalize a few non-negotiables:

- **Rate limits are real and multi-dimensional.** GitHub’s REST API docs describe a
  primary limit of **5,000 requests/hour** for authenticated users, with different rules
  for Apps and secondary limits that can trigger under concurrency/content-generation
  patterns
  ([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api "Rate limits for the REST API - GitHub Docs")).

- **Polling is discouraged; webhooks are the intended mechanism.** GitHub explicitly
  recommends subscribing to webhooks instead of polling to stay within rate limits
  ([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?utm_source=chatgpt.com "Best practices for using the REST API")).

- **Webhook security is mandatory.** GitHub recommends validating webhook signatures,
  and documents headers like `X-Hub-Signature-256` for HMAC verification
  ([GitHub Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries?utm_source=chatgpt.com "Validating webhook deliveries")).

- **Issues/PR comments share primitives.** GitHub’s REST docs note that “every pull
  request is an issue,” and issue comment endpoints cover both issues and PRs
  ([GitHub Docs](https://docs.github.com/rest/issues/comments?utm_source=chatgpt.com "REST API endpoints for issue comments")).

**Takeaway:** A bridge that “just syncs everything constantly” will fail in practice.
You need **event-driven sync**, aggressive caching, and explicit “promotion” semantics
(sync only what matters).

* * *

### 1.6 Why “no SQLite / no filesystem locking” is a durable constraint

Your spec calls this out strongly, and it’s justified.

SQLite’s own docs state: **WAL does not work over a network filesystem**
([SQLite](https://sqlite.org/wal.html?utm_source=chatgpt.com "Write-Ahead Logging")).
Their “SQLite Over a Network” guidance explains why remote filesystem use is tricky and
often pushes you toward a client/server DB or a proxy-on-the-db-host architecture
([SQLite](https://sqlite.org/useovernet.html?utm_source=chatgpt.com "SQLite Over a Network, Caveats and Considerations")).

**Takeaway:** If you want to work well on NFS/SMB/cloud-mounted volumes and ephemeral
sandboxes, “files as truth + atomic rename writes” remains a very robust baseline.

* * *

## 2. What you’re sure of vs. what’s still speculative

### 2.1 Things you’re sure of (treat as hard requirements)

1. **Many humans + many agents will use the CLI.** So: fast, stable commands;
   predictable exit codes; JSON output for scripting; great error messages.

2. **GitHub will be central.** So: you want a clean path to “GitHub as a mirror/event
   source,” but not a bridge that forces every agent to become a GitHub integration
   engineer.

3. **Agents will run in heterogeneous environments.** Local machines, CI runners,
   Codespaces-like IDEs, Claude Code Cloud sandboxes, etc.
   Sandboxed environments often restrict credentials and networking
   ([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing "Making Claude Code more secure and autonomous with sandboxing \ Anthropic")).

4. **Offline and eventual sync matter.** Git remains the only universally reliable
   cross-environment sync substrate.

5. **You cannot afford “mystery state.”** Every major failure mode must be debuggable by
   inspecting files and git history.
   That’s the product antidote to Beads frustration.

### 2.2 Things you’re not sure of (design for change)

1. **How “real-time” you really need.** Some teams can live with 30–120s eventual sync.
   Others need sub-second presence/claims.

2. **Whether GitHub should be the real-time bus or just the mirror.** GitHub is great
   for visibility and notifications, but it’s not designed to be your low-latency
   transactional coordination store.

3. **The right abstraction for “bridges.”** The long-term stable abstraction is likely
   “MCP tools + event sinks/sources,” but which exact set of external services will
   matter is uncertain.

4. **The durability model for messages/presence.** Archiving everything to git is simple
   but can create churn.
   Keeping things ephemeral reduces churn but loses auditability.

* * *

## 3. Broad review of the Tbd draft architecture

Your layered framing is the right move: **File → Git → CLI → Bridge**. This is a real
“escape hatch” architecture: when you need complexity, you add layers; when you don’t,
the tool stays simple.

### 3.1 The strongest architectural choices to keep

**Split architecture (config on main, data on a sync branch)** This is a huge product
win. It:

- avoids polluting feature branches with coordination merges

- makes it easy to allow-list pushes (important in sandboxed envs)
  ([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing "Making Claude Code more secure and autonomous with sandboxing \ Anthropic"))

- gives a clean “coordination branch” mental model

**File-per-entity instead of JSONL** This is the single biggest reliability decision:

- parallel creation has zero conflict

- conflicts are isolated per entity

- diffs are legible, and “git blame” works

**Schema-agnostic sync + attic** The “attic = no data loss” principle is a
trust-builder. When coordination systems drop data, teams stop using them.

**Daemon optionality** This directly addresses the “daemon fights you” class of Beads
pain. Beads has a background daemon as a core part of the system
([GitHub](https://github.com/steveyegge/beads "GitHub - steveyegge/beads: Beads - A memory upgrade for your coding agent")),
and alternative tools explicitly market “no rogue daemon”
([GitHub](https://github.com/wedow/ticket?utm_source=chatgpt.com "wedow/ticket: Fast, powerful, git-native ticket ...")).
Your “optional daemon” is the right default.

### 3.2 The biggest architectural pressure points (where broad changes may be warranted)

These aren’t “bugs”; they’re the places the system might become annoying or expensive
over time.

#### A) “Git churn” from presence + messages

If you commit agent heartbeats and high-volume messages into the sync branch, you risk:

- lots of tiny commits

- large sync diffs

- annoying repo growth

- degraded performance in shallow/partial clones

**Broad recommendation:** treat *presence* and *ephemeral messaging* as **non-git** by
default. Git should store:

- issues and durable artifacts

- major status changes

- a minimal audit log when needed

But presence (“who’s online right now”) and sub-second messaging should live in:

- a local daemon (single-machine)

- or a bridge (GitHub/Slack/native), with **optional** archival to git

Your draft already gestures at this (cache + TTL). I’d push it harder as a product
principle: *git is for durable coordination state, not for the live event stream.*

#### B) Scaling and query latency with 10k entities

File-per-entity is great, but naive scans on every CLI call can get slow.

**Broad recommendation:** standardize a “derived index” concept, but keep it **purely
optional and rebuildable**. For example:

- a local cached index file (JSON/CBOR/msgpack) keyed by file mtime/hash

- rebuild on demand

- never required for correctness

This is exactly how tools like ripgrep remain fast: a small amount of local derivation,
never authoritative.

#### C) Conflict semantics depend on clocks unless you harden them

Your draft assumes NTP-ish sync; you already note HLC as optional.
That’s right.

**Broad recommendation:** position “clock safety” as a *bridge-layer problem* first.
If you later introduce a real-time coordination service (native bridge), it can issue:

- monotonic claim leases

- server timestamps

- or canonical ordering for conflicts

Keep git-only mode simple and accept occasional “wrong winner” with attic recovery.

#### D) Git plumbing vs. product reliability

You correctly called out “how to update the sync branch without checking it out” as an
open question.

**Broad recommendation:** optimize for *correctness + simplicity over cleverness* in v1.
If sparse-checkout or a temp worktree is more robust than plumbing, that’s usually the
right product call early.
Beads’ worktree/branch complexity is itself an example of how “clever git tricks” can
become a maintenance burden
([GitHub](https://github.com/steveyegge/beads/blob/main/docs/PROTECTED_BRANCHES.md?utm_source=chatgpt.com "beads/docs/PROTECTED_BRANCHES.md at main")).

#### E) Agent identity across heterogeneous environments

Today, agents are:

- local processes with names

- cloud sandboxes with ephemeral sessions

- sometimes a bot identity on GitHub

**Broad recommendation:** treat “agent identity” as a first-class but *soft* concept:

- stable `agent_id` inside Tbd

- optional mapping to external identities (GitHub user, Slack user, etc.)

- never require the mapping for core workflows

* * *

## 4. Product design guidance: how to avoid “Beads frustration” in the rewrite

This is the part that often matters more than architecture.

### 4.1 Make the “pit of success” the simplest workflow

The default workflow should be:

- `tbd init`

- `tbd create "…"`, `tbd list`, `tbd show`, `tbd close`

- `tbd sync` (or auto-sync if configured)

No daemon. No background services.
No auth setup beyond “git works.”

### 4.2 Every command must be safe to run in weird environments

Given cloud sandboxes and networked filesystems:

- all writes should be atomic (write temp → rename)

- no required file locks

- tolerate “repo is read-only” gracefully

- degrade to read-only mode with clear messaging

This aligns with why you’re avoiding SQLite WAL on network FS
([SQLite](https://sqlite.org/wal.html?utm_source=chatgpt.com "Write-Ahead Logging")).

### 4.3 Treat “doctor” and “recover” as core features, not add-ons

The #1 reason coordination tools die is that when something goes wrong, users feel
helpless.

In v1, **make it easy to answer**:

- “what changed?”

- “why is my view different?”

- “how do I recover the lost version?”

Your attic mechanism is the right foundation; the product needs the UX around it.

### 4.4 Compatibility strategy: don’t require everyone to change muscle memory

If you want adoption, consider:

- a “Beads-compat CLI mode” (even if internally different)

- or at least `tbd import beads-export.jsonl` and `tbd export --format beads-jsonl`

People will tolerate internal rewrites; they won’t tolerate relearning everything on day
1\.

Tools like `ticket` explicitly provide a migration path from Beads
([GitHub](https://github.com/wedow/ticket?utm_source=chatgpt.com "wedow/ticket: Fast, powerful, git-native ticket ..."))—this
is table stakes.

### 4.5 Meet emerging repo conventions where they are

Two repo-level artifacts are becoming common for agents:

- **AGENTS.md**: a standard place for agent instructions is being pushed broadly
  ([Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation "Linux Foundation Announces the Formation of the Agentic AI Foundation (AAIF),
  Anchored by New Project Contributions Including Model Context Protocol (MCP), goose
  and AGENTS.md")).

- **MCP tool surfaces**: many agent environments are converging on MCP-style tool
  calling
  ([GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol "GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol")).

So a strong product move is:

- document Tbd usage in AGENTS.md (“how agents should claim work, where to write notes”)

- ship an MCP server wrapper early (`tbd-mcp`) that exposes the CLI as tools

This reduces per-environment integration effort and helps with “agents in separate
environments.”

* * *

## 5. A recommended “minimal core + progressive layers” plan

Here’s a concrete way to ship fast without painting yourself into a corner.

### 5.1 Tbd Core v1: the Beads replacement you can ship quickly

**Non-negotiable goals**

- zero daemon required

- no SQLite required

- file-per-entity

- sync branch architecture

- great CLI ergonomics + JSON output

- import from Beads

**Core entities**

- Issues (required)

- Comments/messages (optional but likely worth it; they’re crucial for coordination)

- Agent registry + advisory claims (optional, but if “many agents” is day-1 reality,
  keep at least a minimal `assignee`/`claimed_by`)

**Core operations**

- issue CRUD

- list/filters

- “ready” queries (unblocked, unclaimed)

- sync (pull/push)

- attic list/show/restore

- doctor

**Deliberate non-goals for v1**

- real-time presence

- atomic claims

- GitHub bidirectional sync

- Slack integration

- fancy UI

That keeps it shippable.

### 5.2 Layer 1.5: “GitHub as a visibility surface” (not your database)

A GitHub bridge is valuable, but it should be optional and minimal:

- promote selected issues to GitHub (not all)

- mirror state changes and comments

- use webhooks instead of polling
  ([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?utm_source=chatgpt.com "Best practices for using the REST API"))

- validate webhook payloads
  ([GitHub Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries?utm_source=chatgpt.com "Validating webhook deliveries"))

- design around rate limits and secondary limits
  ([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api "Rate limits for the REST API - GitHub Docs"))

**Product framing:** “GitHub is where humans notice things; Tbd is where agents
coordinate durably.”

### 5.3 A key idea to reduce integration pain: “Bridge bots” instead of “every agent integrates”

You called out the pain of “agents using GitHub directly is messy and you have to deal
with every single one of them.”

A strong architectural lever is:

> **Make *one* bridge runtime integrate with GitHub (or Slack), not every agent.**

How?

- Agents write “bridge intents” to an outbox (files) and sync to git.

- A single bridge process (or GitHub Action / GitHub App) reads the outbox and performs
  GitHub API calls.

- Results get written back into the repo (inbox files or metadata updates).

This is unusually compatible with sandbox environments where agents don’t have
credentials, because the bridge runtime holds credentials and agents just push/pull to
the sync branch (which is already how they collaborate).
Claude Code web’s model of mediated git access makes this especially plausible
([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing "Making Claude Code more secure and autonomous with sandboxing \ Anthropic")).

This pattern also naturally rate-limits and centralizes retries/idempotency.

### 5.4 Layer 2: real-time coordination (presence, atomic claims)

Once teams demand stronger coordination:

**Option A: GitHub-as-lock-provider**

- Claim = set a label or assignee in GitHub (atomic enough)

- Downside: rate limits, noise, coupling

**Option B: Native bridge service**

- WebSocket presence + claims with TTL

- Git remains the durable store; service is the real-time plane

**Option C: Slack/Discord as message transport**

- Great for messaging

- Not great for structured claims unless you build a lot around it

Given GitHub’s rate limits and webhook model
([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api "Rate limits for the REST API - GitHub Docs")),
a native real-time service tends to be the cleanest long-term “coordination plane,” but
it should be v2+ only.

* * *

## 6. Speculative design explorations (creative but practical)

These are “maybe” layers that can sit above the core without forcing early commitment.

### 6.1 A “tool broker” layer: one integration surface for many external tools

Instead of Tbd having native code for GitHub + Slack + Linear + …, define a broker
interface:

- Tbd Core produces normalized “intents”:

  - `create_issue`

  - `post_comment`

  - `claim`

  - `open_pr`

  - `request_review`

- Brokers implement these intents for specific backends.

- Expose broker capabilities via MCP so agents across environments can use them
  consistently
  ([GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol "GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol")).

This is how you avoid “giant project where all design choices must be correct up front.”

### 6.2 Event-log model (append-only ops) instead of state-as-files

If you ever hit high conflict rates, consider an event log:

- each change is an immutable event file

- state is derived by folding events

Pros:

- merges are easier (append-only)

- auditability is perfect

Cons:

- more complex queries

- compaction required

This is not v1, but it’s a plausible v3 if needed.

### 6.3 “Coordination via PRs” as an alternate surface

Some teams already use:

- draft PRs as work-in-progress

- PR comments as messaging

- labels/projects for status

Tbd could optionally support a mode where:

- an “issue” is backed by a PR branch or draft PR

- claims and status changes map to PR metadata

This leans into GitHub’s strengths, but it’s not a replacement for a simple local queue.

### 6.4 A lightweight local UI that reads the same files

Your own draft mentions this.
It’s a good future layer because:

- no new backend needed

- just reads JSON/Markdown + triggers CLI

Even a TUI (like `fzf`/`gum` style) can dramatically improve daily usage without adding
systemic risk.

* * *

## 7. Concrete recommendations (what I would do if shipping this)

### Recommendation 1: Ship a *small, boring* Tbd Core first

- Keep the v1 scope so small you can test it brutally (cross-platform, NFS, sandbox).

- Prefer implementation simplicity over clever git plumbing.

- Treat “no data loss + debuggability” as your product differentiator.

### Recommendation 2: Make “bridge runtime” a separate component from day 1 (even if it’s a stub)

Even if v1 ships without GitHub sync, define:

- `outbox/` and `inbox/` conventions (files, schemas)

- idempotency keys

- retry/dead-letter conventions

So later you can add:

- a GitHub App bridge

- a GitHub Action bridge

- a Slack bridge without destabilizing core.

### Recommendation 3: Use MCP as your primary “integration format,” not bespoke agent SDKs

Ship:

- CLI

- library API (TS)

- MCP server wrapper

So any agent environment that can speak MCP can coordinate through the same stable
surface
([GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol "GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol")).

### Recommendation 4: Treat presence/heartbeats as ephemeral by default

Keep git durable and calm.
Don’t turn coordination state into a constant stream of commits.

* * *

If you want, I can also turn this into an actual **one-page “PRD + technical
architecture”** format (goals/non-goals, personas, success metrics, v1/v2 roadmap,
risks), but I didn’t want to collapse the research content you asked for.

[1]: https://github.com/steveyegge/beads "'GitHub - steveyegge/beads: Beads - A memory upgrade for your coding agent'"
[2]: https://github.com/steveyegge/beads/blob/main/docs/WORKTREES.md?utm_source=chatgpt.com "'beads/docs/WORKTREES.md at main · steveyegge/beads'"
[3]: https://github.com/steveyegge/beads/blob/main/docs/PROTECTED_BRANCHES.md?utm_source=chatgpt.com "'beads/docs/PROTECTED_BRANCHES.md at main'"
[4]: https://github.com/wedow/ticket?utm_source=chatgpt.com "'wedow/ticket: Fast, powerful, git-native ticket ...'"
[5]: https://github.com/hmans/beans?utm_source=chatgpt.com "'hmans/beans: A CLI-based, flat-file issue tracker for ...'"
[6]: https://github.com/Dicklesworthstone/mcp_agent_mail "'GitHub - Dicklesworthstone/mcp_agent_mail: Like gmail for your coding agents. Lets various different agents communicate and coordinate with each other.'"
[7]: https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation "'Donating the Model Context Protocol and establishing the Agentic AI Foundation \\ Anthropic'"
[8]: https://github.com/modelcontextprotocol/modelcontextprotocol "'GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol'"
[9]: https://github.com/modelcontextprotocol "'Model Context Protocol · GitHub'"
[10]: https://www.anthropic.com/engineering/claude-code-sandboxing "'Making Claude Code more secure and autonomous with sandboxing \\ Anthropic'"
[11]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api "'Rate limits for the REST API - GitHub Docs'"
[12]: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?utm_source=chatgpt.com "'Best practices for using the REST API'"
[13]: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries?utm_source=chatgpt.com "'Validating webhook deliveries'"
[14]: https://docs.github.com/rest/issues/comments?utm_source=chatgpt.com "'REST API endpoints for issue comments'"
[15]: https://sqlite.org/wal.html?utm_source=chatgpt.com "'Write-Ahead Logging'"
[16]: https://sqlite.org/useovernet.html?utm_source=chatgpt.com "'SQLite Over a Network, Caveats and Considerations'"
[17]: https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation "'Linux Foundation Announces the Formation of the Agentic AI Foundation (AAIF), Anchored by New Project Contributions Including Model Context Protocol (MCP), goose and AGENTS.md'"
