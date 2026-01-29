---
title: Review Code (TypeScript)
description: Perform a code review for TypeScript code following best practices
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

2. Review the TypeScript rules and guidelines:
   - Run `tbd guidelines typescript-rules` for language-specific rules
   - Run `tbd guidelines general-coding-rules` for general rules

3. Check for common TypeScript issues:
   - [ ] Types are properly defined (avoid `any` unless necessary)
   - [ ] Interfaces/types are used for complex objects
   - [ ] Null/undefined handled properly (strict null checks)
   - [ ] Async/await used correctly (no floating promises)
   - [ ] Error handling is appropriate
   - [ ] No unused imports or variables

4. Check for code quality:
   - [ ] Functions are small and focused
   - [ ] Names are descriptive and consistent
   - [ ] Comments explain “why” not “what”
   - [ ] No code duplication
   - [ ] Appropriate use of TypeScript features

5. Check for security issues:
   - [ ] No hardcoded secrets or credentials
   - [ ] Input validation where needed
   - [ ] Safe handling of user data

6. Summarize findings:
   - List issues found (if any) with file:line references
   - Suggest specific fixes
   - Note any patterns that should be addressed
