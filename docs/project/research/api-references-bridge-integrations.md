# Research Brief: API References for Bridge Integrations

**Last Updated**: 2026-01-08

**Status**: Complete

**Related**:

- Architecture docs for bridge design

- Multi-agent coordination patterns

- Git-native issue tracking systems

* * *

## Executive Summary

This research brief compiles key API references and documentation for building bridge
integrations between TBD (git-native issue tracker) and external platforms (GitHub,
Slack). It also surveys existing git-native issue tracking systems and multi-agent
coordination patterns relevant to the TBD architecture.

**Research Questions**:

1. What are the official APIs for GitHub Issues, Webhooks, and authentication?

2. What are the official APIs for Slack messaging, events, and Socket Mode?

3. What existing git-native issue trackers exist and how do they work?

4. What are the current best practices for multi-agent coordination in AI systems?

**Key Findings**:

- GitHub provides comprehensive REST and GraphQL APIs for issue management with webhook
  support

- Slack recommends Socket Mode over legacy RTM for WebSocket-based connections

- Several mature git-native issue trackers exist (git-bug, git-issue, git-appraise) with
  different approaches

- Multi-agent coordination is undergoing rapid evolution in 2026 with standardized
  protocols (A2A, MCP, ACP, ANP)

* * *

## Research Methodology

### Approach

Conducted comprehensive web search for:

1. Official API documentation from GitHub and Slack

2. Existing git-native issue tracking implementations

3. Current (2026) multi-agent coordination patterns and protocols

4. Best practices and recent developments in the field

### Sources

- Official GitHub and Slack developer documentation

- Open-source project repositories (git-bug, git-issue, git-appraise, etc.)

- Industry blog posts and technical articles

- Academic surveys on agent interoperability protocols

* * *

## Research Findings

### 1. GitHub APIs

#### 1.1 GitHub Issues REST API

**Status**: Complete

**Official Documentation**: https://docs.github.com/en/rest/issues

**Key Features**:

- Manage issues, assignees, comments, labels, and milestones

- Every pull request is considered an issue (but not vice versa)

- Identify pull requests by the `pull_request` key in responses

- Recent updates (2025) added REST API support for issue types

**Important Endpoints**:

- List issues: `GET /repos/{owner}/{repo}/issues`

- Create issue: `POST /repos/{owner}/{repo}/issues`

- Update issue: `PATCH /repos/{owner}/{repo}/issues/{issue_number}`

- Issue comments: `GET/POST /repos/{owner}/{repo}/issues/{issue_number}/comments`

- Issue types: https://docs.github.com/en/rest/orgs/issue-types

**Assessment**: REST API is mature, well-documented, and suitable for most CRUD
operations on issues.
Rate limits apply based on authentication type.

* * *

#### 1.2 GitHub GraphQL API

**Status**: Complete

**Official Documentation**: https://docs.github.com/en/graphql/reference/queries

**Key Features**:

- More precise and flexible queries than REST API

- Returns only requested data (no over-fetching)

- Single endpoint for all operations

- Recent update (2025): Advanced search with AND/OR keywords and nested searches

**Breaking Changes Effective 2026**:

- `ReviewRequest.requestedBy` → use `requestedByActor` (effective 2026-04-01)

- `NotificationThread.list` → use `optionalList` (effective 2026-01-01)

- `NotificationThread.subject` → use `optionalSubject` (effective 2026-01-01)

**Query Structure**:

- Queries operate like GET requests

- Mutations operate like POST/PATCH/DELETE

- Must specify nested subfields until reaching scalars

**Related Documentation**:

- Forming calls: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql

- Rate limits:
  https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api

- Changelog: https://docs.github.com/en/graphql/overview/changelog

**Assessment**: GraphQL is ideal for complex queries requiring specific fields or
relationships. More efficient for bandwidth but requires learning GraphQL query syntax.

* * *

#### 1.3 GitHub Webhooks

**Status**: Complete

**Official Documentation**: https://docs.github.com/en/webhooks

**Key Features**:

- Subscribe to specific events on GitHub (push, issues, pull requests, etc.)

- Real-time HTTP POST notifications to your server

- No polling required - event-driven architecture

- Support for repository, organization, and GitHub App webhooks

**Webhook Types**:

- Repository webhooks: Require owner/admin access

- Organization webhooks: Require org owner status

- GitHub App webhooks: Tied to app permissions

**Best Practices**:

- Server must respond with 2XX within 10 seconds

- Use async queue for processing payloads

- Verify SSL certificates (enabled by default)

- Secure webhook URLs (they contain secrets)

- Maximum 20 webhooks per event type per repository

**Common Use Cases**:

- Trigger CI/CD pipelines

- Send notifications to collaboration platforms (Discord, Slack)

- Sync data with external systems

**Related Documentation**:

- Creating webhooks:
  https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks

- Webhook events and payloads:
  https://docs.github.com/en/webhooks/webhook-events-and-payloads

- REST API for webhooks: https://docs.github.com/en/rest/repos/webhooks

- Best practices:
  https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks

**Assessment**: Webhooks are essential for real-time synchronization.
Must handle webhook verification, replay attacks, and implement proper retry logic.

* * *

#### 1.4 GitHub App Authentication

**Status**: Complete

**Official Documentation**:
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/about-authentication-with-a-github-app

**Authentication Types**:

1. **JWT (JSON Web Token)** - Authenticate as the app itself

   - Required to generate installation access tokens

   - Used for app-level operations (list installations, suspend installations)

   - Short-lived tokens

2. **Installation Access Tokens** - Authenticate as an app installation

   - Required for most API operations on behalf of installation

   - Expire after 1 hour

   - Can specify subset of permissions

   - Ideal for automation workflows

3. **User Access Tokens** - OAuth tokens with fine-grained permissions

   - User + app combined permissions (intersection)

   - No traditional OAuth scopes, uses fine-grained permissions

**Bot User**:

- GitHub Apps automatically get a bot user account

- Bot user ID format: `https://api.github.com/users/<app-slug>[bot]`

- Example: Dependabot user ID is 49699333

**Token Generation Flow**:

1. Generate JWT using app private key

