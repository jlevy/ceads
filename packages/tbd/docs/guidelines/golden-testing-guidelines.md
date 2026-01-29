---
title: Golden Testing Guidelines
description: Guidelines for implementing golden/snapshot testing for complex systems
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Golden Testing Guidelines

## TL;DR

- Define a session schema (events) with stable vs unstable fields.
- Capture full execution for scenarios (inputs, outputs, side effects) as YAML.
- Normalize or remove unstable fields at serialization time.
- Provide a mock mode for all nondeterminism and slow dependencies.
- Add a CLI to run scenarios, update goldens, and print diffs.
- Keep scenarios few but end-to-end; tests must run fast in CI (<100ms each).
- Prefer many small artifacts (shard by scenario/phase) over monolithic traces.
- Layer domain-focused assertions alongside raw diffs for critical invariants.
- Review and commit session files with code; treat them as behavioral specs.

## When to Use Golden Tests

Golden session testing excels for complex systems where writing and maintaining hundreds
of unit or integration tests is burdensome.
Traditional unit tests struggle to capture the full behavior of systems with many
interacting components, non-deterministic outputs, and complex state transitions.

## Core Principles

### 1. Model Events Formally

All events should be modeled with type-safe schemas (Zod, Pydantic, TypeScript
interfaces). Events are serialized to YAML for human readability.

### 2. Classify Fields as Stable or Unstable

- **Stable**: Deterministic values that must match exactly (symbols, actions,
  quantities)
- **Unstable**: Non-deterministic values filtered during comparison (timestamps, IDs)

Filter unstable fields before writing session files by replacing with placeholders like
`"[TIMESTAMP]"` or omitting entirely.

### 3. Use Switchable Mock Modes

- **Live mode**: Calls real external services for debugging and updating golden files
- **Mocked mode**: Uses recorded/stubbed responses for fast, deterministic CI

### 4. Design for Fast CI

Golden tests should run in under 100ms per scenario:
- Run in mocked mode (no network, no external services)
- Use in-memory mocks over file-based fixtures
- Parallelize independent scenarios
- Cache expensive setup

## Do / Don’t

- Do capture full payloads and side effects that influence behavior.
- Do normalize/remap unstable values at write time, not in comparisons.
- Do keep scenarios few, representative, and fast.
- Do prefer many small artifacts over monolithic traces.
- Don’t depend on real clocks, random, network, or database in CI.
- Don’t hide differences with overly broad placeholders.
- Don’t fork logic for tests vs production; share code paths.
- Don’t let artifacts grow unbounded.

## Common Pitfalls

- Missing unstable field classification -> flaky diffs.
- File I/O captured without contents/checksums -> silent regressions.
- Slow or network-bound scenarios -> skipped in practice, regressions leak.
- LLM output not recorded or scrubbed -> non-deterministic sessions.
- Monolithic traces that grow unbounded -> hard to review, slow to diff.
