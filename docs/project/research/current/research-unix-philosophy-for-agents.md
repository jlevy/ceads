# Unix Philosophy for Agents

You’re basically asking: if *Unix* gave us a “thin waist” for composing computation
(files + processes + pipes + conventions), what’s the thin waist for composing
**thousands of semi-autonomous coding agents** spread across environments, tools, and
repos—while keeping things *local-first, inspectable, idempotent, cacheable, and
reviewable*?

I think the right analogy is not “a better CLI” so much as **a better *kernel
boundary***: a minimal set of primitives that makes agent work composable, debuggable,
replayable, governable, and integratable with Git/GitHub and the exploding CLI tool
ecosystem.

Below is a set of primitives and architectural layers that I’m fairly confident are
“certainly useful,” plus some that are more speculative but I’d bet on, and a few weird
ones that might feel initially non-obvious but get powerful when you actually run
systems at this scale.

* * *

## The core shift: from “pipes of bytes” to “pipes of intent + artifacts”

Unix succeeded because it standardized:

* **A universal substrate** (byte streams + files)
* **A universal execution unit** (process)
* **A universal composition operator** (pipe)
* **A few hard-won conventions** (exit codes, environment variables, cwd, etc.)

For agentic coding with many agents, *bytes* are not the hard part.
The hard part is:

* **Coordination and conflict** (who touches what, when, and how)
* **Reproducibility** under nondeterminism (LLMs, flaky tests, networked tools)
* **Provenance and trust** (what produced this patch?
  with what context? with what permissions?)
* **Review surfaces** (what should a human look at?
  what can be auto-validated?)
* **Incrementality** (avoid redoing expensive work; “make” for agents)
* **Cross-environment portability** (agents running on laptops, CI, ephemeral sandboxes,
  remote runners)

So the analog of “pipes” becomes:

> **streams of *artifact references* + *structured claims* about them**, not raw text.

That one change unlocks composability without drowning in accidental complexity.

* * *

## A “thin waist” for agentic systems: 3 primitives that everything else should reduce to

If I had to pick the minimal substrate that most higher-level systems can be built on
top of, it’s:

### 1) Artifact (immutable, content-addressed, typed)

**Artifact = the universal noun.** Everything that matters is an artifact: a file
snapshot, a diff/patch, a test report, a prompt, a model output, a compilation unit, a
dependency graph, a transcript, a decision record.

Key properties:

* **Content-addressed** (hash-based identity)
* **Immutable** (new outputs are new artifacts)
* **Typed** (schema or at least a MIME + versioned contract)
* **Inspectable** (human-readable rendering always available)
* **Composable** (can be referenced, piped, cached, diffed)

This is *Git objects + Bazel-like action outputs + notebook cells* converging into one
concept.

### 2) Action (a pure-ish transform with declared side effects)

**Action = the universal verb.** An action consumes artifacts and produces artifacts.

To work at scale, actions must be:

* **Idempotent-ish** (rerunnable safely)
* **Cacheable** (inputs + tool version + parameters define outputs)
* **Side-effect declared** (network, filesystem writes, secrets, GitHub API calls)
* **Policy-checkable** (allowed/denied, sandboxed, least privilege)

Think: “process” but with a *manifest*.

### 3) Event (append-only log of decisions and outcomes)

**Event = the universal connective tissue.** You need an append-only event stream
because:

* You’ll have concurrency and partial failures.
* You’ll need replay and audit.
* You’ll need to *observe* and *coordinate* across many agents.

Events reference artifacts and actions:

* “Action X started with inputs A,B”
* “Action X completed, produced outputs C,D”
* “Lease acquired on resource R”
* “Human approved checkpoint Y”
* “PR #123 updated with commit Z”
* “Policy denied secret access”

This becomes your distributed “job control + signals + history” in one place.

> **Artifacts + Actions + Events** is a *very strong* minimal foundation.

Everything else can be layered: shells, planners, UI, GitHub integration, tool
ecosystems.

* * *

## The next layer up: coordination primitives you’ll almost certainly want

### A) Lease / Claim (conflict avoidance as a first-class primitive)

Unix didn’t need this because one human ran a few processes.
With hundreds of agents, you need a *coordination primitive* that is boring but
absolutely essential:

* **Lease(resource, ttl, scope)** Resource might be: file glob, directory, module, API
  surface, PR, issue, test suite, environment.

Crucially: leases should be **composable** and **hierarchical**, like filesystem paths:

* Lease `src/payments/**` implies sub-leases need compatibility rules.
* Lease can be optimistic (warn on conflict) or exclusive (block).

This is not “locks everywhere.”
It’s a way to encode *intent* so the system can help you avoid dumb collisions.

### B) Checkpoint (human review as a programmable gate)

At scale, the failure mode is either:

* humans get spammed with noise, or
* humans stop looking, and quality collapses.

So “human review points” should be explicit nodes in the graph:

* **checkpoint(name, criteria, reviewers, ui_rendering)** Criteria might include: tests
  pass, diff size thresholds, risk classification, touched areas, policy checks.

This turns “review” into something you can compose, parallelize, and automate around.

### C) Attestation (trust, provenance, and “why should I believe this?”)

Agents will produce patches.
You need a standard, inspectable structure for claims:

* “This patch compiles”
* “These tests passed”
* “This change is semantics-preserving”
* “This matches issue intent”
* “This used model X with context Y”

Attestations should be:

* **Signed** (by agent identity / runner identity)
* **Reproducible links** (artifact IDs of inputs/outputs)
* **Policy-verifiable**

Think: supply chain security meets agent outputs.
Not optional long-term.

### D) Policy (capabilities + permissions, not “god mode agents”)

In Unix: user IDs + file permissions.

Here: **capability-based permissions** for actions/tools:

* network access? which domains?
* secrets? which scopes?
* GitHub write? PRs only?
  merges?
* filesystem write? where?
* compute? max spend?

If you don’t do this early, you end up with a system that works until it
catastrophically shouldn’t.

* * *

## “Shell” for agents and humans: what it should feel like

A Unix shell is a REPL over processes + pipes.
An agent shell should be a REPL over **plans**, **artifacts**, and **events**.

It should support:

* interactive exploration
* scriptability (non-interactive, deterministic mode)
* “inspect anything”
* easy integration with CLI tools
* easy integration with Git/GitHub primitives

### A mental model: “a Makefile + Git + Notebook + TUI”

Where commands look like:

* `plan issue#123 --goal "fix flaky test" --constraints ...`
* `run plan#abc --parallel 40`
* `inspect artifact:sha256:...`
* `diff artifact:X artifact:Y`
* `trace action:...`
* `pr open --from artifact:patch --target main`
* `checkpoint approve plan#abc:step5`

### Pipes, but typed

Instead of `stdout | stdin`, you have something like:

* `artifact-stream | action | artifact-stream`
* each item is an artifact reference with type metadata

This one design choice eliminates huge classes of glue problems.

* * *

## GitHub integration: treat Git primitives as first-class artifacts, not “an API integration”

You called out GitHub specifically, and I think the “clean integration” isn’t about
OAuth or webhooks—it’s about making Git operations fit the artifact/action/event model.

### The most important step: “Commit” and “PR” are artifacts

* A **commit** is an artifact (hash already exists).
* A **branch head** is a pointer artifact.
* A **PR** is a composite artifact: (base, head, discussion, checks, review state)

If your system treats PRs as artifacts, then:

* PR updates become actions
* PR state changes become events
* checks and CI become attestations
* human reviews become checkpoint events

Then you can compose workflows like:

* “Generate patch → run tests → open PR → request review → respond to review comments →
  update PR → re-run targeted tests → merge when policy satisfied”

### “Git as the shared filesystem” still matters

With many agents, Git becomes:

* your synchronization substrate
* your diff/merge primitive
* your human review interface
* your audit trail

But Git alone isn’t enough because:

* agents need *more metadata* than Git wants to store in-tree
* you need *event logs* and *tool execution traces*
* you need *cache* and *artifacts* that are not source code

So: keep Git as the user-visible nucleus, but layer a `.agent/` (or similar) workspace
that is **local-first** and optionally synced.

* * *

## CLI tools as “skills”: standardize tool contracts the way Unix standardized stdin/stdout

You also called out the rapid emergence of CLI apps as skill modules.
I agree; the CLI ecosystem is basically the new plugin ecosystem.

The missing piece is: CLI tools vary wildly in input/output shape and determinism.

So you want a **Tool Contract** standard that is:

* discoverable (`tool --describe`)
* schema-driven (input/output JSON schema, or a typed table schema)
* declares side effects + permissions
* declares cache keys
* declares streaming behavior
* declares failure modes and retry safety

Imagine every CLI tool ships a `tool.toml` or implements `--contract`:

```yaml
name: ripgrep
version: 14.1.0
inputs:
  - type: TextFile
    name: repo_snapshot
  - type: String
    name: pattern
outputs:
  - type: MatchList
side_effects:
  - read_fs
deterministic: true
cache_key:
  - repo_snapshot.hash
  - pattern
```

Now you can build a shell that composes tools safely and cacheably.

This is *Unix conventions* upgraded with explicit metadata.

* * *

## The orchestration model: not “one big agent,” but “many small actions with a planner”

Most agent systems today over-weight the “brain” and under-weight the “execution
substrate.”

At scale, you want:

* **planner** (LLM-driven, speculative, revisable)
* **executor** (deterministic-ish, policy constrained)
* **verifier** (tests, lint, static checks, differential analysis)
* **reviewer** (human checkpoints)

And you want the planner to emit a **plan DAG** where each node is an action producing
artifacts.

### The killer feature: incremental rebuild for agent work

If the system has artifact hashing + action caching, then:

* Reruns are cheap.
* “Try three approaches” is manageable.
* Partial failures don’t destroy progress.
* You can parallelize aggressively.

This is basically *Bazel/Make* principles applied to agent cognition and tool execution.

* * *

## A subtle but critical primitive: “workspace state is explicit and portable”

In human coding, “context” is in your head plus your editor state.
With agents, context is a liability unless it’s explicit.

So define a first-class object:

### Context Bundle

A bundle contains:

* repo snapshot reference (commit hash / tree)
* selected files / paths
* issue/PR references
* constraints (style, policies)
* toolchain versions
* model + prompt references (if LLM involved)
* cached artifacts
* decisions + checkpoints

It should be:

* serializable
* diffable
* attachable to PRs
* reproducible

This becomes the analog of “current working directory + environment variables,” but done
explicitly.

* * *

## Certain-to-be-useful architectural primitives

Here’s a list I’d put money on.

### 1) Content-addressed artifact store + derivation graph

This is your agent filesystem.

* supports local-first storage
* supports remote cache (optional)
* supports garbage collection
* supports provenance queries (“why does this file look like this?”)

### 2) Append-only event log with replay

This is your “process table + history + audit log” but distributed.

* powers coordination
* powers observability
* enables time-travel debugging

### 3) Typed tool/action contracts

Without this, composition collapses into prompt spaghetti and brittle glue.

### 4) Lease-based concurrency control (lightweight, intention-focused)

Without this, parallel agents fight and you get hidden conflicts.

### 5) Checkpoints + attestations as first-class graph nodes

Without this, you can’t scale human judgment.

### 6) Policy engine + capability-based permissions

Without this, you can’t safely connect to GitHub, secrets, networks, etc.

### 7) “Patch” as a first-class artifact type

Not just “files changed,” but structured patch objects:

* textual diff
* AST diff (when possible)
* semantic intent summary
* risk classification
* affected surface area analysis

This becomes the unit of collaboration between agents.

* * *

## Likely-to-be-useful primitives that feel “obvious in hindsight”

### A) Semantic ownership maps (beyond CODEOWNERS)

CODEOWNERS is file-based.
Agents need *semantic* boundaries:

* API symbols
* config keys
* database tables
* feature flags
* endpoint routes

Agents can then “lease” or “request review” at the *symbol* level.

This reduces conflict massively when thousands of edits touch the same files.

### B) “Speculative execution” with cheap rollback

LLMs will propose multiple approaches.
The system should make that cheap:

* run 3 candidate patches in parallel
* execute minimal test subsets per patch
* pick the best based on objective signals
* discard the rest (but keep artifacts for audit)

This is basically branch prediction for engineering.

### C) Minimal test selection as a primitive (not a bolted-on optimization)

At scale, the cost center becomes verification.

You want an action like:

* `select-tests(changeset) -> test_plan`

…and it should be composable and cacheable.

### D) Tracing as a first-class UI primitive

Every plan/action should produce a trace:

* inputs, outputs, durations, tool versions, policy decisions, cost
* linkable from PR comments/checks

This becomes your “ps + strace + shell history,” but for agent work.

* * *

## More creative / less obvious primitives that get powerful at scale

These are the ones that often don’t show up in early designs but start to matter when
you have *many* agents and long-lived projects.

### 1) Reconciliation loops as the default coordination model

Instead of: “agent does a sequence of steps,” prefer:

> “declare desired state; controllers converge the repo toward it.”

This is Kubernetes’ deepest lesson: idempotence + convergence beat imperative scripts in
distributed environments.

Example desired states:

* “All TODOs of type X removed”
* “All packages upgraded to satisfy policy”
* “All flaky tests quarantined”
* “Repo conforms to style ruleset”
* “All issues labeled ‘good-first-bug’ have minimal reproduction tests”

Agents become controllers that:

* observe current state (artifacts)
* compute deltas (patch artifacts)
* propose changes (PR artifacts)
* verify convergence (attestations)

This scales better than “one agent, one long plan” because failures are localized and
retryable.

### 2) A “patch calculus”: composing patches like functions

Unix pipes compose streams; you want to compose *code edits*.

If patches are first-class artifacts, you can define operations like:

* `patch.compose(p1, p2)` (with conflict resolution strategy)
* `patch.rebase(p, base)`
* `patch.slice(p, predicate)` (extract only certain edits)
* `patch.normalize(p)` (format, reorder imports, etc.)
* `patch.invert(p)` (undo)
* `patch.prove(p, invariant)` (attach attestations)

Once patches are algebraic objects, coordination becomes *mathematical* instead of
ad-hoc.

### 3) “Counterfactual evaluation” as a primitive (diff-based simulation)

For risky changes, you want the ability to ask:

* “What would happen if we applied this patch?”
* “Which tests would fail?”
* “Which files would conflict with ongoing work?”
* “Which deployed services would be impacted?”

Make this an action:

* `simulate(patch, environment_snapshot) -> impact_report`

This is like `dry-run`, but *first-class and cacheable*.

### 4) Agent-to-agent protocols: proposals, bids, and contracts

When you have many agents, “broadcast tasks” doesn’t scale.
You want a market-ish mechanism:

* planner emits “work items”
* agents bid based on capabilities/cost/availability
* scheduler assigns based on policy and SLA

This avoids the “everyone tries everything” failure mode.

Even a simple protocol helps:

* **proposal**: “I can implement X with constraints Y”
* **contract**: “do X, deliver patch + tests + report”
* **accept/decline**: explicit
* **handoff**: transfer context bundle

This is social systems engineering applied to agents.

### 5) A notion of “entropy budget” for a repo

This is weird but useful: repositories accumulate complexity.

Define metrics as first-class artifacts:

* cyclomatic complexity deltas
* dependency graph churn
* test runtime changes
* config surface area
* public API changes

Then enforce budgets via policy:

* “No PR increases dependency fanout above threshold without explicit checkpoint
  approval”
* “Large refactors must include mechanical proof artifacts (AST-based rename evidence)”

This is how you stop 1,000 agents from slowly destroying coherence.

### 6) “Narrative artifacts” for alignment: decisions as code

Humans don’t just review diffs; they review intent.

So have an artifact type:

* `DecisionRecord` (short, structured)

  * goal
  * constraints
  * approach
  * alternatives considered
  * risks
  * validation plan

Agents produce it; humans can diff it; it attaches to PRs.

This reduces review cost dramatically because reviewers stop reconstructing intent from
code deltas.

### 7) Treat prompts as build inputs, not ephemeral text

If LLM steps exist, they must be reproducible inputs:

* prompt template artifact
* context selection artifact
* model spec artifact
* sampling params artifact

Then caching and provenance works across LLM usage too.

This is how you avoid “it worked yesterday, not today” with no explanation.

* * *

## A concrete “agent shell” design sketch

If you want something that feels Unix-like but isn’t trapped by Unix, I’d design:

### Core object model

* `artifact://sha256/...` (immutable)
* `action://...` (manifest + execution record)
* `event://...` (append-only log entry)
* `plan://...` (DAG of actions + checkpoints)
* `lease://...` (coordination record)
* `pr://github/...` (PR artifact wrapper)

### Core operators