2. POST to `/app/installations/{installation_id}/access_tokens` with JWT

3. Receive installation access token (valid 1 hour)

4. Use token in Authorization header for API calls

**SDK Benefits**:

- Octokit SDK handles JWT generation automatically

- Manages token rotation and expiration

**Related Documentation**:

- Generating installation tokens:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

- Authenticating as app:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app

- Authenticating as installation:
  https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation

**Assessment**: Three-tier authentication model is flexible but complex.
Installation tokens with 1-hour expiry require refresh logic.
Use SDK to simplify.

* * *

#### 1.5 GitHub App Permissions and Webhooks

**Status**: Complete

**Official Documentation**:
https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app

**Key Concepts**:

- Apps have no permissions by default

- Webhook event subscriptions depend on permissions granted

- Must request minimum required permissions

**Permission → Webhook Example**:

- To receive `issues` webhook events:

  1. First grant “Issues” permission under “Repository permissions”

  2. Then subscribe to “Issues” events under “Subscribe to events”

**OAuth Scopes Required**:

- Repository webhooks: `write:repo_hook` or `repo` scope

- Organization webhooks: `admin:org_hook` scope

**Best Practices**:

- Request minimum permissions required

- Explain high-level permissions (e.g., “Administration”) on app homepage

- Users must understand why broad permissions are needed

**Related Documentation**:

- Using webhooks with GitHub Apps:
  https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps

- OAuth scopes:
  https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps

**Assessment**: Permission model is granular and security-focused.
Clear documentation needed for users about why specific permissions are required.

* * *

### 2. Slack APIs

#### 2.1 Slack Events API

**Status**: Complete

**Official Documentation**: https://docs.slack.dev/apis/events-api/

**Key Features**:

- Recommended over legacy RTM API for most use cases

- HTTP-based event delivery to your server endpoints

- Near real-time event notifications

- OAuth scope-based access control

- No WebSocket connection management required (unlike RTM)

**How It Works**:

- Set up HTTP endpoint on your server

- Subscribe to specific event types (message.channels, file_created, etc.)

- Slack POSTs events to your endpoint when they occur

- Events tied to OAuth scopes (e.g., `files:read` scope required for file events)

**Event Types**:

- Workspace events (app installation, token revocation)

- Message events (messages posted, edited, deleted)

- File events (uploaded, shared, deleted)

- User events (status changes, profile updates)

- Channel events (created, renamed, archived)

**Rate Limits**:

- 30,000 event deliveries per hour per workspace

**OAuth and Permissions**:

- Events require corresponding OAuth scopes

- Bot user requires `bot` OAuth scope

- Workspace events available through app subscriptions

**Related Documentation**:

- Main Events API: https://api.slack.com/apis/events-api

- Event types: https://api.slack.com/events

- Comparing HTTP & Socket Mode:
  https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/

**Assessment**: Events API is the modern, recommended approach for receiving Slack
events. Requires publicly accessible HTTP endpoint or use Socket Mode for
firewall/security scenarios.

* * *

#### 2.2 Slack Socket Mode

**Status**: Complete

**Official Documentation**: https://docs.slack.dev/apis/events-api/using-socket-mode/

**Key Features**:

- WebSocket-based alternative to HTTP endpoints

- No public HTTP endpoint required (firewall-friendly)

- Uses Events API and interactive features over WebSocket

- Bidirectional stateful protocol with low latency

- Dynamic WebSocket URLs (created at runtime, not static)

**How It Works**:

1. Create app-level token with `connections:write` scope

2. Enable Socket Mode in app settings

3. Call `apps.connections.open` to get WebSocket URL

4. Connect to WebSocket (URL valid for 30 seconds)

5. URLs refresh regularly (not static)

**Connection Limits**:

- Up to 10 concurrent WebSocket connections per app

- Payloads distributed across active connections

**SDK Support**:

- **Python**: `slack_sdk.socket_mode.SocketModeClient`

- **JavaScript (Node.js)**: `@slack/socket-mode` package (Node v18+)

- **Java**: `bolt-socket-mode` extension (since v1.5)

**Use Cases**:

- Development behind corporate firewalls

- Security concerns about exposing public endpoints

- Local development without ngrok/tunneling

**Related Documentation**:

- Main Socket Mode guide: https://docs.slack.dev/apis/events-api/using-socket-mode/

- Python SDK: https://docs.slack.dev/tools/python-slack-sdk/socket-mode/

- Node.js SDK: https://slack.dev/node-slack-sdk/socket-mode/

- Java SDK: https://tools.slack.dev/java-slack-sdk/guides/socket-mode/

**Assessment**: Socket Mode is ideal for development and environments where public
endpoints are not feasible.
Slightly more complex than webhooks but more flexible for certain deployment scenarios.

* * *

#### 2.3 Slack Real Time Messaging (RTM) API

**Status**: Legacy (Not Recommended)

**Official Documentation**: https://api.slack.com/rtm

**Important Notice**:

- **LEGACY API** - Slack recommends Events API or Socket Mode instead

- New classic apps cannot be created after June 4, 2024

- Many workspace admins block RTM due to overly permissive scopes

- Requires broader permissions than modern alternatives

**How It Works**:

- WebSocket-based API for real-time events

- Call `rtm.connect` to get WebSocket URL

- Single-use URLs valid for 30 seconds

- Receives event stream over WebSocket

**Why Avoid**:

- Requires overly permissive OAuth scopes

- Less secure than modern alternatives

- Not supported for new apps

- Better alternatives exist (Socket Mode for WebSockets, Events API for HTTP)

**Migration Path**:

- **For WebSockets**: Use Socket Mode instead

- **For HTTP**: Use Events API instead

**Related Documentation**:

- Legacy RTM API: https://api.slack.com/legacy/rtm

- Node.js RTM SDK: https://docs.slack.dev/tools/node-slack-sdk/rtm-api/

- Python RTM SDK:
  https://docs.slack.dev/tools/python-slack-sdk/legacy/real_time_messaging/

**Assessment**: Do not use for new development.
Migrate existing RTM implementations to Socket Mode or Events API.

* * *

#### 2.4 Slack Incoming Webhooks

