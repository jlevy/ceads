---
title: Architecture Doc Template
description: Template for architecture documents
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Architecture: [Component/System Name]

**Date:** YYYY-MM-DD (last updated YYYY-MM-DD)

**Author:** [Name]

**Status:** Draft | In Review | Approved

## Overview

High-level description of what this architecture covers.

## Goals and Non-Goals

### Goals

- Goal 1
- Goal 2

### Non-Goals

- Non-goal 1
- Non-goal 2

## System Context

How this component fits into the larger system.

```
[Diagram placeholder - describe the system context]
```

## Design

### Components

#### Component 1

**Responsibility:** What this component does.

**Interfaces:** How other components interact with it.

#### Component 2

**Responsibility:** What this component does.

**Interfaces:** How other components interact with it.

### Data Flow

How data moves through the system.

```
[Diagram placeholder - describe the data flow]
```

### Data Model

Key data structures and their relationships.

### Interfaces

#### External APIs

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/example` | GET | Description |

#### Internal Interfaces

Key internal contracts between components.

## Trade-offs and Alternatives

### Decision 1: [Description]

**Chosen approach:** What we decided.

**Alternatives considered:**
- Alternative A: Why rejected
- Alternative B: Why rejected

**Rationale:** Why we chose this approach.

## Security Considerations

- Authentication approach
- Authorization model
- Data protection measures

## Operational Concerns

### Monitoring

What metrics and alerts are needed.

### Logging

What should be logged and at what level.

### Deployment

How this component is deployed.

### Scaling

How this component scales under load.

## Open Questions

- Question 1?
- Question 2?

## References

- [Related doc](url)
- [External reference](url)
