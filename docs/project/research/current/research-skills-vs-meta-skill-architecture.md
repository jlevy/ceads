# Research Brief: Skills vs Meta-Skill Architecture for Agent-Integrated CLIs

**Last Updated**: 2026-01-25

**Status**: Complete

**Related**:

- [CLI as Agent Skill Research](./research-cli-as-agent-skill.md)
- [Agent Orientation Experience Spec](../specs/active/plan-2026-01-25-agent-orientation-experience.md)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)

* * *

## Executive Summary

This research brief investigates architectural alternatives for exposing CLI
functionality to AI agents through Claude Code’s skill system.
The central question: should each CLI capability (shortcut, guideline, template) be a
separate skill, or should a single “meta-skill” expose capabilities through CLI
commands?

**Key Finding**: The current meta-skill architecture (one skill + CLI resource library)
is superior to individual skills for resource-heavy CLIs due to:

1. Context efficiency (one description vs N descriptions)
2. No character budget constraints (15K default limit)
3. Dynamic updates through CLI versioning
4. Simpler maintenance (one SKILL.md vs 25+ files)

The individual skills approach is better suited for CLIs with few, distinct capabilities
that benefit from auto-invocation based on task context.

**Research Questions**:

1. Should each tbd shortcut/guideline be a separate Claude Code skill?
2. What are the tradeoffs of plugins vs standalone skills vs CLI-based resources?
3. Can skills be dynamically generated, and is that advisable?
4. Does nested skill directory organization work in practice?

* * *

## Research Methodology

### Approach

Analysis of Claude Code’s skill system through official documentation, GitHub issues,
community resources, and practical testing of the tbd CLI implementation.

### Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) (Jan 2026)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins) (Jan
  2026\)