* `|` pipes *artifact references*
* `>` materializes artifact into workspace paths
* `@` binds named inputs from the environment/context bundle
* `?` introspects types/contracts (“what is this?”)

### Example interaction (purely illustrative)

```text
ctx open repo@main issue#124

plan "Fix flaky test in payments" \
  --constraints policy/security.yaml \
  --tools ripgrep,jq,pytest,gh \
| run --parallel 25 \
| checkpoint "Review patch + rationale" --reviewers @codeowners \
| pr open --title "Fix flaky payments test" \
| watch
```

The key is that every step is:

* producing artifacts
* logged as events
* replayable
* inspectable

* * *

## How this plays with Claude-code-like workflows

Tools like Claude Code (and similar) are often “one agent in a repo doing interactive
edits.”

That’s great for a *single* thread.
The architecture above lets you keep that experience but add:

* **plan decomposition** (many short actions, not one long session)
* **parallelism** (multiple candidates, multiple modules)
* **coordination** (leases + PR boundaries)
* **governance** (policy, permissions)
* **incrementality** (cache by artifacts)

In practice, you can keep the “interactive agent in a terminal” UX as the *front end*,
while the substrate is the artifact/action/event system.

* * *

## The “obvious but easy to miss” design constraint: nondeterminism is endemic

Unix composition assumes determinism: given bytes in, bytes out.

Agents aren’t. Even toolchains aren’t (network, time, flaky tests, nondeterministic
builds, model drift).

So you need explicit language features for nondeterminism:

* `nondet` actions must record *extra provenance* (seed, model version, environment
  hash)
* caching can be “best effort” with validation
* workflows must tolerate variance: *confidence bounds*, *consensus*, *verification*

A useful primitive here is:

### Confidence-bearing artifacts

Outputs carry confidence metadata:

* “high confidence: mechanical refactor, verified by compiler”
* “medium confidence: behavior seems correct, tests pass”
* “low confidence: heuristic change, needs human review”

Then checkpoints and policies can route attention appropriately.

* * *

## One more idea that tends to surprise people: use GitHub as the *human-facing event bus*, but not the system bus

GitHub PR timelines and checks are excellent for humans.

But the system should not depend on GitHub as its internal orchestration substrate,
because:

* you’ll want high-frequency events
* you’ll want private/internal events
* you’ll want replay even when GitHub is down or rate-limited

So:

* internal event log is authoritative
* GitHub gets a *projection* (PR comments, check runs, status summaries)

This is classic CQRS/event-sourcing thinking applied to dev workflows.

* * *

## A pragmatic build order if you’re actually building this

If you’re implementing, the highest-leverage sequencing I’ve seen is:

1. **Artifact store + action runner** (local-first, cacheable)
2. **Tool contract standard** (even minimal)
3. **Event log + trace UI** (TUI is fine)
4. **GitHub projection** (PR/check integration)
5. **Leases + checkpoints**
6. **Planner layer** (LLM agent that emits plans, not raw edits)
7. **Reconciliation controllers** (long-lived automation)

This keeps you from building a “cool agent” that becomes un-debuggable the moment you
add concurrency.

* * *

## If you want “thoughts you might not have thought of,” here are three bets

### Bet #1: “Make is more important than Chat”

The killer app isn’t a better prompt UX; it’s **incrementality and caching for
cognition**.

If you can cheaply rerun and branch agent work like builds, you win.

### Bet #2: “Patches are the universal currency”

Most systems treat patches as incidental output.
At scale, **patches are the compositional unit**—they need algebra, provenance, and
policy.

### Bet #3: “Distributed systems discipline will matter more than model quality”

With thousands of agents, the bottleneck is not intelligence; it’s **coordination,
failure handling, and verification throughput**.

The teams that win will look more like people who built Bazel + Git + Kubernetes than
people who built chatbots.

* * *

If you want, I can go one level deeper and propose a minimal spec for:

* a `tool contract` format (including caching + permissions)
* an `artifact` schema (including patch, trace, decision record types)
* a `plan` DSL that compiles to a DAG with checkpoints/leasing
* a GitHub projection model (how checks/comments map to internal events)

…but the core point is: define a thin waist (Artifacts/Actions/Events), then build an
“agent shell” that composes those the way bash composes processes and pipes.
The rest becomes an ecosystem.
