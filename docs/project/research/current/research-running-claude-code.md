# Running Claude Code Across Environments

## Introduction: The Need for Flexible Orchestration

Claude Code is currently used in fairly siloed ways – e.g. via IDE plugins (like
Cursor’s integration), Anthropic’s Claude Code Cloud web UI, or the desktop app.
These provide powerful single-agent coding assistance, but orchestrating **multiple
Claude Code instances** concurrently in different environments remains challenging.
There is growing interest in frameworks that let many coding agents collaborate on tasks
(for example, coordinating agents from a Slack channel, or across multiple terminals)
with persistent state and minimal manual overhead.
This is essentially a **multi-agent orchestration** problem.
Several approaches have emerged (or are being developed) to address this, ranging from
command-line tools and agent “memory” systems to new cloud services and protocols.
Below we’ll explore some leading solutions – **Steve Yegge’s Beads and Gas Town**, **MCP
Agent Mail**, **the new “TBD” Git-based tracker**, as well as how **Anthropic and OpenAI
(Codex)** are tackling orchestration and environment flexibility (including tools like
Slack integration and sandboxed VMs like Sprites).
We’ll also consider future directions for more robust coordination layers.

## Beads: Git-Backed Memory for Coding Agents

Before coordinating multiple agents, it’s critical to have a **shared persistent memory
or task tracker** so agents can see the overall work state.
**Beads**, created by Steve Yegge in late 2025, is a foundational tool in this
space[[1]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Like%20it%20or%20not%2C%20Gas,to%20use%20Beads%20to%20use)[[2]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%20are%20the%20atomic%20unit,use%20Beads%2C%20as%20do).
Beads is essentially a **lightweight issue-tracking database for coding agents**, with
each “bead” representing a unit of work (issue/task) containing a description, status,
assignee,
etc[[2]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%20are%20the%20atomic%20unit,use%20Beads%2C%20as%20do).
Under the hood, Beads stores issues as a JSON Lines file and syncs them via Git,
augmented by a local SQLite cache and a background daemon for real-time
updates[[3][4]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=). This design gives agents a
form of long-term memory: they can query what tasks exist, which are in progress or
done, and even preserve history of work in Git.
Crucially, this **shared ledger** means multiple agents (or multiple sessions of Claude
Code) can coordinate by reading/writing the same set of tasks.
Beads proved that a **Git-backed memory** for coding agents “works well for AI agents
and humans” collaborating[[5]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=1,Comparison)
– tasks persist beyond a single session, and any agent can pick up where another left
off by reading the task state from Git.

**Why is Beads important for multi-agent setups?** If you run, say, 5 Claude Code
instances in parallel, you need them to not step on each other’s toes.
Beads addresses this by **tracking task status centrally** and even allowing atomic task
claims (with the daemon) so two agents don’t accidentally grab the same
issue[[6]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,Requires%20SQLite%20queries). In
practice, users (and agents themselves) file tasks into Beads, and each Claude instance
can query “ready” tasks, mark tasks as in-progress or closed, etc., all via CLI commands
(bd create, bd claim, bd close, etc.). This turns coding agents into something akin to
workers on an assembly line with a shared to-do list (the Beads DB).

*However, Beads also has limitations for certain environments.* Its architecture – using
a local SQLite database and continuous daemon – can be brittle or **incompatible with
sandboxed and cloud environments**. For example, running Beads inside a Claude Code
Cloud sandbox or other restricted environment is problematic: many such environments
disallow background processes or have filesystem limitations (SQLite file locking can
break on network filesystems,
etc.)[[7]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,conflicts%20on%20parallel%20issue%20creation)[[8]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,doesn%E2%80%99t%20work%20well%20on%20NFS%2FSMB).
Indeed, Yegge notes issues like **file locking and daemon conflicts** on unconventional
setups: *“SQLite doesn’t work well on NFS/SMB”* and the background sync can conflict
with manual Git
ops[[7]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,conflicts%20on%20parallel%20issue%20creation).
Our own experience mirrors this – **Beads doesn’t run well inside the Claude Code
cloud/desktop sandbox** (partly due to the SQLite dependency and needing a persistent
service).
This motivated new alternatives to retain the benefits of Beads’ shared memory,
but with a simpler, more environment-agnostic design.

## Gas Town: Multi-Agent Orchestration Layer (Built on Beads)

