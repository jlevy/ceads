---
title: Review Code (TypeScript)
description: TypeScript-focused code review (language-specific rules only)
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **TypeScript-focused** code review, checking
TypeScript-specific best practices, patterns, and antipatterns.

For a **comprehensive review** that includes general coding rules, error handling,
comment quality, and testing practices, use `tbd shortcut review-code` instead.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Identify the code to review:
   - If changes are staged, review `git diff --cached`
   - If changes are unstaged, review `git diff`
   - Or review specific files the user mentions

2. Load TypeScript guidelines:
   - Run `tbd guidelines typescript-rules`

3. Perform a TypeScript-focused review:
   - Check TypeScript-specific patterns: types, generics, inference, null safety
   - Verify proper use of TypeScript features (interfaces, enums, utility types)
   - Identify TypeScript antipatterns (any abuse, type assertions, missing types)
   - Assess type safety and strictness

4. Summarize findings:
   - List TypeScript-specific issues found (if any) with file:line references
   - Suggest specific fixes
   - Note any TypeScript patterns that should be addressed