**Status**: Complete

**Official Documentation**: https://api.slack.com/messaging/webhooks

**Key Features**:

- Simple way to post messages from apps to Slack

- Unique URL per webhook

- JSON payload with message text and formatting

- Supports rich formatting and layout blocks

- No OAuth required (URL acts as authentication)

**How It Works**:

1. Create incoming webhook in app settings

2. Get unique webhook URL

3. POST JSON payload to URL

4. Message appears in configured channel

**Security**:

- Webhook URLs contain secrets

- Do not share publicly or commit to public repositories

- Slack actively searches for and revokes leaked webhooks

**Rate Limits**:

- 1 message per second per webhook

- Short bursts allowed

**Message Formatting**:

- Plain text messages

- Rich formatting with Block Kit

- Attachments (legacy)

- Mentions, links, emojis

**Related Documentation**:

- Sending messages with webhooks:
  https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/

**Assessment**: Simplest way to send messages to Slack.
Ideal for one-way notifications.
For bidirectional communication, use Events API or Socket Mode.

* * *

#### 2.5 Slack Bolt Framework

**Status**: Complete

**Official Documentation**:

- Bolt for Python: https://docs.slack.dev/tools/bolt-python/

- Bolt for JavaScript: https://docs.slack.dev/tools/bolt-js/

**Overview**:

- Official framework from Slack for building apps

- Available for JavaScript, Python, and Java

- Simplifies app development with latest platform features

- Handles token rotation and rate limiting automatically

**Key Benefits**:

- Fast setup with built-in best practices

- Type support included (TypeScript/Python type hints)

- Abstracts away complex API details

- Socket Mode and HTTP mode support

- Focus on functionality, not boilerplate

**Bolt for Python**:

- GitHub: https://github.com/slackapi/bolt-python

- Requires Python 3.7+

- Async support with aiohttp

- Built-in adapters for various deployment scenarios

- Examples in repository

**Bolt for JavaScript**:

- Node-based framework with TypeScript bindings

- Built for modern Node.js (v18+)

- Comprehensive documentation and examples

**Installation**:

```bash
# Python
pip install slack-bolt

# JavaScript
npm install @slack/bolt
```

**Related Documentation**:

- General tools overview: https://docs.slack.dev/tools/

- Quickstart guide: https://docs.slack.dev/quickstart/

- Python API reference: https://docs.slack.dev/tools/bolt-python/reference/

**Assessment**: Bolt is the recommended way to build Slack apps.
Use it instead of low-level SDK unless you have specific requirements.
Significantly reduces development time.

* * *

### 3. Git-Native Issue Trackers

#### 3.1 git-bug

**Status**: Complete

**Repository**: https://github.com/git-bug/git-bug

**Overview**:

- Distributed, offline-first bug tracker embedded in git

- Stores issues as git objects (not files)

- No files added to project working directory

- Push/pull bugs like git commits

**Key Features**:

- **Fully embedded in git**: Only need git repository

- **Distributed**: Use normal git remotes to collaborate

- **Offline-first**: Work without network connectivity

- **No vendor lock-in**: Full backup in git history

- **No pollution**: No files added to project

- **Bridges**: Import/export to GitHub, GitLab

- **Multiple UIs**: CLI, terminal UI (termui), web UI

- **GraphQL API**: Integrate with custom tools

**Data Storage**:

- Uses git refs namespace (like `git notes`)

- Stores in special refs, not regular file commits

- Similar to Gerrit’s use of virtual namespaces

**User Interfaces**:

1. **CLI**: `git bug` commands

2. **Terminal UI**: `git bug termui` (interactive TUI)

3. **Web UI**: Served via localhost HTTP server, GraphQL backend

**Recent Activity**:

- Master branch being removed Jan 31, 2026

- Active development and community

**Related Resources**:

- GitHub: https://github.com/git-bug/git-bug

- Hacker News discussion: https://news.ycombinator.com/item?id=43971620

**Assessment**: Most mature and feature-rich git-native issue tracker.
Excellent model for distributed issue management.
Strong GraphQL API for integrations.
Consider as reference architecture.

* * *

#### 3.2 git-issue

**Status**: Complete

**Repository**: https://github.com/dspinellis/git-issue

**Overview**:

- Minimalist decentralized issue management based on git

- Optional bidirectional integration with GitHub and GitLab

- Simple text file format for issues

**Key Features**:

- **No backend, no dependencies**: Install with single shell command

- **Decentralized async management**: Add/comment/edit issues offline

- **Transparent text format**: Plain text files (easy to edit, backup, share)

- **GitHub/GitLab integration**: Bidirectional sync with platforms

**Data Storage**:

- Issues stored as simple text files

- Human-readable and editable

- Version controlled like any other file

**Philosophy**:

- Minimalist approach

- No database required

- Works with any text editor

- Git is the only dependency

**Related Resources**:

- GitHub: https://github.com/dspinellis/git-issue

**Assessment**: Excellent for simple use cases.
Very lightweight and transparent.
Text file approach is both strength (simplicity) and weakness (less structured than git
objects). Good for small teams or personal projects.

* * *

#### 3.3 tk (ticket)

**Status**: Complete

**Repository**: https://github.com/wedow/ticket

**Overview**:

- Fast, git-native ticket tracking in single bash script

- Designed for AI agents

- Inspired by Joe Armstrong’s Minimal Viable Program

- Zero setup required

**Key Features**:

- **Single bash script**: Portable, works on any POSIX system

- **Zero dependencies**: Only requires coreutils and bash

- **Dependency graphs**: Track complex issue dependencies

- **Priority levels**: Built-in prioritization

- **AI-friendly format**: Markdown with YAML frontmatter

**Data Storage**:

- Tickets stored in `.tickets/` directory

- Each ticket is markdown file with YAML frontmatter

- Easy for AI agents to search and parse

- No huge JSON blobs in context window

**Philosophy**:

- Unix Philosophy approach

- Optimized for AI agent integration

- Minimal but powerful

- Human and machine readable

**Related Resources**:

- GitHub: https://github.com/wedow/ticket

- Mentioned in AIBit blog about Beads