While Beads itself is a passive issue tracker, **Gas Town** is Steve Yegge’s ambitious
attempt to build a full **multi-agent orchestrator** on top of Beads.
Gas Town (open-sourced in late 2025) is described as a *“multi-agent orchestration
system for Claude Code with persistent work
tracking”*[[9]](https://github.com/steveyegge/gastown#:~:text=Multi,Code%20with%20persistent%20work%20tracking).
In essence, Gas Town lets a developer launch and manage **dozens of Claude Code agents
in parallel**, dividing work among them and preserving context across agent
restarts[[10]](https://github.com/steveyegge/gastown#:~:text=Gas%20Town%20is%20a%20workspace,agent%20workflows)[[11]](https://github.com/steveyegge/gastown#:~:text=Manual%20agent%20coordination%20Built,state%20stored%20in%20Beads%20ledger).
Yegge built Gas Town after reaching the limits of manually juggling 10+ agents (“Stage
7” in his
terms)[[12]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%206%3A%20CLI%2C%20multi,You%20are%20very%20fast).
It introduces a higher-level framework (in Go, with a tmux TUI) to coordinate these
agents systematically.

**How Gas Town works:** Conceptually, it organizes agents into a “town” with roles:
there’s a **“Mayor” agent (coordinator)** and multiple worker agents called
**“Polecats”** across one or more projects (called
“Rigs”)[[13]](https://github.com/steveyegge/gastown#:~:text=Mayor%5BThe%20Mayor)[[14]](https://github.com/steveyegge/gastown#:~:text=Polecats).
The Mayor is typically a Claude Code instance that has full context of all ongoing work;
you give instructions to the Mayor (like a project manager agent), and it in turn
delegates tasks to the worker Claude instances.
Each project (Rig) has its own set of agents and is linked to a Git repo (your
codebase)[[15]](https://github.com/steveyegge/gastown#:~:text=Rigs%20%EF%B8%8F)[[16]](https://github.com/steveyegge/gastown#:~:text=Ephemeral%20worker%20agents%20that%20spawn%2C,complete%20a%20task%2C%20and%20disappear).
Gas Town crucially uses **Beads for state persistence** – every piece of work (and even
agent identities) are tracked as Beads issues under the
hood[[1]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Like%20it%20or%20not%2C%20Gas,to%20use%20Beads%20to%20use)[[2]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%20are%20the%20atomic%20unit,use%20Beads%2C%20as%20do).
This means all task assignments, statuses, and even inter-agent messages in Gas Town
ultimately live in the Git-backed ledger (Yegge calls Beads the *“universal git-backed
data plane (and control plane) for everything that happens in Gas
Town”*[[1]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Like%20it%20or%20not%2C%20Gas,to%20use%20Beads%20to%20use)).
If an agent crashes or a new one is added, they can recover state from the Beads DB.

Gas Town adds several orchestration features on top of raw Beads: for example, it has
the notion of **“Convoys”** (which bundle multiple tasks/issues to assign to an agent as
a batch) and built-in **mailboxes/handoffs** for
agents[[17]](https://github.com/steveyegge/gastown#:~:text=restarts).
The mailbox system (inspired by Jeffrey Emanuel’s Agent Mail, discussed next) allows
agents to send messages or “email” each other tasks and results
asynchronously[[18]](https://github.com/steveyegge/gastown#:~:text=Challenge%20Gas%20Town%20Solution%20Agents,state%20stored%20in%20Beads%20ledger).
Gas Town also defines **persistent agent identities** via special “Role beads” and
“Agent beads” – giving each agent a stable address and profile in the task
database[[19]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=All%20Gas%20Town%20workers%2C%20in,is%20the%20agent%E2%80%99s%20persistent%20identity)[[20]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=In%20Gas%20Town%2C%20an%20agent,It).
In practical terms, Gas Town with its tmux UI displays multiple Claude Code terminal
instances side by side, each working on different tasks, and the Mayor window
orchestrating the flow.
If one agent finishes or gets blocked, Gas Town can reassign work or spawn new ones (the
ephemeral workers are the “Polecats”). It can scale to “20-30 agents” while keeping
chaos manageable through these
structures[[18]](https://github.com/steveyegge/gastown#:~:text=Challenge%20Gas%20Town%20Solution%20Agents,state%20stored%20in%20Beads%20ledger).

**Real-time coordination and safety:** Gas Town is quite an **aggressive YOLO setup** –
Yegge warns it’s for experienced “chimp wranglers” at the
frontier[[21]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%208%3A%20Building%20your%20own,the%20frontier%2C%20automating%20your%20workflow).
All agents run with high autonomy (often with permission checks disabled for speed), so
mistakes can happen fast.
Gas Town mitigates some risk by persisting everything and using Git as a safety net (you
have a history of changes and tasks in Git).
Still, Yegge notes it’s “chaotic and sloppy” by design: multiple agents might fix the
same bug in different ways, and a human (or mayor) later “picks the
winner”[[22]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Work%20in%20Gas%20Town%20can,efficient%2C%20but%20you%20are%20flying).
The philosophy is high throughput over perfection, trusting that *Claude Code can handle
reasonably sized tasks and that errors can be fixed as part of the
flow*[[23]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=lost,efficient%2C%20but%20you%20are%20flying).
Gas Town’s use of Beads makes this possible – e.g., if two agents both close an issue
with different fixes, you have both results logged and can merge or choose.
It’s effectively an **“AI coding factory”** with you as the manager overseeing a swarm
of coding
agents[[24]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=In%20Gas%20Town%2C%20you%20let,That%E2%80%99s%20it).

One drawback currently is that Gas Town inherits Beads’ dependency on SQLite and the
relative complexity of its setup.
Indeed, Gas Town **requires** Beads (v0.44+) and even SQLite for some queries (e.g. it
uses SQLite for a “convoy” scheduling
DB)[[25]](https://github.com/steveyegge/gastown#:~:text=%2A%20Go%201.23%2B%20,optional%20runtime%29)[[26]](https://github.com/steveyegge/gastown#:~:text=%2A%20Go%201.23%2B%20,recommended%20for%20full%20experience).
This means Gas Town, in its present form, is best suited for local development on a
Unix-like environment with all these installed (Go, Git, tmux, Claude or Codex CLI,
etc.). Running Gas Town *inside* a Claude Code Cloud instance is not practical – rather,
Gas Town is something you run on your machine (or a VM) to manage many cloud instances
of Claude Code via their CLI. In fact, the Gas Town README notes it supports multiple
back-end agents: **Anthropic’s Claude Code CLI (default)** and **OpenAI’s Codex CLI
(optional)** are both
integratable[[27]](https://github.com/steveyegge/gastown#:~:text=%2A%20Git%202.25%2B%20,developers.openai.com%2Fcodex%2Fcli).
This multi-runtime support is useful; you could, for example, have a mix of Claude and
Codex agents working together via Gas Town’s framework.
Gas Town is very new and evolving (described by Yegge as “uncut rough” in Jan
2026[[28]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=of%20more%2C%20but%20these%20should,do)),
but it demonstrates the power of a **dedicated orchestrator layer** for coding agents –
something like “Kubernetes for agents” as he
envisioned[[29]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=%E2%80%9CIt%20will%20be%20like%20kubernetes%2C,but%20for%20agents%2C%E2%80%9D%20I%20said).

## Agent Mail (MCP): Asynchronous Multi-Agent Coordination

Another key development in multi-agent coding workflows is **MCP Agent Mail** by Jeffrey
Emanuel. While Gas Town provides a whole managed workspace, *Agent Mail focuses
specifically on inter-agent communication and coordination*, which can be paired with
any shared memory system like Beads.
Steve Yegge succinctly put it: *“Beads gives the agents shared memory, and MCP Agent
Mail gives them messaging… and that’s all they
need.”*[[30]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=The%20most%20compelling%20case%20to,works%20super%20well%20with%20Beads)
In other words, Agent Mail is like giving your coding agents an **email system** to talk
to each other and negotiate tasks asynchronously.

**What Agent Mail provides:** It runs a local **HTTP server (“MCP server”)** that agents
can use to send messages, very much like email threads.
Each agent gets an **inbox and outbox** stored in a git-tracked archive (so messages are
persisted and
auditable)[[31]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=What%20it%20is%20,auditable%20artifacts%20in%20Git).
The system also manages **agent identities** and a lightweight notion of “threads” for
conversation
context[[31]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=What%20it%20is%20,auditable%20artifacts%20in%20Git).
Perhaps most importantly, Agent Mail implements **advisory file locking
(reservations)**[[32]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=MCP%20tools%20and%20resources.%20,auditable%20artifacts%20in%20Git)[[33]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=Why%20it%27s%20useful%20,macros%20that%20bundle%20common%20flows).
This addresses a big challenge when multiple agents operate in the **same codebase**:
two agents editing the same file simultaneously can interfere or cause merge conflicts.
Agent Mail uses a concept of *file leases* – when an agent is about to modify foo.py, it
can request a reservation for that file (or a glob of files) via the mail server.
Other agents will see that and avoid touching those files until the lease expires or is
released[[32]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=MCP%20tools%20and%20resources.%20,auditable%20artifacts%20in%20Git).
This is analogous to the “file check-out” approach of old source control systems.
Jeffrey even jokes it resembles his 1990s Accenture workflow where only one dev could
edit a file at
once[[34]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=Their%20version%20control%20system%20was,So%20we%20negotiated)
– but in practice, he found that AI agents **“just figure it out”** and coordinate
without
trouble[[35]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=%E2%80%94%20you%20had%20to%20run,So%20we%20negotiated).
Essentially, the agents will negotiate via messages who works on what, often deciding a
leader among themselves, and use file locks to prevent stepping on each
other[[36]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=tell%20me%20that%20it%20works,super%20well%20with%20Beads)[[37]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=He%20said%20that%20Beads%20gives,and%20just%20split%20things%20up).
All message logs and reservations are stored in Git for transparency.

**Integration and usage:** Agent Mail is designed to integrate with existing agent
tools. It provides a one-line install script that automatically detects your installed
coding agents (Claude Code CLI, OpenAI Codex CLI, etc.)
and “wires up” the mail system into
them[[38]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=One)[[39]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=startup%20%28just%20type%20,you%20immediately%20know%20what%20changed).
Typically this means appending some instructions or tool definitions to the agent’s
system prompt (for example, adding a snippet to the agent’s AGENTS.md or config telling
it how to use the mail API and reserve
files)[[40]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=%23%20Now%2C%20simply%20launch%20Codex,better%20utilize%20the%20new%20tools)[[41]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=Ready,md%20Files).
Once set up, you can simply run multiple agent instances (in separate terminals or even
on separate machines) and **they will share the mail server**. You, as the user, might
issue a task to one agent “lead”, which then can use Agent Mail to farm out subtasks to
others.
In a demo video, Emanuel shows agents dividing up implementing different features
by sending each other messages and coordinating via this mail
system[[36]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=tell%20me%20that%20it%20works,super%20well%20with%20Beads).

It’s worth noting that Agent Mail uses Git in a similar spirit to Beads: all
communications and state are stored in a local Git repository (and can optionally sync
to a remote for persistence).
It even supports working with a **Git worktree model** (multiple working copies of the
repo for each agent) as an alternative to the single-folder
mode[[42]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=I%E2%80%99m%20working%20on%20setting%20up,I%E2%80%99ll%20find%20out%20this%20week).
Yegge mentions that Jeffrey modified Agent Mail to support worktrees, which avoids
needing file locks (each agent works on its own branch and merges via
Git)[[43]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=uncrummy)[[42]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=I%E2%80%99m%20working%20on%20setting%20up,I%E2%80%99ll%20find%20out%20this%20week).
This is a more Git-native way to have agents collaborate, though it’s a bit more complex
to set up. The key point: **Agent Mail brings real-time, asynchronous coordination to
coding agents**, complementing tools like Beads/TBD (which handle the to-do list
memory). In fact, Steve Yegge called the combination of *“Beads + Agent Mail = Agent
Village”* – an environment where many agents can work in parallel, share a memory of
tasks, and communicate like a small
team[[44]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=Beads%20%2B%20Agent%20Mail%20%3D,Agent%20Village).
This concept boosts productivity substantially: Jeffrey claims using 10+ agents with
this setup gave him effectively dozens of hours of work done in parallel for each human
hour, thanks to machine-speed typing and
coordination[[45]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=One%20disciplined%20hour%20of%20GPT,that%20advantage%20in%20two%20layers)[[46]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=enforcing%20Double,work).

From our perspective, Agent Mail (which uses the open “Model Context Protocol”, or MCP,
as its API) is one viable answer to having a **“clean backend coordination layer”** that
the user asked about.
It provides a ready-made server for synchronization and messaging so you *don’t* have to
build your own from scratch.
It’s still quite new and somewhat technical to configure, but it’s under active
development.
Notably, Agent Mail even has a **companion mobile app and automation layer**
(a commercial offering) that allows provisioning and steering fleets of agents from an
iOS app, with features like broadcasting instructions to all agents and enforcing
confirmation for dangerous
actions[[47]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=2,Arm%20confirmations%20for%20destructive%20work).
This shows one possible future: an **“Agent HQ”** where a human overseer can manage many
agents remotely, while the agents coordinate through a shared messaging and memory
system.

## “TBD” – A Git-Based Beads Successor for Flexibility

Given Beads’ environment issues, the community (including our team) has been exploring
simpler, more robust alternatives.
One such design is **“TBD” (To Be Done)** – a drop-in replacement for Beads that
emphasizes *durability, simplicity, and cross-environment compatibility*. According to
its design spec, **TBD eliminates the need for SQLite or a daemon**, using only Git and
the filesystem for
storage[[48]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,SQLite%20and%20associated%20file%20locking)[[49]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,file%20for%20fewer%20merge%20conflicts).
Each issue is stored as a separate Markdown file with YAML front-matter (rather than as
rows in a DB or lines in one JSONL file), which makes the data human-readable and
greatly reduces merge conflicts on parallel
edits[[50]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,sync%20branch%20for%20coordination%20data)[[49]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,file%20for%20fewer%20merge%20conflicts).
All these issue files live on a dedicated Git **sync branch**, keeping the main branch
clean[[4]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=)[[51]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,branch%2C%20entities%20on%20sync%20branch).
In essence, TBD is a **Git-native issue tracker**, influenced by prior art like the
simple Bash-based “ticket” tool and
others[[52]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=tbd%20builds%20on%20lessons%20from,native%20issue%20tracking%20ecosystem)[[53]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=The%20key%20insight%3A%20%E2%80%9CYou%20don%E2%80%99t,platform%20reliability).

**Advantages for environment flexibility:** Because it has no background processes and
no binary database, TBD can run virtually anywhere you have Git and a Node/TS runtime.
The design goal was explicitly to “just npm install -g tbd **anywhere**: local dev, CI,
cloud IDEs (Claude Code, Codespaces), network
filesystems”[[54]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=3.%20,network%20filesystems).
This means you could use TBD inside a Claude Code Cloud sandbox or a Codespaces VM,
whereas Beads would have been very difficult to run there.
For example, if you spin up a Claude Code session (which usually has Git available), you
could initialize a TBD repository to persist and sync issues via a remote GitHub repo.
The Claude agent could then use TBD’s CLI commands (which mirror Beads’ commands) to
create and update tasks.
Since TBD’s state is just files and a Git branch, it won’t conflict with the ephemeral
nature of the environment – even if the session terminates, the data can be pushed to
GitHub and retrieved by another instance later.
**No SQLite locks or daemon
needed**[[48]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,SQLite%20and%20associated%20file%20locking)[[55]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,CI%2C%20cloud%20sandboxes%2C%20network%20filesystems).
It’s also designed to tolerate slow or infrequent sync (no constantly running sync loop;
instead, it can sync on command or periodically) which suits cloud sandboxes that might
not allow background processes.

On the flip side, **TBD trades off real-time coordination features** for this
simplicity.
The spec makes clear that *TBD is* *not* *a real-time multi-agent coordinator
or a replacement for Agent Mail*[[56]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=). It
relies on Git’s eventual consistency – multiple agents can use it concurrently by
pulling and pushing, but there’s a slight delay and no guarantee of atomic “claims”.
Instead, TBD uses **“advisory” claims**: an agent can mark an issue as claimed by them,
but if two agents coincidentally claim the same task at the same time, a merge conflict
may occur which TBD will detect and preserve both versions in an “attic” (rather than
losing
data)[[57]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,ripgrep%2Fgrep%20search%20across%20all%20issues)[[58]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,LWW%20merge%20and%20attic%20preservation).
This is a last-write-wins strategy with conflict resolution, not a strict lock.
By contrast, Beads (with its daemon) had a notion of **atomic claims** where only one
agent could claim a task at a time, and Agent Mail’s file reservations are also meant to
be atomic. So, TBD is **ideal for async or loosely coupled multi-agent workflows** (or
single agent use), but if you need *tight real-time hand-offs*, something like Agent
Mail or Beads is still needed on
top[[59]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,opens%20in%20%24EDITOR)[[6]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,Requires%20SQLite%20queries).

**TBD’s design improvements:** For our purposes (seeking a “durable persistence layer in
GitHub” to coordinate agents), TBD hits many marks: - *Durability & Transparency:* All
tasks are plain Markdown files which can be browsed on GitHub or edited by hand if
needed[[60]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,sync%20branch%20for%20coordination%20data)[[49]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,file%20for%20fewer%20merge%20conflicts).
There’s no opaque state; debugging is easier.
- *Minimal Merge Conflicts:* Because each issue is its own file (named by an ID), two
  agents creating different issues won’t collide in one JSONL. And even if they do edit
  the same issue, the YAML fields are merged carefully or conflicting edits are shunted
  to separate attic files rather than clobbering each
  other[[61]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,branch%20access%2C%20searchable%20with%20ripgrep)[[62]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,zero%20conflicts).
  \- *No Daemon:* Agents (or humans) invoke the CLI to sync with the Git remote.
  This avoids the “background process fighting your Git operations” problem that Beads
  had[[3]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=)[[63]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,fights%20manual%20git%20operations).
  \- *Cross-Platform:* It’s being implemented in TypeScript, likely making it easier to
  install on Windows and other systems without compilation
  issues[[54]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=3.%20,network%20filesystems).
  Even Windows network drives (SMB) should work, since there’s no DB locking to worry
  about[[7]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,conflicts%20on%20parallel%20issue%20creation)[[8]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,doesn%E2%80%99t%20work%20well%20on%20NFS%2FSMB).
  \- *Beads Compatibility:* TBD aims to be a drop-in replacement at the CLI level (same
  commands like tbd create, tbd ready, etc.), and it provides import tools to migrate
  from a Beads
  database[[64]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,algorithm)[[65]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=1).
  So one could export their existing Beads issues (with all statuses) into the new
  format fairly easily.

In summary, **TBD would allow a more robust and cloud-friendly orchestration**: we could
imagine each Claude Code instance running in whatever environment (local, cloud,
desktop) using TBD to share tasks via a GitHub repo.
This would solve many Git conflict issues inherent in the old Beads and likely reduce
the friction of multi-agent setups.
The only missing piece is the real-time “agent messaging” – but one could combine TBD
with Agent Mail to get both durable task tracking and live coordination.
In fact, this layered approach might be how future orchestration stacks evolve: *use
Git-based task stores (like TBD) for persistent state, and a separate lightweight
pub-sub or messaging service for live communication.* The user’s idea of a “clean
backend where they could send messages and coordinate via an extra cached sync layer”
aligns with this: Agent Mail could serve as the messaging backend, while TBD serves as
the durable cache/persistence (and perhaps they could be linked or integrated).

Notably, the TBD design doc also references other projects in this vein (Ticket,
git-bug,
etc.)[[52]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=tbd%20builds%20on%20lessons%20from,native%20issue%20tracking%20ecosystem)[[66]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,native%20tracking%20without%20external%20files)
– there’s a general trend towards **git-native issue tracking** for agents.
Each has slightly different trade-offs (some store issues as git commits or tags rather
than files, etc.), but all embrace *simplicity, no always-on services, and Git for
distribution*[[67]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,tracker).
This seems to be the direction for making agent coordination tools more reliable and
easier to deploy.

## IDE and Platform Integrations (Cursor, VS Code, etc.)

So far we’ve focused on CLI and backend tools, but it’s worth examining how existing
**editor integrations and official platforms** handle (or limit) multi-agent
orchestration. Currently, **IDE-based AI coding assistants** (like Cursor or various VS
Code extensions) are typically single-agent affairs.
For example, Cursor’s Claude integration or VS Code’s Copilot/ChatGPT plugins run one AI
assistant in the context of your editor – you ask it for changes or to run code, and it
operates in that environment.
These tools excel at inline code suggestions and one-at-a-time commands, but **do not
inherently support multiple agents concurrently working on separate tasks**. As Yegge’s
“Dev Evolution” stages illustrate, most developers in 2024-2025 are at *Stage 2-3*:
using a coding agent in the IDE, maybe even in “YOLO” mode without constant
confirmations[[68]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=questions)[[69]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%203%3A%20Agent%20in%20IDE%2C,off%20permissions%2C%20agent%20gets%20wider),
but still just one agent at a time.
The jump to Stage 6 (“CLI, multi-agent, YOLO”) and beyond requires stepping outside the
typical IDE plugin UI and using tools like those discussed
above[[70]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=them)[[71]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%208%3A%20Building%20your%20own,the%20frontier%2C%20automating%20your%20workflow).

That said, **IDE and cloud platform teams are aware of these trends**. Anthropic and
OpenAI have begun adding features that hint at multi-agent or multi-task orchestration.
For instance, Anthropic’s new **Claude “Cowork”** mode (announced around late 2025)
essentially transforms Claude into a more general AI *agent* that can autonomously
execute multi-step plans (like browsing the web, writing and running code, etc.)
within a single
session[[72]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=,strong%20signal%20of%20the%20future).
Cowork is not exactly multiple agents – it’s one Claude executing a chain of tool-using
actions – but it’s a step toward an orchestrator-like experience for end users.
Anthropic positions Cowork as a glimpse of the future where powerful coding agents are
more **autonomous and can handle complex workflows** beyond just Q&A
chat[[72]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=,strong%20signal%20of%20the%20future).
They even mention it’s a “general agent… well positioned to bring the wildly powerful
capabilities of Claude Code to a wider
audience”[[73]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=Security%20worries%20aside%2C%20Cowork%20represents,Code%20to%20a%20wider%20audience).
In other words, instead of requiring a power-user to manually orchestrate many Claude
instances via tmux (a la Gas Town), Anthropic might eventually provide a more
**user-friendly orchestrator** where Claude itself manages subtasks.
It wouldn’t be surprising if future versions allow something like “Claude spawns Claude”
internally, though nothing official on multi-Claude coordination has been announced yet.

**OpenAI’s Codex Approach:** OpenAI, meanwhile, has developed a robust framework around
their Codex CLI that incorporates multi-agent concepts.
The **Codex CLI** is analogous to Claude Code’s CLI – an AI coding assistant you run in
your terminal – and it’s open source (built in
Rust)[[74]](https://developers.openai.com/codex/cli#:~:text=Codex%20CLI%20is%20OpenAI%E2%80%99s%20coding,Rust%20for%20speed%20and%20efficiency).
OpenAI has introduced the idea of **“AI-Native Teams”** and the **Model Context Protocol
(MCP)** to facilitate agents working together.
In fact, they allow you to run Codex in a special **MCP server mode** which effectively
turns it into a host that other agents or clients can connect
to[[75]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=You%20can%20run%20Codex%20as,with%20the%20OpenAI%20Agents%20SDK)[[76]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=,offs%2C%20guardrails%2C%20and%20full%20traces).
Using their Agents SDK, a developer can orchestrate *multiple Codex instances (or Codex
\+ other agents)* with explicit hand-offs and shared context.
Their guide shows an example of **orchestrating a multi-agent team with hand-offs,
guardrails, and full traces of each agent’s
steps**[[77]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=match%20at%20L295%20,offs%2C%20guardrails%2C%20and%20full%20traces).
This suggests OpenAI is baking in first-class support for building *multi-agent
workflows* on top of Codex.
For instance, one could have a “planner” agent and a “coder” agent, both using Codex
under the hood, coordinating via the MCP server interface.
The Agents SDK even walks through building such workflows (like two agents collaborating
to produce a browser
game)[[78]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=match%20at%20L295%20,offs%2C%20guardrails%2C%20and%20full%20traces)[[79]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=and%20%2A%20orchestrate%20a%20multi,offs%2C%20guardrails%2C%20and%20full%20traces).
This is essentially an official, standardized approach to what early adopters like Yegge
were hacking together with Beads and Gas Town.
OpenAI’s solution might eventually abstract away the details so that developers can
easily spin up agent teams with a few API calls.

Additionally, OpenAI’s **Codex platform integrates with Slack and other tools**, which
is directly relevant to the user’s question about coordinating agents from Slack or
other UIs. With the Codex Slack app, a team can **mention @Codex in a Slack channel to
kick off coding tasks**; Codex will spin up a *cloud task* (in OpenAI’s managed sandbox)
to execute the request and then reply in Slack with the
results[[80]](https://developers.openai.com/codex/integrations/slack/#:~:text=Ask%20Codex%20to%20run%20tasks,from%20channels%20and%20threads)[[81]](https://developers.openai.com/codex/integrations/slack/#:~:text=Start%20a%20task).
Under the hood, you link Slack to your Codex environments (which might be tied to
specific GitHub repos or dev environments), and Codex decides where to run the task and
posts diffs or answers back to the
thread[[82]](https://developers.openai.com/codex/integrations/slack/#:~:text=1,an%20answer%20in%20the%20thread)[[83]](https://developers.openai.com/codex/integrations/slack/#:~:text=,fix%20the%20issue%20before%20retrying).
This setup doesn’t spawn multiple agents chatting with each other in Slack (it’s one bot
responding), but it allows *users* to easily dispatch various tasks in parallel from a
familiar interface. In practice, multiple Slack threads could be running different Codex
tasks concurrently. OpenAI also provides **GitHub integration** (where Codex can open
PRs, comment on issues, etc.)
and a Linear integration for issue
tracking[[84]](https://developers.openai.com/codex/cli#:~:text=,Linear).
These integrations hint at a more **fluid orchestration layer bridging AI agents with
existing project management tools**. For example, one could imagine raising a GitHub
Issue tagged in a certain way and an AI agent automatically picks it up to work on, or
using Slack messages to assign tasks to different agent “workers” (some of this is
already doable with custom glue code and the above integrations).

**Visual Studio Code** itself (via GitHub Copilot and ChatGPT extensions) hasn’t
publicly launched multi-agent coordination features – it’s more focused on single-agent
code completion and chat.
But there are third-party VSCode extensions that experiment with agent orchestration.
For instance, *Continue* is an extension that can allow the AI to run iterative loops on
code changes (somewhat like an agent refining code continuously).
There are also community projects where people run multiple VSCode instances each with a
coding agent and attempt to coordinate them manually via a shared repo.
These are ad-hoc, though – the real structured solutions are emerging outside the IDE,
in the CLI/cloud space.

## Safe and Flexible Execution Environments (Sprites)

Another angle to consider is the execution environment for these coding agents.
Often Claude Code or Codex has **limited or sandboxed execution** (e.g., no internet
access or restricted file system) for safety.
When orchestrating many agents or giving them more autonomy (YOLO mode), it’s crucial to
have **robust sandboxing** to protect the host system and to allow easy teardown/spin-up
of fresh environments.
This is where tools like **Fly.io’s Sprites.dev** come in.
Sprites are described as *“stateful sandbox environments with checkpoint & restore”* –
essentially lightweight, Firecracker-based VMs that you can control
programmatically[[85]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=New%20from%20Fly,code%20in%20a%20secure%20sandbox)[[86]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=I%20predicted%20earlier%20this%20week,to%20your%20system%20and%20data).
Each **Sprite** is a persistent Linux VM with an ext4 filesystem (100GB+, auto-scaling)
that can be started, stopped, snapshotted, and resumed on
demand[[87]](https://sprites.dev/#:~:text=Stateful%20environment%20%20%3A%3A%3A)[[88]](https://sprites.dev/#:~:text=with%20NFS%20or%20FUSE%20mounts,down%20when%20you%20delete%20things).
They were explicitly designed with AI coding agents in mind: “Whether it’s an AI agent
like Claude Code or a binary your user uploaded, Sprites are the simplest answer for
‘where should I run a blob of
code’”[[89]](https://sprites.dev/#:~:text=A%20Sprite%20is%20a%20hardware,run%20a%20blob%20of%20code).
In fact, Sprites come preloaded with tools like Claude Code, Codex CLI, Python, Node,
etc., and even provide an **LLM integration for checkpoints** (the agent can write to a
special file /.sprite/llm.txt to trigger saving
state)[[90]](https://sprites.dev/#:~:text=Manage%20them%20within%20the%20environment,care%20of%20checkpoints%20for%20you).

For our orchestration problem, **Sprites could offer a convenient way to deploy and
manage multiple Claude Code instances** beyond the local desktop app or Claude Cloud.
You could programmatically spin up, say, 5 Sprites, each of which has Claude Code ready
to go and is isolated from your main system.
Sprites support a CLI and API, so this could be automated.
They also have a notion of **network policy** – you can allow or restrict internet
access per sprite, which is useful since many Claude Code environments disallow internet
by default except through specific
tools[[91]](https://sprites.dev/#:~:text=Just%20run%20%60sprite%20url%20,can%20speak%20to%20your%20Sprite).
Sprites thus solve two issues: 1) **Safety in YOLO mode** – if an agent goes haywire due
to a prompt injection or a bug, it can only damage its VM (which you can snapshot or
wipe)[[86]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=I%20predicted%20earlier%20this%20week,to%20your%20system%20and%20data)[[92]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=The%20safe%20way%20to%20run,away%20and%20get%20another%20one);
2\) **Scalability and portability** – you can create lots of them (“500 Sprites for free
with trial credits” as Fly.io touts) and destroy or suspend them when not
needed[[93]](https://sprites.dev/#:~:text=create%2C%20like%2C%20500%20Sprites%20for,free).
They resume state quickly (sub-second in many cases) and you only pay while they’re
doing
work[[94]](https://sprites.dev/#:~:text=Sprites%20get%20VMs%20when%20they,RAM%20for%20any%20given%20run).

Concretely, one could use Sprites as the foundation of a multi-agent setup: for example,
instead of running Gas Town on your local machine with multiple tmux panes, you could
have a “manager” process that creates Sprite VMs for each agent.
Each agent Sprite would persist its own working copy of the code and could use a shared
GitHub repo (or something like TBD in a shared remote) for coordination.
Communication between agents could either be through a shared service (if allowed) or
via pushing/pulling to GitHub (slower).
Sprites do allow each VM to have an HTTP-accessible URL if
needed[[95]](https://sprites.dev/#:~:text=URLs%20for%20External%20Access%20Sprites,Public%20Access%2C%20if%20you%20want),
which means one could even run an Agent Mail server in one Sprite and have agents in
other Sprites talk to it over a private network.
The **checkpointing** feature also shines here: an agent can checkpoint its VM state
(libraries installed, partial outputs, etc.)
and if something corrupts the environment, restore to a known good state within
～300ms[[96]](https://sprites.dev/#:~:text=Live%20Checkpoints%20Checkpoints%20are%20transactional,Quick%20restores).
This is very useful for long-running autonomous agents that might make mistakes – you
can script periodic checkpoints or rollbacks on failure.

Overall, Sprites represent an approach to make the *environment* orchestration easier,
complementing the *agent* orchestration.
They give us a cloud-hosted alternative to relying on the Claude desktop app or a local
Docker for each agent.
As Simon Willison noted in his first impressions, Sprites tackle two of the “favorite
problems”: *“a safe development environment for running coding agents and an API for
running untrusted code in a secure
sandbox.”*[[85]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=New%20from%20Fly,code%20in%20a%20secure%20sandbox)[[86]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=I%20predicted%20earlier%20this%20week,to%20your%20system%20and%20data)
For anyone building a multi-agent system that needs to run code (which is exactly Claude
Code’s use case), this is a big deal.
We can expect to see more use of such sandbox services, or local equivalents (like
Firecracker microVMs or Docker containers launched on demand), as the orchestration
tooling matures.

## Future Directions: Toward a Unified Orchestration Layer

The landscape is evolving rapidly.
Based on all of the above, a few trends and possible futures emerge:

* **Convergence of Memory and Messaging**: Right now, we have separate pieces (Beads/TBD
  for shared memory, Agent Mail for messaging).
  We might see these converge or be packaged together for convenience.
  For example, Gas Town already uses Beads for both data and a form of messaging (town
  events)[[97]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=and%20so%20on,use%20Beads%2C%20as%20do)[[98]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%2C%20along%20with%20the%20persistent,orchestration%2C%20as%20we%20will%20see).
  OpenAI’s MCP aims to handle context sharing (memory) and tool usage in one
  protocol[[99]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=You%20can%20launch%20a%20Codex,the%20Model%20Context%20Protocol%20Inspector)[[100]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=and%20%2A%20orchestrate%20a%20multi,offs%2C%20guardrails%2C%20and%20full%20traces).
  It’s plausible that a standardized “agent coordination protocol” will emerge (MCP
  could become that standard if widely adopted).
  In a year or two, instead of stitching together one tool for tasks and another for
  comms, there might be a single **Agent Orchestration Server** (open source or cloud
  service) that handles both persistent storage of work items and real-time message
  passing. The user’s thought of building an internal API for this could align with MCP –
  notably, *MCP (Model Context Protocol)* is openly specified, and one could implement
  their own server if desired.
  We could also see hosted versions (e.g., OpenAI could offer a managed coordination
  server as part of their platform).

* **Deeper Integration with Dev Ecosystem**: Orchestration frameworks will likely hook
  into GitHub, Jira, Slack, etc., out-of-the-box.
  OpenAI Codex already shows Slack and GitHub
  integration[[80]](https://developers.openai.com/codex/integrations/slack/#:~:text=Ask%20Codex%20to%20run%20tasks,from%20channels%20and%20threads)[[82]](https://developers.openai.com/codex/integrations/slack/#:~:text=1,an%20answer%20in%20the%20thread).
  We might soon have an Anthropic equivalent (perhaps a Claude Slack bot or a GitHub
  Action for Claude Code).
  This means your agents can take tasks from your issue tracker directly, update
  tickets, open pull requests, and so on, as part of their normal operation.
  The multi-agent layer could act as a bridge between human project management and the
  agents’ work execution.

* **Improved UIs and UX**: Today, using multi-agent setups like Gas Town or Agent Mail
  requires comfort with CLI, tmux, and some “rough edges”.
  Gas Town itself is very new and Yegge expects better UIs to
  come[[101]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Gas%20Town%20uses%20tmux%20as,And%20it%E2%80%99s%20worth%20learning).
  It’s easy to imagine a **web dashboard** showing all your agent instances, their
  current task, progress, and allowing you to chat or redirect work – essentially a
  control panel for an AI workforce.
  Some startups and projects are already headed this way (for example, there are
  mentions of an “Agent HQ” and tools to manage agents across
  platforms[[102]](https://www.linkedin.com/posts/denisedresser_codex-is-now-generally-available-activity-7381464835588460544-p6k7#:~:text=How%20OpenAI%27s%20Codex%20for%20Slack,Google%20LLC%27s%20Jules%2C%20xAI)).
  As these become polished, orchestrating agents might become as simple as dragging
  tasks on a Kanban board to an “AI” column and letting them self-assign.

* **Role Specialization**: Right now, most people just spin up N identical Claude Code
  agents. In the future, orchestrators may allow specialization – e.g., one agent
  optimized for writing tests, another for refactoring, another for researching docs.
  They could each have different system prompts or even use different models (Anthropic
  vs OpenAI vs local).
  Gas Town already supports multiple model types (Claude and
  Codex)[[27]](https://github.com/steveyegge/gastown#:~:text=%2A%20Git%202.25%2B%20,developers.openai.com%2Fcodex%2Fcli),
  and Agent Mail’s mention of “heterogeneous fleets (Claude Code, Codex, Gemini CLI,
  etc.)” shows users are mixing
  models[[47]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=2,Arm%20confirmations%20for%20destructive%20work).
  A flexible orchestration layer should accommodate that, assigning tasks to the
  best-suited agent. We might even see a marketplace of third-party agent “skills” or
  plugins that the orchestrator can invoke (Yegge hints at a “Mol Mall” for sharing
  workflow
  recipes[[103]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=in%20the%20Beads%20database)[[104]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Formulas%20provide%20a%20way%20for,Stay%20tuned)).

* **Cloud vs Local Balance**: The user expressed hope for not having to “deploy and
  manage a sync layer” themselves.
  Indeed, if a cloud service provided a plug-and-play coordination backend, that’s
  appealing. OpenAI’s cloud approach with Codex tasks is one path – though it ties you
  into their
  platform[[105]](https://developers.openai.com/codex/integrations/slack/#:~:text=1,you%20when%20you%20mention%20it).
  Alternatively, one could use GitHub itself as the central store (e.g., TBD pushing to
  a GitHub repo, which is pretty low-maintenance) and perhaps a lightweight cloud
  messaging service (even something like a Slack bot or a simple pub-sub on Firebase) as
  the coordination layer.
  It might even be possible to use GitHub Issues or Discussions as a makeshift
  coordination backend (agents could post messages there).
  However, purpose-built solutions are likely to be more efficient and secure.
  In the near future, we expect frameworks like **OpenAI’s Agents SDK with MCP** or
  community-driven servers to fill this need, so that orchestrating across many
  environments becomes mostly configuration rather than custom code.

In conclusion, the **multi-agent coding future** is coming into focus: it will involve a
blend of robust issue-tracking (to remember and divide work), inter-agent communication
(to collaborate without confusion), and safe, scalable execution environments (to
actually run the code they write).
Pioneers like Yegge’s Gas Town + Beads and Emanuel’s Agent Mail illustrate the
possibilities (and pitfalls) of DIY solutions – they’ve massively increased coding
throughput for early
adopters[[12]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%206%3A%20CLI%2C%20multi,You%20are%20very%20fast)[[45]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=One%20disciplined%20hour%20of%20GPT,that%20advantage%20in%20two%20layers).
Now, with efforts like TBD (making the core tracking more reliable across platforms) and
big players like Anthropic and OpenAI formalizing orchestration capabilities (Cowork,
MCP, etc.), we’re likely to see these capabilities become more accessible.

For your team’s specific needs (e.g. coordinating Claude Code instances from Slack,
using Git as a backing store, minimizing conflicts), a combination of the above
approaches could work even today:

- Use **TBD** (when ready) or a similar git-based tracker to persist tasks on GitHub
  with minimal friction.

- Use **Agent Mail (MCP)** to allow realtime coordination and task handoff between
  agents (possibly with each agent running either locally, or in a Sprite VM for
  safety).

- Consider leveraging **Slack integration** (OpenAI’s Codex Slack bot is a model – you
  could create a Claude Slack bot analog using the Claude API and your coordination
  layer). - If real-time isn’t as important, even just using GitHub issues or PRs as the
  place where Claude agents look for work can be effective – one agent could post a fix
  as a PR, another (or a human) could review/merge, etc., all tracked in GitHub.
  Some people have already had agents manage multiple branches concurrently for
  different
  features[[106]](https://www.reddit.com/r/codex/comments/1o09pgj/multiple_branches_and_agents_working_at_the_same/#:~:text=Multiple%20branches%20and%20agents%20working,to%20work%20on%20each).

All these tools are quickly evolving.
The “best” mechanism will depend on how much real-time concurrency vs.
simplicity you need.
But clearly the **bias is towards flexible, CLI-first infrastructure like Beads/Agent
Mail** (now being reimagined through TBD and similar tools to be more robust).
These can run in any environment – local, cloud, Codespaces, Sprites – since they’re
essentially just Git and simple services, not tied to a heavy platform.
The future likely holds even more **turnkey orchestration services** (perhaps even a
dedicated “Claude Orchestrator” product from Anthropic eventually, or third-party
platforms built around this idea).
Until then, mixing and matching the open-source solutions discussed here is the state of
the art, and it’s quite encouraging that even now we have the pieces to achieve a far
more flexible multi-agent setup than was possible a year ago.

**Sources:** The analysis above draws on Steve Yegge’s descriptions of Gas Town and
Beads[[10]](https://github.com/steveyegge/gastown#:~:text=Gas%20Town%20is%20a%20workspace,agent%20workflows)[[2]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%20are%20the%20atomic%20unit,use%20Beads%2C%20as%20do),
the *TBD Design V3*
specification[[107]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,SQLite%20and%20associated%20file%20locking)[[108]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=),
Jeffrey Emanuel’s Agent Mail
documentation[[31]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=What%20it%20is%20,auditable%20artifacts%20in%20Git)[[30]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=The%20most%20compelling%20case%20to,works%20super%20well%20with%20Beads),
as well as official info on Anthropic Claude and OpenAI Codex integrations (Slack,
MCP)[[80]](https://developers.openai.com/codex/integrations/slack/#:~:text=Ask%20Codex%20to%20run%20tasks,from%20channels%20and%20threads)[[77]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=match%20at%20L295%20,offs%2C%20guardrails%2C%20and%20full%20traces),
and Fly.io’s Sprites for sandboxed
agents[[89]](https://sprites.dev/#:~:text=A%20Sprite%20is%20a%20hardware,run%20a%20blob%20of%20code)[[86]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=I%20predicted%20earlier%20this%20week,to%20your%20system%20and%20data).
These illustrate the current approaches and signal where multi-agent orchestration is
headed.

[[1]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Like%20it%20or%20not%2C%20Gas,to%20use%20Beads%20to%20use)
[[2]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%20are%20the%20atomic%20unit,use%20Beads%2C%20as%20do)
[[12]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%206%3A%20CLI%2C%20multi,You%20are%20very%20fast)
[[19]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=All%20Gas%20Town%20workers%2C%20in,is%20the%20agent%E2%80%99s%20persistent%20identity)
[[20]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=In%20Gas%20Town%2C%20an%20agent,It)
[[21]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%208%3A%20Building%20your%20own,the%20frontier%2C%20automating%20your%20workflow)
[[22]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Work%20in%20Gas%20Town%20can,efficient%2C%20but%20you%20are%20flying)
[[23]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=lost,efficient%2C%20but%20you%20are%20flying)
[[24]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=In%20Gas%20Town%2C%20you%20let,That%E2%80%99s%20it)
[[28]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=of%20more%2C%20but%20these%20should,do)
[[29]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=%E2%80%9CIt%20will%20be%20like%20kubernetes%2C,but%20for%20agents%2C%E2%80%9D%20I%20said)
[[68]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=questions)
[[69]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%203%3A%20Agent%20in%20IDE%2C,off%20permissions%2C%20agent%20gets%20wider)
[[70]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=them)
[[71]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Stage%208%3A%20Building%20your%20own,the%20frontier%2C%20automating%20your%20workflow)
[[97]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=and%20so%20on,use%20Beads%2C%20as%20do)
[[98]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Beads%2C%20along%20with%20the%20persistent,orchestration%2C%20as%20we%20will%20see)
[[101]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Gas%20Town%20uses%20tmux%20as,And%20it%E2%80%99s%20worth%20learning)
[[103]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=in%20the%20Beads%20database)
[[104]](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04#:~:text=Formulas%20provide%20a%20way%20for,Stay%20tuned)
Welcome to Gas Town.
Happy New Year, and Welcome to Gas… | by Steve Yegge | Jan, 2026 | Medium

<https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04>

[[3]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=)
[[4]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=)
[[5]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=1,Comparison)
[[6]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,Requires%20SQLite%20queries)
[[7]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,conflicts%20on%20parallel%20issue%20creation)
[[8]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,doesn%E2%80%99t%20work%20well%20on%20NFS%2FSMB)
[[48]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,SQLite%20and%20associated%20file%20locking)
[[49]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,file%20for%20fewer%20merge%20conflicts)
[[50]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,sync%20branch%20for%20coordination%20data)
[[51]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,branch%2C%20entities%20on%20sync%20branch)
[[52]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=tbd%20builds%20on%20lessons%20from,native%20issue%20tracking%20ecosystem)
[[53]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=The%20key%20insight%3A%20%E2%80%9CYou%20don%E2%80%99t,platform%20reliability)
[[54]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=3.%20,network%20filesystems)
[[55]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,CI%2C%20cloud%20sandboxes%2C%20network%20filesystems)
[[56]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=)
[[57]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,ripgrep%2Fgrep%20search%20across%20all%20issues)
[[58]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,LWW%20merge%20and%20attic%20preservation)
[[59]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,opens%20in%20%24EDITOR)
[[60]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,sync%20branch%20for%20coordination%20data)
[[61]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,branch%20access%2C%20searchable%20with%20ripgrep)
[[62]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,zero%20conflicts)
[[63]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,fights%20manual%20git%20operations)
[[64]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,algorithm)
[[65]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=1)
[[66]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,native%20tracking%20without%20external%20files)
[[67]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,tracker)
[[107]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=,SQLite%20and%20associated%20file%20locking)
[[108]](file://file-G3B5iAgBHwv5B5oNDoXTz5#:~:text=) tbd-design-v3.md

<file://file-G3B5iAgBHwv5B5oNDoXTz5>

[[9]](https://github.com/steveyegge/gastown#:~:text=Multi,Code%20with%20persistent%20work%20tracking)
[[10]](https://github.com/steveyegge/gastown#:~:text=Gas%20Town%20is%20a%20workspace,agent%20workflows)
[[11]](https://github.com/steveyegge/gastown#:~:text=Manual%20agent%20coordination%20Built,state%20stored%20in%20Beads%20ledger)
[[13]](https://github.com/steveyegge/gastown#:~:text=Mayor%5BThe%20Mayor)
[[14]](https://github.com/steveyegge/gastown#:~:text=Polecats)
[[15]](https://github.com/steveyegge/gastown#:~:text=Rigs%20%EF%B8%8F)
[[16]](https://github.com/steveyegge/gastown#:~:text=Ephemeral%20worker%20agents%20that%20spawn%2C,complete%20a%20task%2C%20and%20disappear)
[[17]](https://github.com/steveyegge/gastown#:~:text=restarts)
[[18]](https://github.com/steveyegge/gastown#:~:text=Challenge%20Gas%20Town%20Solution%20Agents,state%20stored%20in%20Beads%20ledger)
[[25]](https://github.com/steveyegge/gastown#:~:text=%2A%20Go%201.23%2B%20,optional%20runtime%29)
[[26]](https://github.com/steveyegge/gastown#:~:text=%2A%20Go%201.23%2B%20,recommended%20for%20full%20experience)
[[27]](https://github.com/steveyegge/gastown#:~:text=%2A%20Git%202.25%2B%20,developers.openai.com%2Fcodex%2Fcli)
GitHub - steveyegge/gastown: Gas Town - multi-agent workspace manager

<https://github.com/steveyegge/gastown>

[[30]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=The%20most%20compelling%20case%20to,works%20super%20well%20with%20Beads)
[[34]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=Their%20version%20control%20system%20was,So%20we%20negotiated)
[[35]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=%E2%80%94%20you%20had%20to%20run,So%20we%20negotiated)
[[36]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=tell%20me%20that%20it%20works,super%20well%20with%20Beads)
[[37]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=He%20said%20that%20Beads%20gives,and%20just%20split%20things%20up)
[[42]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=I%E2%80%99m%20working%20on%20setting%20up,I%E2%80%99ll%20find%20out%20this%20week)
[[43]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=uncrummy)
[[44]](https://steve-yegge.medium.com/beads-best-practices-2db636b9760c#:~:text=Beads%20%2B%20Agent%20Mail%20%3D,Agent%20Village)
Beads Best Practices.
Beads continues to grow momentum.
When… | by Steve Yegge | Nov, 2025 | Medium

<https://steve-yegge.medium.com/beads-best-practices-2db636b9760c>

[[31]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=What%20it%20is%20,auditable%20artifacts%20in%20Git)
[[32]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=MCP%20tools%20and%20resources.%20,auditable%20artifacts%20in%20Git)
[[33]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=Why%20it%27s%20useful%20,macros%20that%20bundle%20common%20flows)
[[38]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=One)
[[39]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=startup%20%28just%20type%20,you%20immediately%20know%20what%20changed)
[[40]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=%23%20Now%2C%20simply%20launch%20Codex,better%20utilize%20the%20new%20tools)
[[41]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=Ready,md%20Files)
[[45]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=One%20disciplined%20hour%20of%20GPT,that%20advantage%20in%20two%20layers)
[[46]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=enforcing%20Double,work)
[[47]](https://github.com/Dicklesworthstone/mcp_agent_mail#:~:text=2,Arm%20confirmations%20for%20destructive%20work)
GitHub - Dicklesworthstone/mcp\_agent\_mail: Like gmail for your coding agents.
Lets various different agents communicate and coordinate with each other.

<https://github.com/Dicklesworthstone/mcp_agent_mail>

[[72]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=,strong%20signal%20of%20the%20future)
[[73]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=Security%20worries%20aside%2C%20Cowork%20represents,Code%20to%20a%20wider%20audience)
[[85]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=New%20from%20Fly,code%20in%20a%20secure%20sandbox)
[[86]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=I%20predicted%20earlier%20this%20week,to%20your%20system%20and%20data)
[[92]](https://simonw.substack.com/p/first-impressions-of-claude-cowork#:~:text=The%20safe%20way%20to%20run,away%20and%20get%20another%20one)
First impressions of Claude Cowork, Anthropic’s general agent

<https://simonw.substack.com/p/first-impressions-of-claude-cowork>

[[74]](https://developers.openai.com/codex/cli#:~:text=Codex%20CLI%20is%20OpenAI%E2%80%99s%20coding,Rust%20for%20speed%20and%20efficiency)
[[84]](https://developers.openai.com/codex/cli#:~:text=,Linear) Codex CLI

<https://developers.openai.com/codex/cli>

[[75]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=You%20can%20run%20Codex%20as,with%20the%20OpenAI%20Agents%20SDK)
[[76]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=,offs%2C%20guardrails%2C%20and%20full%20traces)
[[77]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=match%20at%20L295%20,offs%2C%20guardrails%2C%20and%20full%20traces)
[[78]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=match%20at%20L295%20,offs%2C%20guardrails%2C%20and%20full%20traces)
[[79]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=and%20%2A%20orchestrate%20a%20multi,offs%2C%20guardrails%2C%20and%20full%20traces)
[[99]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=You%20can%20launch%20a%20Codex,the%20Model%20Context%20Protocol%20Inspector)
[[100]](https://developers.openai.com/codex/guides/agents-sdk#:~:text=and%20%2A%20orchestrate%20a%20multi,offs%2C%20guardrails%2C%20and%20full%20traces)
Use Codex with the Agents SDK

<https://developers.openai.com/codex/guides/agents-sdk>

[[80]](https://developers.openai.com/codex/integrations/slack/#:~:text=Ask%20Codex%20to%20run%20tasks,from%20channels%20and%20threads)
[[81]](https://developers.openai.com/codex/integrations/slack/#:~:text=Start%20a%20task)
[[82]](https://developers.openai.com/codex/integrations/slack/#:~:text=1,an%20answer%20in%20the%20thread)
[[83]](https://developers.openai.com/codex/integrations/slack/#:~:text=,fix%20the%20issue%20before%20retrying)
[[105]](https://developers.openai.com/codex/integrations/slack/#:~:text=1,you%20when%20you%20mention%20it)
Use Codex in Slack

<https://developers.openai.com/codex/integrations/slack/>

[[87]](https://sprites.dev/#:~:text=Stateful%20environment%20%20%3A%3A%3A)
[[88]](https://sprites.dev/#:~:text=with%20NFS%20or%20FUSE%20mounts,down%20when%20you%20delete%20things)
[[89]](https://sprites.dev/#:~:text=A%20Sprite%20is%20a%20hardware,run%20a%20blob%20of%20code)
[[90]](https://sprites.dev/#:~:text=Manage%20them%20within%20the%20environment,care%20of%20checkpoints%20for%20you)
[[91]](https://sprites.dev/#:~:text=Just%20run%20%60sprite%20url%20,can%20speak%20to%20your%20Sprite)
[[93]](https://sprites.dev/#:~:text=create%2C%20like%2C%20500%20Sprites%20for,free)
[[94]](https://sprites.dev/#:~:text=Sprites%20get%20VMs%20when%20they,RAM%20for%20any%20given%20run)
[[95]](https://sprites.dev/#:~:text=URLs%20for%20External%20Access%20Sprites,Public%20Access%2C%20if%20you%20want)
[[96]](https://sprites.dev/#:~:text=Live%20Checkpoints%20Checkpoints%20are%20transactional,Quick%20restores)
Sprites - Stateful sandboxes

<https://sprites.dev/>

[[102]](https://www.linkedin.com/posts/denisedresser_codex-is-now-generally-available-activity-7381464835588460544-p6k7#:~:text=How%20OpenAI%27s%20Codex%20for%20Slack,Google%20LLC%27s%20Jules%2C%20xAI)
How OpenAI’s Codex for Slack enhances team collaboration

<https://www.linkedin.com/posts/denisedresser_codex-is-now-generally-available-activity-7381464835588460544-p6k7>

[[106]](https://www.reddit.com/r/codex/comments/1o09pgj/multiple_branches_and_agents_working_at_the_same/#:~:text=Multiple%20branches%20and%20agents%20working,to%20work%20on%20each)
Multiple branches and agents working at the same time : r/codex

<https://www.reddit.com/r/codex/comments/1o09pgj/multiple_branches_and_agents_working_at_the_same/>
