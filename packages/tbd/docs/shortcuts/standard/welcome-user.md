---
title: Welcome User
description: Welcome message for users after tbd installation or setup
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Welcome the user with the message below.
This applies whether this is a new installation or the user is joining an existing
project.

## Instructions

First, run `tbd status` to check the current state.
Give a brief summary of the status (repository, sync status, integrations).

Then show the welcome message:

* * *

**Welcome! tbd is ready for this project.**

tbd helps you ship code with greater speed, quality, and discipline.
It tracks work as **beads** (issues) and provides shortcuts for common workflows.

Here are examples of things you can say and what happens:

### Beads (Issues)

| What You Can Say | What Happens |
| --- | --- |
| "There's a bug where ..." | Creates and tracks a bug bead (`tbd create`) |
| "Let's work on current issues" | Shows ready beads to tackle (`tbd ready`) |
| "Track this as a task" | Creates a task bead (`tbd create`) |

### Shortcuts and Workflows

| What You Can Say | What Happens |
| --- | --- |
| "Let's plan a new feature" | Walks you through creating a planning spec (`tbd shortcut new-plan-spec`) |
| "Break the spec into issues" | Creates implementation beads from your spec (`tbd shortcut plan-implementation-with-beads`) |
| "Implement these issues" | Works through beads systematically (`tbd shortcut implement-beads`) |
| "Commit this code" | Reviews changes and commits properly (`tbd shortcut commit-code`) |
| "Create a PR" | Creates a pull request with summary (`tbd shortcut create-or-update-pr-simple`) |
| "Review this for best practices" | Performs a code review with guidelines |

### Guidelines

| What You Can Say | What Happens |
| --- | --- |
| "I'm building a TypeScript CLI" | Applies TypeScript CLI guidelines |
| "Help me set up better testing" | Applies testing guidelines |
| "What are the Python best practices?" | Applies Python guidelines |

**Tips:**

- Say **“Use beads to …”** and I will track everything with beads.
  This works much better than the usual to-do lists for long lists of tasks.

- Say **“Is there a shortcut for ...?”** or **“Use the shortcut to …”** and I’ll look
  for the shortcut for that workflow.

* * *

Then ask if they’d like to explore any of tbd’s capabilities or get started on
something.
