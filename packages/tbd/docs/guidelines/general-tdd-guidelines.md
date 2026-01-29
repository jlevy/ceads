---
title: TDD Guidelines
description: Test-Driven Development methodology and best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Test-Driven Development (TDD) Guidelines

## Core Development Principles

- Run Red -> Green -> Refactor in small slices.
- Start with the simplest failing test that describes behavior.
- Write only the code needed to pass; defer polish until Green.
- Separate structural vs behavioral work; tidy first when both are needed.
- Keep quality high at every step; avoid speculative work.

## TDD Methodology

- Write one failing test at a time; keep the failure clear and specific.
- Name tests by observable behavior (e.g., `should_sum_two_positive_numbers`).
- Prefer state-based assertions; only mock external boundaries.
- Keep tests fast, deterministic, and isolated (no real time, network, randomness).
- Minimize test setup; use simple helpers/builders when they improve clarity.
- When a test passes, refactor code and tests to remove duplication and reveal intent.
- Grow functionality by adding the next smallest behavior-focused test.

## Tidy First Approach

- Structural change: only reshape code (rename, extract, move) without altering
  behavior.
- Behavioral change: add or modify functionality.
- Do not mix structural and behavioral changes in one commit.
- When both are needed, tidy first, then implement behavior; run tests before and after.

## Commit Discipline

- Commit only when all tests pass and linters are clean.
- Each commit should be a single logical unit; prefer small, frequent commits.
- State in the message whether the commit is structural or behavioral.

## Code Quality Standards

- Remove duplication aggressively in both code and tests.
- Make intent obvious through naming and small, focused functions.
- Keep dependencies explicit; prefer pure functions where practical.
- Use the simplest solution that works; avoid premature abstractions.
- Keep side effects contained at boundaries.

## Refactoring Guidelines

- Refactor only in Green; keep steps reversible.
- Apply one refactoring at a time, with known patterns when appropriate.
- Re-run tests after each refactor and resolve errors or ambiguities.
- Prioritize refactors that simplify design, clarify intent, or remove duplication.