**Assessment**: Excellent choice for AI agent integration.
YAML frontmatter + markdown is optimal format for LLM parsing.
Simple dependency tracking.
Consider for TBD if prioritizing AI agent experience.

* * *

#### 3.4 Beads

**Status**: Complete

**Reference**:
https://aibit.im/blog/post/beads-elevate-your-ai-agent-s-memory-with-git-backed-issue-tracking

**Overview**:

- Lightweight, graph-based issue tracker leveraging git

- Distributed system without server/daemon

- Designed specifically for AI agent memory and task management

**Key Innovations**:

- **Git as “database”**: Feels like centralized SQL but uses git

- **JSONL format**: Source of truth in `.beads/issues.jsonl`

- **Local SQLite cache**: Each machine maintains cache

- **Git synchronization**: JSONL file committed to git

- **Graph-based**: Complex task dependencies and relationships

**Architecture**:

- No server required

- Local cache for performance

- Git commits as synchronization mechanism

- SQLite for local queries

**Use Case**:

- AI agent memory and task tracking

- Complex coding task management

- Distributed team coordination

**Related Resources**:

- Blog post:
  https://aibit.im/blog/post/beads-elevate-your-ai-agent-s-memory-with-git-backed-issue-tracking

**Assessment**: Innovative approach using JSONL + SQLite cache.
Very relevant to TBD design.
Consider hybrid approach: human-readable markdown in git + local cache for performance.

* * *

#### 3.5 git-appraise

**Status**: Complete

**Repository**: https://github.com/google/git-appraise

**Overview**:

- Distributed code review system from Google

- Reviews stored in git refs (git notes)

- No server required

- Works with any git hosting

**Key Features**:

- **Fully distributed**: Reviews stored as git objects

- **No server setup**: Works out of the box

- **Universal**: Works with any git provider

- **Automated merging**: Tool handles merge conflicts in reviews

- **Multiple data types**: Requests, comments, CI results, robot comments

**Data Storage Structure**:

- Reviews: `refs/notes/devtools/reviews` (annotates first revision)

- CI results: `refs/notes/devtools/ci` (annotates tested revision)

- Robot comments: `refs/notes/devtools/analyses` (static analysis)

- Human comments: `refs/notes/devtools/discuss` (annotates first revision)

**Schemas**:

- Structured JSON schemas for each data type

- Request, comment, CI, analysis schemas

**Installation**:

```bash
# Go
go install github.com/google/git-appraise/git-appraise@latest

# Homebrew
brew install git-appraise
```

**Eclipse Integration**:

- Mylyn Task Repository connector

- Leverages Egit plugin

**Related Resources**:

- GitHub: https://github.com/google/git-appraise

- Tutorial: https://github.com/google/git-appraise/blob/master/docs/tutorial.md

**Assessment**: Excellent example of using git refs for structured data.
Separating different data types into different refs is elegant.
Schema approach ensures consistency.
Consider for TBD comment/discussion system.

* * *

### 4. Multi-Agent Coordination Patterns

#### 4.1 Agent Communication Protocols (2026)

**Status**: Complete

**Key Protocols**:

1. **Model Context Protocol (MCP)** - Anthropic

   - JSON-RPC client-server interface

   - Secure tool invocation

   - Typed data exchange

2. **Agent Communication Protocol (ACP)**

   - REST-native messaging

   - Multi-part messages

   - Asynchronous streaming

   - Multimodal agent responses

3. **Agent-to-Agent Protocol (A2A)** - Google

   - Peer-to-peer task outsourcing

   - Capability-based Agent Cards

   - Enterprise-scale workflows

   - Dynamic role assignment

4. **Agent Network Protocol (ANP)**

   - Open-network agent discovery

   - Decentralized identifiers (DIDs)

   - JSON-LD graphs

   - Secure collaboration

**Comparison**:

- **MCP**: Best for client-server tool invocation

- **ACP**: Best for REST-based multimodal communication

- **A2A**: Best for peer-to-peer enterprise workflows

- **ANP**: Best for decentralized agent networks

**Related Resources**:

- Protocol survey: https://arxiv.org/html/2505.02279v1

- A2A overview: https://onereach.ai/blog/what-is-a2a-agent-to-agent-protocol/

- AWS guidance:
  https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-frameworks/agent-to-agent-protocols.html

**Assessment**: Standardization happening rapidly in 2026. A2A protocol most relevant
for TBD multi-agent coordination.
Consider implementing A2A-compatible agent cards for agent capabilities.

* * *

#### 4.2 Google’s Eight Essential Design Patterns

**Status**: Complete

**Source**: https://www.infoq.com/news/2026/01/multi-agent-design-patterns/

**Core Patterns**:

1. **Sequential Pipeline**: Linear agent chain

2. **Parallel Processing**: Multiple agents in parallel

3. **Router/Coordinator**: Central agent routes tasks

4. **Generator-Critic Loop**: Generate and review cycle

5. **Tool Use**: Agents with external tool access

6. **Planning**: Multi-step task planning

7. **Reflection**: Self-evaluation and improvement

8. **Human-in-the-Loop**: Human oversight and approval

**Composite Pattern**:

- Combine multiple patterns

- Example: Router → Parallel → Generator-Critic

- Flexible orchestration

**Implementation**:

- Google’s Agent Development Kit supports all patterns

- Sample code available in documentation

- Each pattern suitable for different use cases

**Related Resources**:

- InfoQ article: https://www.infoq.com/news/2026/01/multi-agent-design-patterns/

**Assessment**: Essential vocabulary for agent architecture.
TBD likely needs Router (for task delegation), Tool Use (for git operations), and
Human-in-the-Loop (for approvals).

* * *

#### 4.3 Orchestration Approaches

**Status**: Complete

**Categories**:

1. **Centralized (Manager/Router)**

   - Single manager agent assigns tasks

   - Controls workflow

   - Ensures objectives met

   - Pro: Simple coordination

   - Con: Single point of failure

2. **Decentralized (Peer-to-Peer)**

   - Agents communicate directly

   - No central coordinator

   - Pro: Resilient, scalable

   - Con: More complex protocols

