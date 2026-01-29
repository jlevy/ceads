---
title: Review Code (Python)
description: Perform a code review for Python code following best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the code to review:
   - If changes are staged, review `git diff --cached`
   - If changes are unstaged, review `git diff`
   - Or review specific files the user mentions

2. Review the Python rules and guidelines:
   - Run `tbd guidelines python-rules` for language-specific rules
   - Run `tbd guidelines general-coding-rules` for general rules

3. Check for common Python issues:
   - [ ] Type hints are used for function signatures
   - [ ] Docstrings follow conventions (Google/NumPy style)
   - [ ] Exception handling is appropriate (not bare except)
   - [ ] Context managers used for resources (with statements)
   - [ ] No mutable default arguments
   - [ ] Imports are organized (stdlib, third-party, local)

4. Check for code quality:
   - [ ] Functions are small and focused
   - [ ] Names follow PEP 8 conventions
   - [ ] No code duplication
   - [ ] Appropriate use of Python idioms
   - [ ] List comprehensions used where appropriate

5. Check for security issues:
   - [ ] No hardcoded secrets or credentials
   - [ ] Input validation where needed
   - [ ] Safe handling of user data
   - [ ] No use of eval() or exec() with untrusted input

6. Summarize findings:
   - List issues found (if any) with file:line references
   - Suggest specific fixes
   - Note any patterns that should be addressed
