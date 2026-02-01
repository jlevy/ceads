---
title: Review Code (Python)
description: Python-focused code review (language-specific rules only)
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **Python-focused** code review, checking Python-specific best
practices, patterns, and antipatterns.

For a **comprehensive review** that includes general coding rules, error handling,
comment quality, and testing practices, use `tbd shortcut review-code` instead.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the code to review:
   - If changes are staged, review `git diff --cached`
   - If changes are unstaged, review `git diff`
   - Or review specific files the user mentions

2. Load Python guidelines:
   - Run `tbd guidelines python-rules`

3. Perform a Python-focused review:
   - Check Python-specific patterns: type hints, naming conventions, imports
   - Verify proper use of Python features (decorators, context managers, comprehensions)
   - Identify Python antipatterns (mutable defaults, bare excepts, global state)
   - Assess Pythonic idioms and PEP compliance

4. Summarize findings:
   - List Python-specific issues found (if any) with file:line references
   - Suggest specific fixes
   - Note any Python patterns that should be addressed