3. **Hierarchical**

   - Multiple layers of coordination

   - Team leads and workers

   - Pro: Scales better than centralized

   - Con: More complex than flat

**Communication Patterns**:

- **Mediator**: Central message broker (O(N) complexity)

- **Observer/Pub-Sub**: Event-based notifications

- **Broker**: Request-response routing

- **Direct P2P**: Point-to-point (O(N²) complexity)

**Learning Structured Communication (LSC)**:

- Neural importance weights

- Distributed election for hierarchy

- Two-tier networks (reduces O(N²) to O(k² + kb))

- Hierarchical GNN for message passing

**Related Resources**:

- AI orchestration guide: https://kanerika.com/blogs/ai-agent-orchestration/

- AIM Multiple overview: https://research.aimultiple.com/agentic-orchestration/

**Assessment**: TBD should consider hierarchical approach with topic-based teams (bridge
agents, git agents, etc.). Pub-sub for event notifications.
A2A for peer delegation.

* * *

#### 4.4 Leading Multi-Agent Frameworks (2026)

**Status**: Complete

**Top Frameworks**:

1. **LangGraph (LangChain)**

   - Graph-based workflows

   - Modular design

   - Complex structured tasks

   - Strong developer ecosystem

2. **MetaGPT (FoundationAgents)**

   - Role-based collaboration

   - Software development roles (engineer, QA, PM)

   - Structured agent interactions

3. **AutoGen (Microsoft)**

   - Conversational collaboration

   - Planner-executor-critic loops

   - Multi-agent conversations

4. **Agent Development Kit (Google)**

   - Multi-agent orchestration

   - Integrated evaluation and debugging

   - Deployment capabilities

   - Supports all eight design patterns

**Industry Trends**:

- 1,445% surge in multi-agent inquiries (Q1 2024 to Q2 2025)

- Gartner: 40% of enterprise apps will include AI agents by 2026

- Shift from single agents to orchestrated systems

- Interoperability becoming core requirement

**Enterprise Requirements**:

- Auditability

- Confidence scoring

- Human oversight

- Cross-platform communication

- Security and compliance

**Related Resources**:

- Framework comparison: https://www.multimodal.dev/post/best-multi-agent-ai-frameworks

- Industry trends: https://www.salesmate.io/blog/future-of-ai-agents/

- Analytics Vidhya: https://www.analyticsvidhya.com/blog/2026/01/ai-agents-trends/

**Assessment**: Consider LangGraph for graph-based task workflows.
Study AutoGen’s planner-executor-critic pattern for code review.
Ensure TBD agents are interoperable with major frameworks.

* * *

#### 4.5 Message Passing Patterns

**Status**: Complete

**Message Structure**:

- **Performative**: Communicative act type (request, inform, propose, query)

- **Content**: Actual message payload (proposal, question, command, data)

- **Metadata**: Sender, receiver, timestamp, correlation IDs

**Communication Standards**:

- HTTP and HTTPS for transport

- JSON-RPC for structured calls

- Server-Sent Events (SSE) for streaming

- WebSockets for bidirectional real-time

**Best Practices**:

1. Use standard protocols (avoid proprietary)

2. Include message versioning

3. Implement retry logic

4. Add correlation IDs for tracing

5. Use typed schemas for validation

6. Support both sync and async patterns

**Security**:

- Zero-trust architectures

- Blockchain-based verification (emerging)

- End-to-end encryption

- Authentication and authorization

- Audit trails

**Related Resources**:

- DigitalOcean guide:
  https://www.digitalocean.com/community/tutorials/agent-communication-protocols-explained

- SmythOS overview:
  https://smythos.com/developers/agent-development/agent-communication-and-message-passing/

**Assessment**: TBD should use JSON-RPC for agent-to-agent calls, SSE for streaming
updates, and pub-sub for event notifications.
Include correlation IDs for debugging distributed operations.

* * *

## Comparative Analysis

### GitHub API Comparison

| Feature | REST API | GraphQL API |
| --- | --- | --- |
| Learning curve | Easy | Moderate |
| Flexibility | Fixed endpoints | Custom queries |
| Data fetching | May over-fetch | Fetch exactly what needed |
| Version management | URL versioning | Schema evolution |
| Rate limiting | Endpoint-based | Query complexity-based |
| Best for | CRUD operations | Complex queries, relationships |

**Recommendation**: Use REST for simple CRUD, GraphQL for complex queries with multiple
related resources.

* * *

### Slack Communication Comparison

| Feature | Events API (HTTP) | Socket Mode | RTM API (Legacy) |
| --- | --- | --- | --- |
| Connection type | HTTP POST | WebSocket | WebSocket |
| Public endpoint | Required | Not required | Not required |
| Firewall-friendly | No | Yes | Yes |
| Status | Recommended | Recommended | Deprecated |
| Setup complexity | Low | Medium | Medium |
| Permissions | Fine-grained | Fine-grained | Overly broad |

**Recommendation**: Use Events API for production with public endpoints, Socket Mode for
development or firewall scenarios.
Avoid RTM.

* * *

### Git-Native Issue Tracker Comparison

| Feature | git-bug | git-issue | tk (ticket) | Beads | git-appraise |
| --- | --- | --- | --- | --- | --- |
| Storage format | Git objects | Text files | Markdown+YAML | JSONL | Git refs |
| UI options | CLI/TUI/Web | CLI | CLI | N/A | CLI/Eclipse |
| GraphQL API | Yes | No | No | No | No |
| Bridges | GitHub/GitLab | GitHub/GitLab | No | No | No |
| AI-friendly | Medium | High | Very High | Very High | Medium |
| Complexity | High | Low | Low | Medium | Medium |
| Dependencies | Go runtime | Bash/Git | Bash only | SQLite | Go runtime |

**Strengths/Weaknesses Summary**:

- **git-bug**: Most feature-rich, excellent GraphQL API, multiple UIs.
  Best for complex projects.
  Learning curve higher.

- **git-issue**: Simplest, plain text files, transparent.
  Best for small teams.
  Limited querying capabilities.

- **tk (ticket)**: Optimized for AI agents, YAML frontmatter perfect for LLMs.
  Best for AI-driven workflows.
  Limited features.

