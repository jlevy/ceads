---
title: General Comment Rules
description: Language-agnostic rules for writing clean, maintainable comments
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# General Comment Rules

## Comment Usage

- Keep all comments concise and clear and suitable for inclusion in final production.

- DO use comments whenever the intent of a given piece of code is subtle or confusing or
  avoids a bug or is not obvious from the code itself.

- DO NOT repeat in comments what is obvious from the names of functions or variables or
  types.

- DO NOT make any other obvious comments that duplicate messages, such as a comment that
  repeats what is in a log message.

- DO NOT include comments that reflect what you did, such as “Added this function” as
  this is meaningless to anyone reading the code later.

- DO NOT use fancy or needlessly decorated headings like “===== MIGRATION TOOLS =====”
  in comments.

- DO NOT number steps in comments.
  These are hard to maintain if the code changes.
  NEVER: “// Step 3: Fetch the data from the cache” OK: “// Now fetch the data from the
  cache”

- DO NOT use emojis or special unicode characters like ① or • or – or — in comments.

- DO NOT leave comments about code changes that have been completed.

- DO NOT put values of constants in comments (redundant and clutters the code).

- DO NOT leave straggling comments that refer to past implementations or refactors.

## Comment Syntax

- Use appropriate syntax for IDE-compatible comments whenever possible, e.g. TypeScript,
  prefer `/** ... */` comments wherever appropriate on variables, functions, methods,
  and at the top of files.

- See language-specific comment rules for more details.
