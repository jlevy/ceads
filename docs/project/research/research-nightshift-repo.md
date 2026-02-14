# Research: nightshift -- AI-Powered Autonomous Development Assistant

**Date:** 2026-02-12

**Author:** Agent research (via tbd)

**Status:** Complete

**Repository:** [github.com/marcus/nightshift](https://github.com/marcus/nightshift)

**License:** MIT

## Overview

Nightshift is a Go CLI tool that autonomously runs AI-powered code maintenance tasks
overnight, using your existing Claude Code or Codex CLI subscriptions. It selects tasks
from a catalog of 60+ built-in task types, executes them via a plan-implement-review
harness loop, and delivers results as pull requests. Its philosophy: "Your tokens get
reset every week, you might as well use them."

This research brief provides a full senior engineering walkthrough of every component --
architecture, the harness loop, all task prompts, budget management, task selection
scoring, integrations, and configuration.

## Questions Answered

1. How does the plan-implement-review harness loop work?
2. What are all the prompts used for each task type?
3. How does nightshift decide which tasks to run?
4. How does it handle different programming languages?
5. How does the budget system work?
6. What integration points exist for external data sources?
7. Which features are most generally useful for other projects?

## Scope

Full analysis of the `marcus/nightshift` repository as of 2026-02-12. Covers all source
code in `cmd/`, `internal/`, configuration schema, and CLI structure. Excludes the
Docusaurus website and test files.

---

## Hierarchical Architecture Overview

```
nightshift CLI (cmd/nightshift/main.go)
├── Commands (cmd/nightshift/commands/)
│   ├── run.go          -- Main execution: preflight → confirm → execute
│   ├── preview.go      -- Show upcoming tasks without running
│   ├── setup.go        -- Guided configuration wizard
│   ├── daemon.go       -- Background service (launchd/systemd/cron)
│   ├── config.go       -- Configuration management
│   ├── doctor.go       -- Environment health checks
│   ├── budget.go       -- Budget status & calibration
│   ├── task.go         -- Task listing & single-task execution
│   ├── logs.go         -- Execution log viewer
│   ├── status.go       -- Current status
│   ├── report.go       -- Summary reports
│   ├── snapshot.go     -- Budget snapshot management
│   ├── stats.go        -- Usage statistics
│   ├── busfactor.go    -- Bus-factor analysis
│   └── install.go      -- System service installation
│
├── Orchestrator (internal/orchestrator/)
│   ├── orchestrator.go -- Plan-implement-review loop
│   └── events.go       -- Lifecycle event system
│
├── Agents (internal/agents/)
│   ├── agent.go        -- Agent interface
│   ├── claude.go       -- Claude Code CLI wrapper
│   └── codex.go        -- Codex CLI wrapper
│
├── Tasks (internal/tasks/)
│   ├── tasks.go        -- 60+ built-in task definitions (the prompts)
│   ├── selector.go     -- Task scoring & selection pipeline
│   └── register.go     -- Custom task registration from config
│
├── Budget (internal/budget/)
│   └── budget.go       -- Token allowance calculation (daily/weekly)
│
├── State (internal/state/)
│   └── state.go        -- SQLite-backed run history & staleness tracking
│
├── Integrations (internal/integrations/)
│   ├── integrations.go -- Multi-reader coordination
│   ├── claudemd.go     -- claude.md context extraction
│   ├── agentsmd.go     -- agents.md context extraction
│   ├── github.go       -- GitHub Issues reader
│   └── td.go           -- td task management reader
│
├── Providers (internal/providers/)  -- Usage tracking (not execution)
├── Config (internal/config/)        -- YAML config loading
├── Database (internal/db/)          -- SQLite schema & migrations
├── Calibrator (internal/calibrator/) -- Budget calibration
├── Trends (internal/trends/)        -- Usage trend analysis
├── Scheduler (internal/scheduler/)  -- Cron expression parsing
├── Reporting (internal/reporting/)  -- Run summaries
├── Logging (internal/logging/)      -- Structured logging
├── Security (internal/security/)    -- Sandboxing
└── Tmux (internal/tmux/)            -- Tmux integration
```

---

## The Harness Loop (Plan-Implement-Review)

**Source:** [`internal/orchestrator/orchestrator.go`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go)

This is the core execution engine. Every task goes through three phases in an iterative
loop with a configurable maximum of 3 iterations (default).

### Phase 1: Plan (lines 432-464)

The orchestrator spawns the AI agent with the **plan prompt**, asking it to analyze the
task and produce a structured JSON plan.

```
You are a planning agent. Create a detailed execution plan for this task.

## Task
ID: {task.ID}
Title: {task.Title}
Description: {task.Description}

## Instructions
0. You are running autonomously. If the task is broad or ambiguous, choose a
   concrete, minimal scope that delivers value and state any assumptions in the
   description.
1. Work on a new branch and plan to submit a PR. Never work directly on the
   primary branch.
2. Before creating your branch, record the current branch name and plan to switch
   back after the PR is opened.
3. If you create commits, include a concise message with these git trailers:
   Nightshift-Task: {task.Type}
   Nightshift-Ref: https://github.com/marcus/nightshift
4. Analyze the task requirements
5. Identify files that need to be modified
6. Create step-by-step implementation plan
7. Output only valid JSON (no markdown, no extra text). The output is read by a
   machine. Use this schema:

{
  "steps": ["step1", "step2", ...],
  "files": ["file1.go", "file2.go", ...],
  "description": "overall approach"
}
```

**Source:** [`orchestrator.go:664-690`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L664-L690)

The plan phase produces a `PlanOutput` struct with `Steps []string`, `Files []string`,
and `Description string`. If the agent returns unstructured text instead of JSON, the raw
output is used as the description.

### Phase 2: Implement (lines 467-510, iterative)

The orchestrator passes the plan to the agent for execution. On subsequent iterations
(after a failed review), the prompt includes the review feedback.

```
You are an implementation agent. Execute the plan for this task.

## Task
ID: {task.ID}
Title: {task.Title}
Description: {task.Description}

## Plan
{plan.Description}

## Steps
{plan.Steps}

{if iteration > 1:}
## Note
This is iteration {N}. Previous attempts did not pass review. Pay attention to
the feedback in the plan description.
{end if}

## Instructions
0. Before creating your branch, record the current branch name. Create and work
   on a new branch. Never modify or commit directly to the primary branch.
   When finished, open a PR. After the PR is submitted, switch back to the
   original branch. If you cannot open a PR, leave the branch and explain next
   steps.
1. If you create commits, include a concise message with these git trailers:
   Nightshift-Task: {task.Type}
   Nightshift-Ref: https://github.com/marcus/nightshift
2. Implement the plan step by step
3. Make all necessary code changes
4. Ensure tests pass
5. Output a summary as JSON:

{
  "files_modified": ["file1.go", ...],
  "summary": "what was done"
}
```

**Source:** [`orchestrator.go:692-727`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L692-L727)

**Key detail:** The implement phase also passes relevant file paths from the plan as
stdin context using the format:

```
# Context Files

## File: /path/to/file.go

\`\`\`
[file content]
\`\`\`
```

**Source:** [`claude.go:188-209`](https://github.com/marcus/nightshift/blob/main/internal/agents/claude.go#L188-L209)

### Phase 3: Review (lines 565-611)

The orchestrator spawns a fresh agent instance to review the implementation.

```
You are a code review agent. Review this implementation.

## Task
ID: {task.ID}
Title: {task.Title}
Description: {task.Description}

## Implementation Summary
{impl.Summary}

## Files Modified
{impl.FilesModified}

## Instructions
1. Confirm work was done on a branch (not primary) and is ready for a PR
2. Check if implementation meets task requirements
3. Verify code quality and correctness
4. Check for bugs or issues
5. Output your review as JSON:

{
  "passed": true/false,
  "feedback": "detailed feedback",
  "issues": ["issue1", "issue2", ...]
}

Set "passed" to true ONLY if the implementation is correct and complete.
```

**Source:** [`orchestrator.go:729-758`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L729-L758)

### Loop Logic (lines 241-331)

```
for iteration := 1; iteration <= maxIterations (default 3); iteration++ {
    implement(task, plan, iteration)
    review(task, implementation)

    if review.Passed {
        commit()
        extractPRURL()
        annotatePR()  // Append metadata footer
        return StatusCompleted
    }

    // Append review feedback to plan for next iteration
    plan.Description += "\n\nReview feedback (iteration N): {feedback}"
}
return StatusAbandoned  // Max iterations reached without passing
```

**Source:** [`orchestrator.go:241-331`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L241-L331)

### Fallback Review Inference (lines 774-803)

When the review agent doesn't return valid JSON, the orchestrator falls back to a
heuristic keyword matcher. It counts pass indicators ("passed", "approved", "lgtm",
"ship it", "no issues") vs. fail indicators ("failed", "rejected", "needs work", "bug",
"incomplete") and compares scores.

**Source:** [`orchestrator.go:774-803`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L774-L803)

### PR Metadata Annotation (lines 344-364)

Every PR created by nightshift gets a metadata footer appended to the body:

```
---
*Automated by [nightshift](https://github.com/marcus/nightshift)*

<!-- nightshift:metadata
task-id: lint-fix:~/code/myproject
task-type: lint-fix
task-title: Linter Fixes
provider: claude
score: 5.2
cost-tier: Low (10-50k)
iterations: 1
duration: 2m15s
run-started: 2025-01-15T02:00:00Z
nightshift:metadata -->
```

This is idempotent -- it checks for existing metadata before appending.

**Source:** [`orchestrator.go:344-364`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go#L344-L364)

### Event System

The orchestrator emits lifecycle events via a callback handler, enabling the live
terminal renderer to show real-time progress.

Event types: `EventTaskStart`, `EventPhaseStart`, `EventPhaseEnd`,
`EventIterationStart`, `EventLog`, `EventTaskEnd`.

**Source:** [`events.go`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/events.go)

---

## Agent Implementations

### Agent Interface

**Source:** [`internal/agents/agent.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/agent.go)

```go
type Agent interface {
    Name() string
    Execute(ctx context.Context, opts ExecuteOptions) (*ExecuteResult, error)
}

type ExecuteOptions struct {
    Prompt  string
    WorkDir string
    Files   []string
    Timeout time.Duration  // default 30 minutes
}

type ExecuteResult struct {
    Output   string
    JSON     []byte   // Parsed structured output if available
    ExitCode int
    Duration time.Duration
    Error    string
}
```

### Claude Agent

Spawns: `claude --print --dangerously-skip-permissions "{prompt}"`

**Source:** [`internal/agents/claude.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/claude.go)

### Codex Agent

Spawns: `codex --quiet --dangerously-bypass-approvals-and-sandbox "{prompt}"`

**Source:** [`internal/agents/codex.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/codex.go)

Both agents share the same file context format and JSON extraction logic. JSON extraction
scans the output for the first `{` or `[`, finds the matching closer via depth counting,
and validates with `json.Valid()`.

---

## Complete Task Catalog -- All 60+ Built-In Prompts

**Source:** [`internal/tasks/tasks.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go)

Each task's `Description` field IS the prompt -- it's inserted directly into the
orchestrator's plan/implement/review templates. There are **no language-specific prompt
variants**. The AI agent detects the project's language and applies appropriate
techniques.

### Category 1: "It's done -- here's the PR" (CategoryPR)

These tasks produce review-ready code changes delivered as PRs.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `lint-fix` | Linter Fixes | "Automatically fix linting errors and style issues" | Low (10-50k) | Low | 24h |
| `bug-finder` | Bug Finder & Fixer | "Identify and fix potential bugs in code" | High (150-500k) | Medium | 72h |
| `auto-dry` | Auto DRY Refactoring | "Identify and refactor duplicate code" | High | Medium | 7d |
| `skill-groom` | Skill Grooming | *(see full prompt below)* | High | Medium | 7d |
| `api-contract-verify` | API Contract Verification | "Verify API contracts match implementation" | Medium (50-150k) | Low | 7d |
| `backward-compat` | Backward-Compatibility Checks | "Check and ensure backward compatibility" | Medium | Low | 7d |
| `build-optimize` | Build Time Optimization | "Optimize build configuration for faster builds" | High | Medium | 7d |
| `docs-backfill` | Documentation Backfiller | "Generate missing documentation" | Low | Low | 7d |
| `commit-normalize` | Commit Message Normalizer | "Standardize commit message format" | Low | Low | 24h |
| `changelog-synth` | Changelog Synthesizer | "Generate changelog from commits" | Low | Low | 7d |
| `release-notes` | Release Note Drafter | "Draft release notes from changes" | Low | Low | 7d |
| `adr-draft` | ADR Drafter | "Draft Architecture Decision Records" | Medium | Low | 7d |
| `td-review` | TD Review Session | *(see full prompt below)* | High | Medium | 72h |

**Source:** [`tasks.go:253-382`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L253-L382)

**Full `skill-groom` prompt** (lines 286-293):
```
Audit and update project-local agent skills to match the current codebase.
Use README.md as the primary project context for commands, architecture, and
workflows.
For Agent Skills documentation lookup, fetch https://agentskills.io/llms.txt
first and use it as the index before reading specific spec pages.
Inspect .claude/skills and .codex/skills for SKILL.md files, validate
frontmatter and naming rules against the spec, and fix stale references to
files/scripts/paths.
Apply safe updates directly, and leave concise follow-ups for anything uncertain.
```

**Full `td-review` prompt** (lines 371-377, disabled by default):
```
Start a td review session and do a detailed review of open reviews.
For obvious fixes, create a td bug task with a detailed description of the
problem and fix them immediately. Create new td tasks with detailed descriptions
for bigger bugs or issues that should be fixed in a later session.
Verify that changes have tests—if not, create td tasks to add test coverage.
For reviews that can be processed in parallel, use subagents.
Once tasks related to previously opened bugs are complete, close the
in-progress tasks.
```

### Category 2: "Here's what I found" (CategoryAnalysis)

These tasks produce reports and analysis -- no code changes.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `doc-drift` | Doc Drift Detector | "Detect documentation that's out of sync with code" | Medium | Low | 3d |
| `semantic-diff` | Semantic Diff Explainer | "Explain the semantic meaning of code changes" | Medium | Low | 3d |
| `dead-code` | Dead Code Detector | "Find unused code that can be removed" | Medium | Low | 3d |
| `dependency-risk` | Dependency Risk Scanner | "Analyze dependencies for security and maintenance risks" | Medium | Low | 3d |
| `test-gap` | Test Gap Finder | "Identify areas lacking test coverage" | Medium | Low | 3d |
| `test-flakiness` | Test Flakiness Analyzer | "Identify and analyze flaky tests" | Medium | Low | 3d |
| `logging-audit` | Logging Quality Auditor | "Audit logging for completeness and quality" | Medium | Low | 3d |
| `metrics-coverage` | Metrics Coverage Analyzer | "Analyze metrics instrumentation coverage" | Medium | Low | 3d |
| `perf-regression` | Performance Regression Spotter | "Identify potential performance regressions" | Medium | Low | 3d |
| `cost-attribution` | Cost Attribution Estimator | "Estimate resource costs by component" | Medium | Low | 3d |
| `security-footgun` | Security Foot-Gun Finder | "Find common security anti-patterns" | Medium | Low | 3d |
| `pii-scanner` | PII Exposure Scanner | "Scan for potential PII exposure" | Medium | Low | 3d |
| `privacy-policy` | Privacy Policy Consistency Checker | "Check code against privacy policy claims" | Medium | Low | 3d |
| `schema-evolution` | Schema Evolution Advisor | "Analyze database schema changes" | Medium | Low | 3d |
| `event-taxonomy` | Event Taxonomy Normalizer | "Normalize event naming and structure" | Medium | Low | 3d |
| `roadmap-entropy` | Roadmap Entropy Detector | "Detect roadmap scope creep and drift" | Medium | Low | 3d |
| `bus-factor` | Bus-Factor Analyzer | "Analyze code ownership concentration" | Medium | Low | 3d |
| `knowledge-silo` | Knowledge Silo Detector | "Identify knowledge silos in the team" | Medium | Low | 3d |

**Source:** [`tasks.go:384-546`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L384-L546)

### Category 3: "Here are options" (CategoryOptions)

These tasks surface decisions and tradeoffs for human review.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `task-groomer` | Task Groomer | "Refine and clarify task definitions" | Medium | Low | 7d |
| `guide-improver` | Guide/Skill Improver | "Suggest improvements to guides and skills" | Medium | Low | 7d |
| `idea-generator` | Idea Generator | "Generate improvement ideas for the codebase" | Medium | Low | 7d |
| `tech-debt-classify` | Tech-Debt Classifier | "Classify and prioritize technical debt" | Medium | Low | 7d |
| `why-annotator` | Why Does This Exist Annotator | "Document the purpose of unclear code" | Medium | Low | 7d |
| `edge-case-enum` | Edge-Case Enumerator | "Enumerate potential edge cases" | Medium | Low | 7d |
| `error-msg-improve` | Error-Message Improver | "Suggest better error messages" | Medium | Low | 7d |
| `slo-suggester` | SLO/SLA Candidate Suggester | "Suggest SLO/SLA candidates" | Medium | Low | 7d |
| `ux-copy-sharpener` | UX Copy Sharpener | "Improve user-facing text" | Medium | Low | 7d |
| `a11y-lint` | Accessibility Linting | "Non-checkbox accessibility analysis" | Medium | Low | 7d |
| `service-advisor` | Should This Be a Service Advisor | "Analyze service boundary decisions" | High | Medium | 7d |
| `ownership-boundary` | Ownership Boundary Suggester | "Suggest code ownership boundaries" | Medium | Low | 7d |
| `oncall-estimator` | Oncall Load Estimator | "Estimate oncall load from code changes" | Medium | Low | 7d |

**Source:** [`tasks.go:548-665`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L548-L665)

### Category 4: "I tried it safely" (CategorySafe)

These tasks involve execution/simulation but leave no lasting side effects.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `migration-rehearsal` | Migration Rehearsal Runner | "Rehearse migrations without side effects" | VeryHigh (500k+) | High | 14d |
| `contract-fuzzer` | Integration Contract Fuzzer | "Fuzz test integration contracts" | VeryHigh | High | 14d |
| `golden-path` | Golden-Path Recorder | "Record golden path test scenarios" | High | Medium | 14d |
| `perf-profile` | Performance Profiling Runs | "Run performance profiling" | High | Medium | 14d |
| `allocation-profile` | Allocation/Hot-Path Profiling | "Profile memory allocation and hot paths" | High | Medium | 14d |

**Source:** [`tasks.go:667-712`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L667-L712)

### Category 5: "Here's the map" (CategoryMap)

These tasks produce context and documentation artifacts.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `visibility-instrument` | Visibility Instrumentor | "Instrument code for observability" | High | Medium | 7d |
| `repo-topology` | Repo Topology Visualizer | "Visualize repository structure" | Medium | Low | 7d |
| `permissions-mapper` | Permissions/Auth Surface Mapper | "Map permissions and auth surfaces" | Medium | Low | 7d |
| `data-lifecycle` | Data Lifecycle Tracer | "Trace data lifecycle through the system" | Medium | Low | 7d |
| `feature-flag-monitor` | Feature Flag Lifecycle Monitor | "Monitor feature flag usage and lifecycle" | Medium | Low | 7d |
| `ci-signal-noise` | CI Signal-to-Noise Scorer | "Score CI signal vs noise ratio" | Medium | Low | 7d |
| `historical-context` | Historical Context Summarizer | "Summarize historical context of code" | Medium | Low | 7d |

**Source:** [`tasks.go:714-777`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L714-L777)

### Category 6: "For when things go sideways" (CategoryEmergency)

These tasks produce emergency preparedness artifacts.

| Task ID | Name | Prompt (Description) | Cost | Risk | Interval |
|---------|------|---------------------|------|------|----------|
| `runbook-gen` | Runbook Generator | "Generate operational runbooks" | High | Medium | 30d |
| `rollback-plan` | Rollback Plan Generator | "Generate rollback plans for changes" | High | Medium | 30d |
| `postmortem-gen` | Incident Postmortem Draft Generator | "Draft incident postmortem documents" | High | Medium | 30d |

**Source:** [`tasks.go:779-807`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go#L779-L807)

---

## Task Selection: How Nightshift Decides What to Run

**Source:** [`internal/tasks/selector.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/selector.go)

### Scoring Algorithm (lines 59-79)

```
score = base_priority (from config, default 0)
      + staleness_bonus (days_since_last_run * 0.1, capped at 3.0;
                         never-run tasks get 3.0)
      + context_bonus (+2.0 if task type mentioned in claude.md/agents.md)
      + task_source_bonus (+3.0 if derived from td/GitHub issues)
```

### Filter Pipeline (applied in order)

1. **`FilterEnabled()`** -- Only tasks not disabled in config. Tasks with
   `DisabledByDefault: true` (like `td-review`) require explicit opt-in via
   `tasks.enabled`.

2. **`FilterByBudget(budget)`** -- Excludes tasks whose max estimated token cost
   exceeds the remaining budget.

3. **`FilterUnassigned(project)`** -- Excludes tasks currently marked as in-progress
   (prevents duplicate execution).

4. **`FilterByCooldown(project)`** -- Excludes tasks whose cooldown interval hasn't
   elapsed since last run. Default cooldowns vary by category:
   - PR tasks: 7 days (except `lint-fix` and `commit-normalize` at 24h)
   - Analysis tasks: 3 days
   - Options tasks: 7 days
   - Safe tasks: 14 days
   - Map tasks: 7 days
   - Emergency tasks: 30 days

5. **`SelectTopN(budget, project, n)`** -- Score remaining tasks, sort descending, pick
   top N.

**Selection modes:**
- `SelectTopN` -- Pick highest-scored (default in `nightshift run`)
- `SelectRandom` -- Pick uniformly at random from eligible pool (via `--random-task`)
- Specific task via `--task lint-fix` (bypasses scoring entirely)

### Staleness Bonus Detail

**Source:** [`internal/state/state.go:172-183`](https://github.com/marcus/nightshift/blob/main/internal/state/state.go#L172-L183)

```go
func (s *State) StalenessBonus(projectPath, taskType string) float64 {
    days := s.DaysSinceLastRun(projectPath, taskType)
    if days < 0 { return 3.0 }   // Never run = high bonus
    if days > 30 { days = 30 }   // Cap at 30 days
    return float64(days) * 0.1
}
```

### Custom Tasks

Users can define custom tasks in config YAML. They go through the same scoring and
filtering pipeline as built-in tasks.

```yaml
tasks:
  custom:
    - type: my-custom-scan
      name: "My Custom Scanner"
      description: "Scan for specific patterns in the codebase"  # This IS the prompt
      category: analysis
      cost_tier: medium
      risk_level: low
      interval: "72h"
```

**Source:** [`internal/tasks/register.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/register.go)

---

## Budget System

**Source:** [`internal/budget/budget.go`](https://github.com/marcus/nightshift/blob/main/internal/budget/budget.go)

### Token Cost Tiers

| Tier | Token Range | Example Tasks |
|------|-------------|---------------|
| Low | 10k-50k | lint-fix, docs-backfill, changelog-synth |
| Medium | 50k-150k | doc-drift, dead-code, test-gap |
| High | 150k-500k | bug-finder, auto-dry, build-optimize |
| Very High | 500k-1M | migration-rehearsal, contract-fuzzer |

### Daily Mode Calculation (lines 188-205)

```
daily_budget = weekly_budget / 7
available_today = daily_budget * (1 - used_percent / 100)
allowance = available_today * max_percent / 100
allowance = max(0, allowance - reserve_amount)
allowance = max(0, allowance - predicted_daytime_usage)
```

### Weekly Mode Calculation (lines 209-233)

```
remaining_weekly = weekly_budget * (1 - used_percent / 100)
multiplier = 1.0
  if aggressive_end_of_week AND remaining_days <= 2:
    multiplier = 3 - remaining_days  // 2x on penultimate day, 3x on last day

allowance = (remaining_weekly / remaining_days) * max_percent / 100 * multiplier
allowance = max(0, allowance - reserve_amount)
allowance = max(0, allowance - predicted_daytime_usage)
```

### Provider Usage Tracking

**Providers** (not agents) track usage to calculate remaining budget:
- **Claude**: Reads `~/.claude/stats-cache.json`
- **Codex**: Reads `~/.codex/sessions/` directory

The budget manager also supports:
- **Calibrated budgets** via snapshot collection over time
- **Trend analysis** to predict daytime usage and protect user's interactive budget
- **Reserve enforcement** (default 5% always held back)

---

## Language Handling

Nightshift has **no language-specific prompts or detection logic**. The task descriptions
are generic ("fix linting errors", "find dead code", etc.) and the underlying AI agents
(Claude Code, Codex) handle language detection and apply appropriate techniques based on
the project's files.

This is a deliberate architectural decision: the prompts are high-level instructions
and the agent interprets them in context.

---

## Integration System

**Source:** [`internal/integrations/integrations.go`](https://github.com/marcus/nightshift/blob/main/internal/integrations/integrations.go)

Four integration readers coordinate to provide context and task sources:

### claude.md Integration

**Source:** [`internal/integrations/claudemd.go`](https://github.com/marcus/nightshift/blob/main/internal/integrations/claudemd.go)

Reads `claude.md`, `CLAUDE.md`, or `.claude.md` from the project root. Parses section
headers to extract hints:
- Headers containing "convention", "coding", "style" -> `HintConvention`
- Headers containing "task", "todo" -> `HintTaskSuggestion`
- Headers containing "constraint", "restriction", "safety" -> `HintConstraint`

Task type mentions in these files trigger the **+2 context bonus** in scoring.

### agents.md Integration

Similar to claude.md but reads `agents.md` files.

### GitHub Issues Integration

Reads open GitHub issues. Task types mentioned in issue labels or titles contribute to
the **+3 task source bonus** in scoring.

### td Integration

Reads tasks from `td` (task management tool). Also feeds task types into the +3 bonus.

---

## End-to-End Execution Flow

**Source:** [`cmd/nightshift/commands/run.go`](https://github.com/marcus/nightshift/blob/main/cmd/nightshift/commands/run.go)

```
1. nightshift run [flags]
2. Load config from ~/.config/nightshift/config.yaml + ./nightshift.yaml
3. Initialize: logging, SQLite database, state manager, providers
4. Clear stale assignments (>2 hours old)
5. Register custom tasks from config
6. Create task selector with state
7. Build preflight plan:
   For each project:
     a. Skip if already processed today (unless --task specified)
     b. Select provider: iterate preference order, check CLI in PATH,
        check budget > 0
     c. Select tasks: filter pipeline → score → pick top N
8. Display preflight summary (colored if interactive terminal)
9. Confirm execution (auto-skip in non-TTY, skip with --yes)
10. Execute:
    For each project:
      For each selected task:
        a. Create orchestrator with selected agent
        b. Set run metadata for PR traceability
        c. RunTask → plan → implement → review loop
        d. Record result in SQLite (state + run_history)
        e. Extract and annotate PR URL if found
11. Display run summary
12. Generate morning summary report
```

### Key CLI Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--dry-run` | false | Show preflight only, don't execute |
| `--project/-p` | all configured | Target a single project |
| `--task/-t` | auto-select | Run a specific task type |
| `--max-projects` | 1 | Limit projects per run |
| `--max-tasks` | 1 | Limit tasks per project |
| `--random-task` | false | Random instead of highest-scored |
| `--ignore-budget` | false | Bypass budget checks |
| `--yes/-y` | false | Skip confirmation prompt |

---

## Configuration Schema

**Source:** `~/.config/nightshift/config.yaml`

```yaml
schedule:
  cron: "0 2 * * *"               # When to run
  window:
    start: "22:00"
    end: "06:00"
    timezone: "America/Denver"

budget:
  mode: daily                      # daily | weekly
  max_percent: 75                  # Max % of budget per run
  reserve_percent: 5               # Always hold in reserve
  aggressive_end_of_week: false    # Ramp up last 2 days (weekly mode)
  billing_mode: subscription       # subscription | api
  calibrate_enabled: true          # Enable budget calibration
  per_provider:
    claude: 700000
    codex: 500000

providers:
  preference: [claude, codex]
  claude:
    enabled: true
    dangerously_skip_permissions: true
  codex:
    enabled: true
    dangerously_bypass_approvals_and_sandbox: true

projects:
  - path: ~/code/myproject
    priority: 1
    tasks: [lint-fix, docs-backfill]

tasks:
  enabled: [lint-fix, docs-backfill, bug-finder]
  disabled: [skill-groom]
  priorities:
    lint-fix: 1
    bug-finder: 2
  intervals:
    lint-fix: "24h"
    docs-backfill: "168h"
  custom:
    - type: my-task
      name: "My Custom Task"
      description: "Your custom prompt here"
      category: pr
      cost_tier: medium
      risk_level: low
      interval: "72h"

integrations:
  claude_md: true
  agents_md: true
  github:
    enabled: true
  td:
    enabled: true
```

---

## State Persistence

**Source:** [`internal/state/state.go`](https://github.com/marcus/nightshift/blob/main/internal/state/state.go)

All state is stored in SQLite at `~/.local/share/nightshift/nightshift.db`.

### Tables

| Table | Purpose |
|-------|---------|
| `projects` | Path, last_run timestamp, run_count |
| `task_history` | (project_path, task_type) -> last_run timestamp |
| `assigned_tasks` | Currently in-progress task assignments |
| `run_history` | Full run records (capped at 100, auto-pruned) |

### Key Operations

- **`WasProcessedToday(project)`** -- Same-day check prevents double runs
- **`StalenessBonus(project, task)`** -- Days since last run * 0.1 (capped at 3.0)
- **`MarkAssigned/ClearAssigned`** -- Prevent duplicate task execution
- **`ClearStaleAssignments(2h)`** -- Auto-cleanup on every run start

---

## Features Most Useful for Other Projects

### 1. Plan-Implement-Review Harness (High Value)

The three-phase loop with iterative feedback is a general-purpose pattern for
autonomous agent work. The key insight is having a separate review phase that can
reject and trigger re-implementation. This could be extracted as a standalone library.

### 2. Task Catalog & Scoring System (High Value)

The categorized task registry with cost tiers, risk levels, cooldown intervals, and
scoring (staleness + context + source bonuses) is a sophisticated task prioritization
framework. The category taxonomy (PR, Analysis, Options, Safe, Map, Emergency) is
well-thought-out.

### 3. Budget-Aware Execution (High Value)

The subscription-aware budget system that reads actual usage from provider data files
and calculates remaining allowance is novel. The aggressive end-of-week multiplier
and trend-based daytime usage prediction are particularly clever.

### 4. PR Metadata Annotations (Medium Value)

Standardized metadata footers on PRs enable programmatic tracking of automated work.
The HTML comment format is a good pattern for machine-readable data in PR bodies.

### 5. Integration Readers (Medium Value)

Reading `claude.md` and `agents.md` for context hints that influence task scoring is
a practical way to make the tool project-aware without requiring explicit configuration.

### 6. Safe Defaults Pattern (High Value)

Everything lands as a PR on a branch. The tool never writes to the primary branch.
The "worst case you close the PR" philosophy makes it low-risk to run autonomously.

### 7. Provider Abstraction (Medium Value)

The clean separation between agents (execute tasks) and providers (track usage)
allows adding new AI backends without restructuring. The provider preference list with
automatic fallback is a good resilience pattern.

### 8. Task Descriptions as Prompts (Medium Value)

Using the task description field directly as the agent prompt is elegant. It means the
task registry is simultaneously the prompt library and the documentation. Custom tasks
inherit the same execution infrastructure.

---

## References

- Repository: [github.com/marcus/nightshift](https://github.com/marcus/nightshift)
- Main entry: [`cmd/nightshift/main.go`](https://github.com/marcus/nightshift/blob/main/cmd/nightshift/main.go)
- CLI commands: [`cmd/nightshift/commands/`](https://github.com/marcus/nightshift/blob/main/cmd/nightshift/commands/)
- Run command: [`cmd/nightshift/commands/run.go`](https://github.com/marcus/nightshift/blob/main/cmd/nightshift/commands/run.go)
- Orchestrator: [`internal/orchestrator/orchestrator.go`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/orchestrator.go)
- Events: [`internal/orchestrator/events.go`](https://github.com/marcus/nightshift/blob/main/internal/orchestrator/events.go)
- Agent interface: [`internal/agents/agent.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/agent.go)
- Claude agent: [`internal/agents/claude.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/claude.go)
- Codex agent: [`internal/agents/codex.go`](https://github.com/marcus/nightshift/blob/main/internal/agents/codex.go)
- Task definitions: [`internal/tasks/tasks.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/tasks.go)
- Task selector: [`internal/tasks/selector.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/selector.go)
- Custom task registration: [`internal/tasks/register.go`](https://github.com/marcus/nightshift/blob/main/internal/tasks/register.go)
- Budget manager: [`internal/budget/budget.go`](https://github.com/marcus/nightshift/blob/main/internal/budget/budget.go)
- State manager: [`internal/state/state.go`](https://github.com/marcus/nightshift/blob/main/internal/state/state.go)
- Integrations: [`internal/integrations/integrations.go`](https://github.com/marcus/nightshift/blob/main/internal/integrations/integrations.go)
- claude.md reader: [`internal/integrations/claudemd.go`](https://github.com/marcus/nightshift/blob/main/internal/integrations/claudemd.go)
- README: [`README.md`](https://github.com/marcus/nightshift/blob/main/README.md)