- **Beads**: Innovative hybrid approach, local cache + git.
  Best for performance + git backup.
  Requires SQLite.

- **git-appraise**: Code review focus, structured schemas, separated refs.
  Best for review workflows.
  Not issue-focused.

* * *

### Multi-Agent Protocol Comparison

| Protocol | Transport | Best For | Maturity | Interop |
| --- | --- | --- | --- | --- |
| MCP | JSON-RPC | Client-server tools | Stable | Growing |
| ACP | REST/HTTP | Multimodal responses | Emerging | Limited |
| A2A | HTTP/SSE | P2P enterprise | Emerging | Growing |
| ANP | HTTP/DID | Decentralized networks | Early | Limited |

**Recommendation**: Implement A2A for agent coordination, consider MCP for tool
invocation interface.
Monitor ANP for future decentralized scenarios.

* * *

## Best Practices

### 1. GitHub Integration Best Practices

**Authentication**:

- Use GitHub App installation tokens (not personal access tokens)

- Implement token refresh logic (1-hour expiry)

- Use Octokit SDK to simplify token management

- Store private keys securely (environment variables, secrets manager)

**Webhooks**:

- Respond within 10 seconds (use async queues)

- Verify webhook signatures

- Implement idempotency (handle duplicate events)

- Use webhook secrets

- Log all webhook events for debugging

**API Usage**:

- Respect rate limits (check `X-RateLimit-*` headers)

- Use conditional requests (ETags) to save quota

- Implement exponential backoff for retries

- Use GraphQL for complex queries to reduce API calls

- Cache data when appropriate

* * *

### 2. Slack Integration Best Practices

**Connection Management**:

- Use Socket Mode for development, Events API for production

- Implement reconnection logic for WebSocket disconnections

- Handle rate limits gracefully (1 msg/sec for webhooks)

- Use Bolt framework to abstract complexity

**Security**:

- Never commit webhook URLs or tokens

- Verify request signatures

- Use app-level tokens for Socket Mode

- Rotate tokens regularly

- Monitor for leaked secrets

**User Experience**:

- Use Block Kit for rich message formatting

- Implement threading for related messages

- Use ephemeral messages for errors

- Add emoji reactions for status updates

- Support slash commands for common operations

* * *

### 3. Git-Native Storage Best Practices

**Data Format**:

- Use human-readable formats (Markdown, YAML)

- Include machine-readable metadata (YAML frontmatter, JSON)

- Version format specifications

- Support forward/backward compatibility

**Git Usage**:

- Use git refs/notes for non-file data (like git-bug)

- Separate concerns into different refs (like git-appraise)

- Include timestamps and authors in all data

- Use atomic git operations

- Handle merge conflicts gracefully

**Performance**:

- Consider local caching (SQLite) for queries

- Index frequently-queried fields

- Lazy-load large data structures

- Use git shallow clones for limited history

* * *

### 4. Multi-Agent Coordination Best Practices

**Architecture**:

- Choose appropriate orchestration pattern (centralized vs decentralized)

- Implement circuit breakers for agent failures

- Use hierarchical structure to reduce communication complexity

- Support both synchronous and asynchronous communication

**Communication**:

- Use standard protocols (JSON-RPC, REST, SSE)

- Include correlation IDs for request tracing

- Implement message versioning

- Add timeouts to all operations

- Log all inter-agent communication

**Reliability**:

- Implement retry logic with exponential backoff

- Handle partial failures gracefully

- Provide confidence scores for agent decisions

- Maintain audit trails

- Support human-in-the-loop for critical operations

**Interoperability**:

- Support standard agent protocols (A2A, MCP)

- Publish agent capability cards

- Use typed schemas for messages

- Document agent APIs

- Version all interfaces

* * *

## Open Research Questions

1. **How should TBD handle real-time synchronization conflicts?**

   - When GitHub issue and TBD task diverge during offline work

   - Conflict resolution strategies (last-write-wins vs manual merge)

   - Next steps: Prototype conflict detection and resolution UI

2. **What’s the optimal local cache strategy for TBD?**

   - SQLite like Beads vs in-memory vs no cache

   - Cache invalidation strategies

   - Performance vs storage tradeoffs

   - Next steps: Benchmark different approaches with realistic data

3. **How to implement agent capability discovery?**

   - Static agent cards vs dynamic capability queries

   - Centralized registry vs peer discovery

   - Next steps: Design agent registration and discovery system

4. **What authentication model for bridge agents?**

   - Per-user OAuth vs shared service account

   - Token storage and rotation

   - Security implications

   - Next steps: Security review and threat modeling

5. **How to handle webhook delivery failures?**

   - Retry logic and backoff strategies

   - Persistent queue vs in-memory

   - Dead letter queue for failed events

   - Next steps: Design failure handling architecture

6. **Should TBD support custom agent plugins?**

   - Plugin API design

   - Sandboxing and security

   - Discovery and installation

   - Next steps: Define plugin architecture requirements

* * *

## Recommendations

### Summary

For TBD bridge integrations, use modern, well-supported APIs and protocols:

- **GitHub**: REST API for CRUD, GraphQL for complex queries, webhooks for real-time
  updates

- **Slack**: Events API or Socket Mode (avoid RTM), Bolt framework for app development

- **Storage**: YAML frontmatter + Markdown (like tk) for human readability, with
  optional SQLite cache

- **Multi-agent**: A2A protocol for coordination, hierarchical orchestration pattern

### Recommended Approach

#### GitHub Bridge Architecture

1. **Authentication**: GitHub App with installation tokens

   - Use Octokit SDK for token management

   - Implement token refresh service

   - Store private key in secure vault

2. **API Layer**: Hybrid REST/GraphQL

   - REST for issue CRUD operations

   - GraphQL for bulk queries and complex relationships

   - Cache frequently-accessed data

3. **Webhook Handling**: Async queue processing

   - Receive webhook on endpoint

   - Validate signature

   - Queue for async processing

   - Respond within 10 seconds

   - Process event and sync to TBD

4. **Sync Strategy**: Bidirectional with conflict detection

   - GitHub → TBD: Real-time via webhooks

   - TBD → GitHub: On local commit

   - Detect conflicts, notify user for resolution

