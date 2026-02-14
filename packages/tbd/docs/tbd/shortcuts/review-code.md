---
title: Review Code
description: Comprehensive code review for uncommitted changes, branch work, or GitHub PRs
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This is the **core code review** shortcut.
It performs a comprehensive review of code changes using all general and
language-specific guidelines.

## Scope Options

This shortcut supports three review scopes:

| Scope | What it reviews | How diff is obtained |
| --- | --- | --- |
| **Uncommitted changes** | Staged + unstaged local changes | `git diff` + `git diff --cached` |
| **Branch work** | All commits ahead of target + uncommitted | `git diff <target>...HEAD` + uncommitted |
| **GitHub PR** | Changes in a pull request | `gh pr diff <PR>` |

For **GitHub PR** reviews with follow-up actions (commenting, CI checks), use
`tbd shortcut review-github-pr` instead—it wraps this shortcut and adds GitHub workflow.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Determine scope:**
   - If the user specified a scope, use it
   - If reviewing for precommit, use **Uncommitted changes**
   - If a PR number/URL was provided, use **GitHub PR**
   - Otherwise, ask the user which scope to review

2. **Get the diff:**
   - **Uncommitted changes:**
     ```bash
     git diff          # Unstaged changes
     git diff --cached # Staged changes
     ```
   - **Branch work** (default target: `origin/main`):
     ```bash
     git fetch origin main
     git diff origin/main...HEAD  # Committed changes on this branch
     git diff                     # Plus unstaged changes
     git diff --cached            # Plus staged changes
     ```
   - **GitHub PR:**
     ```bash
     REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
     gh pr diff <PR_NUMBER> --repo $REPO
     ```

3. **Identify files and languages:**

   - List the files changed
   - Note which languages are present (TypeScript, Python, etc.)

4. **Load general guidelines:**

   - Run `tbd guidelines general-coding-rules`
   - Run `tbd guidelines general-comment-rules`
   - Run `tbd guidelines error-handling-rules`
   - If reviewing test code, also run `tbd guidelines general-testing-rules`

5. **Load language-specific rules based on files changed:**

   - For TypeScript/JavaScript files: `tbd guidelines typescript-rules`
   - For Python files: `tbd guidelines python-rules`
   - Load both if changes contain both languages

6. **Perform comprehensive senior engineering review:**

   - Assess overall design, architecture, and maintainability and if there are alternate
     significantly better approaches
   - Suggest use of additional libraries or tools that are appropriate
   - Check adherence to general coding rules
   - Verify comment quality and appropriateness
   - Check error handling patterns
   - Apply language-specific best practices
   - Call out antipatterns and code smells, especially code duplication or quick hacks
   - Look for security issues (injection, XSS, etc.)

7. **Check documentation consistency:**

   - If changes affect behavior documented in specs (`docs/project/specs/active/`), note
     any needed updates
   - If changes affect `docs/development.md`, note any needed updates
   - If changes affect architecture (`docs/project/architecture/`), note any needed
     updates

8. **Compile the review:**

   Write a structured review with:

   - **Summary**: Brief assessment (1-2 sentences)
   - **Design assessment**: Review architecture and pros/cons/alternatives, how this
     design fits relative to other possible approaches, its strengths and weaknesses
     relative to alternatives
   - **Issues**: Problems found, with `file:line` references and suggested fixes
   - **Suggestions**: Optional improvements (not blockers)
   - **Documentation**: Any docs that need updating

9. **Determine next action:**

   - If the user specified what to do next, follow those instructions
   - If this is a precommit review, proceed to fix any issues found
   - Otherwise, present the review and ask:
     - **Fix issues**: Create tbd beads for issues and begin fixing
     - **Report only**: Just output the review (no changes)