- [GitHub Issue #18192: Recursive Skill Discovery](https://github.com/anthropics/claude-code/issues/18192)
- [Skills vs MCP Comparison](https://intuitionlabs.ai/articles/claude-skills-vs-mcp)
- [Claude Skills Explained (Anthropic Blog)](https://claude.com/blog/skills-explained)
- [Extending Claude with Skills and MCP](https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers)
- tbd CLI implementation (`packages/tbd/`)

* * *

## Background: Claude Code Skill System

### How Skills Work

Skills are directories containing a `SKILL.md` file that extend Claude’s capabilities:

```
.claude/skills/
├── my-skill/
│   ├── SKILL.md           # Required: instructions + frontmatter
│   ├── template.md        # Optional: supporting files
│   └── scripts/
│       └── helper.sh      # Optional: executable scripts
```

**SKILL.md Structure**:

```yaml
---
name: my-skill
description: What this skill does and when to use it
disable-model-invocation: true    # Only user can invoke
user-invocable: false             # Only Claude can invoke
allowed-tools: Read, Grep, Bash(git:*)
context: fork                     # Run in subagent
agent: Explore                    # Which subagent type
---

Instructions Claude follows when skill is invoked...
```

### Skill Discovery and Loading

1. **Description loading**: All skill descriptions load into context at session start
2. **Full content loading**: Only when skill is invoked (by user or Claude)
3. **Character budget**: Default 15,000 characters for all skill descriptions combined
4. **Override**: `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable

### Skill Scopes

| Scope | Location | Applies To |
| --- | --- | --- |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin enabled |
| Enterprise | Managed settings | All org users |

### Nested Directory Support

**Monorepo pattern (WORKS)**: `.claude/skills/` directories in subdirectories are
auto-discovered when editing files in that subdirectory.

```
packages/frontend/.claude/skills/   # Discovered when editing packages/frontend/
```

**Recursive discovery in ~/.claude/skills/ (BROKEN)**: Despite being promised in v2.1.10
(Jan 2026), skills nested like `~/.claude/skills/category/my-skill/SKILL.md` are NOT
discovered. Only top-level directories are scanned.

**Workaround**: Symlinks at top level:

```bash
ln -s tbd-shortcuts/code-review-and-commit code-review-and-commit
```

* * *

## Architecture Options Analysis

### Option A: Individual Skills for Each Resource

Each shortcut, guideline, and template becomes a separate skill:

```
.claude/skills/
├── tbd/SKILL.md                          # Core issue tracking
├── tbd-shortcut-code-review-and-commit/SKILL.md     # Shortcut
├── tbd-shortcut-new-plan-spec/SKILL.md   # Shortcut
├── tbd-guideline-typescript-rules/SKILL.md  # Guideline
└── ... (50+ skills total)
```

**Example Skill** (`tbd-shortcut-code-review-and-commit/SKILL.md`):

```yaml
---
name: tbd-shortcut-code-review-and-commit
description: Run pre-commit checks, review changes, and commit code. Use when ready to commit, before pushing, or when user says "commit" or "let's commit".
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(npm:*), Read
---

# Commit Code Process

1. Run pre-commit checks...
2. Review staged changes...
3. Write commit message...
```

#### Pros

| Benefit | Description |
| --- | --- |
| **Auto-invocation** | Claude selects appropriate skill based on task context |
| **Direct invocation** | User can `/tbd-shortcut-code-review-and-commit` directly |
| **Fine-grained permissions** | Each skill can have different `allowed-tools` |
| **Subagent isolation** | Each can run with `context: fork` |
| **Invocation control** | `disable-model-invocation` per-skill for dangerous operations |

#### Cons

| Drawback | Description |
| --- | --- |
| **Context bloat** | 50+ skill descriptions load into context (~500 chars each = 25K+) |
| **Character budget exceeded** | Default 15K limit; requires env var override |
| **Namespace pollution** | `/` menu becomes crowded with 50+ entries |
| **Maintenance burden** | 50+ SKILL.md files to keep synchronized |
| **No nesting** | Can't organize hierarchically (recursive discovery broken) |
| **Version drift** | Skill files may get out of sync with CLI updates |

#### When to Use

- CLIs with **few capabilities** (< 10)
- Capabilities that are **distinct and independently useful**
- Operations that benefit from **auto-invocation** based on context
- **Dangerous operations** that need explicit user invocation

* * *

### Option B: Plugin with Bundled Skills

Package tbd as a Claude Code plugin with skills inside:

```
tbd-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── skills/
│   ├── core/SKILL.md         # Issue tracking
│   ├── code-review-and-commit/SKILL.md  # Shortcut
│   └── new-plan-spec/SKILL.md
├── commands/
│   └── tbd-status.md         # Slash command
├── hooks/
│   └── hooks.json            # Event handlers
└── .mcp.json                 # Optional: MCP servers
```

**Plugin Manifest** (`plugin.json`):

```json
{
  "name": "tbd",
  "description": "Git-native issue tracking and development workflows",
  "version": "0.1.5",
  "author": { "name": "tbd contributors" }
}
```

**Namespacing**: Skills become `/tbd:code-review-and-commit`, `/tbd:new-plan-spec`

#### Pros

| Benefit | Description |
| --- | --- |
| **Clean namespacing** | `/tbd:skill-name` avoids conflicts |
| **Organized structure** | Skills grouped in plugin directory |
| **Distributable** | Can share via marketplace |
| **Bundled components** | Skills, commands, hooks, MCP in one package |
| **Team sharing** | Easy to install: `/plugin install tbd` |

#### Cons

| Drawback | Description |
| --- | --- |
| **Same context bloat** | All skill descriptions still load |
| **Installation friction** | Users must install plugin first |
| **More complex structure** | Plugin manifest + directory conventions |
| **Marketplace dependency** | Need to host/distribute plugin |
| **No CLI bundling** | Plugin doesn't include npm package |

#### When to Use

- **Team distribution** of standardized workflows
- **Multiple related tools** that should be packaged together
- When you want **marketplace presence**
- When namespace isolation is important

* * *

### Option C: Meta-Skill with CLI Resource Library (Current Architecture)

One skill exposes a CLI that provides resources on-demand:

```
.claude/skills/
└── tbd/
    └── SKILL.md              # Single skill, references CLI commands
```

**SKILL.md Content**:

```yaml
---
name: tbd
description: Git-native issue tracking, coding guidelines, and workflow shortcuts...
allowed-tools: Bash(tbd:*), Read, Write
---

# tbd Workflow

## Capabilities
1. Issue Tracking: `tbd create`, `tbd close`, `tbd ready`
2. Guidelines: `tbd guidelines <name>`
3. Shortcuts: `tbd shortcut <name>`
4. Templates: `tbd template <name>`

## Available Shortcuts
| Command | Purpose |
|---------|---------|
| `tbd shortcut code-review-and-commit` | Pre-commit checks and commit |
| `tbd shortcut new-plan-spec` | Create planning spec |
...
```

**Resource Access Pattern**:

```
Agent needs commit guidance →
  Runs: tbd shortcut code-review-and-commit →
  Receives: Step-by-step instructions →
  Follows: Instructions to complete task
```

#### Pros

| Benefit | Description |
| --- | --- |
| **Single description** | One ~200 char description vs 50+ descriptions |
| **No budget issues** | Well within 15K character limit |
| **Dynamic updates** | `tbd setup --auto` refreshes content |
| **CLI-managed resources** | Resources bundled with npm package |
| **Simple maintenance** | One SKILL.md file |
| **Proven architecture** | Currently working in production |
| **Version coherence** | Resources always match CLI version |

#### Cons

| Drawback | Description |
| --- | --- |
| **No auto-invocation** | Claude can't auto-select specific shortcuts |
| **Two-step process** | Must query CLI, then follow output |
| **Not in `/` menu** | Shortcuts not directly invocable |
| **Requires CLI knowledge** | Agent must know to query tbd |

#### When to Use

- CLIs with **many resources** (> 10)
- **Resource libraries** (guidelines, templates, workflows)
- When resources need **frequent updates**
- When **context efficiency** is critical

* * *

### Option D: Hybrid Approach

Combine meta-skill with a few high-value individual skills:

```
.claude/skills/
├── tbd/SKILL.md                    # Full meta-skill (current)
├── tbd-commit/SKILL.md             # High-frequency shortcut
├── tbd-ready/SKILL.md              # High-frequency command
└── tbd-create-issue/SKILL.md       # Common operation
```

**Thin Wrapper Skills**:

```yaml
---
name: tbd-commit
description: Run pre-commit checks and commit code
disable-model-invocation: true
---

Run `tbd shortcut code-review-and-commit` and follow the instructions exactly.
```

#### Pros

| Benefit | Description |
| --- | --- |
| **Best of both worlds** | Most resources in CLI, key ones as skills |
| **Direct invocation** | `/tbd-commit` for common operations |
| **Context efficiency** | Only 3-5 extra descriptions |
| **Auto-invocation** | For selected high-value operations |

#### Cons

| Drawback | Description |
| --- | --- |
| **Partial duplication** | Some resources exist in both forms |
| **Maintenance overhead** | Must keep wrapper skills in sync |
| **Inconsistent UX** | Some things are skills, some are CLI |

#### When to Use

- When you have **identified high-frequency operations**
- Want **direct invocation** for specific workflows
- Can maintain **small number of wrapper skills** (< 5)

* * *

## Skills vs MCP: Architectural Distinction

From Anthropic’s documentation:

> **MCP handles connectivity**: secure, standardized access to external systems.
> **Skills handle expertise**: domain knowledge and workflow logic.

| Aspect | Skills | MCP |
| --- | --- | --- |
| **Purpose** | Domain knowledge, workflows | External connectivity |
| **Storage** | `.claude/skills/` | `.mcp.json` or `claude mcp add` |
| **Execution** | Inline or forked subagent | Network-based |
| **Use case** | Guidelines, processes, conventions | APIs, databases, services |
| **Composition** | One skill can use multiple MCP servers | One MCP can serve multiple skills |

**tbd’s architecture insight**: The CLI acts as a **local MCP-like server** for
knowledge resources.
Instead of network calls, the agent calls `tbd shortcut X` to retrieve domain knowledge.
This is more efficient than network-based MCP for static content.

* * *

## Dynamic Skill Generation

### Technical Feasibility

Skills are just files.
tbd could generate them during `tbd setup --auto`:

```typescript
// In setup command
for (const shortcut of shortcuts) {
  const skillDir = join(cwd, '.claude', 'skills', `tbd-${shortcut.name}`);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, 'SKILL.md'),
    generateSkillContent(shortcut)
  );
}
```

### Problems with Dynamic Generation

| Issue | Description |
| --- | --- |
| **Recursive discovery broken** | Generated nested skills won't be found |
| **Context bloat** | All generated skill descriptions load |
| **Version sync** | Generated files may drift from CLI |
| **Git noise** | Many generated files in version control |
| **Cleanup complexity** | Must remove old skills when shortcuts change |

### Recommendation

**Don’t dynamically generate individual skills.** The CLI resource library pattern is
more maintainable and context-efficient.

* * *

## Quantitative Analysis

### Context Budget Calculation

**Individual skills approach** (50 resources):

```
50 skills × ~300 chars/description = 15,000 characters
```

This exactly hits the default budget.
Any additional skills require budget override.

**Meta-skill approach** (1 skill):

```
1 skill × ~200 chars/description = 200 characters
```

Leaves 14,800 characters for other skills in the project.

### Skill Discovery Latency

| Approach | Discovery Time | Reason |
| --- | --- | --- |
| Individual skills | O(n) | Each description must be matched |
| Meta-skill | O(1) | Single description, CLI handles lookup |

### Maintenance Burden

| Approach | Files to Maintain | Update Process |
| --- | --- | --- |
| Individual skills | 50+ SKILL.md files | Edit each file |
| Meta-skill | 1 SKILL.md + CLI | `tbd setup --auto` |

* * *

## Decision Framework

### Use Individual Skills When:

- [ ] CLI has fewer than 10 capabilities
- [ ] Capabilities are distinct and independently valuable
- [ ] Auto-invocation based on task context is important
- [ ] Fine-grained tool permissions are needed per capability
- [ ] Capabilities need different subagent configurations

### Use Meta-Skill + CLI When:

- [ ] CLI has many resources (> 10)
- [ ] Resources are a “library” pattern (guidelines, templates)
- [ ] Resources update frequently with CLI versions
- [ ] Context efficiency is important
- [ ] Resources share common tool permissions

### Use Plugin When:

- [ ] Distributing to teams or community
- [ ] Bundling multiple related components
- [ ] Need marketplace presence
- [ ] Namespace isolation is important

* * *

## Recommendations for tbd

### Primary Recommendation: Keep Current Architecture

The meta-skill + CLI resource library approach is optimal for tbd because:

1. **50+ resources** would exceed context budgets as individual skills
2. **Informational commands** pattern (`tbd shortcut X`) is context-efficient
3. **CLI versioning** keeps resources in sync
4. **Dynamic updates** via `tbd setup --auto` work well
5. **Proven in production** with current implementation

### Secondary Recommendation: Consider Hybrid for High-Frequency Operations

If usage data shows specific operations are very common, consider adding thin wrapper
skills:

```yaml
# .claude/skills/tbd-commit/SKILL.md
---
name: tbd-commit
description: Commit code with pre-commit checks
disable-model-invocation: true
---
Run `tbd shortcut code-review-and-commit` and follow the instructions.
```

Criteria for promotion to individual skill:
- Used in > 50% of sessions
- Benefit from direct `/tbd-commit` invocation
- Dangerous enough to need `disable-model-invocation: true`

### Not Recommended: Plugin Architecture

Plugin adds complexity without clear benefit:
- tbd already distributes via npm
- No need for marketplace
- Plugin structure doesn’t solve context bloat

### Not Recommended: Dynamic Skill Generation

Too many drawbacks:
- Recursive discovery is broken
- Context bloat not solved
- Version sync complexity
- Git noise

* * *

## Open Questions

1. **Usage telemetry**: Which shortcuts are most frequently used?
   This would inform hybrid approach decisions.

2. **Recursive discovery fix**: When Claude Code fixes recursive skill discovery, should
   tbd reconsider nested skill organization?

3. **Skill auto-suggestion**: Could the tbd skill proactively suggest running
   `tbd guidelines X` when it detects relevant context?

4. **Cross-platform consistency**: How do Cursor (MDC) and Codex (AGENTS.md) handle
   similar architectural decisions?

* * *

## Conclusion

The “meta-skill with CLI resource library” architecture is the right choice for
resource-heavy CLIs like tbd.
It provides context efficiency, dynamic updates, and simpler maintenance compared to
individual skills.

The key insight is that **skills and informational CLI commands serve different
purposes**:

- **Skills**: Best for distinct capabilities that benefit from auto-invocation
- **CLI commands**: Best for resource libraries where agents query on-demand

tbd’s current architecture correctly uses the CLI as an on-demand knowledge server, with
a single skill providing the interface.
This pattern should be documented as a best practice for similar tools.

* * *

## References

- Claude Code Skills Documentation: https://code.claude.com/docs/en/skills
- Claude Code Plugins Documentation: https://code.claude.com/docs/en/plugins
- Claude Skills Explained: https://claude.com/blog/skills-explained
- Extending Claude with Skills and MCP:
  https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers
- Skills vs MCP Comparison: https://intuitionlabs.ai/articles/claude-skills-vs-mcp
- GitHub Issue #18192: https://github.com/anthropics/claude-code/issues/18192
- Agent Skills Standard: https://agentskills.io