#### Slack Bridge Architecture

1. **Connection**: Socket Mode for development, Events API for production

   - Use Bolt framework (Python or JavaScript)

   - Handle reconnections gracefully

   - Implement rate limiting

2. **Event Handling**: Subscribe to relevant events

   - Message events for new issues/comments

   - User events for @mentions

   - File events for attachments

   - App events for lifecycle management

3. **Commands**: Slash commands for common operations

   - `/tbd create` - Create new task

   - `/tbd list` - List open tasks

   - `/tbd assign` - Assign task

   - `/tbd status` - Update task status

4. **Notifications**: Rich message formatting

   - Use Block Kit for structured messages

   - Thread related notifications

   - Add action buttons for common operations

   - Support ephemeral messages for errors

#### TBD Storage Format

**Recommended**: Hybrid approach inspired by tk and Beads

1. **Primary Storage**: Markdown files with YAML frontmatter

   ```markdown
   ---
   id: task-123
   title: Implement GitHub bridge
   status: in-progress
   assignee: @user
   created: 2026-01-08T10:00:00Z
   updated: 2026-01-08T15:30:00Z
   tags: [bridge, github, integration]
   ---
   
   # Description
   
   Implement bidirectional sync between TBD and GitHub Issues...
   
   # Discussion
   
   - Comment 1...
   - Comment 2...
   ```

2. **Optional Cache**: SQLite for performance

   - Index tasks by status, assignee, tags

   - Enable fast queries without parsing all files

   - Rebuild from git on startup

   - Invalidate on git pull

3. **Git Structure**: Use dedicated branch or refs

   - Option A: `.tbd/` directory on main branch

   - Option B: Separate `tbd-tasks` branch

   - Option C: Git refs like `refs/tbd/tasks` (like git-bug)

**Rationale**:

- Markdown + YAML is human-readable and AI-friendly

- Git native with full version history

- Optional cache doesn’t compromise git-native approach

- Flexible querying with cache, transparent without

#### Multi-Agent Coordination

**Recommended**: Hierarchical A2A with router pattern

1. **Agent Roles**:

   - **Router Agent**: Receives user requests, delegates to specialists

   - **GitHub Bridge Agent**: Handles GitHub sync

   - **Slack Bridge Agent**: Handles Slack notifications

   - **Git Agent**: Performs git operations

   - **Query Agent**: Handles search and reporting

2. **Communication Protocol**: A2A with JSON-RPC

   - Agent capability cards describe what each agent can do

   - Router consults cards to delegate tasks

   - Agents communicate via JSON-RPC messages

   - Correlation IDs for request tracing

3. **Orchestration**: Event-driven with pub-sub

   - Central event bus for agent coordination

   - Agents subscribe to relevant event types

   - Loose coupling between agents

   - Easy to add new agents

4. **Reliability**: Human-in-the-loop for critical operations

   - Agent proposes changes

   - User reviews and approves

   - Audit log of all operations

   - Rollback capability

**Rationale**:

- A2A is emerging standard for enterprise multi-agent systems

- Hierarchical reduces communication complexity

- Pub-sub enables loose coupling

- Human-in-the-loop ensures control and auditability

### Alternative Approaches

#### Alternative 1: Centralized Server Architecture

**When Appropriate**:

- Team needs web UI for task management

- Real-time collaboration is priority

- Complex querying requirements

**Tradeoffs**:

- ❌ Loses git-native benefits

- ❌ Requires server infrastructure

- ✅ Easier real-time sync

- ✅ Better performance for large datasets

#### Alternative 2: Pure Git Objects (like git-bug)

**When Appropriate**:

- Deeply technical users

- No need for human readability

- Want cleanest git history

**Tradeoffs**:

- ❌ Less human-readable

- ❌ Harder to edit manually

- ✅ Cleanest git approach

- ✅ Better separation from codebase

#### Alternative 3: Monolithic Agent vs Multi-Agent

**When Appropriate**:

- Simple use cases

- Small team

- Limited bridge requirements

**Tradeoffs**:

- ❌ Less scalable

- ❌ Harder to extend

- ✅ Simpler architecture

- ✅ Faster initial development

* * *

## References

### GitHub Documentation

- [GitHub REST API Documentation](https://docs.github.com/en/rest)

- [REST API endpoints for issues](https://docs.github.com/en/rest/issues)

- [GitHub GraphQL API Documentation](https://docs.github.com/en/graphql/reference/queries)

- [GraphQL Changelog](https://docs.github.com/en/graphql/overview/changelog)

- [Webhooks Documentation](https://docs.github.com/en/webhooks)

- [About Webhooks](https://docs.github.com/en/webhooks/about-webhooks)

- [Creating Webhooks](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks)

- [Webhook Events and Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)

- [GitHub App Authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/about-authentication-with-a-github-app)

- [Generating Installation Access Tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

- [Choosing Permissions for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)

- [Using Webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)

### Slack Documentation

- [Slack Events API](https://docs.slack.dev/apis/events-api/)

- [Events API Types](https://api.slack.com/events)

- [Using Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)

- [Socket Mode Python SDK](https://docs.slack.dev/tools/python-slack-sdk/socket-mode/)

- [Socket Mode Node.js SDK](https://slack.dev/node-slack-sdk/socket-mode/)

- [Comparing HTTP & Socket Mode](https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/)

- [Legacy RTM API](https://api.slack.com/rtm)

- [Incoming Webhooks](https://api.slack.com/messaging/webhooks)

- [Bolt for Python](https://docs.slack.dev/tools/bolt-python/)

- [Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/)

### Git-Native Issue Trackers

- [git-bug GitHub Repository](https://github.com/git-bug/git-bug)

- [git-issue GitHub Repository](https://github.com/dspinellis/git-issue)

- [tk (ticket) GitHub Repository](https://github.com/wedow/ticket)

- [Beads Blog Post](https://aibit.im/blog/post/beads-elevate-your-ai-agent-s-memory-with-git-backed-issue-tracking)

- [git-appraise GitHub Repository](https://github.com/google/git-appraise)

- [git-appraise Tutorial](https://github.com/google/git-appraise/blob/master/docs/tutorial.md)

### Multi-Agent Systems

- [Google’s Eight Essential Multi-Agent Design Patterns (InfoQ)](https://www.infoq.com/news/2026/01/multi-agent-design-patterns/)

- [A2A Protocol Explained](https://onereach.ai/blog/what-is-a2a-agent-to-agent-protocol/)

- [Top 5 Open Protocols for Multi-Agent AI Systems](https://onereach.ai/blog/power-of-multi-agent-ai-open-protocols/)

- [Agent Communication Protocols Survey (arXiv)](https://arxiv.org/html/2505.02279v1)

- [AWS Agent-to-Agent Protocols Guide](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-frameworks/agent-to-agent-protocols.html)

- [Agent Communication Protocols (DigitalOcean)](https://www.digitalocean.com/community/tutorials/agent-communication-protocols-explained)

- [8 Best Multi-Agent AI Frameworks for 2026](https://www.multimodal.dev/post/best-multi-agent-ai-frameworks)

- [7 Agentic AI Trends to Watch in 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)

- [AI Agent Orchestration Guide](https://kanerika.com/blogs/ai-agent-orchestration/)

* * *

## Appendices

### Appendix A: GitHub Webhook Event Types

**Repository Events**:

- `push` - Code pushed to repository

- `pull_request` - PR opened, closed, reopened, edited

- `pull_request_review` - PR review submitted

- `pull_request_review_comment` - Comment on PR review

**Issue Events**:

- `issues` - Issue opened, closed, edited, assigned, etc.

- `issue_comment` - Comment on issue or PR

- `label` - Label created, edited, deleted

- `milestone` - Milestone created, edited, deleted

**Workflow Events**:

- `workflow_run` - GitHub Actions workflow run

- `check_suite` - Check suite completed

- `check_run` - Check run completed

- `status` - Commit status updated

**App Events**:

- `installation` - App installed or uninstalled

- `installation_repositories` - Repo added/removed from installation

- `app_authorization` - User authorization revoked

### Appendix B: Slack Event Types

**Message Events**:

- `message.channels` - Message posted to public channel

- `message.groups` - Message posted to private channel

- `message.im` - Direct message posted

- `message.mpim` - Group DM message posted

**User Events**:

- `user_change` - User profile changed

- `team_join` - New user joined workspace

- `presence_change` - User presence changed

**Channel Events**:

- `channel_created` - Channel created

- `channel_rename` - Channel renamed

- `channel_archive` - Channel archived

- `member_joined_channel` - User joined channel

**App Events**:

- `app_mention` - App mentioned in message

- `app_home_opened` - User opened app home tab

- `app_uninstalled` - App uninstalled from workspace

**File Events**:

- `file_created` - File uploaded

- `file_shared` - File shared

- `file_deleted` - File deleted

### Appendix C: Example Agent Capability Card (A2A Protocol)

```json
{
  "agent_id": "github-bridge-agent",
  "name": "GitHub Bridge Agent",
  "version": "1.0.0",
  "description": "Synchronizes TBD tasks with GitHub Issues",
  "capabilities": [
    {
      "name": "sync_task_to_github",
      "description": "Create or update GitHub issue from TBD task",
      "input_schema": {
        "type": "object",
        "properties": {
          "task_id": { "type": "string" },
          "repository": { "type": "string" },
          "issue_number": { "type": "integer", "optional": true }
        },
        "required": ["task_id", "repository"]
      },
      "output_schema": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "issue_number": { "type": "integer" },
          "issue_url": { "type": "string" }
        }
      }
    },
    {
      "name": "sync_github_to_task",
      "description": "Create or update TBD task from GitHub issue",
      "input_schema": {
        "type": "object",
        "properties": {
          "repository": { "type": "string" },
          "issue_number": { "type": "integer" }
        },
        "required": ["repository", "issue_number"]
      },
      "output_schema": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "task_id": { "type": "string" },
          "task_path": { "type": "string" }
        }
      }
    }
  ],
  "supported_protocols": ["a2a", "jsonrpc"],
  "endpoint": "http://localhost:8080/agents/github-bridge",
  "authentication": {
    "type": "bearer_token",
    "token_endpoint": "/auth/token"
  }
}
```

### Appendix D: Example TBD Task Format

````markdown
---
id: tbd-2026-001
title: Implement GitHub webhook handler
status: in-progress
priority: high
assignee: @alice
created: 2026-01-08T10:00:00Z
updated: 2026-01-08T15:30:00Z
tags: [bridge, github, webhook, integration]
github_issue: owner/repo#123
slack_thread: C123456/p1234567890
dependencies:
  - tbd-2026-002
related:
  - tbd-2025-050
---

# Description

Implement webhook handler to receive real-time updates from GitHub Issues API. Handler should:

- Validate webhook signature
- Queue event for async processing
- Respond within 10 seconds
- Support all relevant event types

# Acceptance Criteria

- [ ] Webhook endpoint receives and validates events
- [ ] Signature verification implemented
- [ ] Async queue processing in place
- [ ] Response time < 5 seconds
- [ ] All issue events handled (created, updated, closed, etc.)
- [ ] Integration tests passing
- [ ] Deployment documentation updated

# Discussion

**@alice** (2026-01-08 10:15):
Starting with webhook validation. Using GitHub's signature verification approach with HMAC-SHA256.

**@bob** (2026-01-08 12:30):
Consider using Redis for the async queue. We already have it for other services.

**@alice** (2026-01-08 13:00):
Good idea. Will use Bull queue library with Redis backend.

# Technical Notes

## Webhook Signature Verification

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```
````

## Event Processing Flow

1. Receive webhook POST

2. Verify signature

3. Add to queue with correlation ID

4. Return 200 OK

5. Worker processes event async

6. Update TBD task

7. Log result

# Links

- GitHub Issue: https://github.com/owner/repo/issues/123

- Slack Thread: https://workspace.slack.com/archives/C123456/p1234567890

- Design Doc: /docs/project/architecture/github-bridge.md

- API Docs: https://docs.github.com/en/webhooks

```
```
